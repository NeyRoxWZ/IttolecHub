import { NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';
import { shuffle } from '@/lib/party/text';

export const dynamic = 'force-dynamic';

/** The party games whose cards (questions, words, challenges) live in public/data/<game>.json. */
const DECKS = new Set(['horssujet', 'untraitdetrop', 'punchline', 'quiaditca', 'surenchere', 'ledico']);

type Deck = { categories: { id: string; label: string; items: (string | Record<string, unknown>)[] }[] };

/**
 * Draws `count` different cards from the chosen categories of a game.
 * GET /api/games/deck?game=punchline&categories=soiree,absurde&count=10
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game') || '';
    if (!DECKS.has(game)) return NextResponse.json({ error: 'Jeu inconnu' }, { status: 400 });
    const count = Math.min(200, Math.max(1, parseInt(searchParams.get('count') || '10', 10) || 10));
    const wanted = (searchParams.get('categories') || '').split(',').filter(Boolean);

    const deck = await readPublicJson<Deck>(`/data/${game}.json`, request);
    const chosen = deck.categories.filter((c) => wanted.includes(c.id));
    const pool = (chosen.length ? chosen : deck.categories).flatMap((c) =>
      c.items.map((item) => ({ cat: c.id, catLabel: c.label, ...(typeof item === 'string' ? { text: item } : item) })),
    );

    return NextResponse.json({ items: shuffle(pool).slice(0, count) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Deck API error:', error);
    return NextResponse.json({ error: 'Cartes indisponibles' }, { status: 500 });
  }
}
