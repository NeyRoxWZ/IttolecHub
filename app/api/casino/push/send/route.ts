import { NextResponse } from 'next/server';
import { pushSweep } from '@/lib/casino/push.server';

/**
 * The scheduled sweep.
 *
 * Guarded by a shared secret rather than left open: anyone who could call it
 * freely could empty everybody's six-hour quiet window and effectively mute
 * the app for the day.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET absent' }, { status: 503 });

  const auth = request.headers.get('authorization');
  const given = new URL(request.url).searchParams.get('secret');
  if (auth !== `Bearer ${secret}` && given !== secret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    return NextResponse.json(await pushSweep());
  } catch (err) {
    console.error('Erreur sweep push:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
