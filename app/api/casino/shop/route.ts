import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { dailyShop, itemById, secondsUntilRotation, shopDayKey } from '@/lib/casino/shop';
import { CRATES, crateById } from '@/lib/casino/crates';
import { addToInventory } from '@/lib/casino/inventory.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let purchased: string[] = [];
    if (userId) {
      const { data } = await supabase.from('casino_shop_purchases')
        .select('item_id').eq('user_id', userId).eq('day_key', shopDayKey());
      purchased = (data || []).map((r) => r.item_id);
    }

    return NextResponse.json({
      day: shopDayKey(),
      resetIn: secondsUntilRotation(),
      items: dailyShop(),
      crates: CRATES,
      /** Daily items already taken today — one purchase each, per rotation. */
      purchased,
    });
  } catch (err) {
    console.error('Erreur GET shop:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const itemId: string = body?.item_id;
    if (!userId || !itemId) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    const crate = crateById(itemId);
    const item = crate ? null : itemById(itemId);
    if (!crate && !item) return NextResponse.json({ error: 'Objet inconnu' }, { status: 404 });

    // Crates are permanent stock and stack; the five daily items are one-shot.
    // No arbitrary ceiling: what you can afford is the limit.
    const quantity = crate ? Math.max(1, Math.floor(Number(body?.quantity) || 1)) : 1;

    if (item && !dailyShop().some((i) => i.id === itemId)) {
      return NextResponse.json({ error: "Cet objet n'est pas en boutique aujourd'hui." }, { status: 400 });
    }

    const day = shopDayKey();
    if (item) {
      // Claim the slot first: the primary key makes a second attempt fail,
      // which is what stops a double-click from buying twice.
      const { error: claimError } = await supabase.from('casino_shop_purchases')
        .insert({ user_id: userId, day_key: day, item_id: itemId });
      if (claimError) {
        return NextResponse.json({ error: 'Tu as déjà pris cet objet aujourd’hui.' }, { status: 400 });
      }
    }

    const unitPrice = crate ? crate.price : item!.price;
    const total = unitPrice * quantity;

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet || wallet.balance < total) {
      if (item) await supabase.from('casino_shop_purchases').delete().eq('user_id', userId).eq('day_key', day).eq('item_id', itemId);
      return NextResponse.json({ error: wallet ? 'Solde insuffisant' : 'Portefeuille introuvable' }, { status: wallet ? 400 : 404 });
    }

    const afterCost = wallet.balance - total;
    const { data: charged } = await supabase.from('casino_wallets')
      .update({ balance: afterCost, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('balance', wallet.balance)
      .select().maybeSingle();

    if (!charged) {
      if (item) await supabase.from('casino_shop_purchases').delete().eq('user_id', userId).eq('day_key', day).eq('item_id', itemId);
      return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });
    }

    await Promise.all([
      addToInventory(userId, itemId, quantity),
      supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'shop',
        amount: -total, balance_after: afterCost, meta: { item: itemId, quantity },
      }),
    ]);

    const name = crate ? crate.name : item!.name;
    return NextResponse.json({
      ok: true,
      item: { id: itemId, name },
      quantity,
      newBalance: afterCost,
      message: `${quantity > 1 ? `${quantity}× ` : ''}${name} ajouté à ton inventaire.`,
    });
  } catch (err) {
    console.error('Erreur achat shop:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
