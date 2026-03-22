import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const difficulty = searchParams.get('difficulty') || 'easy';
        const count = parseInt(searchParams.get('count') || '1', 10);

        const filePath = path.join(process.cwd(), 'public', 'wikiracing.json');
        const fileData = await fs.readFile(filePath, 'utf8');
        const allPairs = JSON.parse(fileData);

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