'use client';

import { COSMETIC_BY_ID, getSpecies, zoneInfo, type CosmeticSlot, type WeatherId } from '@/lib/peche/data';
import type { PortCatch, PortPlayer } from './usePort';

type Phase = 'idle' | 'waiting' | 'reeling' | 'landed' | 'lost';

const INK = '#05061A';
const WATER_Y = 196;

function colorsOf(equipped: Partial<Record<CosmeticSlot, string>>, slot: CosmeticSlot, fallback: string[]) {
  const c = equipped[slot] ? COSMETIC_BY_ID.get(equipped[slot]!) : undefined;
  return c?.colors?.length ? c.colors : fallback;
}

/** The fisher's hat, drawn from the equipped cosmetic. */
function Hat({ id, color }: { id?: string; color: string }) {
  const kind = id?.split('-')[1] || 'bob';
  switch (kind) {
    case 'casquette':
      return <g><path d="M-13 -4 Q -12 -20 3 -20 Q 14 -18 13 -4 Z" fill={color} stroke={INK} strokeWidth="4" /><path d="M10 -6 L 26 -4 L 12 0 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" /></g>;
    case 'paille':
      return <g><ellipse cx="0" cy="-4" rx="26" ry="6" fill={color} stroke={INK} strokeWidth="4" /><path d="M-12 -5 Q -11 -22 0 -22 Q 11 -22 12 -5 Z" fill={color} stroke={INK} strokeWidth="4" /><rect x="-12" y="-10" width="24" height="4" fill="#FF4F8B" /></g>;
    case 'bonnet':
      return <g><path d="M-13 -3 Q -13 -24 0 -24 Q 13 -24 13 -3 Z" fill={color} stroke={INK} strokeWidth="4" /><rect x="-14" y="-7" width="28" height="7" rx="3" fill="#FFFFFF" stroke={INK} strokeWidth="3" /><circle cx="0" cy="-26" r="5" fill="#FFFFFF" stroke={INK} strokeWidth="3" /></g>;
    case 'tricorne':
      return <g><path d="M-24 -4 Q -10 -30 0 -18 Q 10 -30 24 -4 Q 0 4 -24 -4 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" /><circle cx="0" cy="-10" r="3.5" fill="#FFC61A" /></g>;
    case 'couronne':
      return <path d="M-13 -4 L -13 -20 L -6 -12 L 0 -24 L 6 -12 L 13 -20 L 13 -4 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" />;
    case 'pass':
      return <g><ellipse cx="0" cy="-4" rx="20" ry="5" fill={color} stroke={INK} strokeWidth="4" /><path d="M-10 -5 L 2 -36 L 10 -5 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" /><circle cx="2" cy="-18" r="3" fill="#FFC61A" /></g>;
    default:
      return <g><path d="M-13 -4 Q -12 -20 0 -20 Q 12 -20 13 -4 Z" fill={color} stroke={INK} strokeWidth="4" /><ellipse cx="0" cy="-4" rx="19" ry="5" fill={color} stroke={INK} strokeWidth="4" /></g>;
  }
}

/**
 * The fishing scene: sky and clouds, the spot's far shore, layered animated
 * water with fish swimming beneath, and the fisher sitting on the edge of the
 * jetty. The rod bends and the line tightens while reeling; the float bobs,
 * rings the water on a bite and a fish leaps out on a catch. At the public
 * port, the other players fishing the same spot appear on their boats, with
 * their catches popping up above them.
 */
export default function Scene({
  zoneId, phase, weather, equipped, others = [], events = [], landedColor,
}: {
  zoneId: number;
  phase: Phase;
  weather: WeatherId;
  equipped: Partial<Record<CosmeticSlot, string>>;
  others?: PortPlayer[];
  events?: PortCatch[];
  landedColor?: string;
}) {
  const z = zoneInfo(zoneId);
  const decor = equipped.decor ? COSMETIC_BY_ID.get(equipped.decor) : undefined;
  const dark = weather === 'orage' || weather === 'lune';
  const sky = decor ? decor.colors[0] : dark ? '#1A1E3A' : z.sky;
  const sunColor = weather === 'lune' ? '#F4F4FF' : decor ? decor.colors[1] : '#FFE27A';

  const float = colorsOf(equipped, 'flotteur', ['#FF4F8B', '#FFFFFF']);
  const rod = colorsOf(equipped, 'canne', ['#8E4418'])[0];
  const line = colorsOf(equipped, 'ligne', ['#05061A']);
  const hatColor = colorsOf(equipped, 'chapeau', ['#33D17A'])[0];
  const dock = colorsOf(equipped, 'ponton', ['#C2632B', '#8E4418']);

  const out = phase === 'waiting' || phase === 'reeling';
  const reeling = phase === 'reeling';
  const fx = out ? 330 : 205;
  const fy = WATER_Y + 2;

  // Rod: from the hand, curving to the tip; it bends down while reeling.
  const hand = { x: 126, y: 138 };
  const tip = reeling ? { x: 228, y: 84 } : { x: 212, y: 44 };
  const rodCtrl = reeling ? { x: 190, y: 64 } : { x: 168, y: 72 };
  const lineCtrl = { x: (tip.x + fx) / 2, y: reeling ? Math.max(tip.y, fy) - 18 : Math.max(tip.y, fy) + 26 };

  const boats = others.slice(0, 5).map((p, i) => ({ p, x: 280 + i * 42 + (i % 2) * 8, y: WATER_Y - 4 + (i % 2) * 18 }));

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes scCloud { from { transform: translateX(-160px) } to { transform: translateX(640px) } }
        @keyframes scWave { from { transform: translateX(0) } to { transform: translateX(-120px) } }
        @keyframes scWave2 { from { transform: translateX(-120px) } to { transform: translateX(0) } }
        @keyframes scBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }
        @keyframes scBite { 0%,100% { transform: translateY(0) } 35% { transform: translateY(12px) } 65% { transform: translateY(3px) } }
        @keyframes scRing { from { transform: scale(.3); opacity: .9 } to { transform: scale(1.8); opacity: 0 } }
        @keyframes scSwim { from { transform: translateX(-80px) } to { transform: translateX(560px) } }
        @keyframes scSwimBack { from { transform: translateX(560px) scaleX(-1) } to { transform: translateX(-80px) scaleX(-1) } }
        @keyframes scCircle { 0% { transform: translate(-22px, 26px) } 50% { transform: translate(22px, 34px) } 100% { transform: translate(-22px, 26px) } }
        @keyframes scShake { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-2deg) } 75% { transform: rotate(2deg) } }
        @keyframes scJump { 0% { transform: translate(0, 10px) rotate(-40deg); opacity: 0 } 15% { opacity: 1 } 50% { transform: translate(-40px, -90px) rotate(10deg) } 100% { transform: translate(-90px, 0) rotate(60deg); opacity: 0 } }
        @keyframes scTwinkle { 0%,100% { opacity: .1 } 50% { opacity: .9 } }
        @keyframes scRain { from { transform: translateY(-40px) } to { transform: translateY(400px) } }
        @keyframes scFlash { 0%, 92%, 100% { opacity: 0 } 94% { opacity: .5 } }
        @keyframes scPop { 0% { transform: translateY(8px) scale(.5); opacity: 0 } 15% { transform: translateY(0) scale(1.1); opacity: 1 } 80% { opacity: 1 } 100% { transform: translateY(-26px); opacity: 0 } }
        @keyframes scRock { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
        .sc-cloud { animation: scCloud linear infinite; }
        .sc-wave { animation: scWave 5s linear infinite; }
        .sc-wave2 { animation: scWave2 7s linear infinite; }
        .sc-bob { animation: scBob 1.8s ease-in-out infinite; }
        .sc-bite { animation: scBite .5s ease-in-out infinite; }
        .sc-ring { transform-box: fill-box; transform-origin: center; animation: scRing 1.6s ease-out infinite; }
        .sc-swim { animation: scSwim linear infinite; }
        .sc-swimback { animation: scSwimBack linear infinite; }
        .sc-circle { animation: scCircle 1.2s ease-in-out infinite; }
        .sc-shake { transform-box: view-box; transform-origin: 126px 138px; animation: scShake .25s linear infinite; }
        .sc-jump { animation: scJump 1s ease-out forwards; }
        .sc-twinkle { animation: scTwinkle 2.4s ease-in-out infinite; }
        .sc-rain { animation: scRain .7s linear infinite; }
        .sc-flash { animation: scFlash 6s linear infinite; }
        .sc-pop { animation: scPop 3.4s ease-out forwards; }
        .sc-rock { transform-box: fill-box; transform-origin: 50% 100%; animation: scRock 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sc-cloud, .sc-wave, .sc-wave2, .sc-bob, .sc-bite, .sc-ring, .sc-swim, .sc-swimback, .sc-circle, .sc-shake, .sc-jump, .sc-twinkle, .sc-rain, .sc-flash, .sc-pop, .sc-rock { animation: none; } }
      `}</style>

      <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
        <defs>
          <linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky} />
            <stop offset="1" stopColor={dark ? '#3A3F6A' : '#FFFFFF'} stopOpacity={dark ? 1 : 0.55} />
          </linearGradient>
          <linearGradient id="scWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={z.top} />
            <stop offset="1" stopColor={z.bottom} />
          </linearGradient>
          <linearGradient id="scLine" x1="0" y1="0" x2="1" y2="1">
            {line.map((c, i) => <stop key={i} offset={line.length > 1 ? i / (line.length - 1) : 0} stopColor={c} />)}
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="480" height="360" fill={sky} />
        <rect width="480" height={WATER_Y} fill="url(#scSky)" />
        {(dark || decor?.id === 'de-nuit' || decor?.id === 'de-pass') && [[40, 30], [96, 70], [150, 22], [236, 48], [300, 18], [352, 76], [420, 40], [190, 96]].map(([x, y], i) => (
          <circle key={i} className="sc-twinkle" style={{ animationDelay: `${i * 300}ms` }} cx={x} cy={y} r="2.2" fill="#FFFFFF" />
        ))}
        {decor?.id === 'de-aurore' && <path d="M0 70 Q 120 20 240 70 T 480 60 L 480 110 Q 360 70 240 120 T 0 120 Z" fill="#33D17A" opacity="0.45" />}
        {weather !== 'orage' && (
          <g>
            <circle cx="398" cy="64" r="44" fill={sunColor} opacity="0.25" />
            <circle cx="398" cy="64" r="30" fill={sunColor} stroke={INK} strokeWidth="5" />
          </g>
        )}
        {[{ y: 42, s: 1, d: 60 }, { y: 88, s: 0.7, d: 90 }, { y: 24, s: 0.55, d: 120 }].map((c, i) => (
          <g key={i} className="sc-cloud" style={{ animationDuration: `${c.d}s`, animationDelay: `-${i * 25}s` }}>
            <g transform={`translate(0 ${c.y}) scale(${c.s})`}>
              <path d="M0 20 Q 0 0 22 4 Q 34 -12 54 2 Q 76 -2 78 18 Q 92 20 88 32 L 4 32 Q -8 30 0 20 Z" fill={dark ? '#5A6080' : '#FFFFFF'} stroke={INK} strokeWidth="4" strokeLinejoin="round" opacity={weather === 'brume' ? 0.9 : 1} />
            </g>
          </g>
        ))}

        {/* Far shore */}
        <path d={`M0 ${WATER_Y} L0 150 Q 50 118 110 146 Q 170 108 240 140 Q 310 116 370 138 Q 430 110 480 132 L 480 ${WATER_Y} Z`} fill={z.bottom} opacity="0.55" />
        <path d={`M0 ${WATER_Y} L0 170 Q 80 150 160 172 Q 250 146 330 170 Q 410 152 480 166 L 480 ${WATER_Y} Z`} fill={z.bottom} opacity="0.8" />

        {/* Water */}
        <rect y={WATER_Y} width="480" height={360 - WATER_Y} fill="url(#scWater)" />
        {[[60, 220], [180, 250], [320, 232], [420, 270], [250, 300]].map(([x, y], i) => (
          <rect key={i} className="sc-twinkle" style={{ animationDelay: `${i * 450}ms` }} x={x} y={y} width="18" height="3" rx="1.5" fill="#FFFFFF" />
        ))}
        {/* Fish swimming under the surface */}
        <g className="sc-swim" style={{ animationDuration: '18s' }} opacity="0.35">
          <path d="M0 290 q 14 -9 30 0 q -16 9 -30 0 z M30 290 l 10 -7 v 14 z" fill={INK} />
        </g>
        <g className="sc-swimback" style={{ animationDuration: '24s', animationDelay: '-8s' }} opacity="0.28">
          <path d="M0 320 q 18 -11 38 0 q -20 11 -38 0 z M38 320 l 12 -8 v 16 z" fill={INK} />
        </g>
        <g className="sc-wave2" opacity="0.55">
          <path d={`M0 ${WATER_Y + 26} ${Array.from({ length: 16 }, (_, i) => `Q ${30 + i * 60} ${WATER_Y + 18} ${60 + i * 60} ${WATER_Y + 26} T ${120 + i * 60} ${WATER_Y + 26}`).join(' ')}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="4" />
        </g>
        <g className="sc-wave">
          <path d={`M0 ${WATER_Y} ${Array.from({ length: 16 }, (_, i) => `Q ${20 + i * 40} ${WATER_Y - 9} ${40 + i * 40} ${WATER_Y} T ${80 + i * 40} ${WATER_Y}`).join(' ')}`} fill="none" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* Other players' boats at the public port */}
        {boats.map(({ p, x, y }) => {
          const ev = [...events].reverse().find((e) => e.userId === p.userId);
          const sp = ev ? getSpecies(ev.speciesId) : undefined;
          return (
            <g key={p.userId} transform={`translate(${x} ${y})`}>
              <g className="sc-rock">
                <path d="M-18 0 L 18 0 L 12 10 L -12 10 Z" fill="#C2632B" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
                <circle cx="0" cy="-8" r="6" fill="#FFD2B8" stroke={INK} strokeWidth="3" />
                <line x1="4" y1="-6" x2="20" y2="-26" stroke={INK} strokeWidth="2.5" />
              </g>
              <text x="0" y="24" textAnchor="middle" fontSize="10" fontWeight="900" fill="#FFFFFF" stroke={INK} strokeWidth="3" style={{ paintOrder: 'stroke fill' }}>{p.pseudo}</text>
              {ev && sp && (
                <g key={ev.key} className="sc-pop">
                  <rect x="-24" y="-54" width="48" height="22" rx="8" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
                  <path d="M-14 -43 q 8 -6 18 0 q -10 6 -18 0 z M4 -43 l 6 -5 v 10 z" fill={sp.color} stroke={INK} strokeWidth="2" />
                  <text x="14" y="-38" textAnchor="middle" fontSize="11" fontWeight="900" fill={INK}>!</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Jetty */}
        <rect x="-10" y="150" width="150" height="20" rx="4" fill={dock[0]} stroke={INK} strokeWidth="5" />
        {[18, 52, 86, 120].map((x) => <line key={x} x1={x} y1="152" x2={x} y2="168" stroke={INK} strokeOpacity="0.35" strokeWidth="3" />)}
        {[14, 100].map((x) => <rect key={x} x={x} y="166" width="16" height="110" fill={dock[1]} stroke={INK} strokeWidth="5" />)}
        <rect x="-10" y="150" width="150" height="20" rx="4" fill="none" stroke={INK} strokeWidth="5" />

        {/* Fisher, sitting on the edge */}
        <g>
          <path d="M104 150 L 110 178 L 124 178" fill="none" stroke="#1A3A6A" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M92 150 L 96 180 L 108 182" fill="none" stroke="#1A3A6A" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="84" y="112" width="30" height="40" rx="12" fill="#FF8A1F" stroke={INK} strokeWidth="5" />
          <circle cx="99" cy="98" r="14" fill="#FFD2B8" stroke={INK} strokeWidth="5" />
          <circle cx="104" cy="96" r="2.2" fill={INK} />
          <g transform="translate(99 92)"><Hat id={equipped.chapeau} color={hatColor} /></g>
          <path d="M108 124 L 126 138" stroke="#FFD2B8" strokeWidth="9" strokeLinecap="round" />
        </g>

        {/* Rod and line */}
        <g className={reeling ? 'sc-shake' : ''}>
          <path d={`M${hand.x} ${hand.y} Q ${rodCtrl.x} ${rodCtrl.y} ${tip.x} ${tip.y}`} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <path d={`M${hand.x} ${hand.y} Q ${rodCtrl.x} ${rodCtrl.y} ${tip.x} ${tip.y}`} fill="none" stroke={rod} strokeWidth="5" strokeLinecap="round" />
          <circle cx={hand.x + 6} cy={hand.y - 4} r="5" fill="#C2C9F0" stroke={INK} strokeWidth="3" />
        </g>
        <path d={`M${tip.x} ${tip.y} Q ${lineCtrl.x} ${lineCtrl.y} ${fx} ${fy - 8}`} fill="none" stroke={line.length > 1 ? 'url(#scLine)' : line[0]} strokeWidth={line[0] === '#05061A' ? 2 : 2.8} style={{ transition: 'd 350ms ease-out' }} />

        {/* Float */}
        <g transform={`translate(${fx} ${fy})`} style={{ transition: 'transform 350ms ease-out' }}>
          {(phase === 'waiting' || phase === 'reeling') && [0, 800].map((d) => (
            <ellipse key={d} className="sc-ring" style={{ animationDelay: `${d}ms` }} cx="0" cy="4" rx="16" ry="5" fill="none" stroke="#FFFFFF" strokeWidth="3" />
          ))}
          {reeling && (
            <g className="sc-circle" opacity="0.45">
              <path d="M0 0 q 18 -10 36 0 q -18 10 -36 0 z M36 0 l 12 -8 v 16 z" fill={INK} />
            </g>
          )}
          <g className={reeling ? 'sc-bite' : 'sc-bob'}>
            <line x1="0" y1="-18" x2="0" y2="-10" stroke={INK} strokeWidth="3" />
            <circle r="11" cy="-2" fill={float[1] || '#FFFFFF'} stroke={INK} strokeWidth="5" />
            <path d="M-11 -2 A11 11 0 0 1 11 -2 Z" fill={float[0]} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          </g>
          {reeling && (
            <g transform="translate(14 -44)">
              <rect x="-11" y="-14" width="22" height="24" rx="8" fill="#FFC61A" stroke={INK} strokeWidth="4" />
              <text x="0" y="5" textAnchor="middle" fontSize="18" fontWeight="900" fill={INK}>!</text>
            </g>
          )}
          {phase === 'landed' && (
            <g className="sc-jump">
              <path d="M-20 0 q 20 -14 40 0 q -20 14 -40 0 z M20 0 l 14 -10 v 20 z" fill={landedColor || '#FFC61A'} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <circle cx="-10" cy="-2" r="2.5" fill={INK} />
            </g>
          )}
        </g>

        {/* Weather */}
        {(weather === 'pluie' || weather === 'orage') && (
          <g className="sc-rain">
            {Array.from({ length: 60 }, (_, i) => {
              const x = (i * 53) % 480;
              const y = ((i * 97) % 720) - 360;
              return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 15} stroke="#DDEFFF" strokeOpacity="0.7" strokeWidth="2.5" />;
            })}
          </g>
        )}
        {weather === 'brume' && <rect width="480" height="360" fill="#FFFFFF" opacity="0.32" />}
        {weather === 'orage' && <rect className="sc-flash" width="480" height="360" fill="#FFFFFF" />}
      </svg>
    </div>
  );
}
