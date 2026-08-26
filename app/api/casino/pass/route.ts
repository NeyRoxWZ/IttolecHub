import { NextResponse } from 'next/server';
import { ensurePass, passClaims, buyPassPremium, claimPassTier, claimAllPass } from '@/lib/casino/pass.server';
import { supabase } from '@/lib/supabase/server';
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
    let claimed = { free: [] as number[], premium: [] as number[] };

    if (userId) {
      const [row, inv, claims] = await Promise.all([
        ensurePass(userId),
        supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
        passClaims(userId),
      ]);
      if (row) {
        const { tier, intoTier, needed } = tierFromPassXp(row.xp);
        state = { tier: Math.min(PASS_TIERS, tier), xp: row.xp, intoTier, needed, premium: row.premium };
      }
      owned = (inv.data || []).map((r) => r.item_id);
      claimed = claims;
    }

    const claimable = state.tier
      - claimed.free.filter((t) => t <= state.tier).length
      + (state.premium ? state.tier - claimed.premium.filter((t) => t <= state.tier).length : 0);

    return NextResponse.json({
      week: weekKey(),
      resetIn: secondsUntilReset(),
      tiers: PASS_TRACK,
      maxTier: PASS_TIERS,
      premiumPrice: PASS_PREMIUM_PRICE,
      xpRates: PASS_XP,
      state,
      owned,
      claimed,
      claimable: Math.max(0, claimable),
    });
  } catch (err) {
    console.error('Erreur GET pass:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** action: 'claim' (one tier) | 'claim_all' | 'premium' */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const action: string = body?.action || 'premium';
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    if (action === 'claim') {
      const result = await claimPassTier(userId, Number(body?.tier), body?.track === 'premium' ? 'premium' : 'free');
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(result);
    }

    if (action === 'claim_all') {
      const result = await claimAllPass(userId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(result);
    }

    const result = await buyPassPremium(userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, unlockedTiers: result.unlockedTiers, newBalance: result.newBalance });
  } catch (err) {
    console.error('Erreur POST pass:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
