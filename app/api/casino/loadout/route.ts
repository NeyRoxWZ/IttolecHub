import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { itemById, SHOP_ITEMS, type CosmeticSlot } from '@/lib/casino/shop';

const SLOTS: CosmeticSlot[] = ['title', 'border', 'confetti', 'table_theme', 'card_back'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const [{ data: loadout }, { data: inv }] = await Promise.all([
      supabase.from('casino_loadout').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
    ]);

    const owned = (inv || []).map((r) => r.item_id);
    return NextResponse.json({
      loadout: loadout || {},
      owned,
      cosmetics: SHOP_ITEMS.filter((i) => i.effect === 'cosmetic' && owned.includes(i.id)),
    });
  } catch (err) {
    console.error('Erreur GET loadout:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Equip (or, with a null item_id, unequip) one cosmetic slot. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const slot: CosmeticSlot = body?.slot;
    const itemId: string | null = body?.item_id ?? null;
    if (!userId || !SLOTS.includes(slot)) return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });

    let value: string | null = null;
    if (itemId) {
      const item = itemById(itemId);
      if (!item || item.effect !== 'cosmetic' || item.slot !== slot) {
        return NextResponse.json({ error: 'Cosmétique invalide pour cet emplacement' }, { status: 400 });
      }
      const { data: owned } = await supabase.from('casino_inventory')
        .select('item_id').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
      if (!owned) return NextResponse.json({ error: 'Tu ne possèdes pas cet objet.' }, { status: 400 });
      value = item.value ?? null;
    }

    await supabase.from('casino_loadout')
      .upsert({ user_id: userId, [slot]: value }, { onConflict: 'user_id' });

    const { data: loadout } = await supabase.from('casino_loadout').select('*').eq('user_id', userId).maybeSingle();
    return NextResponse.json({ ok: true, loadout: loadout || {} });
  } catch (err) {
    console.error('Erreur POST loadout:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
