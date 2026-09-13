import { RARITIES, type Cosmetic } from '@/lib/peche/data';

const INK = '#05061A';

/**
 * A fishing cosmetic on a tile tinted by its rarity. Hidden pieces (not owned
 * yet, or a silhouette during a chest opening) keep their shape in dark tones.
 */
export default function CosmeticIcon({ cosmetic, size = 64, hidden = false }: { cosmetic: Cosmetic; size?: number; hidden?: boolean }) {
  const c = cosmetic.colors;
  const dark = '#2B3170';
  const tile = hidden ? '#0E1030' : RARITIES[cosmetic.rarity]?.color || '#C2C9F0';
  const pick = (i: number) => (hidden ? dark : c[i % c.length]);
  const id = `ci-${cosmetic.id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {c.map((col, i) => <stop key={i} offset={c.length > 1 ? i / (c.length - 1) : 0} stopColor={hidden ? dark : col} />)}
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#1E2358" stroke={INK} strokeWidth="4" />
      <rect x="6" y="6" width="52" height="52" rx="12" fill={tile} opacity={hidden ? 1 : 0.22} />
      {!hidden && cosmetic.passOnly && <path d="M44 6 h14 v14 z" fill="#B06BFF" />}

      {cosmetic.slot === 'flotteur' && (
        <g>
          <path d="M16 44 q 16 -6 32 0" fill="none" stroke="#9EE7FF" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="10" x2="32" y2="20" stroke={INK} strokeWidth="3" />
          <circle cx="32" cy="32" r="13" fill={pick(1)} stroke={INK} strokeWidth="4" />
          <path d="M19 32 A13 13 0 0 1 45 32 Z" fill={pick(0)} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          {!hidden && <ellipse cx="27" cy="25" rx="3" ry="2" fill="#FFFFFF" opacity="0.7" />}
        </g>
      )}
      {cosmetic.slot === 'canne' && (
        <g>
          <path d="M14 52 Q 30 30 52 12" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <path d="M14 52 Q 30 30 52 12" fill="none" stroke={pick(0)} strokeWidth="5" strokeLinecap="round" />
          <circle cx="21" cy="44" r="5" fill={hidden ? dark : '#C2C9F0'} stroke={INK} strokeWidth="3" />
          <path d="M52 12 Q 56 30 50 44" fill="none" stroke={INK} strokeWidth="1.5" />
        </g>
      )}
      {cosmetic.slot === 'ligne' && (
        <g>
          <path d="M10 16 C 24 4, 26 44, 38 30 S 54 44, 54 52" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <path d="M10 16 C 24 4, 26 44, 38 30 S 54 44, 54 52" fill="none" stroke={hidden ? dark : `url(#${id})`} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M54 52 q -4 -2 -4 -6" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {cosmetic.slot === 'chapeau' && (
        <g transform="translate(32 42) scale(1.3)">
          <path d="M-13 -4 Q -12 -22 0 -22 Q 12 -22 13 -4 Z" fill={pick(0)} stroke={INK} strokeWidth="3.5" />
          <ellipse cx="0" cy="-4" rx="20" ry="5" fill={pick(0)} stroke={INK} strokeWidth="3.5" />
          {!hidden && <rect x="-12" y="-11" width="24" height="4" fill="#FFFFFF" opacity="0.45" />}
        </g>
      )}
      {cosmetic.slot === 'ponton' && (
        <g>
          <rect x="8" y="24" width="48" height="12" rx="3" fill={pick(0)} stroke={INK} strokeWidth="4" />
          {[20, 32, 44].map((x) => <line key={x} x1={x} y1="26" x2={x} y2="34" stroke={INK} strokeOpacity="0.4" strokeWidth="2" />)}
          {[14, 44].map((x) => <rect key={x} x={x} y="34" width="8" height="20" fill={pick(1)} stroke={INK} strokeWidth="3.5" />)}
          <path d="M6 50 q 13 -5 26 0 t 26 0" fill="none" stroke="#9EE7FF" strokeWidth="3" />
        </g>
      )}
      {cosmetic.slot === 'decor' && (
        <g>
          <rect x="8" y="8" width="48" height="30" rx="8" fill={pick(0)} />
          <circle cx="42" cy="22" r="8" fill={hidden ? '#1A1F52' : c[1]} stroke={INK} strokeWidth="3" />
          <path d="M8 34 Q 22 26 34 34 T 56 32 L 56 38 L 8 38 Z" fill={hidden ? '#1A1F52' : '#1A4A7A'} />
          <rect x="8" y="36" width="48" height="20" rx="4" fill={hidden ? '#1A1F52' : '#1F6FD0'} stroke={INK} strokeWidth="3" />
          <rect x="8" y="8" width="48" height="48" rx="8" fill="none" stroke={INK} strokeWidth="3" />
        </g>
      )}
      {(cosmetic.slot === 'aquafond' || cosmetic.slot === 'aquasol' || cosmetic.slot === 'aquadeco') && (
        <g>
          <rect x="9" y="12" width="46" height="40" rx="6" fill={cosmetic.slot === 'aquafond' ? `url(#${id})` : hidden ? dark : '#3CC3D6'} stroke={INK} strokeWidth="3.5" />
          <path d="M9 44 Q 22 38 32 44 T 55 42 L 55 52 L 9 52 Z" fill={cosmetic.slot === 'aquasol' ? pick(0) : hidden ? '#1A1F52' : '#F0D27A'} stroke={INK} strokeWidth="3" />
          {cosmetic.slot === 'aquadeco' ? (
            <path d="M22 44 Q 16 32 22 20 Q 28 32 22 44 M40 44 Q 34 34 40 26 Q 46 34 40 44" fill={pick(0)} stroke={INK} strokeWidth="3" />
          ) : (
            <path d="M20 28 q 8 -6 16 0 q -8 6 -16 0 z M36 28 l 6 -4 v 8 z" fill={hidden ? dark : '#FF8A1F'} stroke={INK} strokeWidth="2.5" />
          )}
        </g>
      )}
      {cosmetic.slot === 'effet' && (
        <g>
          {[[20, 22, 6], [42, 18, 5], [30, 40, 8], [48, 42, 5], [16, 46, 4], [36, 26, 3]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={pick(i)} stroke={INK} strokeWidth="3" />
          ))}
        </g>
      )}
    </svg>
  );
}
