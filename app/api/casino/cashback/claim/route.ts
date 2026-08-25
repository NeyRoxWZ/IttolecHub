import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { CASHBACK_RATE, CASHBACK_BOOSTED_RATE, CASHBACK_MIN } from '@/lib/casino/progression';
import { loadEffects, consumeEffects } from '@/lib/casino/effects.server';

function isSameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

/** Yesterday's UTC window, which is the period cashback is computed over. */
function yesterdayWindow(now: Date) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Net result of yesterday's play: negative means the player lost money. */
async function netYesterday(userId: string, now: Date): Promise<number> {
  const { start, end } = yesterdayWindow(now);
  const { data } = await supabase
    .from('casino_transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .in('type', ['bet', 'win', 'push'])
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  return (data || []).reduce((sum, t) => sum + Number(t.amount), 0);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('last_cashback_claim_at').eq('user_id', userId).maybeSingle();
    const now = new Date();
    const claimedToday = !!wallet?.last_cashback_claim_at && isSameUtcDay(new Date(wallet.last_cashback_claim_at), now);

    const effects = await loadEffects(userId);
    const rate = effects.cashback_boost ? CASHBACK_BOOSTED_RATE : CASHBACK_RATE;
    const net = await netYesterday(userId, now);
    const losses = net < 0 ? -net : 0;
    const amount = Math.floor(losses * rate);

    return NextResponse.json({
      claimedToday,
      losses,
      rate,
      amount: amount >= CASHBACK_MIN ? amount : 0,
      available: !claimedToday && amount >= CASHBACK_MIN,
    });
  } catch (err) {
    console.error('Erreur GET cashback:', err);
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
    if (wallet.last_cashback_claim_at && isSameUtcDay(new Date(wallet.last_cashback_claim_at), now)) {
      return NextResponse.json({ error: 'Cashback déjà réclamé aujourd’hui.' }, { status: 400 });
    }

    const effects = await loadEffects(userId);
    const boosted = !!effects.cashback_boost;
    const rate = boosted ? CASHBACK_BOOSTED_RATE : CASHBACK_RATE;

    const net = await netYesterday(userId, now);
    const losses = net < 0 ? -net : 0;
    const amount = Math.floor(losses * rate);
    if (amount < CASHBACK_MIN) {
      return NextResponse.json({ error: 'Aucune perte à rembourser hier.' }, { status: 400 });
    }

    const newBalance = wallet.balance + amount;
    // Guard on the previous claim timestamp so a double-click can't pay twice.
    let query = supabase.from('casino_wallets')
      .update({ balance: newBalance, last_cashback_claim_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', userId);
    query = wallet.last_cashback_claim_at
      ? query.eq('last_cashback_claim_at', wallet.last_cashback_claim_at)
      : query.is('last_cashback_claim_at', null);
    const { data: updated } = await query.select().maybeSingle();
    if (!updated) return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });

    if (boosted) await consumeEffects(userId, effects, ['cashback_boost']);

    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus', amount,
      balance_after: newBalance, meta: { kind: 'cashback', losses, rate },
    });

    return NextResponse.json({ amount, losses, rate, newBalance });
  } catch (err) {
    console.error('Erreur claim cashback:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
