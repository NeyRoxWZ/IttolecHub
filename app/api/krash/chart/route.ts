import { NextResponse } from 'next/server';
import { ASSET_BY_ID } from '@/lib/krash/assets';
import { nowTick, priceSeries } from '@/lib/krash/engine.server';

export const dynamic = 'force-dynamic';

const RANGES: Record<string, { span: number; step: number }> = {
  '15m': { span: 15 * 60, step: 4 },
  '1h': { span: 3600, step: 12 },
  '6h': { span: 6 * 3600, step: 72 },
};

/**
 * An asset's recent history, ending on a whole minute that has passed. Like
 * the market snapshot, a given URL always returns the same curve and is
 * cached for everyone; the page appends live ticks on top of it.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const asset = params.get('asset') ?? '';
  const range = RANGES[params.get('range') ?? '15m'];
  const to = Math.floor(Number(params.get('to')) / 60) * 60;

  if (!ASSET_BY_ID.has(asset)) return NextResponse.json({ error: 'Actif inconnu' }, { status: 400 });
  if (!range) return NextResponse.json({ error: 'Période invalide' }, { status: 400 });
  if (!Number.isFinite(to) || to <= 0) return NextResponse.json({ error: 'Instant invalide' }, { status: 400 });
  if (to > nowTick()) {
    return NextResponse.json({ error: 'Pas encore arrivé' }, { status: 425, headers: { 'Cache-Control': 'no-store' } });
  }

  const points = priceSeries(asset, to - range.span, to, range.step).map(({ t, p }) => [t, p]);
  return NextResponse.json(
    { asset, to, points },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=31536000, immutable' } },
  );
}
