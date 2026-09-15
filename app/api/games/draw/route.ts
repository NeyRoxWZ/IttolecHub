import { NextRequest, NextResponse } from 'next/server';
// Bundled with the route: a Cloudflare Worker has no filesystem to read it from (the old fs read failed with 500).
import allWords from '@/mots_a_dessiner.json';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const count = parseInt(searchParams.get('count') || '10', 10);
        const difficulty = searchParams.get('difficulty') || 'mix';

        const words = allWords as { difficulty?: string }[];

        // Filter
        let filtered = words;
        if (difficulty !== 'mix') {
            filtered = words.filter((w) => w.difficulty === difficulty);
        }

        // Shuffle (a copy: the bundled list is shared between requests)
        const shuffled = [...filtered].sort(() => 0.5 - Math.random());

        // Take count
        const selected = shuffled.slice(0, count);

        return NextResponse.json(selected);

    } catch (error) {
        console.error('Draw API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
