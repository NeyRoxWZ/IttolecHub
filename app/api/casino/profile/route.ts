import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ACHIEVEMENTS } from '@/lib/casino/meta';
import { levelFromXp } from '@/lib/casino/progression';
import { COSMETICS, cosmeticById } from '@/lib/casino/cosmetics';
import { SHOWCASE_SLOTS } from '@/lib/casino/social';

/**
 * The display case, filtered through what is actually owned.
 *
 * A piece can leave an inventory — a reset, a cosmetic pulled from rotation —
 * and a showcase that kept pointing at it would render an empty frame with no
 * way to clear it.
 */
function showcaseOf(raw: unknown, owned: Set<string>) {
  const ids = Array.isArray(raw) ? (raw as string[]) : [];
  return ids
    .filter((id) => owned.has(id))
    .map((id) => cosmeticById(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .slice(0, SHOWCASE_SLOTS)
    .map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, slot: c.slot, params: c.params }));
}

/**
 * Everything the profile page shows about the casino. Read straight from the
 * wallet row rather than reconstructed client-side from a save blob, which is
 * how the old profile ended up printing zeroes.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const [{ data: wallet }, { data: unlocked }, { data: inv }] = await Promise.all([
      supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('casino_achievements_unlocked').select('achievement_id').eq('user_id', userId),
      supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
    ]);

    if (!wallet) return NextResponse.json({ error: 'Aucune partie' }, { status: 404 });

    const { level, intoLevel, needed } = levelFromXp(Number(wallet.xp || 0));
    const owned = new Set((inv || []).map((r) => r.item_id));
    const cosmetics = (inv || []).filter((r) => cosmeticById(r.item_id)).length;

    return NextResponse.json({
      balance: Number(wallet.balance || 0),
      totalWagered: Number(wallet.total_wagered || 0),
      totalWon: Number(wallet.total_won || 0),
      betsPlaced: Number(wallet.bets_placed || 0),
      winsCount: Number(wallet.wins_count || 0),
      bestStreak: Number(wallet.best_streak || 0),
      biggestMultiplier: Number(wallet.biggest_multiplier || 0),
      biggestWin: Number(wallet.biggest_win || 0),
      allTimeBestBalance: Number(wallet.all_time_best_balance || 0),
      level,
      xp: Number(wallet.xp || 0),
      xpIntoLevel: intoLevel,
      xpForNext: needed,
      prestigeCount: Number(wallet.prestige_count || 0),
      jackpotsWon: Number(wallet.jackpots_won || 0),
      missionsDone: Number(wallet.missions_done || 0),
      dailyStreak: Number(wallet.daily_streak || 0),
      achievements: (unlocked || []).length,
      achievementsTotal: ACHIEVEMENTS.length,
      cosmetics,
      cosmeticsTotal: COSMETICS.length,
      /** The pieces this player chose to put on display, in their order. */
      showcase: showcaseOf(wallet.showcase, owned),
      showcaseSlots: SHOWCASE_SLOTS,
    });
  } catch (err) {
    console.error('Erreur GET profil casino:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Saves the display case. Only pieces the player owns are accepted. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const wanted: string[] = Array.isArray(body?.showcase) ? body.showcase.slice(0, SHOWCASE_SLOTS) : [];

    const { data: inv } = await supabase.from('casino_inventory').select('item_id').eq('user_id', userId);
    const owned = new Set((inv || []).map((r) => r.item_id));
    const clean = wanted.filter((id) => owned.has(id) && cosmeticById(id));

    const { data: saved } = await supabase.from('casino_wallets')
      .update({ showcase: clean }).eq('user_id', userId).select('showcase').maybeSingle();
    if (!saved) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    return NextResponse.json({ ok: true, showcase: clean });
  } catch (err) {
    console.error('Erreur POST vitrine:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
