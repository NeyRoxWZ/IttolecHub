import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Helper to normalize strings for comparison/API calls
function normalize(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function getSongsFromITunes(artist: string) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&limit=100`);
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
        // Use lrclib.net as requested
        const query = `${artist} ${title}`;
        const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
        
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        // Find the best match
        // We prioritize syncedLyrics, then plainLyrics
        // We also want to make sure the artist/title match reasonably well to avoid covers/wrong songs
        const match = data.find((item: any) => {
            const itemArtist = normalize(item.artistName);
            const targetArtist = normalize(artist);
            return itemArtist.includes(targetArtist) || targetArtist.includes(itemArtist);
        });

        if (match) {
            return match.plainLyrics || match.syncedLyrics || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching from lrclib:', error);
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
        const artists = artistParam.split(',').map(a => a.trim()).filter(a => a.length > 0);
        let allSongs: any[] = [];

        // Fetch songs for each artist
        for (const artist of artists) {
            const songs = await getSongsFromITunes(artist);
            allSongs = allSongs.concat(songs);
        }
        
        if (allSongs.length === 0) {
             return NextResponse.json({ error: "Aucun artiste trouvé sur iTunes." }, { status: 404 });
        }

        // Shuffle songs
        for (let i = allSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
        }

        const results = [];
        const usedTitles = new Set();

        for (const song of allSongs) {
            if (results.length >= countParam) break;
            if (usedTitles.has(song.trackName.toLowerCase())) continue;

            const lyrics = await getLyrics(song.artistName, song.trackName);
            if (lyrics) {
                // Check if lyrics are not just "Instrumental"
                if (lyrics.length < 50 || lyrics.includes("Instrumental")) continue;

                const extract = getRandomSection(lyrics);
                if (extract) {
                    results.push({
                        artist: song.artistName,
                        title: song.trackName,
                        cover: song.artworkUrl100?.replace('100x100', '600x600'),
                        extract
                    });
                    usedTitles.add(song.trackName.toLowerCase());
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
