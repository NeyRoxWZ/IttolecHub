import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import {
  spinWheel,
  resolveWheelBet,
  getMaxBet,
  CASINO_MIN_BET,
  type WheelBet,
} from '@/lib/casino/wheel';
import { recordWager, recordSettlement } from '@/lib/casino/metaProgression.server';

// RNG and payout are resolved here, server-side, with the service-role key.
// The client never gets to submit or influence the result — it only ever
// sees what this route returns.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const bet: WheelBet = body?.bet;
    const amount: number = Number(body?.amount);

    if (!userId || !bet || !bet.type || bet.value === undefined || bet.value === null) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount < CASINO_MIN_BET) {
      return NextResponse.json({ error: 'Mise invalide' }, { status: 400 });
    }

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    const maxBet = getMaxBet(wallet.balance);
    if (amount > wallet.balance) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
    if (amount > maxBet) return NextResponse.json({ error: `Mise max: ${maxBet} ₶` }, { status: 400 });

    const landedNumber = spinWheel();
    const { won, multiplier } = resolveWheelBet(landedNumber, bet);
    const payout = won ? amount * multiplier : 0;
    const netChange = payout - amount; // negative on loss, positive profit on win
    const newBalance = wallet.balance + netChange;

    const { data: updated, error: updateError } = await supabase
      .from('casino_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('balance', wallet.balance) // optimistic lock: fails if balance changed concurrently
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: 'Conflit de mise à jour, réessayez.' }, { status: 409 });
    }

    await supabase.from('casino_transactions').insert({
      user_id: userId,
      game_slug: 'wheel',
      type: won ? 'win' : 'bet',
      amount: netChange,
      balance_after: newBalance,
      meta: { bet, landedNumber, multiplier, amount },
    });

    await recordWager(userId, amount);
    const progression = await recordSettlement(userId, 'wheel', { amount, payout, multiplier, newBalance });

    return NextResponse.json({
      landedNumber,
      won,
      multiplier,
      payout,
      netChange,
      newBalance,
      progression,
    });
  } catch (err) {
    console.error('Erreur spin wheel:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
