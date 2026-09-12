import { NextResponse } from 'next/server';
import { loadFlash, placeFlash } from '@/lib/krash/flash.server';

export const dynamic = 'force-dynamic';

/** Recent flash bets, settling the ones whose minute is up. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  try {
    return NextResponse.json(await loadFlash(userId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Paris flash Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Places one flash bet on a fresh headline. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.user_id) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    const result = await placeFlash(body.user_id, {
      newsId: String(body.news_id ?? ''),
      hint: Number(body.hint ?? 0),
      side: String(body.side ?? ''),
      stake: Number(body.stake),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Pari flash Krash POST:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
