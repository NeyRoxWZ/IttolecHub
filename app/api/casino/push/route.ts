import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { pushConfigured } from '@/lib/casino/push.server';

/** Whether push is usable at all, so the UI can hide the toggle if not. */
export async function GET() {
  return NextResponse.json({
    enabled: pushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
}

/** Registers or removes one device. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const sub = body?.subscription;

    if (body?.action === 'unsubscribe') {
      if (!sub?.endpoint) return NextResponse.json({ error: 'endpoint requis' }, { status: 400 });
      await supabase.from('casino_push').delete().eq('endpoint', sub.endpoint);
      return NextResponse.json({ ok: true });
    }

    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 });
    }

    await supabase.from('casino_push').upsert({
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    }, { onConflict: 'endpoint' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erreur abonnement push:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
