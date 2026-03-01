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
    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Aucun mot disponible pour Infiltre.' }, { status: 500 });
    }

    // Pick a random word
    const randomIndex = Math.floor(Math.random() * words.length);
    const selected = words[randomIndex];
    
    return NextResponse.json({
        secretWord: selected.word,
        category: selected.category
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
