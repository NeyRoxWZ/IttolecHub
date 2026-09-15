import { ImageResponse } from 'next/og';

/**
 * Home-screen icons for the per-game apps, in the site's look: a bright game
 * colour, thick navy outlines and a pressed-in shade, the same artwork as the
 * game's cover in the Solo list. Drawn on request, so a new game only needs
 * an entry here.
 *
 * The artwork stays inside the central 60%: Android crops maskable icons to a
 * circle or a squircle, and nothing important may sit in the corners.
 */
const INK = '#05061A';

const GAMES: Record<string, { bg: string; shade: string; art: string }> = {
  // Slot machine: sign, cabinet, three 7s, lever.
  casino: {
    bg: '#8B3DFF',
    shade: '#6A22D6',
    art: `
      <rect x="196" y="120" width="110" height="36" rx="12" fill="#FFC61A" stroke="${INK}" stroke-width="10"/>
      ${[216, 238, 260, 282].map((x) => `<circle cx="${x + 4}" cy="138" r="5" fill="${INK}"/>`).join('')}
      <rect x="140" y="150" width="210" height="220" rx="28" fill="#FF4F8B" stroke="${INK}" stroke-width="12"/>
      <rect x="162" y="178" width="166" height="96" rx="16" fill="${INK}"/>
      ${[172, 226, 280].map((x) => `
        <rect x="${x}" y="188" width="46" height="76" rx="9" fill="#FFFFFF"/>
        <path d="M${x + 9} 202 H ${x + 37} L ${x + 22} 252 H ${x + 11} L ${x + 24} 214 H ${x + 9} Z" fill="#FFC61A" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      `).join('')}
      <rect x="182" y="300" width="126" height="22" rx="11" fill="${INK}"/>
      <rect x="346" y="230" width="20" height="36" rx="7" fill="${INK}"/>
      <rect x="360" y="170" width="12" height="80" rx="6" fill="${INK}"/>
      <circle cx="366" cy="160" r="20" fill="#FFC61A" stroke="${INK}" stroke-width="9"/>
    `,
  },
  // Float on the water, line from the top, a fish swimming under.
  peche: {
    bg: '#1FA3D6',
    shade: '#1482B0',
    art: `
      <rect x="0" y="262" width="512" height="250" fill="#0E6FA8"/>
      <path d="M0 262 Q 32 246 64 262 T 128 262 T 192 262 T 256 262 T 320 262 T 384 262 T 448 262 T 512 262" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="10"/>
      <line x1="150" y1="96" x2="300" y2="236" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="300" cy="256" r="34" fill="#FFFFFF" stroke="${INK}" stroke-width="12"/>
      <path d="M266 256 A34 34 0 0 1 334 256 Z" fill="#FF4F8B" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
      <path d="M148 350 q 48 -44 108 0 q -60 44 -108 0 z M256 350 l 38 -28 v 56 z" fill="#FFC61A" stroke="${INK}" stroke-width="11" stroke-linejoin="round"/>
      <circle cx="180" cy="344" r="7" fill="${INK}"/>
    `,
  },
  // Multiplayer: two players side by side, the one in front bigger.
  multi: {
    bg: '#33D17A',
    shade: '#1E9A55',
    art: `
      <circle cx="318" cy="186" r="52" fill="#5B8CFF" stroke="${INK}" stroke-width="12"/>
      <path d="M232 372 Q 232 270 318 270 Q 404 270 404 372 Z" fill="#5B8CFF" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
      <circle cx="206" cy="212" r="62" fill="#FFC61A" stroke="${INK}" stroke-width="12"/>
      <path d="M102 392 Q 102 290 206 290 Q 310 290 310 392 Z" fill="#FFC61A" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
      <circle cx="186" cy="206" r="8" fill="${INK}"/>
      <circle cx="226" cy="206" r="8" fill="${INK}"/>
    `,
  },
};

export async function GET(req: Request, context: { params: Promise<{ game: string }> }) {
  const params = await context.params;
  const game = GAMES[params.game];
  if (!game) return new Response('Not found', { status: 404 });

  const requested = Number(new URL(req.url).searchParams.get('size'));
  const size = [180, 192, 512].includes(requested) ? requested : 512;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" fill="${game.bg}"/>
    <path d="M-40 512 L 170 -20 L 240 -20 L 30 512 Z" fill="#FFFFFF" fill-opacity="0.1"/>
    ${game.art}
    <rect x="0" y="470" width="512" height="42" fill="${game.shade}" fill-opacity="0.6"/>
  </svg>`;

  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" width={size} height={size} src={`data:image/svg+xml;base64,${btoa(svg)}`} />
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    }
  );
}
