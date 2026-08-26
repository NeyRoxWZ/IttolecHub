import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ACHIEVEMENTS, achievementReward } from '@/lib/casino/meta';
import { checkAchievements, statsFromWallet, withCollectionStats } from '@/lib/casino/metaProgression.server';

/**
 * The list plus the player's stats. Opening the page also runs a check, so
 * anything earned through a path that doesn't settle a bet (a crate, a pass
 * reward) shows up as unlocked rather than sitting there silently completed.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    const list = ACHIEVEMENTS.map((a) => ({
      id: a.id, name: a.name, description: a.description,
      category: a.category, points: a.points, reward: achievementReward(a.points),
    }));

    if (!userId) return NextResponse.json({ achievements: list, unlocked: [], points: 0, stats: null });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ achievements: list, unlocked: [], points: 0, stats: null });

    const stats = await withCollectionStats(userId, statsFromWallet(wallet));
    await checkAchievements(userId, stats);

    const { data: unlocked } = await supabase.from('casino_achievements_unlocked')
      .select('achievement_id, unlocked_at').eq('user_id', userId);

    return NextResponse.json({
      achievements: list,
      unlocked: (unlocked || []).map((u) => u.achievement_id),
      points: ACHIEVEMENTS
        .filter((a) => (unlocked || []).some((u) => u.achievement_id === a.id))
        .reduce((sum, a) => sum + a.points, 0),
      stats,
    });
  } catch (err) {
    console.error('Erreur GET achievements:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
