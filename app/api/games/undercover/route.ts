import { NextRequest, NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

type UndercoverPair = {
  civilWord: string;
  undercoverWord: string;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const countParam = url.searchParams.get('count');
    const count = countParam ? parseInt(countParam, 10) : 1;

    const pairs = await readPublicJson<UndercoverPair[]>('/data/undercover.json', request);
    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json(
        { error: 'Aucune paire de mots disponible pour Undercover.' },
        { status: 500 },
      );
    }

    const shuffled = [...pairs].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.max(1, count));

    if (count === 1) {
      return NextResponse.json({
        civilWord: selected[0].civilWord,
        undercoverWord: selected[0].undercoverWord,
      });
    }

    return NextResponse.json(selected.map((p) => ({
      civilWord: p.civilWord,
      undercoverWord: p.undercoverWord,
    })));
  } catch (error) {
    console.error('Erreur API Undercover:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sélection de la paire de mots.' },
      { status: 500 },
    );
  }
}
