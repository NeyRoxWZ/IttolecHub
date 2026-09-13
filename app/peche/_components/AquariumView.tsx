'use client';

import { COSMETIC_BY_ID, getSpecies, type CosmeticSlot } from '@/lib/peche/data';

const INK = '#05061A';

export interface AquariumFish { speciesId: string; variant: string }

function colors(equipped: Partial<Record<CosmeticSlot, string>>, slot: CosmeticSlot, fallback: string[]) {
  const c = equipped[slot] ? COSMETIC_BY_ID.get(equipped[slot]!) : undefined;
  return c?.colors?.length ? c.colors : fallback;
}

/** The decoration piece standing on the sand, by cosmetic id. */
function Deco({ id, color }: { id?: string; color: string }) {
  const kind = id?.split('-')[1] || 'plantes';
  switch (kind) {
    case 'rochers':
      return <g><path d="M40 238 Q 60 196 96 210 Q 118 190 140 238 Z" fill={color} stroke={INK} strokeWidth="5" /><path d="M360 238 Q 380 212 410 222 Q 430 206 446 238 Z" fill={color} stroke={INK} strokeWidth="5" /></g>;
    case 'chateau':
      return (
        <g transform="translate(340 150)">
          <rect x="0" y="30" width="90" height="60" fill={color} stroke={INK} strokeWidth="5" />
          {[0, 60].map((x) => <rect key={x} x={x} y="0" width="30" height="90" fill={color} stroke={INK} strokeWidth="5" />)}
          {[0, 12, 24, 60, 72, 84].map((x) => <rect key={x} x={x} y="-10" width="6" height="10" fill={color} stroke={INK} strokeWidth="3" />)}
          <path d="M34 90 V 62 Q 45 48 56 62 V 90 Z" fill="#1A1F52" stroke={INK} strokeWidth="4" />
        </g>
      );
    case 'epave':
      return (
        <g transform="translate(320 176) rotate(-12)">
          <path d="M0 40 L 130 40 L 110 70 L 16 70 Z" fill={color} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <line x1="64" y1="40" x2="70" y2="-20" stroke={INK} strokeWidth="6" />
          <path d="M70 -16 L 108 12 L 70 20 Z" fill="#E8E8E8" stroke={INK} strokeWidth="4" opacity="0.8" />
          {[30, 60, 90].map((x) => <circle key={x} cx={x} cy="54" r="5" fill="#1A1F52" />)}
        </g>
      );
    case 'tresor':
      return (
        <g transform="translate(350 196)">
          <rect x="0" y="12" width="70" height="34" rx="6" fill="#8E4418" stroke={INK} strokeWidth="5" />
          <path d="M0 16 Q 35 -14 70 16 Z" fill="#C2632B" stroke={INK} strokeWidth="5" />
          {[12, 30, 48].map((x) => <circle key={x} cx={x + 4} cy="10" r="6" fill={color} stroke={INK} strokeWidth="3" />)}
        </g>
      );
    default:
      return (
        <g>
          {[[36, 238, 80], [70, 238, 110], [410, 238, 90], [440, 238, 64]].map(([x, y, h], i) => (
            <path key={i} d={`M${x} ${y} Q ${x - 16} ${y - h / 2} ${x} ${y - h} Q ${x + 16} ${y - h / 2} ${x} ${y}`} fill={color} stroke={INK} strokeWidth="4" />
          ))}
        </g>
      );
  }
}

/**
 * A tank: background water, sand and a decoration from the aquarium
 * cosmetics, and the chosen fish swimming back and forth. Shown on the
 * owner's aquarium tab and on everyone's player card.
 */
export default function AquariumView({ fish, equipped, className }: { fish: AquariumFish[]; equipped: Partial<Record<CosmeticSlot, string>>; className?: string }) {
  const [top, bottom] = colors(equipped, 'aquafond', ['#3CC3D6', '#137A9E']);
  const sand = colors(equipped, 'aquasol', ['#F0D27A'])[0];
  const deco = colors(equipped, 'aquadeco', ['#33D17A'])[0];

  return (
    <div className={className}>
      <style>{`
        @keyframes aqSwim { 0% { transform: translateX(0) scaleX(1) } 48% { transform: translateX(var(--d)) scaleX(1) } 50% { transform: translateX(var(--d)) scaleX(-1) } 98% { transform: translateX(0) scaleX(-1) } 100% { transform: translateX(0) scaleX(1) } }
        @keyframes aqBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(6px) } }
        @keyframes aqBubble { from { transform: translateY(0); opacity: .8 } to { transform: translateY(-220px); opacity: 0 } }
        .aq-swim { transform-box: fill-box; transform-origin: center; animation: aqSwim linear infinite; }
        .aq-bob { animation: aqBob ease-in-out infinite; }
        .aq-bubble { animation: aqBubble linear infinite; }
        @media (prefers-reduced-motion: reduce) { .aq-swim, .aq-bob, .aq-bubble { animation: none; } }
      `}</style>
      <svg viewBox="0 0 480 270" className="w-full h-auto block rounded-[18px] border-4 border-brand-border" style={{ background: bottom }}>
        <defs>
          <linearGradient id="aqWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        </defs>
        <rect width="480" height="270" fill="url(#aqWater)" />
        {[60, 160, 300, 420].map((x, i) => (
          <path key={x} d={`M${x} 0 L ${x + 40} 0 L ${x - 30} 230 L ${x - 60} 230 Z`} fill="#FFFFFF" opacity="0.06" style={{ animationDelay: `${i}s` }} />
        ))}
        <Deco id={equipped.aquadeco} color={deco} />
        <path d="M0 236 Q 60 222 120 234 T 240 232 T 360 236 T 480 230 L 480 270 L 0 270 Z" fill={sand} stroke={INK} strokeWidth="5" />
        {[[90, 250], [200, 256], [330, 250], [430, 258]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="3" fill={INK} opacity="0.18" />)}

        {fish.map((f, i) => {
          const sp = getSpecies(f.speciesId);
          if (!sp) return null;
          const y = 40 + ((i * 53) % 150);
          const x = 30 + ((i * 97) % 260);
          const d = 90 + ((i * 37) % 90);
          const fill = f.variant === 'or' ? '#FFC61A' : sp.color;
          const scale = 0.8 + sp.rarity * 0.12;
          return (
            <g key={`${f.speciesId}-${i}`} className="aq-bob" style={{ animationDuration: `${2.4 + (i % 3) * 0.6}s` }}>
              <g transform={`translate(${x} ${y}) scale(${scale})`}>
                <g className="aq-swim" style={{ animationDuration: `${9 + (i % 4) * 2}s`, animationDelay: `-${i * 1.3}s`, ['--d' as string]: `${d}px` }}>
                  <path d="M40 14 L 58 2 L 54 14 L 58 26 Z" fill={fill} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
                  <ellipse cx="22" cy="14" rx="22" ry="13" fill={f.variant === 'chroma' ? '#FF4F8B' : fill} stroke={INK} strokeWidth="4" />
                  {f.variant === 'chroma' && <ellipse cx="22" cy="14" rx="14" ry="7" fill="#25D0C8" />}
                  <circle cx="10" cy="11" r="4" fill="#FFFFFF" stroke={INK} strokeWidth="2.5" />
                  <circle cx="9" cy="11" r="1.6" fill={INK} />
                </g>
              </g>
            </g>
          );
        })}

        {[80, 250, 400].map((x, i) => (
          <circle key={x} className="aq-bubble" style={{ animationDuration: `${4 + i}s`, animationDelay: `${i * 1.2}s` }} cx={x} cy="230" r={4 + i} fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.7" />
        ))}
      </svg>
    </div>
  );
}
