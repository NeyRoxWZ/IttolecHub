import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name'); // Optional: search by name
    
    let pokemonId = id;

    if (!pokemonId && !name) {
         // Random if no ID provided (legacy support or simple usage)
         // Gen 1-9 (up to 1025)
         pokemonId = (Math.floor(Math.random() * 1025) + 1).toString();
    }
    
    // Fetch species data (for names and generation)
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId || name}`);
    if (!speciesResponse.ok) {
        // Fallback for some variants or errors
        console.error(`Pokemon species not found: ${pokemonId || name}`);
        return NextResponse.json({ error: 'Pokemon species not found' }, { status: 404 });
    }
    const speciesData = await speciesResponse.json();
    
    const realId = speciesData.id; // In case we searched by name

    // Build names map
    const names: { [lang: string]: string } = {};
    if (speciesData.names) {
        speciesData.names.forEach((nameData: any) => {
            names[nameData.language.name] = nameData.name;
        });
    }
    
    // Add internal name as fallback
    names['en'] = names['en'] || speciesData.name;
    names['fr'] = names['fr'] || names['en']; // Ensure FR exists
    
    // Use official artwork directly (more reliable than fetching pokemon endpoint just for sprites)
    const imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${realId}.png`;

    return NextResponse.json({
      id: realId,
      names,
      imageUrl,
      generation: speciesData.generation?.name || 'unknown',
    });
    
  } catch (error) {
    console.error('Error API Pokémon:', error);
    return NextResponse.json(
      { error: 'Error fetching Pokemon data' },
      { status: 500 }
    );
  }
}
