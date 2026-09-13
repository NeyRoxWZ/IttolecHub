import { NextResponse } from 'next/server';
import { cosmeticsState, equipCosmetic } from '@/lib/krash/meta.server';

export const dynamic = 'force-dynamic';

/** Owned Krash cosmetics and what is equipped in each slot. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  return NextResponse.json(await cosmeticsState(userId), { headers: { 'Cache-Control': 'no-store' } });
}

/** Equips a cosmetic in its slot, or clears the slot with cosmetic_id null. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.user_id || !body?.slot) return NextResponse.json({ error: 'user_id et slot requis' }, { status: 400 });
    const result = await equipCosmetic(body.user_id, String(body.slot), body.cosmetic_id ? String(body.cosmetic_id) : null);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, ...(await cosmeticsState(body.user_id)) });
  } catch (err) {
    console.error('Cosmétiques Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
