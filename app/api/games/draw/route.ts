import { NextRequest, NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '10', 10);
    const difficulty = searchParams.get('difficulty') || 'mix';

    const words = await readPublicJson<{ difficulty?: string }[]>('/data/drawguessr.json', request);
    const filtered = difficulty === 'mix' ? words : words.filter((w) => w.difficulty === difficulty);

    // Shuffle a copy: the cached list is shared between requests.
    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    return NextResponse.json(shuffled.slice(0, count));
  } catch (error) {
    console.error('Draw API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
