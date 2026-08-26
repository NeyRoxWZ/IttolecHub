import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { dailyShop, itemById, secondsUntilRotation, shopDayKey } from '@/lib/casino/shop';
import { CRATES, crateById } from '@/lib/casino/crates';
import { addToInventory } from '@/lib/casino/inventory.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    return NextResponse.json({
      day: shopDayKey(),
      resetIn: secondsUntilRotation(),
      items: dailyShop(),
      crates: CRATES,
      // Anything bought lands in the inventory, so nothing is ever
      // "already owned" — the shop can be used as often as the player likes.
      userId: !!userId,
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
    const quantity: number = Math.max(1, Math.min(10, Number(body?.quantity) || 1));
    if (!userId || !itemId) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    const crate = crateById(itemId);
    const item = crate ? null : itemById(itemId);
    if (!crate && !item) return NextResponse.json({ error: 'Objet inconnu' }, { status: 404 });

    // Crates are permanent stock; the five consumables rotate daily.
    if (item && !dailyShop().some((i) => i.id === itemId)) {
      return NextResponse.json({ error: "Cet objet n'est pas en boutique aujourd'hui." }, { status: 400 });
    }

    const unitPrice = crate ? crate.price : item!.price;
    const total = unitPrice * quantity;

    const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
    if (!wallet) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });
    if (wallet.balance < total) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 });

    const afterCost = wallet.balance - total;
    const { data: charged } = await supabase.from('casino_wallets')
      .update({ balance: afterCost, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('balance', wallet.balance)
      .select().maybeSingle();
    if (!charged) return NextResponse.json({ error: 'Conflit, réessaye.' }, { status: 409 });

    await Promise.all([
      addToInventory(userId, itemId, quantity),
      supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'shop',
        amount: -total, balance_after: afterCost, meta: { item: itemId, quantity },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      item: { id: itemId, name: crate ? crate.name : item!.name },
      quantity,
      newBalance: afterCost,
      message: `${quantity > 1 ? `${quantity}× ` : ''}${crate ? crate.name : item!.name} ajouté à ton inventaire.`,
    });
  } catch (err) {
    console.error('Erreur achat shop:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
