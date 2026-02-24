import { NextRequest, NextResponse } from 'next/server';

const PROMPT_STARTERS = [
  'Pourquoi les français',
  'Comment cacher',
  'Est-ce que les chats',
  'Mon patron est',
  'Je suis allergique à',
  'Le sens de la vie est',
  'Comment devenir',
  'Pourquoi mon chien',
  'Les aliens existent-ils',
  'Le meilleur moyen de',
];

async function getSuggestions(query: string, lang: string = 'fr'): Promise<string[]> {
  try {
    const url = `http://suggestqueries.google.com/complete/search?client=chrome&hl=${lang}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // On ne garde que les 5 premières suggestions et on filtre les URLs
    return data[1]
      .slice(0, 5)
      .filter((s: string) => !s.startsWith('http'));
      
  } catch (error) {
    console.error('Erreur API Google Suggest:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'fr';
    
    // Choisir un début de phrase aléatoire
    const prompt = PROMPT_STARTERS[Math.floor(Math.random() * PROMPT_STARTERS.length)];
    
    // Récupérer les suggestions
    const suggestionsText = await getSuggestions(prompt, lang);
    
    if (suggestionsText.length < 3) {
      return NextResponse.json(
        { error: 'Pas assez de suggestions trouvées' },
        { status: 500 }
      );
    }
    
    const suggestions = suggestionsText.map(text => ({
      text: text.replace(prompt, '').trim(), // On garde que la fin de la suggestion
      found: false,
    }));

    return NextResponse.json({
      prompt: `${prompt}...`,
      suggestions,
    });
    
  } catch (error) {
    console.error('Erreur API ComplèteGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}