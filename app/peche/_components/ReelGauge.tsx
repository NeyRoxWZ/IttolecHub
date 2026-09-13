'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Seconds at the start where the fish holds still and nothing drains. */
const GRACE = 1.5;

/**
 * The reeling mini-game. A green zone follows the fish up and down the bar;
 * holding (mouse, finger or space bar) pushes the cursor up, letting go lets
 * it sink. Staying in the zone fills the catch meter, leaving it drains it —
 * slowly: the first version was over before players could react. Never
 * leaving the zone after the grace period is a perfect catch.
 */
export default function ReelGauge({
  green, speed, fill = 0.28, drain = 0.1, onDone,
}: {
  green: number;
  speed: number;
  /** Meter gained per second in the zone / lost per second outside: rarer fish drain faster. */
  fill?: number;
  drain?: number;
  onDone: (quality: 'perfect' | 'good' | 'fail') => void;
}) {
  const [, force] = useState(0);
  const s = useRef({
    cursor: 0.5, vel: 0, zone: 0.5, zoneVel: 0, target: 0.5,
    progress: 0.4, perfect: true, t: 0, holding: false, done: false,
  });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const setHold = useCallback((v: boolean) => { s.current.holding = v; }, []);

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
    const loop = (now: number) => {
      const st = s.current;
      if (st.done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.t += dt;
      const started = st.t > GRACE;

      if (started) {
        if (Math.random() < dt * (0.5 + speed * 2)) st.target = 0.15 + Math.random() * 0.7;
        st.zoneVel += (st.target - st.zone) * dt * 5 * speed;
        st.zoneVel *= 0.9;
        st.zone = Math.max(green / 2, Math.min(1 - green / 2, st.zone + st.zoneVel * dt * 3));
      }

      st.vel += (st.holding ? 1.6 : -1.3) * dt;
      st.vel = Math.max(-0.8, Math.min(0.8, st.vel));
      st.cursor += st.vel * dt;
      if (st.cursor < 0) { st.cursor = 0; st.vel = 0; }
      if (st.cursor > 1) { st.cursor = 1; st.vel = 0; }

      const inside = Math.abs(st.cursor - st.zone) <= green / 2;
      if (started) {
        if (!inside) st.perfect = false;
        st.progress += (inside ? fill : -drain) * dt;
      } else if (inside) {
        st.progress += 0.12 * dt;
      }

      if (st.progress >= 1 || st.progress <= 0 || st.t > 25) {
        st.done = true;
        doneRef.current(st.progress >= 1 ? (st.perfect ? 'perfect' : 'good') : 'fail');
        force((n) => n + 1);
        return;
      }
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [green, speed, fill, drain]);

  const st = s.current;
  const inside = Math.abs(st.cursor - st.zone) <= green / 2;

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
        <div className="font-display text-2xl leading-tight">{st.t < GRACE ? 'Prépare-toi…' : 'Ça mord !'}</div>
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
