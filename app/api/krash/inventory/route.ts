import { NextResponse } from 'next/server';
import { inventoryState, useItem } from '@/lib/krash/meta.server';

export const dynamic = 'force-dynamic';

/** Items, crates, owned cosmetics and active effects. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  return NextResponse.json(await inventoryState(userId), { headers: { 'Cache-Control': 'no-store' } });
}

/** Uses an item, or opens crates. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.user_id || !body?.item_id) return NextResponse.json({ error: 'user_id et item_id requis' }, { status: 400 });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- not a hook, a server action named like one
    const result = await useItem(body.user_id, String(body.item_id), Number(body.quantity ?? 1));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Inventaire Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
