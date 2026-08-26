import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ensurePass, buyPassPremium } from '@/lib/casino/pass.server';
import {
  PASS_TRACK, PASS_TIERS, PASS_PREMIUM_PRICE, PASS_XP,
  passXpForTier, tierFromPassXp, secondsUntilReset, weekKey,
} from '@/lib/casino/pass';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let state = { tier: 0, xp: 0, intoTier: 0, needed: passXpForTier(0), premium: false };
    let owned: string[] = [];

    if (userId) {
      const [row, inv] = await Promise.all([
        ensurePass(userId),
        supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
      ]);
      if (row) {
        const { tier, intoTier, needed } = tierFromPassXp(row.xp);
        state = { tier: Math.min(PASS_TIERS, tier), xp: row.xp, intoTier, needed, premium: row.premium };
      }
      owned = (inv.data || []).map((r) => r.item_id);
    }

    return NextResponse.json({
      week: weekKey(),
      resetIn: secondsUntilReset(),
      tiers: PASS_TRACK,
      maxTier: PASS_TIERS,
      premiumPrice: PASS_PREMIUM_PRICE,
      xpRates: PASS_XP,
      state,
      owned,
    });
  } catch (err) {
    console.error('Erreur GET pass:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Unlock the premium track for this week. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = await buyPassPremium(userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, granted: result.granted, newBalance: result.newBalance });
  } catch (err) {
    console.error('Erreur achat premium pass:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
