import { NextRequest, NextResponse } from 'next/server';
import infiltreWords from '@/infiltre.json';

type InfiltreWord = {
  word: string;
  category: string;
  difficulty: string;
};

const words = infiltreWords as InfiltreWord[];

export async function GET(request: NextRequest) {
  try {
    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'Aucun mot disponible pour L’Infiltré.' },
        { status: 500 },
      );
    }

    const index = Math.floor(Math.random() * words.length);
    const selected = words[index];

    return NextResponse.json({
      word: selected.word,
      category: selected.category,
      difficulty: selected.difficulty,
    });
  } catch (error) {
    console.error('Erreur API Infiltré:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sélection du mot.' },
      { status: 500 },
    );
  }
}

