import { RARITIES } from '@/lib/peche/data';

/**
 * A fish drawn in the site's style: chunky outline, flat fill, a tail and an
 * eye. Unknown species are a dark silhouette, like an empty Poissodex slot.
 */
export default function FishIcon({
  color, rarity = 0, size = 56, unknown = false, variant = '',
}: {
  color: string;
  rarity?: number;
  size?: number;
  unknown?: boolean;
  variant?: string;
}) {
  const INK = '#05061A';
  const fill = unknown ? '#2B3170' : variant === 'or' ? '#FFC61A' : color;
  const fin = unknown ? '#1A1F52' : RARITIES[rarity]?.color || '#C2C9F0';
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" aria-hidden="true">
      {variant === 'chroma' && !unknown && (
        <defs>
          <linearGradient id="chroma" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF4F8B" /><stop offset="0.5" stopColor="#FFC61A" /><stop offset="1" stopColor="#25D0C8" />
          </linearGradient>
        </defs>
      )}
      <path d="M70 31 L96 10 L90 31 L96 52 Z" fill={fin} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M40 12 L55 2 L60 16 Z" fill={fin} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="40" cy="31" rx="36" ry="21" fill={variant === 'chroma' && !unknown ? 'url(#chroma)' : fill} stroke={INK} strokeWidth="5" />
      {!unknown && (
        <>
          <path d="M52 16 Q 60 31 52 46" fill="none" stroke={INK} strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
          <circle cx="20" cy="26" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="3" />
          <circle cx="19" cy="26" r="2.5" fill={INK} />
        </>
      )}
    </svg>
  );
}
