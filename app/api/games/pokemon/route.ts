import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name'); // Optional: search by name
    
    let pokemonId = id;

    if (!pokemonId && !name) {
         // Random if no ID provided (legacy support or simple usage)
         // But better to use client logic for complex generation selection
         pokemonId = (Math.floor(Math.random() * 1025) + 1).toString();
    }
    
    // Fetch species data
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId || name}`);
    if (!speciesResponse.ok) throw new Error('Pokemon species not found');
    const speciesData = await speciesResponse.json();
    
    const realId = speciesData.id; // In case we searched by name

    // Fetch pokemon data
    const pokemonResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${realId}`);
    if (!pokemonResponse.ok) throw new Error('Pokemon data not found');
    const pokemonData = await pokemonResponse.json();
    
    // Build names map
    const names: { [lang: string]: string } = {};
    speciesData.names.forEach((nameData: any) => {
      names[nameData.language.name] = nameData.name;
    });
    
    // Add internal name as fallback
    names['en'] = names['en'] || speciesData.name;

    return NextResponse.json({
      id: realId,
      names,
      imageUrl: pokemonData.sprites.other['official-artwork'].front_default,
      generation: speciesData.generation.name,
    });
    
  } catch (error) {
    console.error('Error API Pokémon:', error);
    return NextResponse.json(
      { error: 'Error fetching Pokemon data' },
      { status: 500 }
    );
  }
}
