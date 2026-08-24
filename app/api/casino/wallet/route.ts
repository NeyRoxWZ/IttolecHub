import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { CASINO_STARTING_BALANCE, CASINO_SAFETY_NET_THRESHOLD, CASINO_SAFETY_NET_AMOUNT } from '@/lib/casino/wheel';

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

    return NextResponse.json({ balance: wallet.balance, history: history || [] });
  } catch (err) {
    console.error('Erreur GET wallet:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
