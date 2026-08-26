'use client';

import { useEffect, useRef } from 'react';
import { getActiveCosmetics } from '@/lib/casino/activeCosmetics';

interface ConfettiProps {
  /** Bump this number to fire a burst. */
  trigger: number;
  intensity?: 'small' | 'big' | 'huge';
}

interface Piece {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vrot: number; life: number;
}

const COLORS = ['#FFD000', '#FF2A55', '#00FF94', '#4FC3F7', '#FFFFFF', '#B388FF'];

/** Canvas confetti burst — no dependency, cleans itself up when idle. */
export default function Confetti({ trigger, intensity = 'big' }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The equipped win effect decides the palette and how the burst moves.
    const fx = getActiveCosmetics().win_fx?.params;
    const palette = fx?.colors?.length ? fx.colors : COLORS;
    const style = fx?.winStyle || 'confetti';
    const count = intensity === 'huge' ? 220 : intensity === 'big' ? 120 : 55;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    for (let i = 0; i < count; i++) {
      const spread = style === 'shock' ? 1.6 : style === 'coins' ? 0.6 : 1;
      const lift = style === 'coins' ? -Math.random() * 9 - 3 : -Math.random() * 13 - 5;
      piecesRef.current.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.42,
        vx: (Math.random() - 0.5) * 13 * spread,
        vy: lift,
        size: 5 + Math.random() * 7,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.35,
        life: 1,
      });
    }

    if (rafRef.current) return; // a burst is already animating; new pieces just join it

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      piecesRef.current = piecesRef.current.filter((p) => p.life > 0 && p.y < h + 40);

      for (const p of piecesRef.current) {
        p.vy += 0.36;      // gravity
        p.vx *= 0.995;     // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life -= 0.006;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
        ctx.restore();
      }

      if (piecesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [trigger, intensity]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-[150]" />;
}
