import { NextRequest, NextResponse } from 'next/server';

// Helper to normalize strings for comparison/API calls
function normalize(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function getSongsFromITunes(artist: string) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&limit=50`);
        if (!response.ok) return [];
        const data = await response.json();
        // Filter to ensure artist matches somewhat (iTunes search is fuzzy)
        return data.results.filter((s: any) => normalize(s.artistName).includes(normalize(artist)) || normalize(artist).includes(normalize(s.artistName)));
    } catch (e) {
        console.error('iTunes API error', e);
        return [];
    }
}

async function getLyrics(artist: string, title: string) {
    try {
        // Try exact match first
        let url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        let response = await fetch(url);
        if (response.ok) {
             const data = await response.json();
             return data.lyrics;
        }

        // Try cleaning title (remove "feat.", "(Remix)", etc.)
        const cleanTitle = title.replace(/\(.*\)/g, '').replace(/feat\..*/i, '').trim();
        if (cleanTitle !== title) {
            url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
            response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.lyrics;
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

function getRandomSection(lyrics: string): string {
    // Split by double newlines to get stanzas
    const stanzas = lyrics.split(/\n\n+/);
    // Filter stanzas that are long enough but not too long
    const validStanzas = stanzas.filter(s => {
        const lines = s.split('\n').length;
        return lines >= 2 && lines <= 6;
    });
    
    if (validStanzas.length > 0) {
        return validStanzas[Math.floor(Math.random() * validStanzas.length)];
    }
    
    // Fallback: just take 4 lines from middle
    const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 4) return lyrics;
    const start = Math.floor(Math.random() * (lines.length - 4));
    return lines.slice(start, start + 4).join('\n');
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const artistParam = searchParams.get('artist');
    const countParam = parseInt(searchParams.get('count') || '1', 10);

    if (!artistParam) {
        return NextResponse.json({ error: "Le paramètre 'artist' est requis" }, { status: 400 });
    }

    try {
        const songs = await getSongsFromITunes(artistParam);
        
        if (songs.length === 0) {
             return NextResponse.json({ error: "Artiste non trouvé sur iTunes." }, { status: 404 });
        }

        // Shuffle songs
        for (let i = songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songs[i], songs[j]] = [songs[j], songs[i]];
        }

        const results = [];
        const usedTitles = new Set();

        for (const song of songs) {
            if (results.length >= countParam) break;
            if (usedTitles.has(song.trackName.toLowerCase())) continue;

            const lyrics = await getLyrics(song.artistName, song.trackName);
            if (lyrics) {
                const extract = getRandomSection(lyrics);
                if (extract) {
                    usedTitles.add(song.trackName.toLowerCase());
                    results.push({
                        extract,
                        artist: song.artistName,
                        title: song.trackName,
                        cover: song.artworkUrl100?.replace('100x100', '600x600')
                    });
                }
            }
        }
        
        if (results.length === 0) {
            return NextResponse.json({ error: "Impossible de trouver des paroles pour cet artiste." }, { status: 404 });
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error('Erreur API LyricsGuessr:', error);
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
}
