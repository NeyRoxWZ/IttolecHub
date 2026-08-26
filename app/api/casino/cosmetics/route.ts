import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { cosmeticById, COSMETIC_SLOTS, type CosmeticSlot } from '@/lib/casino/cosmetics';

/** Owned cosmetics + what is currently equipped, per game. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const gameSlug = searchParams.get('game');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let loadoutQuery = supabase.from('casino_game_loadout').select('*').eq('user_id', userId);
    if (gameSlug) loadoutQuery = loadoutQuery.eq('game_slug', gameSlug);

    const [inv, loadout] = await Promise.all([
      supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
      loadoutQuery,
    ]);

    // { [gameSlug]: { [slot]: cosmeticId } }
    const equipped: Record<string, Record<string, string>> = {};
    for (const row of loadout.data || []) {
      (equipped[row.game_slug] ||= {})[row.slot] = row.cosmetic_id;
    }

    return NextResponse.json({
      owned: (inv.data || []).map((r) => r.item_id),
      equipped,
    });
  } catch (err) {
    console.error('Erreur GET cosmetics:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Equip a cosmetic, or unequip the slot by passing a null cosmetic_id. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const gameSlug: string = body?.game_slug;
    const slot: CosmeticSlot = body?.slot;
    const cosmeticId: string | null = body?.cosmetic_id ?? null;

    if (!userId || !gameSlug || !COSMETIC_SLOTS.includes(slot)) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    if (!cosmeticId) {
      await supabase.from('casino_game_loadout').delete()
        .eq('user_id', userId).eq('game_slug', gameSlug).eq('slot', slot);
      return NextResponse.json({ ok: true, equipped: null });
    }

    const cosmetic = cosmeticById(cosmeticId);
    if (!cosmetic || cosmetic.gameSlug !== gameSlug || cosmetic.slot !== slot) {
      return NextResponse.json({ error: 'Ce cosmétique ne va pas à cet emplacement.' }, { status: 400 });
    }

    const { data: owned } = await supabase.from('casino_inventory')
      .select('item_id').eq('user_id', userId).eq('item_id', cosmeticId).maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Tu ne possèdes pas ce cosmétique.' }, { status: 400 });

    await supabase.from('casino_game_loadout')
      .upsert({ user_id: userId, game_slug: gameSlug, slot, cosmetic_id: cosmeticId }, { onConflict: 'user_id,game_slug,slot' });

    return NextResponse.json({ ok: true, equipped: cosmeticId });
  } catch (err) {
    console.error('Erreur POST cosmetics:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
