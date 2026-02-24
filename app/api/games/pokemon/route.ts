import { NextRequest, NextResponse } from 'next/server';

// Génération aléatoire d'un ID de Pokémon selon la génération
function getRandomPokemonId(maxGen: number = 9): number {
  const genLimits = {
    1: { min: 1, max: 151 },
    2: { min: 152, max: 251 },
    3: { min: 252, max: 386 },
    4: { min: 387, max: 493 },
    5: { min: 494, max: 649 },
    6: { min: 650, max: 721 },
    7: { min: 722, max: 809 },
    8: { min: 810, max: 905 },
    9: { min: 906, max: 1025 },
  };

  const limit = genLimits[maxGen as keyof typeof genLimits] || genLimits[9];
  return Math.floor(Math.random() * (limit.max - limit.min + 1)) + limit.min;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generation = parseInt(searchParams.get('gen') || '9');
    
    const pokemonId = getRandomPokemonId(generation);
    
    // Récupérer les données du Pokémon
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`);
    const speciesData = await speciesResponse.json();
    
    // Récupérer l'image officielle
    const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
    const pokemonData = await pokemonResponse.json();
    
    // Construire la liste des noms dans toutes les langues
    const names: { [lang: string]: string } = {};
    speciesData.names.forEach((nameData: any) => {
      names[nameData.language.name] = nameData.name;
    });
    
    // Ajouter les noms alternatifs si disponibles
    if (pokemonData.species?.name) {
      names['species'] = pokemonData.species.name;
    }

    return NextResponse.json({
      id: pokemonId,
      names,
      imageUrl: pokemonData.sprites.other['official-artwork'].front_default,
      generation: speciesData.generation.name,
    });
    
  } catch (error) {
    console.error('Erreur API Pokémon:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données Pokémon' },
      { status: 500 }
    );
  }
}