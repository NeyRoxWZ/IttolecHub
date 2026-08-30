import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { CASINO_STARTING_BALANCE, CASINO_SAFETY_NET_THRESHOLD, CASINO_SAFETY_NET_AMOUNT } from '@/lib/casino/wheel';
import { levelFromXp } from '@/lib/casino/progression';
import { loadEffects } from '@/lib/casino/effects.server';
import { ensurePass } from '@/lib/casino/pass.server';
import { tierFromPassXp } from '@/lib/casino/pass';
import { runningSyndicate } from '@/lib/casino/bankroll.server';

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();

    if (!wallet) {
      const { data: created, error } = await supabase
        .from('casino_wallets')
        .insert({ user_id: userId, balance: CASINO_STARTING_BALANCE })
        .select()
        .maybeSingle();
      if (error || !created) return NextResponse.json({ error: 'Erreur création portefeuille' }, { status: 500 });
      wallet = created;
    }

    // Safety net: never stay stuck near zero.
    if (wallet.balance < CASINO_SAFETY_NET_THRESHOLD) {
      const newBalance = wallet.balance + CASINO_SAFETY_NET_AMOUNT;
      const { data: updated } = await supabase
        .from('casino_wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      if (updated) {
        wallet = updated;
        await supabase.from('casino_transactions').insert({
          user_id: userId,
          game_slug: 'casino',
          type: 'safety_net',
          amount: CASINO_SAFETY_NET_AMOUNT,
          balance_after: newBalance,
        });
      }
    }

    const { data: history } = await supabase
      .from('casino_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const now = new Date();
    const xp = Number(wallet.xp || 0);
    const { level, intoLevel, needed } = levelFromXp(xp);
    const [effects, pass, syn] = await Promise.all([
      loadEffects(userId), ensurePass(userId), runningSyndicate(userId),
    ]);

    // The visible level is the pass tier: one progression, reset every Monday.
    const passState = tierFromPassXp(pass?.xp ?? 0);

    const dailyClaimedToday = !!wallet.last_daily_claim_at && isSameUtcDay(new Date(wallet.last_daily_claim_at), now);
    const wheelClaimedToday = !!wallet.last_wheel_claim_at && isSameUtcDay(new Date(wallet.last_wheel_claim_at), now);

    // The balance stays the player's own, everywhere and always. The pot is
    // reported alongside it: only the cagnotte arena swaps what it bets
    // against, and only for as long as the player is inside it.
    return NextResponse.json({
      balance: wallet.balance,
      syndicate: syn
        ? { id: syn.id, code: syn.code, pot: Number(syn.pot), seedPot: Number(syn.seed_pot), endsAt: syn.ends_at }
        : null,
      history: history || [],
      stats: {
        totalWagered: Number(wallet.total_wagered || 0),
        totalWon: Number(wallet.total_won || 0),
        currentStreak: Number(wallet.current_streak || 0),
        bestStreak: Number(wallet.best_streak || 0),
        prestigeCount: Number(wallet.prestige_count || 0),
        biggestMultiplier: Number(wallet.biggest_multiplier || 0),
        allTimeBestBalance: Number(wallet.all_time_best_balance || CASINO_STARTING_BALANCE),
        dailyStreak: Number(wallet.daily_streak || 0),
        dailyClaimedToday,
        wheelClaimedToday,
        xp,
        level: passState.tier,
        xpIntoLevel: passState.intoTier,
        xpForNext: passState.needed,
        /** Lifetime account level, kept for the achievement list. */
        accountLevel: level,
        accountXp: xp,
        accountXpIntoLevel: intoLevel,
        accountXpForNext: needed,
        cashbackClaimedToday: !!wallet.last_cashback_claim_at && isSameUtcDay(new Date(wallet.last_cashback_claim_at), now),
      },
      effects,
    });
  } catch (err) {
    console.error('Erreur GET wallet:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
