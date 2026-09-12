import { NextResponse } from 'next/server';
import { refillWallet, walletState } from '@/lib/krash/trade.server';

export const dynamic = 'force-dynamic';

/** The Krash wallet: balance and whether the daily refill is available. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  const state = await walletState(userId);
  if (!state) return NextResponse.json({ error: 'Portefeuille introuvable' }, { status: 404 });
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}

/** Claims the daily refill. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    const result = await refillWallet(body.user_id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const state = await walletState(body.user_id);
    return NextResponse.json(state);
  } catch (err) {
    console.error('Renflouement Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
