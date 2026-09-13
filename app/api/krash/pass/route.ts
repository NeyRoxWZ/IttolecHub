import { NextResponse } from 'next/server';
import { buyPremium, claimAll, claimTier, passState } from '@/lib/krash/meta.server';

export const dynamic = 'force-dynamic';

/** The month's pass: track, progress, claims and premium status. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  try {
    return NextResponse.json(await passState(userId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Pass Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** claim · claim_all · premium */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let result;
    if (body.action === 'claim') {
      const track = body.track === 'premium' ? 'premium' : 'free';
      result = await claimTier(userId, Number(body.tier), track);
    } else if (body.action === 'claim_all') {
      result = await claimAll(userId);
    } else if (body.action === 'premium') {
      result = await buyPremium(userId);
    } else {
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Pass Krash POST:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
