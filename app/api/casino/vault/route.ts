import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { VAULT_LOCK_HOURS, VAULT_INTEREST, VAULT_MIN, vaultPayout } from '@/lib/casino/events';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data } = await supabase.from('casino_vault').select('*').eq('user_id', userId).maybeSingle();

    return NextResponse.json({
      amount: Number(data?.amount || 0),
      unlocksAt: data?.unlocks_at ?? null,
      ready: !!data && new Date(data.unlocks_at) <= new Date(),
      payout: data ? vaultPayout(Number(data.amount)) : 0,
      interest: VAULT_INTEREST,
      lockHours: VAULT_LOCK_HOURS,
      min: VAULT_MIN,
    });
  } catch (err) {
    console.error('Erreur GET coffre-fort:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** action: 'lock' puts coins away, 'withdraw' takes them back with interest. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const action: string = body?.action;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });

    const { data: vault } = await supabase.from('casino_vault').select('*').eq('user_id', userId).maybeSingle();

    if (action === 'lock') {
      const amount = Math.floor(Number(body?.amount) || 0);
      if (amount < VAULT_MIN) return NextResponse.json({ error: `Minimum ${VAULT_MIN.toLocaleString('en-US')} ₶.` }, { status: 400 });
      if (amount > wallet.balance) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });
      if (vault) return NextResponse.json({ error: 'Le coffre-fort est déjà occupé.' }, { status: 400 });

      const afterCost = wallet.balance - amount;
      const { data: charged } = await supabase.from('casino_wallets')
        .update({ balance: afterCost, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('balance', wallet.balance)
        .select().maybeSingle();
      if (!charged) return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });

      const unlocksAt = new Date(Date.now() + VAULT_LOCK_HOURS * 60 * 60 * 1000);
      await supabase.from('casino_vault').insert({
        user_id: userId, amount, unlocks_at: unlocksAt.toISOString(),
      });
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'vault',
        amount: -amount, balance_after: afterCost, meta: { kind: 'vault_lock' },
      });

      return NextResponse.json({
        ok: true, amount, newBalance: afterCost,
        unlocksAt: unlocksAt.toISOString(), payout: vaultPayout(amount),
      });
    }

    if (action === 'withdraw') {
      if (!vault) return NextResponse.json({ error: 'Le coffre-fort est vide.' }, { status: 400 });
      if (new Date(vault.unlocks_at) > new Date()) {
        return NextResponse.json({ error: 'Encore verrouillé.' }, { status: 400 });
      }

      const payout = vaultPayout(Number(vault.amount));
      const newBalance = wallet.balance + payout;

      // Delete first: the row is the lock, and a failed delete must not pay
      // out twice.
      const { data: removed } = await supabase.from('casino_vault')
        .delete().eq('user_id', userId).select().maybeSingle();
      if (!removed) return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });

      await supabase.from('casino_wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'vault',
        amount: payout, balance_after: newBalance,
        meta: { kind: 'vault_withdraw', interest: VAULT_INTEREST },
      });

      return NextResponse.json({ ok: true, payout, newBalance });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (err) {
    console.error('Erreur coffre-fort:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
