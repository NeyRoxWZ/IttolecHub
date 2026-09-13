'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The reeling mini-game. A green zone follows the fish up and down the bar;
 * holding (mouse, finger or space bar) pushes the cursor up, letting go lets
 * it sink. Staying in the zone fills the catch meter, leaving it drains it.
 * Never leaving the zone after the first moment is a perfect catch.
 */
export default function ReelGauge({
  green, speed, onDone,
}: {
  green: number;
  speed: number;
  onDone: (quality: 'perfect' | 'good' | 'fail') => void;
}) {
  const [, force] = useState(0);
  const s = useRef({
    cursor: 0.2, vel: 0, zone: 0.5, zoneVel: 0, target: 0.5,
    progress: 0.3, perfect: true, t: 0, holding: false, done: false,
  });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const setHold = useCallback((v: boolean) => { s.current.holding = v; }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); setHold(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setHold(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerup', () => setHold(false));
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
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

      // The fish picks a new spot now and then and drags the zone toward it.
      if (Math.random() < dt * (0.8 + speed)) st.target = 0.12 + Math.random() * 0.76;
      st.zoneVel += (st.target - st.zone) * dt * 6 * speed;
      st.zoneVel *= 0.9;
      st.zone = Math.max(green / 2, Math.min(1 - green / 2, st.zone + st.zoneVel * dt * 3));

      st.vel += (st.holding ? 2.6 : -2.2) * dt;
      st.vel = Math.max(-1.2, Math.min(1.2, st.vel));
      st.cursor += st.vel * dt;
      if (st.cursor < 0) { st.cursor = 0; st.vel = 0; }
      if (st.cursor > 1) { st.cursor = 1; st.vel = 0; }

      const inside = Math.abs(st.cursor - st.zone) <= green / 2;
      if (!inside && st.t > 0.6) st.perfect = false;
      st.progress += (inside ? 0.32 : -0.24) * dt;

      if (st.progress >= 1 || st.progress <= 0 || st.t > 15) {
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
  }, [green, speed]);

  const st = s.current;
  const inside = Math.abs(st.cursor - st.zone) <= green / 2;

  return (
    <div className="flex items-stretch gap-3 select-none touch-none">
      <div
        className="relative w-16 h-64 rounded-2xl border-4 border-brand-border bg-[#0E1030] overflow-hidden cursor-pointer"
        onPointerDown={(e) => { e.preventDefault(); setHold(true); }}
        onPointerUp={() => setHold(false)}
        onPointerLeave={() => setHold(false)}
      >
        <div
          className="absolute left-1 right-1 rounded-lg border-[3px] border-brand-border"
          style={{
            bottom: `${(st.zone - green / 2) * 100}%`, height: `${green * 100}%`,
            background: inside ? '#33D17A' : '#1E9A55',
          }}
        />
        <div
          className="absolute left-0 right-0 h-2.5 bg-[#FFC61A] border-y-[3px] border-brand-border"
          style={{ bottom: `calc(${st.cursor * 100}% - 5px)` }}
        />
      </div>

      <div className="flex flex-col items-center justify-between">
        <div className="relative w-5 h-64 rounded-full border-[3px] border-brand-border bg-[#0E1030] overflow-hidden">
          <div
            className={cn('absolute left-0 right-0 bottom-0', st.progress > 0.66 ? 'bg-accent-success' : st.progress > 0.33 ? 'bg-accent-primary' : 'bg-accent-secondary')}
            style={{ height: `${Math.max(0, Math.min(1, st.progress)) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col justify-center gap-2 max-w-[150px]">
        <div className="font-display text-2xl leading-tight">Ça mord !</div>
        <p className="text-sm font-bold text-tx-secondary leading-snug">
          Maintiens (clic, doigt ou espace) pour garder le curseur jaune dans la zone verte.
        </p>
        <div className={cn('self-start px-2 py-0.5 rounded-lg border-2 border-brand-border font-display text-sm', st.perfect ? 'bg-accent-primary text-brand-bg' : 'bg-[#2B3170] text-tx-secondary')}>
          {st.perfect ? 'Parfait en cours' : 'Plus parfait'}
        </div>
      </div>
    </div>
  );
}
