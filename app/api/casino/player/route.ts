import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ACHIEVEMENTS } from '@/lib/casino/meta';
import { cosmeticById } from '@/lib/casino/cosmetics';

/**
 * One player's public card: their headline numbers and the curve of their
 * balance over their last few hundred settled moves.
 *
 * Read with the service key rather than from the client, because
 * `casino_transactions` has no read policy — it is the full personal ledger,
 * and only this shape of it is meant to be public.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pseudo = searchParams.get('pseudo');
    if (!pseudo) return NextResponse.json({ error: 'pseudo requis' }, { status: 400 });

    const { data: user } = await supabase.from('users').select('id, pseudo').eq('pseudo', pseudo).maybeSingle();
    if (!user) return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });

    const [{ data: wallet }, { data: rows }, { data: unlocked }, { data: inv }] = await Promise.all([
      supabase.from('casino_wallets').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('casino_transactions')
        .select('amount, balance_after, type, game_slug, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase.from('casino_achievements_unlocked').select('achievement_id').eq('user_id', user.id),
      supabase.from('casino_inventory').select('item_id').eq('user_id', user.id),
    ]);

    if (!wallet) return NextResponse.json({ error: 'Aucune partie' }, { status: 404 });

    // Oldest first, so the curve reads left to right.
    const points = (rows || []).slice().reverse().map((r) => ({
      t: r.created_at,
      balance: Number(r.balance_after),
      amount: Number(r.amount),
      game: r.game_slug,
      type: r.type,
    }));

    return NextResponse.json({
      pseudo: user.pseudo,
      balance: Number(wallet.balance || 0),
      totalWagered: Number(wallet.total_wagered || 0),
      totalWon: Number(wallet.total_won || 0),
      bestStreak: Number(wallet.best_streak || 0),
      biggestWin: Number(wallet.biggest_win || 0),
      biggestMultiplier: Number(wallet.biggest_multiplier || 0),
      prestigeCount: Number(wallet.prestige_count || 0),
      allTimeBestBalance: Number(wallet.all_time_best_balance || 0),
      achievements: (unlocked || []).length,
      achievementsTotal: ACHIEVEMENTS.length,
      cosmetics: (inv || []).filter((r) => cosmeticById(r.item_id)).length,
      points,
    });
  } catch (err) {
    console.error('Erreur GET joueur:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
