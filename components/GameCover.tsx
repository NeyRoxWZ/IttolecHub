/**
 * Cover art for a solo game, drawn from its own world: the clicker's target
 * and pointer, the casino's three sevens, Krash's rising curve.
 */
export type CoverGame = 'clicker' | 'casino' | 'krash';

const PALETTES: Record<CoverGame, { bg: string; a: string; b: string }> = {
  clicker: { bg: '#1FB866', a: '#FFFFFF', b: '#0E1030' },
  casino: { bg: '#8B3DFF', a: '#FFC61A', b: '#FF4F8B' },
  krash: { bg: '#FF4F8B', a: '#FFFFFF', b: '#FFC61A' },
};

const INK = '#05061A';

export default function GameCover({ game, className }: { game: CoverGame; className?: string }) {
  const { bg, a, b } = PALETTES[game];
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-hidden="true">
      <rect width="300" height="200" fill={bg} />
      <path d="M-20 200 L120 -20 L160 -20 L20 200 Z" fill="#FFFFFF" fillOpacity="0.08" />
      {game === 'clicker' && (
        <>
          <circle cx="190" cy="100" r="78" fill={a} />
          <circle cx="190" cy="100" r="52" fill={b} />
          <circle cx="190" cy="100" r="26" fill={a} />
          <polygon points="112,52 112,150 136,128 153,166 170,158 153,121 186,121" fill="#FFFFFF" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        </>
      )}
      {game === 'casino' && (
        <>
          {[40, 120, 200].map((x) => (
            <g key={x}>
              <rect x={x} y="48" width="62" height="100" rx="10" fill="#FFFFFF" stroke={INK} strokeWidth="7" />
              <text x={x + 31} y="122" textAnchor="middle" fontSize="66" fill={a} stroke={INK} strokeWidth="3" style={{ fontFamily: "'Lilita One', 'Arial Black', sans-serif" }}>7</text>
            </g>
          ))}
          <rect x="272" y="60" width="10" height="70" rx="5" fill={INK} />
          <circle cx="277" cy="56" r="12" fill={b} stroke={INK} strokeWidth="5" />
        </>
      )}
      {game === 'krash' && (
        <>
          {[50, 100, 150].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="2" />)}
          <polyline points="18,166 58,142 92,154 128,104 164,120 202,62 236,84 282,30" fill="none" stroke={INK} strokeWidth="20" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points="18,166 58,142 92,154 128,104 164,120 202,62 236,84 282,30" fill="none" stroke={a} strokeWidth="11" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="282" cy="30" r="14" fill={b} stroke={INK} strokeWidth="5" />
        </>
      )}
    </svg>
  );
}
