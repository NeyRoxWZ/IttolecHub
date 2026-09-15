import { NextResponse } from 'next/server';
import { referralState, applyReferralCode, claimReferral } from '@/lib/casino/social.server';
import { allow } from '@/lib/rateLimit';

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

    // Anti-spam: guessing referral codes one after another.
    if (body?.action !== 'claim' && !(await allow(`referral-code:${userId}`, 10, 60 * 60))) {
      return NextResponse.json({ error: 'Trop d’essais de code, réessaie dans une heure.' }, { status: 429 });
    }

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
