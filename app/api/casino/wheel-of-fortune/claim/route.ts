import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { rollWheelOfFortune, WHEEL_OF_FORTUNE_SEGMENTS } from '@/lib/casino/meta';
import { advancePass } from '@/lib/casino/pass.server';
import { PASS_XP } from '@/lib/casino/pass';

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    const now = new Date();
    if (wallet.last_wheel_claim_at && isSameUtcDay(new Date(wallet.last_wheel_claim_at), now)) {
      return NextResponse.json({ error: 'Déjà tourné aujourd\'hui, reviens demain.' }, { status: 400 });
    }

    const reward = rollWheelOfFortune();
    const newBalance = wallet.balance + reward;
    const segmentIndex = WHEEL_OF_FORTUNE_SEGMENTS.indexOf(reward);

    await supabase.from('casino_wallets').update({
      balance: newBalance, last_wheel_claim_at: now.toISOString(), updated_at: now.toISOString(),
    }).eq('user_id', userId);

    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus', amount: reward, balance_after: newBalance, meta: { kind: 'wheel_of_fortune' },
    });

    const pass = await advancePass(userId, PASS_XP.dailyWheel, 'activity');

    return NextResponse.json({ reward, newBalance, segmentIndex, pass });
  } catch (err) {
    console.error('Erreur wheel-of-fortune claim:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
