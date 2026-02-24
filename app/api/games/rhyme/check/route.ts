import { NextRequest, NextResponse } from 'next/server';

function getLastWord(sentence: string): string {
  return sentence.split(' ').pop()?.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"") || '';
}

export async function POST(request: NextRequest) {
  try {
    const { sentence, rhymeWith } = await request.json();
    
    if (!sentence || !rhymeWith) {
      return NextResponse.json(
        { error: 'Les paramètres "sentence" et "rhymeWith" sont requis' },
        { status: 400 }
      );
    }

    const lastWord = getLastWord(sentence);
    if (!lastWord) {
      return NextResponse.json({ isRhyme: false });
    }

    const url = `https://api.datamuse.com/words?rel_rhy=${rhymeWith}`;
    const response = await fetch(url);
    const rhymes: { word: string, score: number }[] = await response.json();
    
    const isRhyme = rhymes.some(rhyme => rhyme.word === lastWord);

    return NextResponse.json({ isRhyme });
    
  } catch (error) {
    console.error('Erreur API Datamuse:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de la rime' },
      { status: 500 }
    );
  }
}