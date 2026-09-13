'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { krashCosmeticById } from '@/lib/krash/cosmetics';
import KrashCosmeticPreview from './KrashCosmeticPreview';

interface Point { t: string; balance: number; amount: number; kind: string }

interface Player {
  pseudo: string;
  balance: number;
  bestBalance: number;
  trades: number;
  wins: number;
  liquidations: number;
  realizedPnl: number;
  volume: number;
  bestTrade: number;
  cosmetics: number;
  passTier: number;
  title: string | null;
  emblem: string | null;
  points: Point[];
}

const W = 620;
const H = 200;
const PAD = 6;
const UP = '#00FF94';
const DOWN = '#FF2A55';

/** A Krash player's card with their balance curve, like the casino's player card. */
export default function KrashPlayerCard({ pseudo, onClose }: { pseudo: string; onClose: () => void }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch(`/api/krash/player?pseudo=${encodeURIComponent(pseudo)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erreur');
        setPlayer(data);
      })
      .catch((e) => setError(e.message));
  }, [pseudo]);

  const chart = useMemo(() => {
    const pts = player?.points ?? [];
    if (pts.length < 2) return null;
    const values = pts.map((p) => p.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
    const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(' ');
    const area = `${line} L ${x(pts.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
    return { pts, min, max, x, y, line, area, up: pts[pts.length - 1].balance >= pts[0].balance };
  }, [player]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chart || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const inView = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((inView - PAD) / (W - PAD * 2)) * (chart.pts.length - 1));
    setHover(Math.max(0, Math.min(chart.pts.length - 1, i)));
  };

  const point = hover !== null && chart ? chart.pts[hover] : null;
  const title = player?.title ? krashCosmeticById(player.title) : undefined;
  const emblem = player?.emblem ? krashCosmeticById(player.emblem) : undefined;
  const color = chart?.up ? UP : DOWN;

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {emblem && <KrashCosmeticPreview cosmetic={emblem} size={44} />}
            <div className="min-w-0">
              <h2 className="font-display text-xl font-black truncate">{pseudo}</h2>
              {title && <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: title.params.color }}>{title.params.title}</span>}
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-tx-secondary">{error}</p>}
        {!player && !error && <div className="h-[200px] rounded-2xl border-2 border-brand-border bg-brand-inner animate-pulse" />}

        {player && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Solde Krash', value: `${player.balance.toLocaleString('fr-FR')} ₶` },
                { label: 'Record de solde', value: `${player.bestBalance.toLocaleString('fr-FR')} ₶` },
                { label: 'Profit total', value: `${player.realizedPnl >= 0 ? '+' : ''}${player.realizedPnl.toLocaleString('fr-FR')} ₶`, tone: player.realizedPnl >= 0 ? 'text-accent-success' : 'text-rose-400' },
                { label: 'Meilleur coup', value: `+${player.bestTrade.toLocaleString('fr-FR')} ₶` },
                { label: 'Trades', value: `${player.trades}` },
                { label: 'Gagnants', value: `${Math.round((player.wins / Math.max(1, player.trades)) * 100)} %` },
                { label: 'Liquidations', value: `${player.liquidations}` },
                { label: 'Pass du mois', value: `Palier ${player.passTier}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
                  <div className={cn('font-display font-black text-sm tabular-nums truncate', s.tone)}>{s.value}</div>
                </div>
              ))}
            </div>

            {chart ? (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {chart.up ? <TrendingUp className="h-4 w-4 text-accent-success" /> : <TrendingDown className="h-4 w-4 text-rose-400" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Solde Krash sur les {chart.pts.length} derniers mouvements</span>
                  </div>
                  <span className="text-[10px] font-bold text-tx-muted tabular-nums">{chart.min.toLocaleString('fr-FR')} → {chart.max.toLocaleString('fr-FR')} ₶</span>
                </div>
                <div className="relative">
                  <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full block cursor-crosshair" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
                    <defs>
                      <linearGradient id="krashPlayerFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
                    <path d={chart.area} fill="url(#krashPlayerFill)" />
                    <path d={chart.line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    {hover !== null && point && (
                      <>
                        <line x1={chart.x(hover)} y1="0" x2={chart.x(hover)} y2={H} stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
                        <circle cx={chart.x(hover)} cy={chart.y(point.balance)} r="5" fill={color} stroke="#12121A" strokeWidth="2" />
                      </>
                    )}
                  </svg>
                  {point && (
                    <div
                      className="absolute -top-1 pointer-events-none rounded-lg border-2 border-brand-border bg-brand-card px-2.5 py-1.5 shadow-brutal"
                      style={{ left: `${(chart.x(hover!) / W) * 100}%`, transform: `translateX(${hover! > chart.pts.length / 2 ? '-105%' : '5%'})` }}
                    >
                      <div className="font-display font-black text-sm tabular-nums">{point.balance.toLocaleString('fr-FR')} ₶</div>
                      <div className={cn('text-[11px] font-black tabular-nums', point.amount > 0 ? 'text-accent-success' : point.amount < 0 ? 'text-rose-400' : 'text-tx-muted')}>
                        {point.amount > 0 ? '+' : ''}{point.amount.toLocaleString('fr-FR')} ₶
                      </div>
                      <div className="text-[10px] text-tx-muted capitalize">
                        {point.kind} · {new Date(point.t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-tx-secondary">Pas encore assez de mouvements pour tracer une courbe.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
