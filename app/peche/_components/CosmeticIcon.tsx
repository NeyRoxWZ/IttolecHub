import type { Cosmetic } from '@/lib/peche/data';

const INK = '#05061A';

/** A small drawing of a fishing cosmetic, by slot. */
export default function CosmeticIcon({ cosmetic, size = 64, hidden = false }: { cosmetic: Cosmetic; size?: number; hidden?: boolean }) {
  const c = cosmetic.colors;
  const dark = '#2B3170';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill={hidden ? '#0E1030' : '#1E2358'} stroke={INK} strokeWidth="4" />
      {cosmetic.slot === 'flotteur' && (
        <g>
          <line x1="32" y1="6" x2="32" y2="20" stroke={INK} strokeWidth="3" />
          <circle cx="32" cy="36" r="15" fill={hidden ? dark : c[1]} stroke={INK} strokeWidth="4" />
          <path d="M17 36 A15 15 0 0 1 47 36 Z" fill={hidden ? dark : c[0]} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        </g>
      )}
      {cosmetic.slot === 'canne' && (
        <g>
          <line x1="12" y1="54" x2="50" y2="10" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <line x1="12" y1="54" x2="50" y2="10" stroke={hidden ? dark : c[0]} strokeWidth="5" strokeLinecap="round" />
          <circle cx="20" cy="45" r="5" fill={hidden ? dark : '#C2C9F0'} stroke={INK} strokeWidth="3" />
        </g>
      )}
      {cosmetic.slot === 'decor' && (
        <g>
          <rect x="8" y="8" width="48" height="30" rx="8" fill={hidden ? dark : c[0]} />
          <circle cx="42" cy="22" r="8" fill={hidden ? '#1A1F52' : c[1]} stroke={INK} strokeWidth="3" />
          <rect x="8" y="36" width="48" height="20" rx="4" fill={hidden ? '#1A1F52' : '#1F6FD0'} stroke={INK} strokeWidth="3" />
        </g>
      )}
      {cosmetic.slot === 'effet' && (
        <g>
          {[[20, 22, 6], [42, 18, 5], [30, 40, 8], [48, 42, 5], [16, 46, 4]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={hidden ? dark : c[i % c.length]} stroke={INK} strokeWidth="3" />
          ))}
        </g>
      )}
    </svg>
  );
}
