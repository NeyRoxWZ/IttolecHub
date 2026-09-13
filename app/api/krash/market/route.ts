import { NextResponse } from 'next/server';
import { MARKET_ORDER, assetsOf, type MarketId } from '@/lib/krash/assets';
import { TICK, activeEvent, newsBetween, nowTick, priceAt, quantize, upcomingScheduled } from '@/lib/krash/engine.server';

export const dynamic = 'force-dynamic';

/** How far back the feed reaches, and how many headlines it returns. */
const NEWS_WINDOW = 45 * 60;
const NEWS_LIMIT = 30;

/**
 * One market at one tick: prices, the headlines published by then, and the
 * KRACH or BULL RUN in progress if there is one.
 *
 * The tick is in the URL and must already have happened, so the answer for a
 * given URL never changes. The CDN keeps it for everyone: a hundred players
 * watching the same market cost one function call per tick, not a hundred.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const market = params.get('m') as MarketId;
  const at = quantize(Number(params.get('at')));

  if (!MARKET_ORDER.includes(market)) return NextResponse.json({ error: 'Marché inconnu' }, { status: 400 });
  if (!Number.isFinite(at) || at <= 0) return NextResponse.json({ error: 'Instant invalide' }, { status: 400 });
  if (at > nowTick()) {
    return NextResponse.json({ error: 'Pas encore arrivé' }, { status: 425, headers: { 'Cache-Control': 'no-store' } });
  }

  const assets = assetsOf(market).map((a) => ({
    id: a.id,
    price: priceAt(a.id, at),
    prev: priceAt(a.id, at - TICK),
    hourAgo: priceAt(a.id, at - 3600),
  }));

  return NextResponse.json(
    {
      at,
      market,
      assets,
      news: newsBetween(at - NEWS_WINDOW, at).slice(0, NEWS_LIMIT),
      event: activeEvent(at),
      upcoming: upcomingScheduled(at),
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=31536000, immutable' } },
  );
}
