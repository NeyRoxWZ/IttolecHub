/**
 * Cover art for a solo game, drawn from its own world: the casino's slot
 * machine, the fishing game's float on the water.
 *
 * Drawn on a 16:9 board and scaled to fit ("meet") rather than to fill: the
 * card is 16:9 but capped in height on wide screens, and filling used to crop
 * the drawing and push it off-centre. The SVG's own background paints the
 * margins, so the card never shows a gap.
 */
export type CoverGame = 'casino' | 'peche';

const PALETTES: Record<CoverGame, { bg: string; a: string; b: string }> = {
  casino: { bg: '#8B3DFF', a: '#FFC61A', b: '#FF4F8B' },
  peche: { bg: '#1FA3D6', a: '#FFFFFF', b: '#FF4F8B' },
};

const INK = '#05061A';
const FONT = { fontFamily: "'Lilita One', 'Arial Black', sans-serif" };

export default function GameCover({ game, className }: { game: CoverGame; className?: string }) {
  const { bg, a, b } = PALETTES[game];
  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ background: bg }}
      role="img"
      aria-hidden="true"
    >
      <path d="M-20 180 L110 -10 L150 -10 L20 180 Z" fill="#FFFFFF" fillOpacity="0.08" />

      {game === 'casino' && (
        // The whole machine, lever included, spans x 70–252: centred on 160.
        <g>
          {/* sign */}
          <rect x="104" y="18" width="92" height="28" rx="10" fill={a} stroke={INK} strokeWidth="6" />
          {[120, 135, 150, 165, 180].map((x) => <circle key={x} cx={x} cy="32" r="4" fill={INK} />)}
          {/* cabinet */}
          <rect x="70" y="42" width="160" height="120" rx="18" fill={b} stroke={INK} strokeWidth="6" />
          {/* reel window */}
          <rect x="84" y="58" width="132" height="64" rx="12" fill={INK} />
          {[90, 131, 172].map((x) => (
            <g key={x}>
              <rect x={x} y="64" width="38" height="52" rx="7" fill="#FFFFFF" />
              <text x={x + 19} y="104" textAnchor="middle" fontSize="40" fill={a} stroke={INK} strokeWidth="2.5" style={FONT}>7</text>
            </g>
          ))}
          {/* coin tray */}
          <rect x="100" y="134" width="100" height="14" rx="7" fill={INK} />
          {/* lever: pivot on the cabinet's side, arm and knob outside it */}
          <rect x="228" y="96" width="14" height="20" rx="5" fill={INK} />
          <rect x="240" y="54" width="8" height="56" rx="4" fill={INK} />
          <circle cx="244" cy="50" r="11" fill={a} stroke={INK} strokeWidth="5" />
        </g>
      )}

      {game === 'peche' && (
        <g>
          <rect y="104" width="320" height="76" fill="#0E6FA8" />
          <path d="M0 104 Q 20 94 40 104 T 80 104 T 120 104 T 160 104 T 200 104 T 240 104 T 280 104 T 320 104" fill="none" stroke={a} strokeOpacity="0.55" strokeWidth="5" />
          <line x1="36" y1="6" x2="188" y2="96" stroke={INK} strokeWidth="3" />
          <circle cx="188" cy="104" r="15" fill={a} stroke={INK} strokeWidth="6" />
          <path d="M173 104 A15 15 0 0 1 203 104 Z" fill={b} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M112 146 q 22 -20 50 0 q -28 20 -50 0 z M162 146 l 16 -12 v 24 z" fill="#FFC61A" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="126" cy="143" r="3" fill={INK} />
        </g>
      )}
    </svg>
  );
}
