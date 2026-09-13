'use client';

import { useId, useMemo } from 'react';
import type { NewsCategory } from '@/lib/krash/newsMeta';

const CATEGORY_HEX: Record<NewsCategory, string> = {
  geo: '#ef4444', eco: '#34d399', energie: '#facc15', tech: '#38bdf8',
  entreprise: '#a78bfa', crypto: '#fb923c', rumeur: '#a1a1aa',
};

const UP = '#00FF94';
const DOWN = '#FF4D6D';

export interface ChartLine { price: number; kind: 'entry' | 'liquidation'; label: string }

/**
 * The price curve. Plain SVG: a few hundred points redrawn every two seconds
 * is nothing a charting library would do better.
 *
 * Dashed lines mark the player's entries and where they would be liquidated;
 * the small coloured ticks along the bottom are headlines, so a jump in the
 * curve can be matched to the news that caused it.
 */
export default function PriceChart({
  points, lines = [], news = [], height = 280, colors, arrow,
}: {
  points: [number, number][];
  lines?: ChartLine[];
  news?: { at: number; category: NewsCategory }[];
  height?: number;
  /** Rising and falling colours, from the player's chart skin. */
  colors?: { up: string; down: string };
  /** A headline that just landed on this asset: which way it pushes. */
  arrow?: { key: string; up: boolean; label: string } | null;
}) {
  const upColor = colors?.up ?? UP;
  const downColor = colors?.down ?? DOWN;
  const gradientId = useId();

  const view = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0][0];
    const t1 = points[points.length - 1][0];
    let lo = Infinity, hi = -Infinity;
    for (const [, p] of points) { lo = Math.min(lo, p); hi = Math.max(hi, p); }
    // Entry lines always count; a liquidation line only when it is close
    // enough not to flatten the curve into a ruler.
    for (const l of lines) {
      if (l.kind === 'entry' || (l.price > lo - (hi - lo) * 1.5 && l.price < hi + (hi - lo) * 1.5)) {
        lo = Math.min(lo, l.price); hi = Math.max(hi, l.price);
      }
    }
    const pad = (hi - lo) * 0.08 || hi * 0.002;
    lo -= pad; hi += pad;
    const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * 1000;
    const y = (p: number) => 300 - ((p - lo) / (hi - lo)) * 300;
    const path = points.map(([t, p], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(p).toFixed(1)}`).join('');
    const rising = points[points.length - 1][1] >= points[0][1];
    return { path, x, y, t0, t1, lo, hi, rising, lastY: y(points[points.length - 1][1]) };
  }, [points, lines]);

  if (!view) {
    return (
      <div style={{ height }} className="rounded-2xl border-2 border-brand-border bg-brand-inner flex items-center justify-center text-tx-muted text-sm">
        Chargement de la courbe…
      </div>
    );
  }

  const color = view.rising ? upColor : downColor;

  return (
    <div style={{ height }} className="relative rounded-2xl border-2 border-brand-border bg-brand-inner overflow-hidden">
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[75, 150, 225].map((gy) => (
          <line key={gy} x1="0" x2="1000" y1={gy} y2={gy} stroke="currentColor" className="text-brand-border" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" />
        ))}

        <path d={`${view.path}L1000,300L0,300Z`} fill={`url(#${gradientId})`} />
        <path d={view.path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />

        {lines.map((l, i) => {
          if (l.price < view.lo || l.price > view.hi) return null;
          const ly = view.y(l.price);
          return (
            <line
              key={i} x1="0" x2="1000" y1={ly} y2={ly}
              stroke={l.kind === 'entry' ? '#FFD000' : DOWN}
              strokeWidth="1.5" strokeDasharray={l.kind === 'entry' ? '8 6' : '3 5'}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {news.filter((n) => n.at >= view.t0 && n.at <= view.t1).map((n) => (
          <rect key={`${n.at}`} x={view.x(n.at) - 2} y="284" width="4" height="16" fill={CATEGORY_HEX[n.category]} />
        ))}
      </svg>

      {/* Labels in HTML so the stretched SVG does not squash the text. */}
      {lines.map((l, i) => {
        if (l.price < view.lo || l.price > view.hi) return null;
        return (
          <div
            key={i}
            style={{ top: `${(view.y(l.price) / 300) * 100}%` }}
            className={`absolute left-2 -translate-y-1/2 px-1.5 rounded text-[10px] font-black ${l.kind === 'entry' ? 'bg-accent-primary text-brand-bg' : 'bg-rose-500 text-white'}`}
          >
            {l.label}
          </div>
        );
      })}
      {arrow && (
        <div
          key={arrow.key}
          className={`pointer-events-none absolute right-8 flex flex-col items-center animate-in fade-in zoom-in-50 duration-500 ${arrow.up ? 'top-3' : 'bottom-6'}`}
        >
          <span
            className={`font-display font-black leading-none text-6xl drop-shadow-[0_0_14px_currentColor] ${arrow.up ? 'animate-bounce text-accent-success' : 'animate-bounce text-rose-400'}`}
          >
            {arrow.up ? '▲' : '▼'}
          </span>
          <span className={`mt-1 px-2 py-0.5 rounded-md text-[10px] font-black ${arrow.up ? 'bg-accent-success text-brand-bg' : 'bg-rose-500 text-white'}`}>
            NEWS · {arrow.label}
          </span>
        </div>
      )}
      <div
        style={{ top: `${(view.lastY / 300) * 100}%`, background: color }}
        className="absolute right-0 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full shadow-[0_0_12px_currentColor] animate-pulse"
      />
    </div>
  );
}
