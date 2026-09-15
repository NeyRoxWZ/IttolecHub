import { NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';
import { cleanTitle, fold, shuffle } from '@/lib/party/text';

export const dynamic = 'force-dynamic';

/**
 * Songs for BlindTest, from Deezer's free public API (30-second previews).
 * - GET ?categories=rapfr,hits&count=10 : one popular song per artist drawn
 *   from the chosen playlists (public/data/blindtest.json lists the artists).
 * - GET ?track=123 : a fresh preview link for a song (the links expire after
 *   about fifteen minutes, so each round asks again).
 */

type Deck = { categories: { id: string; label: string; items: string[] }[] };
type DeezerTrack = { id: number; title: string; preview?: string; readable?: boolean; artist?: { name: string }; album?: { cover_medium?: string } };

const API = 'https://api.deezer.com';

async function deezer<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const json = await res.json();
  if (json?.error) throw new Error(json.error.message || 'Deezer error');
  return json as T;
}

const toSong = (t: DeezerTrack, catLabel?: string) => ({
  id: t.id,
  title: cleanTitle(t.title),
  artist: t.artist?.name || '',
  cover: t.album?.cover_medium || '',
  preview: t.preview || '',
  catLabel,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const noStore = { headers: { 'Cache-Control': 'no-store' } };

  try {
    const track = searchParams.get('track');
    if (track) {
      if (!/^\d+$/.test(track)) return NextResponse.json({ error: 'Morceau invalide' }, { status: 400 });
      const t = await deezer<DeezerTrack>(`/track/${track}`);
      return NextResponse.json({ song: toSong(t) }, noStore);
    }

    const count = Math.min(30, Math.max(1, parseInt(searchParams.get('count') || '10', 10) || 10));
    const wanted = (searchParams.get('categories') || '').split(',').filter(Boolean);
    const deck = await readPublicJson<Deck>('/data/blindtest.json', request);
    const chosen = deck.categories.filter((c) => wanted.includes(c.id));
    const artists = shuffle((chosen.length ? chosen : deck.categories).flatMap((c) => c.items.map((name) => ({ name, catLabel: c.label }))));

    const songs: ReturnType<typeof toSong>[] = [];
    const seen = new Set<string>();
    // A few artists at a time: Deezer allows about 50 calls every 5 seconds.
    for (let i = 0; i < artists.length && songs.length < count && i < count * 3; i += 6) {
      const batch = artists.slice(i, i + 6);
      const found = await Promise.all(batch.map(async ({ name, catLabel }) => {
        try {
          // The artist with this exact name and the most fans, then their most played songs.
          const { data: found } = await deezer<{ data: { id: number; name: string; nb_fan?: number }[] }>(`/search/artist?q=${encodeURIComponent(name)}&limit=10`);
          const artist = (found || []).filter((a) => fold(a.name) === fold(name)).sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0];
          if (!artist) return null;
          const { data: top } = await deezer<{ data: DeezerTrack[] }>(`/artist/${artist.id}/top?limit=15`);
          const pool = (top || []).filter((t) => t.preview && t.readable !== false).slice(0, 12);
          return pool.length ? toSong(pool[Math.floor(Math.random() * pool.length)], catLabel) : null;
        } catch {
          return null;
        }
      }));
      for (const s of found) {
        const key = fold(s ? `${s.artist}|${s.title}` : '');
        if (s && s.title && !seen.has(key) && songs.length < count) { seen.add(key); songs.push(s); }
      }
    }

    if (!songs.length) return NextResponse.json({ error: 'Aucune musique trouvée' }, { status: 502 });
    return NextResponse.json({ songs }, noStore);
  } catch (error) {
    console.error('BlindTest API error:', error);
    return NextResponse.json({ error: 'Musiques indisponibles' }, { status: 500 });
  }
}
