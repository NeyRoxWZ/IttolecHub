'use client';

import { cn } from '@/lib/utils';
import type { Cosmetic, CosmeticParams } from '@/lib/casino/cosmetics';
import * as Art from './CasinoArt';

/**
 * Every cosmetic is described as data, so one component can preview all 160
 * of them — and the preview is drawn with the same parameters the game itself
 * uses, so what you see in the pass is what you get on the table.
 */

const ART: Record<string, (p: { size?: number; className?: string }) => JSX.Element> = {
  cherry: Art.ArtCherry, bell: Art.ArtBell, star: Art.ArtStar, diamond: Art.ArtDiamond,
  lemon: Art.ArtLemon, seven: Art.ArtSeven, chicken: Art.ArtChicken, car: Art.ArtCar,
  finishFlag: Art.ArtFinishFlag, dino: Art.ArtDino, rock: Art.ArtRock, fire: Art.ArtFire,
  volcano: Art.ArtVolcano, gem: Art.ArtGem, bomb: Art.ArtBomb, clover: Art.ArtClover,
  moneyBag: Art.ArtMoneyBag, crown: Art.ArtCrown, crate: Art.ArtCrate, horse: Art.ArtHorse,
  rocket: Art.ArtRocketShip, ball: Art.ArtBall, shield: Art.ArtShield,
  rps: (q) => <Art.ArtRps move="pierre" {...q} />,
  door: Art.ArtDoor, skull: Art.ArtSkull, check: Art.ArtCheck,
  coinFace: (q) => <Art.ArtCoinFace side="face" {...q} />,
};

/** CSS background for a table cosmetic — also used by the game scene itself. */
export function tableBackground(p: CosmeticParams): string {
  const from = p.from || '#161620';
  const to = p.to || '#26263a';
  const accent = p.color || '#FFD000';
  const base = `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;

  switch (p.pattern) {
    case 'rays':
      return `repeating-conic-gradient(from 0deg at 50% 120%, ${accent}14 0deg 6deg, transparent 6deg 14deg), ${base}`;
    case 'grid':
      return `linear-gradient(${accent}14 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, ${accent}14 1px, transparent 1px) 0 0 / 22px 22px, ${base}`;
    case 'dots':
      return `radial-gradient(${accent}26 1.5px, transparent 1.6px) 0 0 / 18px 18px, ${base}`;
    case 'stripes':
      return `repeating-linear-gradient(135deg, ${accent}12 0 10px, transparent 10px 26px), ${base}`;
    default:
      return base;
  }
}

/** Filter string for a skin cosmetic, applied to the game's own artwork. */
export function skinFilter(p: CosmeticParams): string {
  return `hue-rotate(${p.hue ?? 0}deg) saturate(${p.saturate ?? 1})`;
}

const WIN_LABEL: Record<string, string> = {
  confetti: 'Confettis', coins: 'Pluie de pièces', shock: 'Onde de choc',
  sparks: 'Étincelles', fireworks: 'Feu d’artifice',
};
const LOSE_LABEL: Record<string, string> = {
  smoke: 'Fumée', crack: 'Fissure', ash: 'Cendres', static: 'Grésillement', drip: 'Coulée',
};
const PARTICLE_LABEL: Record<string, string> = {
  float: 'Flottantes', rise: 'Ascendantes', fall: 'Retombantes', orbit: 'En orbite', drift: 'À la dérive',
};
const PACK_LABEL: Record<string, string> = {
  retro: 'Rétro', lounge: 'Lounge', arcade: 'Arcade', space: 'Spatial',
  western: 'Western', orchestral: 'Orchestral',
};

/** One-line description of what the piece actually does. */
export function cosmeticEffect(c: Cosmetic): string {
  const p = c.params;
  switch (c.slot) {
    case 'table': return 'Change le fond de la table.';
    case 'skin': return 'Recolore les pièces du jeu.';
    case 'win_fx': return `${WIN_LABEL[p.winStyle || ''] || 'Effet'} à chaque gain.`;
    case 'lose_fx': return `${LOSE_LABEL[p.loseStyle || ''] || 'Effet'} quand tu perds.`;
    case 'border': return p.animated ? 'Contour animé autour de la table.' : 'Contour coloré autour de la table.';
    case 'particles': return `${PARTICLE_LABEL[p.particleStyle || ''] || 'Particules'} pendant la partie.`;
    case 'sound': return `Pack sonore ${PACK_LABEL[p.pack || ''] || ''}.`;
    case 'emblem': return 'Badge affiché à côté de ton solde.';
  }
}

export default function CosmeticPreview({
  cosmetic, size = 96, className,
}: {
  cosmetic: Cosmetic;
  size?: number;
  className?: string;
}) {
  const p = cosmetic.params;
  const accent = p.color || '#FFD000';

  const frame = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div
      className={cn('relative rounded-xl overflow-hidden border-2 border-brand-border shrink-0', className)}
      style={{ width: size, height: size, background: '#12121A', ...style }}
    >
      {children}
    </div>
  );

  switch (cosmetic.slot) {
    case 'table':
      return frame(null, { background: tableBackground(p) });

    case 'skin': {
      const ArtPiece = ART[cosmetic.gameSlug === 'slots' ? 'cherry' : 'gem'];
      return frame(
        <div className="absolute inset-0 flex items-center justify-center" style={{ filter: skinFilter(p) }}>
          <ArtPiece size={size * 0.55} />
        </div>,
        { background: 'linear-gradient(160deg,#1A1A26,#101018)' }
      );
    }

    case 'win_fx': {
      const colors = p.colors || [accent];
      const bits = Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const r = p.winStyle === 'shock' ? 0.36 : 0.18 + (i % 4) * 0.07;
        return {
          left: `${50 + Math.cos(angle) * r * 100}%`,
          top: `${50 + Math.sin(angle) * r * 100}%`,
          background: colors[i % colors.length],
          size: p.winStyle === 'coins' ? 7 : p.winStyle === 'fireworks' ? 4 : 5,
          radius: p.winStyle === 'confetti' ? '2px' : '999px',
        };
      });
      return frame(
        <>
          {p.winStyle === 'shock' && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: size * 0.62, height: size * 0.62, border: `3px solid ${accent}`, opacity: 0.7 }} />
          )}
          {bits.map((b, i) => (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: b.left, top: b.top, width: b.size, height: b.size, background: b.background, borderRadius: b.radius }} />
          ))}
        </>,
        { background: 'radial-gradient(circle at 50% 50%, #23233A, #0E0E16)' }
      );
    }

    case 'lose_fx':
      return frame(
        <>
          {p.loseStyle === 'crack' && (
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <path d="M50 6 L44 40 L58 46 L40 96 M44 40 L18 30 M58 46 L86 38" stroke={p.color || '#888'} strokeWidth="3" fill="none" />
            </svg>
          )}
          {p.loseStyle === 'static' && (
            <div className="absolute inset-0" style={{
              background: `repeating-linear-gradient(0deg, ${p.color}55 0 2px, transparent 2px 5px)`,
            }} />
          )}
          {p.loseStyle === 'drip' && (
            <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: `linear-gradient(${p.color}, transparent)` }} />
          )}
          {(p.loseStyle === 'smoke' || p.loseStyle === 'ash') && (
            <div className="absolute inset-0" style={{
              background: `radial-gradient(circle at 30% 70%, ${p.color}77, transparent 55%), radial-gradient(circle at 70% 40%, ${p.color}55, transparent 50%)`,
            }} />
          )}
        </>,
        { background: 'linear-gradient(160deg,#15151E,#0B0B12)' }
      );

    case 'border':
      return frame(
        <span
          className={cn('absolute inset-1.5 rounded-lg', p.animated && 'animate-pulse')}
          style={{ border: `3px solid ${accent}`, boxShadow: p.glow ? `0 0 14px ${accent}` : undefined }}
        />,
        { background: 'linear-gradient(160deg,#16161F,#0D0D14)' }
      );

    case 'particles': {
      const dots = Array.from({ length: 10 }, (_, i) => ({
        left: `${8 + ((i * 37) % 84)}%`,
        top: `${10 + ((i * 53) % 78)}%`,
        s: 3 + (i % 3),
      }));
      return frame(
        <>
          {dots.map((d, i) => (
            <span key={i} className="absolute rounded-full"
              style={{ left: d.left, top: d.top, width: d.s, height: d.s, background: accent, opacity: 0.35 + (i % 4) * 0.15 }} />
          ))}
          <span className="absolute bottom-1.5 right-2 text-[9px] font-black tracking-widest" style={{ color: accent }}>
            {(PARTICLE_LABEL[p.particleStyle || ''] || '').toUpperCase()}
          </span>
        </>,
        { background: 'linear-gradient(160deg,#14141D,#0B0B12)' }
      );
    }

    case 'sound': {
      const bars = [0.35, 0.7, 0.45, 1, 0.6, 0.85, 0.4];
      return frame(
        <div className="absolute inset-0 flex items-end justify-center gap-1 p-3">
          {bars.map((h, i) => (
            <span key={i} className="rounded-sm" style={{ width: 5, height: `${h * 100}%`, background: accent, opacity: 0.55 + h * 0.45 }} />
          ))}
        </div>,
        { background: 'linear-gradient(160deg,#16161F,#0D0D14)' }
      );
    }

    case 'emblem': {
      const ArtPiece = ART[p.art || 'gem'] || Art.ArtGem;
      return frame(
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute rounded-full" style={{ width: size * 0.68, height: size * 0.68, background: `${accent}22`, border: `2px solid ${accent}` }} />
          <ArtPiece size={size * 0.42} />
        </div>,
        { background: 'linear-gradient(160deg,#16161F,#0D0D14)' }
      );
    }
  }
}
