import { NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

interface Country { code: string; name: string; region: string; independent: boolean }

/**
 * Flags for FlagGuessr. The countries used to be fetched live from
 * restcountries.com on every game, which refuses requests coming from the
 * Cloudflare worker (500 since the move) — they now come from a list shipped
 * with the site (public/data/countries.json), and the flag images from flagcdn.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = (searchParams.get('region') || 'all').toLowerCase();
    const count = parseInt(searchParams.get('count') || '10', 10);

    const countries = await readPublicJson<Country[]>('/data/countries.json', request);
    // Recognised countries only: tiny territories made rounds unguessable.
    const pool = countries.filter((c) => c.independent && (region === 'all' || c.region === region));

    if (pool.length === 0) {
      return NextResponse.json({ error: 'No countries found' }, { status: 404 });
    }

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, count).map((c) => ({
      name: c.name,
      code: c.code.toUpperCase(),
      flagUrl: `https://flagcdn.com/w640/${c.code}.png`,
      // Answers are typed, never picked from a list.
      options: [] as string[],
    }));

    return NextResponse.json(questions);
  } catch (error) {
    console.error('Flag API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
