import { NextResponse } from 'next/server';
import { chatHistory, postChat } from '@/lib/casino/social.server';
import { nudgeCommunity } from '@/lib/casino/community.server';

export async function GET() {
  try {
    return NextResponse.json({ messages: await chatHistory() });
  } catch (err) {
    console.error('Erreur GET chat:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = await postChat(userId, String(body?.body || ''));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await nudgeCommunity(userId, { chat: 1 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erreur chat:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
