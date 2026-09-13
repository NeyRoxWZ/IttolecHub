import { ImageResponse } from 'next/og';

export const runtime = 'edge';

/**
 * Home-screen icons for the per-game apps. Drawn on request instead of kept
 * as image files, so a new game only needs an entry here.
 *
 * The artwork stays inside the central 60%: Android crops maskable icons to a
 * circle or a squircle, and nothing important may sit in the corners.
 */
const GAMES: Record<string, { word: string; accent: string; glyph: string }> = {
  casino: { word: 'CASINO', accent: '#FFD000', glyph: '777' },
  peche: { word: 'PÊCHE', accent: '#3CC3D6', glyph: '><>' },
};

export function GET(req: Request, { params }: { params: { game: string } }) {
  const game = GAMES[params.game];
  if (!game) return new Response('Not found', { status: 404 });

  const requested = Number(new URL(req.url).searchParams.get('size'));
  const size = [180, 192, 512].includes(requested) ? requested : 512;
  const u = size / 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#13131A',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 250 * u,
            height: 170 * u,
            borderRadius: 34 * u,
            border: `${12 * u}px solid ${game.accent}`,
            boxShadow: `${12 * u}px ${12 * u}px 0 #000`,
            background: '#1E1E28',
            color: game.accent,
            fontSize: 96 * u,
            fontWeight: 900,
            letterSpacing: -4 * u,
          }}
        >
          {game.glyph}
        </div>
        <div
          style={{
            marginTop: 26 * u,
            color: '#FFFFFF',
            fontSize: 44 * u,
            fontWeight: 900,
            letterSpacing: 6 * u,
          }}
        >
          {game.word}
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
    }
  );
}
