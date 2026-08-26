import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { itemById } from '@/lib/casino/shop';
import { crateById } from '@/lib/casino/crates';
import { cosmeticById } from '@/lib/casino/cosmetics';
import { loadEffects } from '@/lib/casino/effects.server';
import { consumeItem } from '@/lib/casino/inventory.server';

/** Consumables and crates in stock, plus what is currently running. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const [{ data: rows }, effects] = await Promise.all([
      supabase.from('casino_inventory').select('item_id, quantity').eq('user_id', userId),
      loadEffects(userId),
    ]);

    const items: any[] = [];
    const crates: any[] = [];
    const cosmetics: string[] = [];

    for (const row of rows || []) {
      const quantity = Number(row.quantity);
      if (cosmeticById(row.item_id)) { cosmetics.push(row.item_id); continue; }

      const crate = crateById(row.item_id);
      if (crate) { crates.push({ ...crate, quantity }); continue; }

      const item = itemById(row.item_id);
      if (item) items.push({ ...item, quantity });
    }

    return NextResponse.json({ items, crates, cosmetics, effects });
  } catch (err) {
    console.error('Erreur GET inventory:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Use one unit of an item, or open one crate. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const itemId: string = body?.item_id;
    if (!userId || !itemId) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    const result = await consumeItem(userId, itemId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      ok: true,
      message: result.message,
      newBalance: result.newBalance,
      opening: result.opening ?? null,
    });
  } catch (err) {
    console.error('Erreur POST inventory:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
