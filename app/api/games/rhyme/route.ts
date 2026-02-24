import { NextRequest, NextResponse } from 'next/server';

const PROMPTS = [
  "Je préfère aller dans mon lit",
  "Le code est plein de bugs",
  "Ce soir, je mange une pizza",
  "Le chat est sur le toit",
  "Demain, j'arrête le café",
  "Le soleil brille fort",
  "La vie est une aventure",
];

function getLastWord(sentence: string): string {
  return sentence.split(' ').pop() || '';
}

export async function GET(request: NextRequest) {
  try {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const rhymeWith = getLastWord(prompt);

    return NextResponse.json({
      prompt,
      rhymeWith,
    });
    
  } catch (error) {
    console.error('Erreur API RhymeGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}