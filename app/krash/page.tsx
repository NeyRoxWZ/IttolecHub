'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useKrashWallet } from './_lib/useKrashWallet';
import {
  ASSET_BY_ID, MARKETS, MARKET_ORDER, SECTORS, assetsOf, formatPrice, liquidationPrice, positionValue,
  type MarketId,
} from '@/lib/krash/assets';
import KrashShell from './_components/KrashShell';
import PriceChart, { type ChartLine } from './_components/PriceChart';
import NewsFeed from './_components/NewsFeed';
import TradePanel from './_components/TradePanel';
import PositionCard from './_components/PositionCard';
import { serverNow, useKrashMarket, type MarketAsset } from './_lib/useKrashMarket';
import { useKrashPositions } from './_lib/useKrashPositions';

type Range = '15m' | '1h' | '6h';
const RANGE_SECONDS: Record<Range, number> = { '15m': 900, '1h': 3600, '6h': 21600 };

function change(a?: MarketAsset) {
  return a ? (a.price / a.hourAgo - 1) * 100 : 0;
}

function AssetRow({ id, data, selected, onPick, holding }: {
  id: string; data?: MarketAsset; selected: boolean; onPick: () => void; holding: boolean;
}) {
  const asset = ASSET_BY_ID.get(id)!;
  const c = change(data);
  const tick = data ? Math.sign(data.price - data.prev) : 0;
  return (
    <button
      onClick={onPick}
      className={cn(
        'w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 transition-colors',
        selected ? 'border-rose-400 bg-rose-400/10' : 'border-transparent hover:bg-brand-inner'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', SECTORS[asset.sector].dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="font-display font-black text-sm">{asset.id}</span>
          {holding && <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" title="Position ouverte" />}
        </div>
        <div className="text-[10px] text-tx-muted truncate">{asset.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn(
          'text-[12px] font-bold tabular-nums transition-colors duration-300',
          tick > 0 ? 'text-accent-success' : tick < 0 ? 'text-rose-400' : 'text-tx-base'
        )}>
          {data ? formatPrice(data.price) : '…'}
        </div>
        <div className={cn('text-[10px] font-black tabular-nums', c >= 0 ? 'text-accent-success' : 'text-rose-400')}>
          {data ? `${c >= 0 ? '+' : ''}${c.toFixed(2)} %` : ''}
        </div>
      </div>
    </button>
  );
}

const INTRO_KEY = 'krash_intro_seen';

export default function KrashMarketPage() {
  const wallet = useKrashWallet();
  const positions = useKrashPositions();

  const [market, setMarket] = useState<MarketId>('frx');
  const [selected, setSelected] = useState<Record<MarketId, string>>({ frx: 'LVMX', crypto: 'BTC' });
  const [range, setRange] = useState<Range>('15m');
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('krash_view') || 'null');
      if (saved?.market && MARKET_ORDER.includes(saved.market)) setMarket(saved.market);
      if (saved?.selected) setSelected((s) => ({ ...s, ...saved.selected }));
      if (!localStorage.getItem(INTRO_KEY)) setIntro(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('krash_view', JSON.stringify({ market, selected })); } catch {}
  }, [market, selected]);

  const { snapshot, live } = useKrashMarket(market);
  const assetId = selected[market];
  const asset = ASSET_BY_ID.get(assetId)!;
  const byId = useMemo(() => new Map((snapshot?.assets ?? []).map((a) => [a.id, a])), [snapshot]);
  const current = byId.get(assetId);
  const price = current?.price ?? null;

  // History from the cache, live ticks appended on top.
  const [history, setHistory] = useState<{ key: string; to: number; points: [number, number][] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const key = `${assetId}:${range}`;
    const load = async () => {
      const to = Math.floor(serverNow() / 60) * 60 - 60;
      try {
        const res = await fetch(`/api/krash/chart?asset=${assetId}&range=${range}&to=${to}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setHistory({ key, to: data.to, points: data.points });
      } catch {}
    };
    void load();
    // Longer views drift out of date; refetch them now and then.
    const id = setInterval(load, range === '15m' ? 120_000 : 300_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [assetId, range]);

  const points = useMemo<[number, number][]>(() => {
    const base = history?.key === `${assetId}:${range}` ? history.points : [];
    const cutoff = base.length ? base[base.length - 1][0] : 0;
    const tail = (live.get(assetId) ?? []).filter(([t]) => t > cutoff);
    const all = [...base, ...tail];
    const from = (all.length ? all[all.length - 1][0] : 0) - RANGE_SECONDS[range];
    return all.filter(([t]) => t >= from);
    // `snapshot` changes every tick and is what refreshes `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, assetId, range, snapshot]);

  const openHere = positions.open.filter((p) => p.asset === assetId);
  const lines: ChartLine[] = openHere.flatMap((p) => {
    const out: ChartLine[] = [{ price: p.entry_price, kind: 'entry', label: `${p.side === 'long' ? '↑' : '↓'} x${p.leverage}` }];
    const liq = liquidationPrice(p);
    if (liq !== null) out.push({ price: liq, kind: 'liquidation', label: 'LIQ' });
    return out;
  });

  // A position that just hit zero on screen: ask the server to settle it.
  const lastSweep = useRef(0);
  useEffect(() => {
    if (!snapshot) return;
    const broken = positions.open.some((p) => {
      const pr = byId.get(p.asset)?.price;
      return pr !== undefined && p.market === market && positionValue(p, pr) === 0;
    });
    if (broken && Date.now() - lastSweep.current > 4000) {
      lastSweep.current = Date.now();
      void positions.reload();
    }
  }, [snapshot, positions, byId, market]);

  const now = snapshot?.at ?? serverNow();
  const c = change(current);
  const holdings = new Set(positions.open.map((p) => p.asset));

  const pick = (id: string) => { sfx.select(); setSelected((s) => ({ ...s, [market]: id })); };

  return (
    <KrashShell wide badge={positions.open.length}>
      {intro && (
        <div className="relative mb-4 bg-brand-card border-4 border-rose-400/70 rounded-[24px] p-4 pr-12 shadow-brutal">
          <button
            onClick={() => { setIntro(false); try { localStorage.setItem(INTRO_KEY, '1'); } catch {} }}
            aria-label="Fermer"
            className="absolute top-3 right-3 h-8 w-8 rounded-lg border-2 border-brand-border flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="font-display font-black text-lg">Comment ça marche</div>
          <ul className="mt-1.5 grid md:grid-cols-3 gap-2 text-[13px] text-tx-secondary leading-snug">
            <li><b className="text-accent-success">Acheter</b> : tu gagnes si la cote monte. <b className="text-rose-400">Vendre</b> : tu gagnes si elle baisse.</li>
            <li>Les <b className="text-tx-base">news</b> font bouger les cotes. Chaque news indique ses chances de hausse ou de baisse.</li>
            <li>Ton argent reste placé jusqu’à ce que tu le <b className="text-tx-base">retires</b>, même si tu changes de marché. Tout est dans Placements.</li>
          </ul>
        </div>
      )}

      {/* Three columns only when the middle one can still hold the chart and
          the ticket side by side; below that the news drops under them. */}
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_340px]">
        {/* Assets */}
        <aside className="bg-brand-card border-4 border-brand-border rounded-[24px] shadow-brutal p-3 lg:max-h-[calc(100vh-120px)] flex flex-col min-h-0">
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {MARKET_ORDER.map((m) => (
              <button
                key={m}
                onClick={() => { sfx.click(); setMarket(m); }}
                className={cn(
                  'h-10 rounded-xl border-2 font-display font-black text-xs tracking-wider uppercase',
                  market === m ? 'border-rose-400 text-rose-300 bg-rose-400/10' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
                )}
              >
                {MARKETS[m].label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-tx-muted px-1 mb-1">{MARKETS[market].description} Variation sur 1 h.</p>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto min-h-0 -mx-1 px-1 pb-1">
            {assetsOf(market).map((a) => (
              <div key={a.id} className="shrink-0 w-[170px] lg:w-auto">
                <AssetRow id={a.id} data={byId.get(a.id)} selected={a.id === assetId} onPick={() => pick(a.id)} holding={holdings.has(a.id)} />
              </div>
            ))}
          </div>
        </aside>

        {/* Chart and ticket */}
        <div className="space-y-4 min-w-0">
          <section className="bg-brand-card border-4 border-brand-border rounded-[24px] shadow-brutal p-4">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-tx-muted">
                  <span className={cn('h-2 w-2 rounded-full', SECTORS[asset.sector].dot)} />
                  {SECTORS[asset.sector].label} · {asset.cap >= 100 ? 'géante' : asset.cap >= 30 ? 'grande' : 'moyenne'} capitalisation
                </div>
                <div className="font-display text-3xl font-black leading-tight">{asset.name} <span className="text-tx-muted text-lg">{asset.id}</span></div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-display text-3xl font-black tabular-nums leading-tight">{price !== null ? formatPrice(price) : '…'}</div>
                <div className={cn('text-sm font-black tabular-nums', c >= 0 ? 'text-accent-success' : 'text-rose-400')}>
                  {current ? `${c >= 0 ? '▲ +' : '▼ '}${c.toFixed(2)} % sur 1 h` : ''}
                </div>
              </div>
            </div>
            <PriceChart points={points} lines={lines} news={snapshot?.news.filter((n) => n.markets.includes(market)) ?? []} />
            <div className="mt-2 flex gap-1.5">
              {(['15m', '1h', '6h'] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    'h-8 px-3 rounded-lg border-2 text-[11px] font-black',
                    range === r ? 'border-tx-base text-tx-base' : 'border-brand-border text-tx-muted hover:text-tx-base'
                  )}
                >
                  {r.replace('m', ' min').replace('h', ' h')}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-tx-muted self-center">Traits en bas : les news</span>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <TradePanel
              asset={asset}
              price={price}
              balance={wallet.balance}
              trades={positions.stats?.trades ?? 0}
              busy={positions.busy === 'open'}
              onOpen={(side, leverage, stake) => positions.openPosition({ asset: assetId, side, leverage, stake })}
            />

            <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-black tracking-wider uppercase">Sur {asset.id}</h2>
                <Link href="/krash/placements" className="flex items-center text-[11px] font-black text-tx-muted hover:text-tx-base">
                  {positions.open.length} au total <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {openHere.length === 0 ? (
                <p className="text-[13px] text-tx-muted leading-snug py-6 text-center">
                  Aucune position sur {asset.name}.<br />Achète si tu penses que ça monte, vends si ça baisse.
                </p>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {openHere.map((p) => (
                    <PositionCard
                      key={p.id}
                      position={p}
                      price={price}
                      compact
                      busy={positions.busy === p.id || positions.busy === 'all'}
                      onClose={() => positions.closePosition(p)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <NewsFeed
          news={snapshot?.news ?? []}
          market={market}
          now={now}
          className="max-h-[70vh] lg:col-span-2 xl:col-span-1 xl:max-h-[calc(100vh-120px)]"
        />
      </div>
    </KrashShell>
  );
}
