import { NextResponse } from 'next/server';
import { ASSETS } from '@/lib/krash/assets';
import { TICK, nowTick, priceAt, quantize, upcomingScheduled } from '@/lib/krash/engine.server';

export const dynamic = 'force-dynamic';

const COUNT = 8;
const WINDOW = 15 * 60;

/**
 * What moves the most right now, across every market: the simple view's list.
 * Like the market snapshot, one URL per past tick, cached for everyone.
 */
export function GET(request: Request) {
  const at = quantize(Number(new URL(request.url).searchParams.get('at')));
  if (!Number.isFinite(at) || at <= 0) return NextResponse.json({ error: 'Instant invalide' }, { status: 400 });
  if (at > nowTick()) {
    return NextResponse.json({ error: 'Pas encore arrivé' }, { status: 425, headers: { 'Cache-Control': 'no-store' } });
  }

  const upcoming = upcomingScheduled(at);
  const rows = ASSETS.map((a) => {
    const price = priceAt(a.id, at);
    return {
      id: a.id,
      market: a.market,
      price,
      prev: priceAt(a.id, at - TICK),
      hourAgo: priceAt(a.id, at - 3600),
      change: (price / priceAt(a.id, at - WINDOW) - 1) * 100,
    };
  }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change));

  // The asset of an announced result always makes the list: it is where the
  // action is about to be.
  const movers = rows.slice(0, COUNT);
  if (upcoming?.scheduled && !movers.some((m) => m.id === upcoming.scheduled!.asset)) {
    const star = rows.find((r) => r.id === upcoming.scheduled!.asset);
    if (star) movers.splice(COUNT - 1, 1, star);
  }

  return NextResponse.json(
    { at, movers, upcoming },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=31536000, immutable' } },
  );
}
