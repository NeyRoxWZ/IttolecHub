import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const count = parseInt(searchParams.get('count') || '10', 10);
        const difficulty = searchParams.get('difficulty') || 'mix';

        // Read JSON file
        const filePath = path.join(process.cwd(), 'mots_a_dessiner.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const allWords = JSON.parse(fileContent);

        // Filter
        let filtered = allWords;
        if (difficulty !== 'mix') {
            filtered = allWords.filter((w: any) => w.difficulty === difficulty);
        }

        // Shuffle
        const shuffled = filtered.sort(() => 0.5 - Math.random());
        
        // Take count
        const selected = shuffled.slice(0, count);
        
        return NextResponse.json(selected);

    } catch (error) {
        console.error('Draw API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
