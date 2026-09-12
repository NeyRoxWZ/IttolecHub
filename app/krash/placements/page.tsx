'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ASSET_BY_ID, MARKETS, MARKET_ORDER, type MarketId } from '@/lib/krash/assets';
import KrashShell from '../_components/KrashShell';
import PositionCard, { livePnl } from '../_components/PositionCard';
import { useKrashMarket } from '../_lib/useKrashMarket';
import { useKrashPositions, type KrashPosition } from '../_lib/useKrashPositions';

const fmt = (n: number) => Math.abs(n).toLocaleString('fr-FR');
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(n)} ₶`;

function when(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Every open position, all markets together, with one button to take
 * everything out. The answer to "where is my money?" without opening each
 * market one by one.
 */
export default function PlacementsPage() {
  const positions = useKrashPositions();
  const [confirming, setConfirming] = useState(false);

  const has = (m: MarketId) => positions.open.some((p) => p.market === m);
  // One poll per market that actually holds a position; the others stay idle.
  const frx = useKrashMarket('frx', has('frx'));
  const global = useKrashMarket('global', has('global'));
  const crypto = useKrashMarket('crypto', has('crypto'));
  const meme = useKrashMarket('meme', has('meme'));
  const matieres = useKrashMarket('matieres', has('matieres'));

  const prices = useMemo(() => {
    const map = new Map<string, number>();
    for (const snap of [frx.snapshot, global.snapshot, crypto.snapshot, meme.snapshot, matieres.snapshot]) {
      for (const a of snap?.assets ?? []) map.set(a.id, a.price);
    }
    return map;
  }, [frx.snapshot, global.snapshot, crypto.snapshot, meme.snapshot, matieres.snapshot]);

  const priceOf = (p: KrashPosition) => prices.get(p.asset) ?? null;

  const totals = positions.open.reduce(
    (acc, p) => {
      const live = livePnl(p, priceOf(p));
      acc.staked += p.stake;
      if (live) { acc.value += live.payout; acc.pnl += live.pnl; } else acc.pending = true;
      return acc;
    },
    { staked: 0, value: 0, pnl: 0, pending: false },
  );

  const stats = positions.stats;

  return (
    <KrashShell title="Mes placements" badge={positions.open.length}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Placé</div>
                <div className="font-display text-2xl font-black tabular-nums">{fmt(totals.staked)} ₶</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Si je retire</div>
                <div className="font-display text-2xl font-black tabular-nums">{totals.pending ? '…' : `${fmt(totals.value)} ₶`}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Gain / perte</div>
                <div className={cn('font-display text-2xl font-black tabular-nums', totals.pnl >= 0 ? 'text-accent-success' : 'text-rose-400')}>
                  {totals.pending ? '…' : signed(totals.pnl)}
                </div>
              </div>
            </div>

            {positions.open.length > 0 && (
              confirming ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider"
                  >
                    ANNULER
                  </button>
                  <button
                    onClick={async () => { await positions.closeAll(); setConfirming(false); }}
                    disabled={positions.busy === 'all'}
                    className="h-12 rounded-xl bg-rose-500 text-white border-2 border-brand-border font-display font-black text-xs tracking-wider disabled:opacity-50"
                  >
                    {positions.busy === 'all' ? '…' : `OUI, TOUT RETIRER (${positions.open.length})`}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="mt-4 w-full h-12 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border shadow-brutal font-display font-black tracking-wider"
                >
                  TOUT RETIRER · {totals.pending ? '…' : `${fmt(totals.value)} ₶`}
                </button>
              )
            )}
          </section>

          {!positions.loaded ? (
            <p className="text-tx-muted text-center py-10">Chargement…</p>
          ) : positions.open.length === 0 ? (
            <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-8 shadow-brutal text-center">
              <div className="font-display text-xl font-black">Rien de placé pour l’instant</div>
              <p className="text-tx-muted text-sm mt-1">Choisis une action ou une crypto et parie sur sa direction.</p>
              <Link href="/krash" className="mt-5 inline-flex h-12 px-6 items-center rounded-xl bg-rose-500 text-white font-display font-black tracking-wider border-2 border-brand-border">
                ALLER AU MARCHÉ
              </Link>
            </div>
          ) : (
            MARKET_ORDER.filter(has).map((m) => {
              const list = positions.open.filter((p) => p.market === m);
              return (
                <section key={m}>
                  <h2 className="font-display font-black tracking-widest uppercase text-sm text-tx-muted mb-2 px-1">
                    {MARKETS[m].label} · {list.length}
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((p) => (
                      <PositionCard
                        key={p.id}
                        position={p}
                        price={priceOf(p)}
                        busy={positions.busy === p.id || positions.busy === 'all'}
                        onClose={() => positions.closePosition(p)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
            <h2 className="font-display font-black tracking-wider uppercase mb-3">Mon bilan</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Profit total', value: stats ? signed(Number(stats.realized_pnl)) : '…', tone: Number(stats?.realized_pnl ?? 0) >= 0 ? 'text-accent-success' : 'text-rose-400' },
                { label: 'Meilleur coup', value: stats ? `+${fmt(stats.best_trade)} ₶` : '…', tone: 'text-accent-primary' },
                { label: 'Trades', value: stats ? String(stats.trades) : '…', tone: 'text-tx-base' },
                { label: 'Gagnants', value: stats ? `${Math.round((stats.wins / Math.max(1, stats.trades)) * 100)} %` : '…', tone: 'text-tx-base' },
                { label: 'Liquidations', value: stats ? String(stats.liquidations) : '…', tone: 'text-rose-400' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
                  <div className={cn('font-display font-black tabular-nums', s.tone)}>{s.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
            <h2 className="font-display font-black tracking-wider uppercase mb-3">Derniers trades</h2>
            {positions.recent.length === 0 ? (
              <p className="text-[13px] text-tx-muted">Aucun trade fermé.</p>
            ) : (
              <ul className="space-y-1.5">
                {positions.recent.map((p) => {
                  const pnl = (p.payout ?? 0) - p.stake - p.fee;
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-[12px]">
                      <span className="font-display font-black w-12 shrink-0">{p.asset}</span>
                      <span className={cn('shrink-0 text-[10px] font-black', p.side === 'long' ? 'text-accent-success' : 'text-rose-400')}>
                        {p.side === 'long' ? '↑' : '↓'}x{p.leverage}
                      </span>
                      {p.status === 'liquidated' && <span className="shrink-0 px-1 rounded bg-rose-500/20 text-rose-400 text-[9px] font-black">LIQUIDÉ</span>}
                      <span className="text-tx-muted truncate">{when(p.closed_at)}</span>
                      <span className={cn('ml-auto font-black tabular-nums shrink-0', pnl >= 0 ? 'text-accent-success' : 'text-rose-400')}>{signed(pnl)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-[11px] text-tx-muted px-1 leading-snug">
            {ASSET_BY_ID.size} actifs cotés. Une position à levier se ferme toute seule si la cote va trop loin contre toi, même quand tu n’es pas connecté.
          </p>
        </aside>
      </div>
    </KrashShell>
  );
}
