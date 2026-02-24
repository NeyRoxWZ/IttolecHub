import { NextRequest, NextResponse } from 'next/server';

let countriesCache: any[] = [];

async function getCountries() {
  if (countriesCache.length > 0) {
    return countriesCache;
  }
  try {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,population,translations');
    const data = await response.json();
    countriesCache = data.filter((c: any) => c.name && c.flags?.png && c.population && c.translations);
    return countriesCache;
  } catch (error) {
    console.error('Erreur API RestCountries:', error);
    return [];
  }
}

function formatCountryName(country: any) {
    const names: { [key: string]: string } = {
        en: country.name.common,
        fr: country.translations.fra.common,
    };
    Object.keys(country.translations).forEach(lang => {
        names[lang] = country.translations[lang].common;
    });
    return names;
}

export async function GET(request: NextRequest) {
  try {
    const countries = await getCountries();
    if (countries.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les données des pays' },
        { status: 500 }
      );
    }
    
    const country = countries[Math.floor(Math.random() * countries.length)];

    return NextResponse.json({
      name: formatCountryName(country),
      flagUrl: country.flags.png,
      population: country.population,
    });
    
  } catch (error) {
    console.error('Erreur API FlagGuessr:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du jeu' },
      { status: 500 }
    );
  }
}