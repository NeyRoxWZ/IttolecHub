import { NextRequest, NextResponse } from 'next/server';
import undercoverPairs from '@/undercover.json';

type UndercoverPair = {
  civilWord: string;
  undercoverWord: string;
};

const pairs = undercoverPairs as UndercoverPair[];

export async function GET(request: NextRequest) {
  try {
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json(
        { error: 'Aucune paire de mots disponible pour Undercover.' },
        { status: 500 },
      );
    }

    const index = Math.floor(Math.random() * pairs.length);
    const selected = pairs[index];

    return NextResponse.json({
      civilWord: selected.civilWord,
      undercoverWord: selected.undercoverWord,
    });
  } catch (error) {
    console.error('Erreur API Undercover:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sélection de la paire de mots.' },
      { status: 500 },
    );
  }
}

