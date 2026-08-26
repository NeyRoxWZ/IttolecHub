import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { rollDailyBonus } from '@/lib/casino/meta';
import { dailyStreakMultiplier } from '@/lib/casino/progression';
import { advancePass } from '@/lib/casino/pass.server';
import { PASS_XP } from '@/lib/casino/pass';

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}
function isYesterday(prev: Date, now: Date): boolean {
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return isSameUtcDay(prev, oneDayAgo);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    const now = new Date();
    if (wallet.last_daily_claim_at && isSameUtcDay(new Date(wallet.last_daily_claim_at), now)) {
      return NextResponse.json({ error: 'Déjà réclamé aujourd\'hui, reviens demain.' }, { status: 400 });
    }

    const newStreak = wallet.last_daily_claim_at && isYesterday(new Date(wallet.last_daily_claim_at), now) ? Number(wallet.daily_streak || 0) + 1 : 1;
    // Longer login streaks pay more — that's the whole point of coming back.
    const streakMult = dailyStreakMultiplier(newStreak);
    const base = rollDailyBonus();
    const reward = Math.round(base * streakMult);
    const newBalance = wallet.balance + reward;

    await supabase.from('casino_wallets').update({
      balance: newBalance, last_daily_claim_at: now.toISOString(), daily_streak: newStreak, updated_at: now.toISOString(),
    }).eq('user_id', userId);

    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus', amount: reward, balance_after: newBalance, meta: { kind: 'daily', streak: newStreak, base, streakMult },
    });

    const pass = await advancePass(userId, PASS_XP.dailyBonus, 'activity');

    return NextResponse.json({ reward, base, streakMult, newBalance, dailyStreak: newStreak, pass });
  } catch (err) {
    console.error('Erreur daily claim:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
