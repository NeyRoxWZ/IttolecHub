'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  REEL_DT, REEL_GRACE, REEL_MAX_STEPS, isInside, newReel, stepReel,
  type ReelParams, type ReelResult,
} from '@/lib/peche/reel';

/**
 * The reeling mini-game. A green zone follows the fish up and down the bar;
 * holding (mouse, finger or space bar) pushes the cursor up, letting go lets
 * it sink. Staying in the zone fills the catch meter, leaving it drains it —
 * slowly: the first version was over before players could react. Never
 * leaving the zone after the grace period is a perfect catch.
 *
 * The simulation itself lives in lib/peche/reel.ts and runs in fixed steps
 * from the server's seed. This component draws it and records on which steps
 * the player pressed or released; the server replays those and decides.
 */
export default function ReelGauge({
  green, speed, fill = 0.28, drain = 0.1, seed, onDone,
}: {
  green: number;
  speed: number;
  /** Meter gained per second in the zone / lost per second outside: rarer fish drain faster. */
  fill?: number;
  drain?: number;
  /** From the server's cast: the fish moves the same way here and in its replay. */
  seed: number;
  onDone: (quality: ReelResult, input: { toggles: number[]; steps: number }) => void;
}) {
  const [, force] = useState(0);
  const params = useRef<ReelParams>({ green, speed, fill, drain, seed });
  const s = useRef(newReel(params.current));
  const holding = useRef(false);
  const lastHold = useRef(false);
  const toggles = useRef<number[]>([]);
  const finished = useRef(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const setHold = useCallback((v: boolean) => { holding.current = v; }, []);

  // Hold anywhere on the page, not just on the narrow bar: clicking or
  // touching outside it used to do nothing, so only the space bar worked.
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); setHold(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setHold(false); };
    const press = (e: Event) => { e.preventDefault(); setHold(true); };
    const release = () => setHold(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousedown', press);
    window.addEventListener('touchstart', press, { passive: false });
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousedown', press);
      window.removeEventListener('touchstart', press);
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
      window.removeEventListener('touchcancel', release);
      window.removeEventListener('blur', release);
    };
  }, [setHold]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const st = s.current;
      if (finished.current) return;
      // Real time accumulates; the simulation advances in fixed steps (at most a quarter second at once).
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      while (acc >= REEL_DT && !st.done && st.step < REEL_MAX_STEPS) {
        if (holding.current !== lastHold.current) {
          lastHold.current = holding.current;
          toggles.current.push(st.step);
        }
        stepReel(st, params.current, lastHold.current);
        acc -= REEL_DT;
      }

      if (st.done && st.result) {
        finished.current = true;
        doneRef.current(st.result, { toggles: toggles.current.slice(), steps: st.step });
        force((n) => n + 1);
        return;
      }
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const st = s.current;
  const inside = isInside(st, params.current);

  return (
    <div className="flex items-stretch gap-3 select-none touch-none">
      <div
        className="relative w-20 h-72 rounded-2xl border-4 border-brand-border bg-[#0E1030] overflow-hidden cursor-pointer"
      >
        <div
          className="absolute left-1 right-1 rounded-lg border-[3px] border-brand-border transition-colors"
          style={{ bottom: `${(st.zone - green / 2) * 100}%`, height: `${green * 100}%`, background: inside ? '#33D17A' : '#1E9A55' }}
        />
        <div className="absolute left-0 right-0 h-3 bg-[#FFC61A] border-y-[3px] border-brand-border" style={{ bottom: `calc(${st.cursor * 100}% - 6px)` }} />
      </div>

      <div className="relative w-6 h-72 rounded-full border-[3px] border-brand-border bg-[#0E1030] overflow-hidden">
        <div
          className={cn('absolute left-0 right-0 bottom-0', st.progress > 0.66 ? 'bg-accent-success' : st.progress > 0.33 ? 'bg-accent-primary' : 'bg-accent-secondary')}
          style={{ height: `${Math.max(0, Math.min(1, st.progress)) * 100}%` }}
        />
      </div>

      <div className="flex flex-col justify-center gap-2 max-w-[160px]">
        <div className="font-display text-2xl leading-tight">{st.t < REEL_GRACE ? 'Prépare-toi…' : 'Ça mord !'}</div>
        <p className="text-sm font-bold text-tx-secondary leading-snug">
          Maintiens le clic n’importe où (ou le doigt, ou espace) pour faire monter le curseur jaune dans la zone verte. Relâche pour descendre.
        </p>
        <div className={cn('self-start px-2 py-0.5 rounded-lg border-2 border-brand-border font-display text-sm', st.perfect ? 'bg-accent-primary text-brand-bg' : 'bg-[#2B3170] text-tx-secondary')}>
          {st.perfect ? 'Parfait en cours' : 'Plus parfait'}
        </div>
      </div>
    </div>
  );
}
