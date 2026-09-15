/**
 * One drawn icon per multiplayer game, in the site's style: a coloured tile
 * with a dark outline and a darker bottom edge, and a flat drawing of the
 * game's own object (a Pokéball, a gauge, a gavel…).
 */

import type { ReactElement } from 'react';

const INK = '#05061A';
const W = '#FFFFFF';
const Y = '#FFC61A';
const P = '#FF4F8B';
const G = '#33D17A';
const B = '#5B8CFF';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

type Art = { bg: string; shade: string; draw: ReactElement };

const ART: Record<string, Art> = {
  pokeguessr: {
    bg: '#FF8A1F', shade: '#CC6508',
    draw: (
      <g>
        <path d="M10 24a14 14 0 0 1 28 0Z" fill="#E63946" {...S} />
        <path d="M10 24a14 14 0 0 0 28 0Z" fill={W} {...S} />
        <line x1="10" y1="24" x2="38" y2="24" {...S} />
        <circle cx="24" cy="24" r="5" fill={W} {...S} />
      </g>
    ),
  },
  flagguessr: {
    bg: B, shade: '#2F5BD0',
    draw: (
      <g>
        <line x1="13" y1="9" x2="13" y2="40" {...S} strokeWidth={3.5} />
        <path d="M14 11c6-3 10 3 16 0s6 0 6 0v15s-2-2-6 0-10-3-16 0Z" fill={W} {...S} />
        <path d="M22 10.5v16" stroke="#E63946" strokeWidth="5" />
        <path d="M14 11c6-3 10 3 16 0s6 0 6 0v15s-2-2-6 0-10-3-16 0Z" fill="none" {...S} />
      </g>
    ),
  },
  infiltre: {
    bg: G, shade: '#1E9A55',
    draw: (
      <g>
        <circle cx="21" cy="21" r="9" fill="#BFE9FF" {...S} />
        <line x1="28" y1="28" x2="37" y2="37" {...S} strokeWidth={5} />
        <circle cx="21" cy="21" r="3" fill={INK} />
      </g>
    ),
  },
  undercover: {
    bg: '#FF8A1F', shade: '#CC6508',
    draw: (
      <g>
        <path d="M11 22h26" {...S} strokeWidth={4} />
        <path d="M15 22c0-6 2-11 9-11s9 5 9 11" fill={INK} {...S} />
        <path d="M13 28h9v4a4 4 0 0 1-8 0Zm13 0h9v4a4 4 0 0 1-8 0Z" fill={INK} {...S} strokeWidth={2} />
        <line x1="22" y1="29" x2="26" y2="29" {...S} strokeWidth={2} />
      </g>
    ),
  },
  drawguessr: {
    bg: '#8B3DFF', shade: '#6526C9',
    draw: (
      <g>
        <path d="M9 36c5-8 9 2 14-5s8 1 11-3" fill="none" stroke={Y} strokeWidth="3" strokeLinecap="round" />
        <path d="M30 10l6 6-15 15-8 2 2-8Z" fill={Y} {...S} />
        <path d="M27 13l6 6" {...S} />
        <path d="M13 25l8 8" fill="none" />
      </g>
    ),
  },
  budgetguessr: {
    bg: P, shade: '#C92D63',
    draw: (
      <g>
        <rect x="9" y="19" width="26" height="18" rx="3" fill={INK} {...S} />
        <path d="M9 19l3-8 25 4-2 5Z" fill={W} {...S} />
        <circle cx="34" cy="31" r="7" fill={Y} {...S} />
        <text x="34" y="34.5" textAnchor="middle" fontSize="10" fontWeight="900" fill={INK} fontFamily="Arial Black, sans-serif">€</text>
      </g>
    ),
  },
  rentguessr: {
    bg: G, shade: '#1E9A55',
    draw: (
      <g>
        <path d="M9 23l15-12 15 12" fill="none" {...S} strokeWidth={3.5} />
        <path d="M13 21v16h22V21" fill={W} {...S} />
        <rect x="20" y="27" width="8" height="10" fill={P} {...S} />
      </g>
    ),
  },
  logoguessr: {
    bg: B, shade: '#2F5BD0',
    draw: (
      <g>
        <path d="M24 9l4 9 10 1-7.5 7 2 10-8.5-5-8.5 5 2-10L10 19l10-1Z" fill={Y} {...S} />
        <text x="24" y="28.5" textAnchor="middle" fontSize="9" fontWeight="900" fill={INK} fontFamily="Arial Black, sans-serif">TM</text>
      </g>
    ),
  },
  jaugeguessr: {
    bg: '#8B3DFF', shade: '#6526C9',
    draw: (
      <g>
        <path d="M9 32a15 15 0 0 1 30 0Z" fill={W} {...S} />
        <path d="M24 32L24 17a15 15 0 0 1 11 6Z" fill={G} stroke="none" />
        <path d="M9 32a15 15 0 0 1 30 0Z" fill="none" {...S} />
        <line x1="24" y1="32" x2="32" y2="21" {...S} strokeWidth={3.5} stroke={P} />
        <circle cx="24" cy="32" r="3" fill={INK} />
      </g>
    ),
  },
  wikiracing: {
    bg: '#FF8A1F', shade: '#CC6508',
    draw: (
      <g>
        <path d="M5 18h6M3 24h8M5 30h6" {...S} stroke={W} />
        <rect x="14" y="10" width="24" height="28" rx="3" fill={W} {...S} />
        <text x="26" y="30" textAnchor="middle" fontSize="16" fontWeight="900" fill={INK} fontFamily="Georgia, serif">W</text>
      </g>
    ),
  },
  horssujet: {
    bg: '#8B3DFF', shade: '#6526C9',
    draw: (
      <g>
        <path d="M8 12h18v12H15l-5 4v-4H8Z" fill={W} {...S} />
        <path d="M22 22h18v12h-2v4l-5-4H22Z" fill={P} {...S} />
        <text x="31" y="32" textAnchor="middle" fontSize="11" fontWeight="900" fill={W} fontFamily="Arial Black, sans-serif">?</text>
      </g>
    ),
  },
  untraitdetrop: {
    bg: '#FF8A1F', shade: '#CC6508',
    draw: (
      <g>
        <rect x="8" y="10" width="28" height="24" rx="3" fill={W} {...S} />
        <path d="M13 28c4-9 8-10 12-4" fill="none" stroke={B} strokeWidth="3" strokeLinecap="round" />
        <path d="M29 20l4-3" fill="none" stroke={P} strokeWidth="3" strokeLinecap="round" />
        <path d="M33 26l7 10-3 2-7-10Z" fill={Y} {...S} strokeWidth={2.5} />
      </g>
    ),
  },
  blindtest: {
    bg: '#8B3DFF', shade: '#6526C9',
    draw: (
      <g>
        <path d="M11 28v-4a13 13 0 0 1 26 0v4" fill="none" {...S} strokeWidth={3.5} />
        <rect x="8" y="26" width="8" height="12" rx="3" fill={P} {...S} />
        <rect x="32" y="26" width="8" height="12" rx="3" fill={P} {...S} />
        <path d="M22 30V19l6-2v10" fill="none" stroke={Y} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20.5" cy="30.5" r="2.5" fill={Y} />
        <circle cx="26.5" cy="27.5" r="2.5" fill={Y} />
      </g>
    ),
  },
  punchline: {
    bg: P, shade: '#C92D63',
    draw: (
      <g>
        <rect x="18" y="8" width="12" height="20" rx="6" fill={W} {...S} />
        <path d="M13 22a11 11 0 0 0 22 0" fill="none" {...S} />
        <line x1="24" y1="33" x2="24" y2="40" {...S} />
        <line x1="17" y1="40" x2="31" y2="40" {...S} />
        <path d="M21 17q3 3 6 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  petitbac: {
    bg: G, shade: '#1E9A55',
    draw: (
      <g>
        <rect x="9" y="9" width="30" height="30" rx="4" fill={W} {...S} />
        <path d="M19 9v30M29 9v30M9 19h30M9 29h30" stroke={INK} strokeWidth="2" />
        <rect x="9" y="9" width="10" height="10" rx="2" fill={Y} {...S} strokeWidth={2} />
        <text x="14" y="17.5" textAnchor="middle" fontSize="8" fontWeight="900" fill={INK} fontFamily="Arial Black, sans-serif">A</text>
      </g>
    ),
  },
  quiaditca: {
    bg: '#FF8A1F', shade: '#CC6508',
    draw: (
      <g>
        <path d="M8 11h32v20H22l-8 7v-7H8Z" fill={W} {...S} />
        <text x="24" y="29" textAnchor="middle" fontSize="20" fontWeight="900" fill={P} fontFamily="Georgia, serif">“ ”</text>
      </g>
    ),
  },
  surenchere: {
    bg: B, shade: '#2F5BD0',
    draw: (
      <g>
        <rect x="16" y="9" width="18" height="10" rx="3" transform="rotate(-35 25 14)" fill={Y} {...S} />
        <line x1="26" y1="18" x2="36" y2="32" {...S} strokeWidth={4} />
        <rect x="8" y="34" width="20" height="5" rx="2" fill="#8D6E63" {...S} />
      </g>
    ),
  },
  ledico: {
    bg: G, shade: '#1E9A55',
    draw: (
      <g>
        <path d="M24 14c-5-3-10-3-15-2v24c5-1 10-1 15 2Z" fill={W} {...S} />
        <path d="M24 14c5-3 10-3 15-2v24c-5-1-10-1-15 2Z" fill={W} {...S} />
        <text x="16.5" y="29" textAnchor="middle" fontSize="11" fontWeight="900" fill={P} fontFamily="Georgia, serif">A</text>
        <text x="31.5" y="29" textAnchor="middle" fontSize="10" fontWeight="900" fill={B} fontFamily="Georgia, serif">a</text>
      </g>
    ),
  },
};

export const hasGameIcon = (game: string) => game in ART;

export default function GameIcon({ game, className }: { game: string; className?: string }) {
  const art = ART[game];
  if (!art) return null;
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="12" fill={art.shade} stroke={INK} strokeWidth="3" />
      <rect x="3" y="3" width="42" height="38" rx="10.5" fill={art.bg} />
      <path d="M8 6h14" stroke={W} strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
      {art.draw}
    </svg>
  );
}
