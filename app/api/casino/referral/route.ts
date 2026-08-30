import { NextResponse } from 'next/server';
import { referralState, applyReferralCode, claimReferral } from '@/lib/casino/social.server';

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    const state = await referralState(userId);
    if (!state) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });
    return NextResponse.json(state);
  } catch (err) {
    console.error('Erreur GET parrainage:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = body?.action === 'claim'
      ? await claimReferral(userId)
      : await applyReferralCode(userId, String(body?.code || ''));

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur parrainage:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
