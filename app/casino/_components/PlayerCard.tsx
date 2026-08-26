'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrestigeTitle } from '@/lib/casino/meta';
import { GAME_LABELS } from '@/lib/casino/cosmetics';

interface Point {
  t: string;
  balance: number;
  amount: number;
  game: string;
  type: string;
}

interface Player {
  pseudo: string;
  balance: number;
  totalWagered: number;
  totalWon: number;
  bestStreak: number;
  biggestWin: number;
  biggestMultiplier: number;
  prestigeCount: number;
  allTimeBestBalance: number;
  achievements: number;
  achievementsTotal: number;
  cosmetics: number;
  points: Point[];
}

const W = 620;
const H = 200;
const PAD = 6;

/**
 * A player's balance over their last few hundred moves. The curve is drawn as
 * a plain SVG path — a chart library would be a lot of weight for one line —
 * and the pointer reads the nearest point rather than the exact pixel, so a
 * hover between two moves still answers.
 */
export default function PlayerCard({ pseudo, onClose }: { pseudo: string; onClose: () => void }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetch(`/api/casino/player?pseudo=${encodeURIComponent(pseudo)}`)
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
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (chart.pts.length - 1));
    setHover(Math.max(0, Math.min(chart.pts.length - 1, i)));
  };

  const point = hover !== null && chart ? chart.pts[hover] : null;
  const title = player ? getPrestigeTitle(player.prestigeCount) : null;

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-black truncate">{pseudo}</h2>
            {title && <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary">{title}</span>}
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-sm text-tx-secondary">{error}</p>}
        {!player && !error && <div className="h-[200px] rounded-2xl border-2 border-brand-border bg-brand-inner animate-pulse" />}

        {player && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Solde', value: `${player.balance.toLocaleString('en-US')} ₶` },
                { label: 'Total misé', value: `${player.totalWagered.toLocaleString('en-US')} ₶` },
                { label: 'Total gagné', value: `${player.totalWon.toLocaleString('en-US')} ₶` },
                { label: 'Record de solde', value: `${player.allTimeBestBalance.toLocaleString('en-US')} ₶` },
                { label: 'Plus gros gain', value: `${player.biggestWin.toLocaleString('en-US')} ₶` },
                { label: 'Meilleur multi.', value: `×${player.biggestMultiplier}` },
                { label: 'Meilleure série', value: `${player.bestStreak}` },
                { label: 'Succès', value: `${player.achievements}/${player.achievementsTotal}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
                  <div className="font-display font-black text-sm tabular-nums truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {chart ? (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {chart.up
                      ? <TrendingUp className="h-4 w-4 text-accent-success" />
                      : <TrendingDown className="h-4 w-4 text-accent-secondary" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                      Solde sur les {chart.pts.length} dernières parties
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-tx-muted tabular-nums">
                    {chart.min.toLocaleString('en-US')} → {chart.max.toLocaleString('en-US')} ₶
                  </span>
                </div>

                <div className="relative">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full block cursor-crosshair"
                    style={{ height: H }}
                    onMouseMove={onMove}
                    onMouseLeave={() => setHover(null)}
                  >
                    <defs>
                      <linearGradient id="playerFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chart.up ? '#00FF94' : '#FF2A55'} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={chart.up ? '#00FF94' : '#FF2A55'} stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {[0.25, 0.5, 0.75].map((f) => (
                      <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                    ))}

                    <path d={chart.area} fill="url(#playerFill)" />
                    <path
                      d={chart.line}
                      fill="none"
                      stroke={chart.up ? '#00FF94' : '#FF2A55'}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {hover !== null && point && (
                      <>
                        <line
                          x1={chart.x(hover)} y1="0" x2={chart.x(hover)} y2={H}
                          stroke="rgba(255,255,255,0.28)" strokeWidth="1"
                        />
                        <circle
                          cx={chart.x(hover)} cy={chart.y(point.balance)} r="5"
                          fill={chart.up ? '#00FF94' : '#FF2A55'} stroke="#12121A" strokeWidth="2"
                        />
                      </>
                    )}
                  </svg>

                  {point && (
                    <div
                      className="absolute -top-1 pointer-events-none rounded-lg border-2 border-brand-border bg-brand-card px-2.5 py-1.5 shadow-brutal"
                      style={{
                        left: `${(chart.x(hover!) / W) * 100}%`,
                        transform: `translateX(${hover! > chart.pts.length / 2 ? '-105%' : '5%'})`,
                      }}
                    >
                      <div className="font-display font-black text-sm tabular-nums">
                        {point.balance.toLocaleString('en-US')} ₶
                      </div>
                      <div className={cn(
                        'text-[11px] font-black tabular-nums',
                        point.amount > 0 ? 'text-accent-success' : point.amount < 0 ? 'text-accent-secondary' : 'text-tx-muted'
                      )}>
                        {point.amount > 0 ? '+' : ''}{point.amount.toLocaleString('en-US')} ₶
                      </div>
                      <div className="text-[10px] text-tx-muted">
                        {GAME_LABELS[point.game] || point.game}
                        {' · '}
                        {new Date(point.t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-tx-secondary">Pas encore assez de parties pour tracer une courbe.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
