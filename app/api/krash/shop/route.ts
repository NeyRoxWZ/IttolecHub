import { NextResponse } from 'next/server';
import { buy, shopState } from '@/lib/krash/meta.server';

export const dynamic = 'force-dynamic';

/** Today's five items, the crates, and what this player already bought today. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  return NextResponse.json(await shopState(userId), { headers: { 'Cache-Control': 'no-store' } });
}

/** Buys a daily item (once a day) or crates (up to ten at once). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.user_id || !body?.id) return NextResponse.json({ error: 'user_id et id requis' }, { status: 400 });
    const result = await buy(body.user_id, String(body.id), Number(body.quantity ?? 1));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Boutique Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
