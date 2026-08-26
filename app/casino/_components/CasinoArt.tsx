'use client';

/**
 * Hand-drawn SVG art for the casino games — replaces the emoji placeholders.
 * Everything is inline vector so it scales cleanly, keeps a single coherent
 * flat style, and costs no extra network request.
 */

interface ArtProps { size?: number; className?: string }

const box = (size: number) => ({ width: size, height: size, display: 'block' as const });

/* ---------------------------------------------------------------- */
/* Slot symbols                                                       */
/* ---------------------------------------------------------------- */

export function ArtCherry({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 6c2 4 6 6 9 7" stroke="#4E7B32" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M16 6c-2 4-5 7-7 9" stroke="#4E7B32" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M16 6c3-2 6-2 8 0-3 1-6 1-8 0z" fill="#5C9138" />
      <circle cx="9" cy="22" r="6" fill="#C81E3C" />
      <circle cx="24" cy="19" r="5.5" fill="#E02845" />
      <ellipse cx="7" cy="20" rx="1.8" ry="1.2" fill="#fff" opacity="0.5" transform="rotate(-30 7 20)" />
      <ellipse cx="22.2" cy="17.2" rx="1.6" ry="1" fill="#fff" opacity="0.5" transform="rotate(-30 22.2 17.2)" />
    </svg>
  );
}

export function ArtBell({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 4a2 2 0 0 1 2 2v1.2A8.8 8.8 0 0 1 24.5 16v5l2 3.2H5.5L7.5 21v-5A8.8 8.8 0 0 1 14 7.2V6a2 2 0 0 1 2-2z" fill="#F5B622" />
      <path d="M16 4a2 2 0 0 1 2 2v1.2A8.8 8.8 0 0 1 24.5 16v5l2 3.2h-6V6a2 2 0 0 0-2-2z" fill="#D4930C" />
      <path d="M11 9.5A8 8 0 0 0 9 15.5" stroke="#FFDE7A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="12.5" y="24.5" width="7" height="3" rx="1.5" fill="#A96F06" />
      <circle cx="16" cy="29" r="2.2" fill="#8A5A04" />
    </svg>
  );
}

export function ArtStar({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 2.5l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4L16 24.2 7.6 28.6l1.6-9.4-6.9-6.7 9.5-1.4z" fill="#FFC933" />
      <path d="M16 2.5l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4L16 24.2z" fill="#E8A511" />
      <path d="M16 6.6l2.8 5.7" stroke="#FFE8A3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ArtDiamond({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M8 5h16l6 7-14 16L2 12z" fill="#3FC9E8" />
      <path d="M16 5l-4 7 4 16 4-16z" fill="#8DE9FA" />
      <path d="M2 12h28" stroke="#1B9FC4" strokeWidth="1.2" />
      <path d="M8 5l4 7M24 5l-4 7" stroke="#1B9FC4" strokeWidth="1.2" />
      <path d="M24 5l6 7-14 16" fill="#2AA9CC" opacity="0.55" />
    </svg>
  );
}

export function ArtLemon({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <ellipse cx="16" cy="18" rx="11" ry="8.5" fill="#F2CF23" transform="rotate(-18 16 18)" />
      <ellipse cx="16" cy="18" rx="11" ry="8.5" fill="none" stroke="#C9A806" strokeWidth="1" transform="rotate(-18 16 18)" />
      <ellipse cx="11" cy="14.5" rx="3" ry="1.8" fill="#FBEB9A" opacity="0.75" transform="rotate(-18 11 14.5)" />
      <path d="M25 10c1.5-2 3-2.6 4.5-2.3-.6 1.8-1.9 3-3.4 3.4z" fill="#5C9138" />
    </svg>
  );
}

export function ArtSeven({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M8 5h16v4.5L15.5 28h-6l8.5-18H8z" fill="#E02845" />
      <path d="M8 5h16v4.5l-2.4 5.2V10H8z" fill="#F5566F" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Poulet                                                             */
/* ---------------------------------------------------------------- */

export function ArtChicken({ size = 40, className, dead }: ArtProps & { dead?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <ellipse cx="16" cy="20" rx="9" ry="7.5" fill="#F7F3EA" />
      <ellipse cx="12.5" cy="21" rx="5" ry="5.5" fill="#E4DED0" />
      <circle cx="21" cy="12.5" r="5.5" fill="#FCFAF4" />
      <path d="M19 6.5c.5-1.6 2-2 2.6-.7.9-1.4 2.5-.8 2.4.8-.2 1.3-1.6 1.9-2.6 1.7-1-.2-2.2-.6-2.4-1.8z" fill="#E0393F" />
      <path d="M26 13l3.4 1.4L26 15.8z" fill="#F2A61E" />
      <path d="M25.4 15.5c.9.4 1.3 1.3 1 2.2-.7.2-1.4-.2-1.7-1z" fill="#E0393F" />
      <circle cx="22.3" cy="11.6" r="1.1" fill="#221E1B" />
      <circle cx="22.7" cy="11.25" r="0.35" fill="#fff" />
      {!dead && (
        <>
          <path d="M13.5 27v3M19 27v3" stroke="#F2A61E" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 30h3M17.5 30h3" stroke="#F2A61E" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      <path d="M9 18c2.5-1.5 5.5-1 7 1.5-2 1.6-5.2 1.3-7-1.5z" fill="#E4DED0" />
      {dead && <path d="M20.6 10.4l3.4 3.4M24 10.4l-3.4 3.4" stroke="#221E1B" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

export function ArtCar({ size = 34, className }: ArtProps) {
  // Seen from above — it drives down the lane toward the player.
  return (
    <svg viewBox="0 0 24 40" style={{ width: size, height: size * (40 / 24), display: 'block' }} className={className}>
      <rect x="2.5" y="8" width="19" height="5" rx="1.2" fill="#1D1D26" />
      <rect x="2.5" y="27" width="19" height="5" rx="1.2" fill="#1D1D26" />
      <rect x="3" y="2" width="18" height="36" rx="6" fill="#D8322F" />
      <rect x="3" y="2" width="9" height="36" rx="6" fill="#EA4A44" />
      <path d="M6 9h12l-1.4 5.6H7.4z" fill="#2A3B52" />
      <path d="M6.6 31h10.8l1.3-5.2H5.3z" fill="#2A3B52" />
      <rect x="5" y="16" width="14" height="8" rx="1.6" fill="#B8231F" />
      <circle cx="6.6" cy="4.6" r="1.5" fill="#FFE9A8" />
      <circle cx="17.4" cy="4.6" r="1.5" fill="#FFE9A8" />
      <circle cx="6.6" cy="35.6" r="1.2" fill="#8E1512" />
      <circle cx="17.4" cy="35.6" r="1.2" fill="#8E1512" />
    </svg>
  );
}

export function ArtImpact({ size = 44, className }: ArtProps) {
  return (
    <svg viewBox="0 0 40 40" style={box(size)} className={className}>
      <path d="M20 1l3.6 8.6L32 5.4l-3.2 8.9 9.4.5-7.4 5.6 7 5.5-9.3.9 3.6 8.6-8.6-4.2L20 39l-3.5-8.8-8.6 4.2 3.6-8.6-9.3-.9 7-5.5-7.4-5.6 9.4-.5L8 5.4l8.4 4.2z" fill="#FF7A18" />
      <path d="M20 7l2.6 6.2L28.6 10l-2.4 6.5 6.6.4-5 3.9 4.7 3.8-6.4.6 2.4 6-5.9-2.9L20 30l-2.6-6.1-5.9 2.9 2.4-6-6.4-.6 4.7-3.8-5-3.9 6.6-.4L11.4 10l6 3.2z" fill="#FFD000" />
    </svg>
  );
}

export function ArtFinishFlag({ size = 30, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <rect x="6" y="3" width="2.2" height="26" rx="1" fill="#8A8F98" />
      <g>
        <rect x="8.2" y="4" width="18" height="12" fill="#F5F5F5" />
        <g fill="#1A1A22">
          <rect x="8.2" y="4" width="4.5" height="3" /><rect x="17.2" y="4" width="4.5" height="3" />
          <rect x="12.7" y="7" width="4.5" height="3" /><rect x="21.7" y="7" width="4.5" height="3" />
          <rect x="8.2" y="10" width="4.5" height="3" /><rect x="17.2" y="10" width="4.5" height="3" />
          <rect x="12.7" y="13" width="4.5" height="3" /><rect x="21.7" y="13" width="4.5" height="3" />
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Dino                                                               */
/* ---------------------------------------------------------------- */

export function ArtDino({ size = 40, className, dead }: ArtProps & { dead?: boolean }) {
  return (
    <svg viewBox="0 0 40 32" style={{ width: size * 1.25, height: size, display: 'block' }} className={className}>
      <path d="M2 22c3-1 5-3 6.5-6" stroke="#3E8E4F" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M22 5.5c5.2 0 9 3.4 9 8v3.5h3.5c1.6 0 2.5 1 2.5 2.2 0 1.3-1 2.3-2.6 2.3H30c-.6 3.9-4.3 6.5-8.6 6.5H16c-5 0-8.8-3.2-8.8-8.2 0-3.4 1.6-6 4.2-7.4C12.5 8.2 16.6 5.5 22 5.5z" fill="#4CA860" />
      <path d="M22 5.5c5.2 0 9 3.4 9 8v3.5h3.5c1.6 0 2.5 1 2.5 2.2 0 1.3-1 2.3-2.6 2.3H30c-.6 3.9-4.3 6.5-8.6 6.5h-2.6c4-.7 6.7-3.3 7.2-6.9V13c0-4-2.6-6.8-6.4-7.5z" fill="#3E8E4F" />
      <path d="M12 8.5l2.4-3.2 1.6 3M17 5.6l2.2-3.4 1.8 3.2" fill="#3E8E4F" />
      <rect x="14" y="26" width="3.2" height="5" rx="1.4" fill="#3E8E4F" />
      <rect x="21" y="26" width="3.2" height="5" rx="1.4" fill="#4CA860" />
      <circle cx="27.6" cy="12.4" r="1.5" fill="#1D2A20" />
      <circle cx="28.1" cy="11.9" r="0.5" fill="#fff" />
      {dead
        ? <path d="M26.4 11l2.4 2.4M28.8 11l-2.4 2.4" stroke="#1D2A20" strokeWidth="1.3" strokeLinecap="round" />
        : <path d="M31 17.5h2.6" stroke="#2E6B3B" strokeWidth="1.2" strokeLinecap="round" />}
    </svg>
  );
}

export function ArtCactus({ size = 30, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 32" style={{ width: size * 0.75, height: size, display: 'block' }} className={className}>
      <rect x="9" y="6" width="6" height="26" rx="3" fill="#3E8E4F" />
      <path d="M9 16H6.5A2.5 2.5 0 0 1 4 13.5v-2a2 2 0 1 1 4 0v1a1 1 0 0 0 1 1z" fill="#3E8E4F" />
      <path d="M15 20h2.5a2.5 2.5 0 0 0 2.5-2.5v-3a2 2 0 1 0-4 0v2a1 1 0 0 1-1 1z" fill="#3E8E4F" />
      <path d="M11 8v22" stroke="#2E6B3B" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

export function ArtRock({ size = 28, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 24" style={{ width: size * 1.33, height: size, display: 'block' }} className={className}>
      <path d="M4 22l4-13 7-5 9 4 4 9-3 5z" fill="#7C8492" />
      <path d="M15 4l9 4 4 9-3 5H16l4-9z" fill="#5F6875" />
      <path d="M8 9l7 4-4 9" stroke="#98A0AC" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function ArtFire({ size = 30, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 32" style={{ width: size * 0.75, height: size, display: 'block' }} className={className}>
      <path d="M12 1c1.5 5-2 6.5-4.5 10C5 14.5 4 17 4 20a8 8 0 0 0 16 0c0-4-2-6.5-4-9.5-.8 1.6-2 2.5-3.2 2 1.8-3.6 1.4-8-.8-11.5z" fill="#F26A1B" />
      <path d="M12 13c1.2 2.4-.6 3.4-1.8 5.2-.8 1.2-1.2 2.3-1.2 3.6a4 4 0 0 0 8 0c0-2.2-1.4-3.6-2.6-5.4-.5.9-1.2 1.4-1.9 1.1.9-1.7.9-3.1-.5-4.5z" fill="#FFC933" />
    </svg>
  );
}

export function ArtVolcano({ size = 32, className }: ArtProps) {
  return (
    <svg viewBox="0 0 36 32" style={{ width: size * 1.12, height: size, display: 'block' }} className={className}>
      <path d="M2 30l10-18h12l10 18z" fill="#6A5347" />
      <path d="M18 12h6l10 18H18z" fill="#54423A" />
      <path d="M12 12h12l-3 4h-6z" fill="#3A2D28" />
      <path d="M15 12c0-4 1-6 3-8 2 2 3 4 3 8-1-1.5-2-2-3-2s-2 .5-3 2z" fill="#F26A1B" />
      <path d="M14 16c1.4 2.5 3 4.5 3 7-2.6-1-4-3.4-3-7zM22 16c-1.4 2.5-3 4.5-3 7 2.6-1 4-3.4 3-7z" fill="#E0472B" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Mines                                                              */
/* ---------------------------------------------------------------- */

export function ArtGem({ size = 28, className }: ArtProps) {
  return <ArtDiamond size={size} className={className} />;
}

export function ArtBomb({ size = 28, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <circle cx="14.5" cy="19.5" r="10.5" fill="#25252F" />
      <circle cx="14.5" cy="19.5" r="10.5" fill="none" stroke="#3A3A48" strokeWidth="1" />
      <ellipse cx="10.5" cy="15.5" rx="3" ry="2" fill="#4A4A5C" opacity="0.8" transform="rotate(-35 10.5 15.5)" />
      <rect x="19" y="6" width="5" height="4" rx="1" fill="#4A4A5C" transform="rotate(35 21.5 8)" />
      <path d="M23 6c2.5-1.5 4-3.5 3.5-5.5" stroke="#B0824A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="26.8" cy="1" r="2.4" fill="#FFC933" />
      <circle cx="26.8" cy="1" r="1.2" fill="#FF7A18" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Grattage / Caisses                                                 */
/* ---------------------------------------------------------------- */

export function ArtClover({ size = 36, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 15c-1-3.5-3.6-5.4-6-4.4-2.2 1-2.6 4-.8 6 1.5 1.6 4.2 2 6.8-1.6z" fill="#4CA860" />
      <path d="M16 15c3.5-1 5.4-3.6 4.4-6-1-2.2-4-2.6-6-.8-1.6 1.5-2 4.2 1.6 6.8z" fill="#5CBF72" />
      <path d="M16 15c1 3.5 3.6 5.4 6 4.4 2.2-1 2.6-4 .8-6-1.5-1.6-4.2-2-6.8 1.6z" fill="#5CBF72" />
      <path d="M16 15c-3.5 1-5.4 3.6-4.4 6 1 2.2 4 2.6 6 .8 1.6-1.5 2-4.2-1.6-6.8z" fill="#4CA860" />
      <path d="M16 16c1 4 2 8 1 14" stroke="#3E8E4F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ArtMoneyBag({ size = 36, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M11 7h10l-2.2 3.2C24 12 27 17 27 22c0 5-4 8-11 8S5 27 5 22c0-5 3-10 8.2-11.8z" fill="#C48A2E" />
      <path d="M16 7h5l-2.2 3.2C24 12 27 17 27 22c0 5-4 8-11 8z" fill="#A8721F" />
      <path d="M10.5 5.5h11l-.8 2.2h-9.4z" fill="#E4B252" />
      <path d="M16 14v11M13 17h5.2a2 2 0 0 1 0 4H14a2 2 0 0 0 0 4h5" stroke="#FFE8A3" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ArtCrown({ size = 36, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M4 24l-2-14 7.5 5L16 5l6.5 10L30 10l-2 14z" fill="#F5B622" />
      <path d="M16 5l6.5 10L30 10l-2 14H16z" fill="#D4930C" />
      <rect x="4" y="24" width="24" height="4" rx="1.2" fill="#A96F06" />
      <circle cx="16" cy="13" r="1.8" fill="#E02845" />
      <circle cx="8" cy="15" r="1.4" fill="#3FC9E8" />
      <circle cx="24" cy="15" r="1.4" fill="#3FC9E8" />
    </svg>
  );
}

export function ArtCrate({ size = 40, className, open }: ArtProps & { open?: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 32 32" style={box(size)} className={className}>
        <path d="M3 12l4-6h18l4 6-3 2H6z" fill="#6B4A2A" transform="translate(0,-4) rotate(-8 16 10)" />
        <rect x="4" y="13" width="24" height="16" rx="1.5" fill="#8A6236" />
        <rect x="4" y="13" width="24" height="16" rx="1.5" fill="none" stroke="#5C3F20" strokeWidth="1.2" />
        <path d="M4 20h24" stroke="#5C3F20" strokeWidth="1.2" />
        <circle cx="12" cy="19" r="3" fill="#F5B622" />
        <circle cx="20" cy="20" r="3.5" fill="#FFC933" />
        <circle cx="16" cy="23" r="3" fill="#E4B252" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <rect x="4" y="7" width="24" height="21" rx="1.5" fill="#8A6236" />
      <rect x="4" y="7" width="24" height="21" rx="1.5" fill="none" stroke="#5C3F20" strokeWidth="1.4" />
      <path d="M4 13.5h24M4 21.5h24" stroke="#5C3F20" strokeWidth="1.4" />
      <path d="M5 8l22 19M27 8L5 27" stroke="#6B4A2A" strokeWidth="1.6" opacity="0.55" />
      <rect x="13.5" y="15.5" width="5" height="4.5" rx="1" fill="#C48A2E" />
    </svg>
  );
}

export function ArtCrateEmpty({ size = 40, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className} opacity={0.55}>
      <path d="M4 11l3-4h18l3 4" fill="none" stroke="#5C3F20" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="4" y="12" width="24" height="16" rx="1.5" fill="#5A4429" />
      <rect x="4" y="12" width="24" height="16" rx="1.5" fill="none" stroke="#3E2D18" strokeWidth="1.2" />
      <path d="M8 18h16" stroke="#3E2D18" strokeWidth="1.2" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Others                                                             */
/* ---------------------------------------------------------------- */

export function ArtHorse({ size = 26, className }: ArtProps) {
  // Galloping silhouette: barrel, arched neck, muzzle, four legs, tail. The
  // previous version was a single blob that read as a brown lump at 26px.
  return (
    <svg viewBox="0 0 44 34" style={{ width: size * 1.3, height: size, display: 'block' }} className={className}>
      {/* far legs, darker so the near pair reads in front */}
      <path d="M15 20l-3 8-3 3 2 1.6 4-4 2-7z" fill="#5E3820" />
      <path d="M27 20l2 8 3 3-2 1.6-4-4-1.6-7z" fill="#5E3820" />
      {/* tail */}
      <path d="M9 16c-3 1-5 4-5.6 8 2-2.6 3.6-4 6-4.6z" fill="#3E2416" />
      {/* barrel + hindquarters */}
      <ellipse cx="19" cy="17" rx="10" ry="6" fill="#7A4B2A" />
      <path d="M9 15c-1 3-.6 6 1.4 8-2.4-.6-3.4-3-3.4-5z" fill="#7A4B2A" />
      {/* neck */}
      <path d="M26 14c1-4 4-7 8-9l3 2c-3 2-5 5-6 8z" fill="#7A4B2A" />
      {/* head + muzzle */}
      <path d="M33 4l5 1.4c1.6.5 2.4 1.6 2 3l-1 3.4c-.3 1-1.2 1.5-2.2 1.2l-5.4-1.6z" fill="#8A5730" />
      <path d="M37.4 12.6l2.6.8c.8.2 1 .8.5 1.4-.6.7-1.6.8-2.5.4l-1.2-.6z" fill="#5E3820" />
      {/* ears */}
      <path d="M33.4 4.2l-.8-3.4 2.8 2.6zM36.2 5l.6-3.4 1.8 3z" fill="#3E2416" />
      {/* mane */}
      <path d="M27 13.6c1.4-4 4-7.2 7.4-9.2l1.2 1c-3 2.2-5.2 5.4-6.2 9z" fill="#3E2416" />
      {/* near legs */}
      <path d="M16 21l-2.4 8.4-3.4 2.8 1.6 1.8 4.6-4 2.4-7.4z" fill="#8A5730" />
      <path d="M25 21l2.4 8.4 3.4 2.8-1.6 1.8-4.6-4-2.4-7.4z" fill="#8A5730" />
      {/* hooves */}
      <path d="M10.6 31.4l2.6-1.4.8 1.4-2.4 1.6zM30.8 31.4l-2.6-1.4-.8 1.4 2.4 1.6z" fill="#241408" />
      <circle cx="36.4" cy="7.4" r="1.1" fill="#241408" />
    </svg>
  );
}

/** The FrenlyCoin itself - flat, thick-outlined, same language as the site. */
export function ArtFrenlyCoin({ size = 40, className, variant = 'gold' }: ArtProps & { variant?: 'gold' | 'dark' }) {
  const gold = variant === 'gold';
  const disc = gold ? '#FFD000' : '#1E1E28';
  const ink = gold ? '#12121A' : '#FFD000';
  return (
    <svg viewBox="0 0 40 40" style={box(size)} className={className}>
      <circle cx="20" cy="20" r="18" fill={disc} stroke="#12121A" strokeWidth="3" />
      <circle cx="20" cy="20" r="14" fill="none" stroke={ink} strokeWidth="1.6" opacity="0.5" />
      <path
        d="M15 11h6.4c3.4 0 5.6 2.1 5.6 5.4 0 3.4-2.2 5.5-5.6 5.5H18V29h-3zm3 3v5h3.2c1.8 0 2.9-1 2.9-2.5s-1.1-2.5-2.9-2.5z"
        fill={ink}
      />
      <path d="M11.5 18.5h14M11.5 22.5h14" stroke={ink} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function ArtRocketShip({ size = 44, className, crashed }: ArtProps & { crashed?: boolean }) {
  if (crashed) return <ArtImpact size={size} className={className} />;
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 1c5 4 7.5 9.5 7.5 15.5L21 22h-10l-2.5-5.5C8.5 10.5 11 5 16 1z" fill="#EDEFF3" />
      <path d="M16 1c5 4 7.5 9.5 7.5 15.5L21 22h-5V1z" fill="#C6CBD4" />
      <circle cx="16" cy="12" r="3.4" fill="#2F80C8" />
      <circle cx="16" cy="12" r="3.4" fill="none" stroke="#8FA3B8" strokeWidth="1.2" />
      <path d="M11 16.5L6 21l1 5 4-3.5zM21 16.5l5 4.5-1 5-4-3.5z" fill="#E02845" />
      <path d="M12.5 22h7l-1.4 3h-4.2z" fill="#F2A61E" />
      <path d="M14 25h4l-2 6z" fill="#FF7A18" />
    </svg>
  );
}

export function ArtBall({ size = 22, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" style={box(size)} className={className}>
      <circle cx="12" cy="12" r="10" fill="#F2F4F7" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#B6BCC6" strokeWidth="1" />
      <ellipse cx="8.6" cy="8.6" rx="3" ry="2.2" fill="#fff" transform="rotate(-35 8.6 8.6)" />
    </svg>
  );
}

/* Rock–paper–scissors: objects rather than hands, reads instantly at small sizes. */
export function ArtRps({ move, size = 44, className }: ArtProps & { move: 'pierre' | 'feuille' | 'ciseaux' }) {
  if (move === 'pierre') return <ArtRock size={size} className={className} />;
  if (move === 'feuille') {
    return (
      <svg viewBox="0 0 32 32" style={box(size)} className={className}>
        <path d="M6 3h14l6 6v20H6z" fill="#F7F8FA" />
        <path d="M20 3l6 6h-6z" fill="#C6CBD4" />
        <path d="M10 14h12M10 18h12M10 22h8" stroke="#9AA2AE" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M8 3l12 17M24 3L12 20" stroke="#B6BCC6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="9" cy="25" r="4.5" fill="none" stroke="#E02845" strokeWidth="3" />
      <circle cx="23" cy="25" r="4.5" fill="none" stroke="#E02845" strokeWidth="3" />
      <circle cx="16" cy="19" r="1.6" fill="#8A9099" />
    </svg>
  );
}

export function ArtShield({ size = 26, className, away }: ArtProps & { away?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" style={box(size)} className={className}>
      <path d="M12 1.5l9 3.2v7.6c0 5.2-3.6 9-9 10.7-5.4-1.7-9-5.5-9-10.7V4.7z" fill={away ? '#3FC9E8' : '#E02845'} />
      <path d="M12 1.5l9 3.2v7.6c0 5.2-3.6 9-9 10.7z" fill={away ? '#2AA9CC' : '#B8231F'} />
      <path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6L7 10.3l3.6-.5z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

export function ArtHandshake({ size = 26, className }: ArtProps) {
  return (
    <svg viewBox="0 0 32 24" style={{ width: size * 1.33, height: size, display: 'block' }} className={className}>
      <path d="M1 8h6l4-3h5l-4 4 3 3 5-5h5l5 3v8l-4 3-5-4-3 3-3-2-3 2-4-3-3 2-4-3z" fill="#E4B252" />
      <path d="M16 5l-4 4 3 3 5-5h5l5 3v8l-4 3-5-4-3 3" fill="none" stroke="#A8721F" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtDoor({ size = 18, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" style={box(size)} className={className}>
      <rect x="4" y="2" width="16" height="21" rx="1.5" fill="#8A6236" />
      <rect x="6" y="4" width="12" height="17" rx="1" fill="#6B4A2A" />
      <circle cx="16" cy="13" r="1.3" fill="#F5B622" />
    </svg>
  );
}

export function ArtSkull({ size = 18, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" style={box(size)} className={className}>
      <path d="M12 2c5 0 8.5 3.4 8.5 8 0 2.8-1.3 4.7-3 5.9V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3.1c-1.7-1.2-3-3.1-3-5.9C3.5 5.4 7 2 12 2z" fill="#EDEFF3" />
      <circle cx="8.6" cy="10.4" r="2.4" fill="#22222C" />
      <circle cx="15.4" cy="10.4" r="2.4" fill="#22222C" />
      <path d="M12 13.4l-1.4 2.6h2.8z" fill="#22222C" />
      <path d="M9.5 21v-2.4M12 21v-2.4M14.5 21v-2.4" stroke="#C6CBD4" strokeWidth="1.2" />
    </svg>
  );
}

export function ArtCheck({ size = 18, className }: ArtProps) {
  return (
    <svg viewBox="0 0 24 24" style={box(size)} className={className}>
      <circle cx="12" cy="12" r="10" fill="#00C97A" />
      <path d="M7.5 12.4l3.1 3.1 6-6.4" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtCoinFace({ size = 40, className, side }: ArtProps & { side: 'pile' | 'face' }) {
  if (side === 'pile') {
    return (
      <svg viewBox="0 0 32 32" style={box(size)} className={className}>
        <path d="M12 6h5.5c3.6 0 5.8 2 5.8 5.2 0 3.3-2.2 5.3-5.8 5.3H15V26h-3zm3 2.6v5.3h2.3c1.9 0 3-1 3-2.7 0-1.6-1.1-2.6-3-2.6zM9 12h11.5M9 16h11.5" stroke="#4A3800" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" style={box(size)} className={className}>
      <path d="M16 5.5l3.1 6.4 7 1-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-1z" fill="#2A2F38" />
    </svg>
  );
}
