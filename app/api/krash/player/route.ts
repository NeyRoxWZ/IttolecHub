import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { isKrashCosmetic } from '@/lib/krash/cosmetics';
import { krashPassPeriod } from '@/lib/krash/pass';

export const dynamic = 'force-dynamic';

/**
 * A player's public Krash card: headline numbers, equipped title and emblem,
 * and the curve of their Krash balance over their last few hundred moves.
 * Read with the service key because the ledger itself has no public policy.
 */
export async function GET(request: Request) {
  try {
    const pseudo = new URL(request.url).searchParams.get('pseudo');
    if (!pseudo) return NextResponse.json({ error: 'pseudo requis' }, { status: 400 });

    const { data: user } = await supabase.from('users').select('id, pseudo').eq('pseudo', pseudo).maybeSingle();
    if (!user) return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });

    const [{ data: wallet }, { data: stats }, { data: rows }, { data: inv }, { data: loadout }, { data: pass }] = await Promise.all([
      supabase.from('krash_wallets').select('balance, best_balance').eq('user_id', user.id).maybeSingle(),
      supabase.from('krash_stats').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('krash_ledger').select('kind, amount, balance_after, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(300),
      supabase.from('krash_inventory').select('item_id').eq('user_id', user.id),
      supabase.from('krash_loadout').select('slot, cosmetic_id').eq('user_id', user.id),
      supabase.from('krash_pass').select('tier').eq('user_id', user.id).eq('period_key', krashPassPeriod()).maybeSingle(),
    ]);

    if (!wallet) return NextResponse.json({ error: 'Pas encore joué à Krash' }, { status: 404 });

    const equipped = Object.fromEntries((loadout || []).map((l) => [l.slot, l.cosmetic_id]));

    return NextResponse.json({
      pseudo: user.pseudo,
      balance: Number(wallet.balance),
      bestBalance: Number(wallet.best_balance),
      trades: Number(stats?.trades ?? 0),
      wins: Number(stats?.wins ?? 0),
      liquidations: Number(stats?.liquidations ?? 0),
      realizedPnl: Number(stats?.realized_pnl ?? 0),
      volume: Number(stats?.volume ?? 0),
      bestTrade: Number(stats?.best_trade ?? 0),
      cosmetics: (inv || []).filter((r) => isKrashCosmetic(r.item_id)).length,
      passTier: Number(pass?.tier ?? 0),
      title: equipped.title ?? null,
      emblem: equipped.emblem ?? null,
      // Oldest first, so the curve reads left to right.
      points: (rows || []).slice().reverse().map((r) => ({
        t: r.created_at, balance: Number(r.balance_after), amount: Number(r.amount), kind: r.kind,
      })),
    });
  } catch (err) {
    console.error('Fiche joueur Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
