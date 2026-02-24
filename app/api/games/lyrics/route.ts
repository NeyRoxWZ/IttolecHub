import { NextRequest, NextResponse } from 'next/server';

// Liste d'artistes populaires pour lesquels l'API fonctionne bien
const ARTIST_SONG_MAP: { [artist: string]: string[] } = {
    "daft punk": ["One More Time", "Harder, Better, Faster, Stronger", "Around the World", "Get Lucky"],
    "queen": ["Bohemian Rhapsody", "Don't Stop Me Now", "Another One Bites the Dust", "We Will Rock You"],
    "michael jackson": ["Billie Jean", "Thriller", "Beat It", "Smooth Criminal"],
    "jul": ["Tchikita", "J'oublie tout", "On m'appelle l'ovni"],
    "ninho": ["Mamacita", "La vie qu'on mène", "Goutte d'eau"],
    "stromae": ["Alors on danse", "Papaoutai", "Formidable", "Tous les mêmes"],
    "nekfeu": ["On verra", "Egérie", "Ma dope"],
};

async function getLyrics(artist: string, title: string) {
    try {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data.lyrics;
    } catch (error) {
        return null;
    }
}

function getRandomLine(lyrics: string): string {
    const lines = lyrics.split('\n').filter(line => line.trim() !== '' && line.length > 15);
    if (lines.length === 0) return '';
    return lines[Math.floor(Math.random() * lines.length)];
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const artistParam = searchParams.get('artist')?.toLowerCase();

    if (!artistParam) {
        return NextResponse.json({ error: "Le paramètre 'artist' est requis" }, { status: 400 });
    }

    const artistSongs = ARTIST_SONG_MAP[artistParam];
    if (!artistSongs) {
        return NextResponse.json({ error: "Artiste non trouvé ou non supporté. Essayez un artiste plus connu." }, { status: 404 });
    }

    try {
        let attempts = 0;
        while (attempts < 5) {
            const title = artistSongs[Math.floor(Math.random() * artistSongs.length)];
            const lyrics = await getLyrics(artistParam, title);

            if (lyrics) {
                const line = getRandomLine(lyrics);
                if (line) {
                    return NextResponse.json({
                        line,
                        artist: artistParam.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        title,
                    });
                }
            }
            attempts++;
        }
        
        return NextResponse.json({ error: "Impossible de trouver des paroles pour cet artiste." }, { status: 500 });

    } catch (error) {
        console.error('Erreur API LyricsGuessr:', error);
        return NextResponse.json({ error: 'Erreur lors de la génération du jeu' }, { status: 500 });
    }
}