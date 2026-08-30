import { NextResponse } from 'next/server';
import { weeklyRecap } from '@/lib/casino/recap.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    const offset = Math.max(0, Math.min(8, Number(searchParams.get('offset') ?? 1) || 1));
    return NextResponse.json(await weeklyRecap(userId, offset));
  } catch (err) {
    console.error('Erreur GET récap:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
