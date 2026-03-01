import { NextResponse } from 'next/server';

const REGION_MAP: Record<string, string> = {
  'europe': 'region/europe',
  'asia': 'region/asia',
  'africa': 'region/africa',
  'americas': 'region/americas',
  'oceania': 'region/oceania',
  'all': 'all'
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'all';
    const count = parseInt(searchParams.get('count') || '10');
    const mode = searchParams.get('mode') || 'mcq';

    const endpoint = REGION_MAP[region.toLowerCase()] || 'all';
    const response = await fetch(`https://restcountries.com/v3.1/${endpoint}?fields=name,cca2,translations,flags`);
    
    if (!response.ok) {
        throw new Error('Failed to fetch flags');
    }

    const allCountries = await response.json();
    
    if (!allCountries || allCountries.length === 0) {
        return NextResponse.json({ error: 'No countries found' }, { status: 404 });
    }

    // Shuffle and pick
    const shuffled = allCountries.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    // Format for game
    const questions = selected.map((country: any) => {
        const correctName = country.translations.fra?.common || country.name.common;
        const code = country.cca2;
        const flagUrl = country.flags.svg || country.flags.png;

        let options: string[] = [];
        
        if (mode === 'mcq') {
            // Pick 3 distractors from the rest (or even from selected)
            const distractors = allCountries
                .filter((c: any) => c.cca2 !== code)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map((c: any) => c.translations.fra?.common || c.name.common);
            
            options = [...distractors, correctName].sort(() => 0.5 - Math.random());
        }

        return {
            name: correctName,
            code: code,
            flagUrl: flagUrl,
            options: options
        };
    });

    return NextResponse.json(questions);

  } catch (error) {
    console.error('Flag API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
