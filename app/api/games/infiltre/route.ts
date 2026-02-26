import { NextRequest, NextResponse } from 'next/server';
import infiltreWords from '@/infiltre.json';

export const dynamic = 'force-dynamic';

type InfiltreWord = {
  word: string;
  category: string;
  difficulty: string;
};

const words = infiltreWords as InfiltreWord[];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam, 10) : 1;

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'Aucun mot disponible pour L’Infiltré.' },
        { status: 500 },
      );
    }

    // Shuffle and pick 'count' words
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(1, count));

    if (count === 1) {
       return NextResponse.json({
        word: selected[0].word,
        category: selected[0].category,
        difficulty: selected[0].difficulty,
      });
    }

    return NextResponse.json(selected.map(w => ({
      word: w.word,
      category: w.category,
      difficulty: w.difficulty,
    })));
  } catch (error) {
    console.error('Erreur API Infiltré:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sélection du mot.' },
      { status: 500 },
    );
  }
}

