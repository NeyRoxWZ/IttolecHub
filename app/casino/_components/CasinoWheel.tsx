'use client';

import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';

export interface WheelSegment {
  label: string;
  color: string;
  textColor?: string;
}

export interface CasinoWheelHandle {
  /** Start free-spinning immediately (before the result is known). */
  startSpin: () => void;
  /** Decelerate onto a segment. Resolves when the wheel has stopped. */
  settleOn: (index: number) => Promise<void>;
  stop: () => void;
}

interface CasinoWheelProps {
  segments: WheelSegment[];
  size?: number;
  labelSize?: number;
  className?: string;
  /** Center content (result number, logo, ...). */
  hub?: React.ReactNode;
  spinSpeed?: number;
  settleMs?: number;
  settleTurns?: number;
}

/**
 * One wheel for the whole casino: the 37-pocket roulette and the 6-segment
 * daily wheel are the same component with different `segments`.
 *
 * Spin model: the wheel starts turning the instant the player commits (so
 * there's no dead wait while the server answers), then decelerates onto the
 * segment the server actually chose. The visual never decides the outcome.
 */
const CasinoWheel = forwardRef<CasinoWheelHandle, CasinoWheelProps>(function CasinoWheel(
  { segments, size = 320, labelSize, className, hub, spinSpeed = 900, settleMs = 2000, settleTurns = 3 },
  ref
) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef(0);

  const segAngle = 360 / segments.length;
  const fontSize = labelSize ?? Math.max(8, Math.min(13, 420 / segments.length));

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const apply = (deg: number, transition?: string) => {
    if (!wheelRef.current) return;
    wheelRef.current.style.transition = transition || 'none';
    wheelRef.current.style.transform = `rotate(${deg}deg)`;
  };

  useImperativeHandle(ref, () => ({
    startSpin() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      let last = performance.now();
      const loop = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        angleRef.current += spinSpeed * dt;
        apply(angleRef.current);
        // Audible tick as pockets pass the pointer.
        tickRef.current += spinSpeed * dt;
        if (tickRef.current >= segAngle * 2) { tickRef.current = 0; sfx.tick(); }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },

    settleOn(index: number) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Pointer sits at 12 o'clock. Segment i is centred at (i+0.5)*segAngle
      // clockwise from the wheel's own 0, so we need that much *negative*
      // rotation (mod 360) to bring it under the pointer.
      const target = (360 - (index + 0.5) * segAngle) % 360;
      const current = ((angleRef.current % 360) + 360) % 360;
      let delta = target - current;
      if (delta < 0) delta += 360;

      const final = angleRef.current + delta + settleTurns * 360;
      angleRef.current = final;
      apply(final, `transform ${settleMs}ms cubic-bezier(0.12, 0.68, 0.06, 1)`);

      // Ticks that thin out as it slows, like a real wheel.
      let elapsed = 0;
      const scheduleTick = () => {
        if (elapsed >= settleMs) return;
        const progress = elapsed / settleMs;
        const gap = 55 + progress * progress * 420;
        elapsed += gap;
        window.setTimeout(() => { if (elapsed < settleMs) sfx.tick(); scheduleTick(); }, gap);
      };
      scheduleTick();

      return new Promise<void>((resolve) => window.setTimeout(resolve, settleMs));
    },

    stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
  }));

  const background = useMemo(() => {
    const stops = segments.map((s, i) => `${s.color} ${(i * segAngle).toFixed(3)}deg ${((i + 1) * segAngle).toFixed(3)}deg`);
    return `conic-gradient(${stops.join(', ')})`;
  }, [segments, segAngle]);

  const separators = useMemo(() => {
    const w = Math.min(0.5, segAngle / 40);
    const stops: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      const b = i * segAngle;
      stops.push(
        `transparent ${(b - w).toFixed(2)}deg`,
        `rgba(0,0,0,0.55) ${(b - w).toFixed(2)}deg`,
        `rgba(0,0,0,0.55) ${(b + w).toFixed(2)}deg`,
        `transparent ${(b + w).toFixed(2)}deg`
      );
    }
    return stops.length ? `conic-gradient(${stops.join(', ')})` : 'none';
  }, [segments.length, segAngle]);

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {/* Pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -10 }}>
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '11px solid transparent',
            borderRight: '11px solid transparent',
            borderTop: '20px solid var(--casino-gold, #FFD000)',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.6))',
          }}
        />
      </div>

      <div
        ref={wheelRef}
        className="relative w-full h-full rounded-full border-4 border-brand-border"
        style={{ background, willChange: 'transform' }}
      >
        {separators !== 'none' && (
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: separators }} />
        )}

        {segments.map((s, i) => (
          <div key={i} className="absolute inset-0 pointer-events-none" style={{ transform: `rotate(${i * segAngle + segAngle / 2}deg)` }}>
            <span
              className="absolute left-1/2 -translate-x-1/2 font-bold select-none whitespace-nowrap"
              style={{
                top: size > 220 ? 10 : 6,
                fontSize,
                color: s.textColor || '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {hub !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {hub}
        </div>
      )}
    </div>
  );
});

export default CasinoWheel;
