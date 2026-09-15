import { NextRequest, NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

type InfiltreWord = {
  word: string;
  category: string;
  difficulty: string;
};

export async function GET(request: NextRequest) {
  try {
    const words = await readPublicJson<InfiltreWord[]>('/data/infiltre.json', request);
    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Aucun mot disponible pour Infiltre.' }, { status: 500 });
    }

    const url = new URL(request.url);
    const categoryParam = url.searchParams.get('category');

    let availableWords = words;
    if (categoryParam && categoryParam !== 'all') {
      availableWords = words.filter((w) => w.category === categoryParam);
      if (availableWords.length === 0) availableWords = words; // Fallback
    }

    const selected = availableWords[Math.floor(Math.random() * availableWords.length)];

    return NextResponse.json({
      secretWord: selected.word,
      category: selected.category,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
