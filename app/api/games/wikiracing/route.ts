import { NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const difficulty = searchParams.get('difficulty') || 'easy';
        const count = parseInt(searchParams.get('count') || '1', 10);

        const allPairs = await readPublicJson<Record<string, [string, string][]>>('/data/wikiracing.json', request);

        const validDifficulty = (difficulty === 'easy' || difficulty === 'hard') ? difficulty : 'easy';
        const pool = allPairs[validDifficulty] || allPairs['easy'];

        // Shuffle and select
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(count, pool.length));

        const result = selected.map(([start, target]: [string, string]) => ({ start, target }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error reading wikiracing.json:', error);
        return NextResponse.json({ error: 'Failed to load words' }, { status: 500 });
    }
}
