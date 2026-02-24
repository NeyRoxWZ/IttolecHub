import { NextRequest, NextResponse } from 'next/server';

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"',
    // Add more as needed
  };
  return text.replace(/&[#a-z0-9]+;/gi, (entity) => entities[entity] || entity);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get('difficulty') || 'easy';
    const category = searchParams.get('category') || '9'; // Default to General Knowledge

    const url = `https://opentdb.com/api.php?amount=1&category=${category}&difficulty=${difficulty}&type=multiple`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.response_code !== 0 || data.results.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de récupérer une question de trivia.' },
        { status: 500 }
      );
    }

    const trivia = data.results[0];
    const question = decodeHtmlEntities(trivia.question);
    const correctAnswer = decodeHtmlEntities(trivia.correct_answer);
    const incorrectAnswers = trivia.incorrect_answers.map(decodeHtmlEntities);

    const answers = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5);

    return NextResponse.json({
      question,
      answers,
      correctAnswer,
    });
  } catch (error) {
    console.error('Erreur API TrollTrivia:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}