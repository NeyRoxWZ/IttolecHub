import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { CHEST_DAYS, CHEST_LENGTH, chestRewardFor } from '@/lib/casino/events';
import { addToInventory } from '@/lib/casino/inventory.server';
import { loadEffects, consumeEffects } from '@/lib/casino/effects.server';

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

function isYesterday(prev: Date, now: Date): boolean {
  return isSameUtcDay(prev, new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ days: CHEST_DAYS, day: 0, claimedToday: false, broken: false });

    const { data: wallet } = await supabase.from('casino_wallets')
      .select('chest_day, chest_claimed_at').eq('user_id', userId).maybeSingle();

    const now = new Date();
    const last = wallet?.chest_claimed_at ? new Date(wallet.chest_claimed_at) : null;
    const claimedToday = !!last && isSameUtcDay(last, now);
    // Missing a day sends the chest back to the first case.
    const broken = !!last && !claimedToday && !isYesterday(last, now);
    const day = broken ? 0 : Number(wallet?.chest_day || 0);

    return NextResponse.json({
      days: CHEST_DAYS,
      day,
      claimedToday,
      broken,
      next: Math.min(CHEST_LENGTH, day + 1),
    });
  } catch (err) {
    console.error('Erreur GET coffre:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    const now = new Date();
    const last = wallet.chest_claimed_at ? new Date(wallet.chest_claimed_at) : null;
    if (last && isSameUtcDay(last, now)) {
      return NextResponse.json({ error: 'Case déjà ouverte aujourd’hui.' }, { status: 400 });
    }

    // Continue the run, or start over after a missed day. Past the seventh
    // case it loops, so the chest never stops being worth opening.
    //
    // A "réveil-matin" is spent only when it actually saves something: on a
    // run that was about to be lost. Burning it on an unbroken run would make
    // the item feel like it did nothing.
    const effects = await loadEffects(userId);
    const missed = !!last && !isYesterday(last, now);
    const rescued = missed && !!effects.chest_freeze && Number(wallet.chest_day || 0) > 0;
    if (rescued) await consumeEffects(userId, effects, ['chest_freeze']);

    const continues = (last && isYesterday(last, now)) || rescued;
    const previous = continues ? Number(wallet.chest_day || 0) : 0;
    const day = previous >= CHEST_LENGTH ? 1 : previous + 1;

    const reward = chestRewardFor(day);
    const newBalance = wallet.balance + reward.coins;

    await supabase.from('casino_wallets').update({
      balance: newBalance,
      chest_day: day,
      chest_claimed_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq('user_id', userId);

    if (reward.coins > 0) {
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'bonus',
        amount: reward.coins, balance_after: newBalance, meta: { kind: 'chest', day },
      });
    }

    if (reward.crate) await addToInventory(userId, reward.crate);

    return NextResponse.json({
      day,
      rescued,
      reward,
      newBalance,
      restarted: !continues && previous > 0,
    });
  } catch (err) {
    console.error('Erreur claim coffre:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
