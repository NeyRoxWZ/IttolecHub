import { useId } from 'react';
import { RARITIES, getSpecies } from '@/lib/peche/data';
import { fishLook, type Body, type Dorsal, type FishLook, type Tail } from '@/lib/peche/fishLook';

const INK = '#05061A';

/** Every body on a 100×62 board, facing left: outline, where the top is, where the eyes sit. */
const BODY: Record<Body, { d: string; top: number; eyes: [number, number][] }> = {
  oval: { d: 'M6 31 Q 8 10 40 10 Q 72 10 74 31 Q 72 52 40 52 Q 8 52 6 31 Z', top: 10, eyes: [[20, 26]] },
  slim: { d: 'M4 31 Q 18 16 44 17 Q 66 19 74 31 Q 66 43 44 45 Q 18 46 4 31 Z', top: 17, eyes: [[16, 28]] },
  tall: { d: 'M8 31 Q 14 4 42 4 Q 70 6 72 31 Q 70 56 42 58 Q 14 58 8 31 Z', top: 5, eyes: [[22, 24]] },
  round: { d: 'M12 31 Q 12 5 42 5 Q 72 5 72 31 Q 72 57 42 57 Q 12 57 12 31 Z', top: 5, eyes: [[26, 24]] },
  box: { d: 'M10 14 Q 10 8 16 8 L 66 8 Q 72 8 72 14 L 72 48 Q 72 54 66 54 L 16 54 Q 10 54 10 48 Z', top: 8, eyes: [[24, 22]] },
  eel: { d: 'M4 30 Q 14 20 30 24 Q 50 30 66 24 Q 80 20 94 27 Q 97 31 94 35 Q 80 42 66 38 Q 50 34 30 40 Q 14 44 4 34 Z', top: 22, eyes: [[14, 29]] },
  flat: { d: 'M4 31 Q 10 14 40 13 Q 70 14 74 31 Q 70 48 40 49 Q 10 48 4 31 Z', top: 13, eyes: [[20, 25], [31, 21]] },
  shark: { d: 'M2 33 Q 14 20 40 19 Q 62 19 76 28 L 76 36 Q 50 46 20 44 Q 8 42 2 33 Z', top: 19, eyes: [[14, 29]] },
  ray: { d: 'M4 31 Q 38 -2 70 31 Q 38 64 4 31 Z', top: 12, eyes: [[22, 26], [22, 36]] },
  seahorse: { d: 'M40 6 Q 60 4 60 20 Q 60 30 50 34 Q 62 44 54 54 Q 46 60 38 54 Q 46 50 44 44 Q 30 40 32 24 L 20 22 L 22 16 L 34 16 Q 34 8 40 6 Z', top: 6, eyes: [[44, 14]] },
};

const TAIL: Record<Tail, string> = {
  fork: 'M70 31 L96 10 L88 31 L96 52 Z',
  round: 'M68 31 Q 98 6 96 31 Q 98 56 68 31 Z',
  lunate: 'M70 31 Q 86 20 100 4 Q 90 31 100 58 Q 86 42 70 31 Z',
  fan: 'M70 31 L96 14 L96 48 Z',
  none: '',
};

/** Drawn on a base line at y = 0, then moved to the top of the body. */
const DORSAL: Record<Dorsal, string> = {
  none: '',
  small: 'M34 2 L 50 -10 L 56 4 Z',
  spiky: 'M22 4 L 28 -8 L 34 2 L 40 -10 L 46 2 L 52 -8 L 58 4 Z',
  sail: 'M18 4 Q 40 -22 64 6 Z',
  flame: 'M24 4 Q 26 -6 32 -2 Q 34 -14 42 -4 Q 48 -16 52 -2 Q 58 -8 58 4 Z',
};

const star = (x: number, y: number, r = 4) =>
  `M${x} ${y - r} L ${x + r * 0.3} ${y - r * 0.3} L ${x + r} ${y} L ${x + r * 0.3} ${y + r * 0.3} L ${x} ${y + r} L ${x - r * 0.3} ${y + r * 0.3} L ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.3} Z`;

const DEFAULT_LOOK: FishLook = { body: 'oval', tail: 'fork', dorsal: 'small', pattern: 'none', extras: [], eye: 'normal', accent: '#FFFFFF', ghost: false };

/**
 * One fish as SVG shapes, on a board from (-8, -12) to (104, 64). Used inside
 * the icon below and inside the aquarium, which places it where it swims.
 */
export function FishShape({
  speciesId, color, rarity = 0, unknown = false, variant = '',
}: {
  speciesId?: string;
  color: string;
  rarity?: number;
  unknown?: boolean;
  variant?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const sp = speciesId ? getSpecies(speciesId) : undefined;
  const look = sp ? fishLook(sp.id, sp.name, color) : DEFAULT_LOOK;
  const b = BODY[look.body];
  const chroma = variant === 'chroma' && !unknown;
  const fill = unknown ? '#2B3170' : chroma ? `url(#${uid}g)` : variant === 'or' ? '#FFC61A' : color;
  const fin = unknown ? '#1A1F52' : RARITIES[rarity]?.color || '#C2C9F0';
  const line = unknown ? '#1A1F52' : INK;
  const [ex, ey] = b.eyes[0];
  const mouth = { x: Math.max(2, ex - 12), y: ey + 7 };
  const has = (e: string) => look.extras.includes(e as never);

  return (
    <g opacity={look.ghost && !unknown ? 0.78 : 1}>
      <defs>
        <clipPath id={`${uid}c`}><path d={b.d} /></clipPath>
        {chroma && (
          <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF4F8B" /><stop offset="0.5" stopColor="#FFC61A" /><stop offset="1" stopColor="#25D0C8" />
          </linearGradient>
        )}
      </defs>

      {/* Behind the body */}
      {TAIL[look.tail] && <path d={TAIL[look.tail]} fill={fin} stroke={line} strokeWidth="5" strokeLinejoin="round" />}
      {look.body === 'ray' && <path d="M66 31 Q 84 31 102 22" fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" />}
      {look.body === 'shark' && <path d="M32 21 L 48 -2 L 56 22 Z" fill={fill} stroke={line} strokeWidth="5" strokeLinejoin="round" />}
      {DORSAL[look.dorsal] && <path d={DORSAL[look.dorsal]} transform={`translate(0 ${b.top})`} fill={look.dorsal === 'flame' && !unknown ? '#FF8A1F' : fin} stroke={line} strokeWidth="4" strokeLinejoin="round" />}
      {has('horns') && <path d="M24 4 L 20 -9 L 31 3 Z M38 2 L 40 -11 L 46 3 Z" transform={`translate(0 ${b.top})`} fill={unknown ? fin : '#FFE27A'} stroke={line} strokeWidth="3" strokeLinejoin="round" />}
      {has('spines') && (
        <g transform={`translate(0 ${b.top})`} stroke={line} strokeWidth="3" strokeLinecap="round">
          <path d="M26 4 L 20 -10 M36 2 L 34 -12 M46 2 L 48 -12 M56 4 L 62 -8" />
        </g>
      )}
      {has('bill') && <path d="M8 28 L -8 31 L 8 34 Z" fill={fin} stroke={line} strokeWidth="3" strokeLinejoin="round" />}
      {has('horn') && <path d="M6 30 L -8 21 L 8 27 Z" fill={unknown ? fin : '#FFF4D6'} stroke={line} strokeWidth="3" strokeLinejoin="round" />}
      {has('lure') && (
        <g>
          <path d={`M${ex + 4} ${b.top + 3} Q ${ex} ${b.top - 14} ${ex - 14} ${b.top - 8}`} fill="none" stroke={line} strokeWidth="2.5" strokeLinecap="round" />
          {!unknown && <circle cx={ex - 14} cy={b.top - 8} r="7" fill="#FFE27A" opacity="0.35" />}
          <circle cx={ex - 14} cy={b.top - 8} r="3.5" fill={unknown ? fin : '#FFE27A'} stroke={line} strokeWidth="2" />
        </g>
      )}

      {/* Body, its pattern, its outline */}
      <path d={b.d} fill={fill} />
      {!unknown && look.pattern !== 'none' && (
        <g clipPath={`url(#${uid}c)`}>
          {look.pattern === 'stripes' && [22, 38, 54].map((x) => <rect key={x} x={x} y="-10" width="7" height="80" fill={look.accent} opacity="0.9" />)}
          {look.pattern === 'spots' && [[30, 22, 4], [46, 34, 5], [58, 22, 3.5], [36, 42, 3], [52, 14, 3], [20, 38, 3]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={look.accent} />)}
          {look.pattern === 'belly' && <ellipse cx="40" cy="52" rx="46" ry="14" fill="#FFFFFF" opacity="0.4" />}
          {look.pattern === 'stars' && [[30, 22], [48, 36], [58, 20], [22, 40]].map(([x, y]) => <path key={`${x}-${y}`} d={star(x, y)} fill="#FFFFFF" />)}
          {look.pattern === 'shine' && <path d="M20 54 L 46 4 M36 58 L 60 12" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="5" />}
        </g>
      )}
      {['oval', 'slim', 'tall', 'round', 'shark'].includes(look.body) && !unknown && (
        <path d={`M${ex + 13} ${ey - 9} Q ${ex + 19} ${ey + 5} ${ex + 13} ${ey + 18}`} fill="none" stroke={INK} strokeOpacity="0.3" strokeWidth="3.5" strokeLinecap="round" />
      )}
      <path d={b.d} fill="none" stroke={line} strokeWidth="5" strokeLinejoin="round" />

      {/* In front */}
      {look.body === 'shark' && <path d="M30 40 L 22 56 L 46 42 Z" fill={fill} stroke={line} strokeWidth="4" strokeLinejoin="round" />}
      {has('wings') && <path d="M30 34 Q 36 62 70 60 Q 52 46 46 32 Z" fill={fin} stroke={line} strokeWidth="3" strokeLinejoin="round" />}
      {has('hammer') && <rect x="-4" y="14" width="12" height="36" rx="5" fill={fill} stroke={line} strokeWidth="4" />}
      {has('teeth') && !unknown && <path d={`M${mouth.x} ${mouth.y} l 3 4 l 3 -4 l 3 4 l 3 -4`} fill="#FFFFFF" stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      {has('whiskers') && <path d={`M${mouth.x + 2} ${mouth.y} q -8 6 -12 14 M${mouth.x + 4} ${mouth.y + 2} q -4 10 -8 18`} fill="none" stroke={line} strokeWidth="2.5" strokeLinecap="round" />}
      {!unknown && b.eyes.map(([x, y]) =>
        look.eye === 'none' ? (
          <path key={`${x}-${y}`} d={`M${x - 4} ${y} Q ${x} ${y + 3} ${x + 4} ${y}`} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        ) : (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={look.eye === 'big' ? 8 : 6} fill="#FFFFFF" stroke={INK} strokeWidth="3" />
            <circle cx={x - 1} cy={y} r={look.eye === 'big' ? 3.5 : 2.5} fill={INK} />
            {look.eye === 'angry' && <path d={`M${x - 7} ${y - 8} L ${x + 6} ${y - 4}`} stroke={INK} strokeWidth="3" strokeLinecap="round" />}
          </g>
        )
      )}
    </g>
  );
}

/**
 * A fish drawn in the site's style, with the shape of its species: chunky
 * outline, flat fill, fins in the rarity's colour. Unknown species are a dark
 * silhouette of that same shape, like an empty Poissodex slot.
 */
export default function FishIcon({
  speciesId, color, rarity = 0, size = 56, unknown = false, variant = '',
}: {
  speciesId?: string;
  color: string;
  rarity?: number;
  size?: number;
  unknown?: boolean;
  variant?: string;
}) {
  return (
    <svg width={size} height={size * (76 / 112)} viewBox="-8 -12 112 76" aria-hidden="true" overflow="visible">
      <FishShape speciesId={speciesId} color={color} rarity={rarity} unknown={unknown} variant={variant} />
    </svg>
  );
}
