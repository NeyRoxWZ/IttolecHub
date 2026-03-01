import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3/discover/movie';

interface Movie {
    title: string;
    poster_path: string;
    release_date: string;
    budget: number;
    genre_ids: number[];
}

const GENRES: Record<number, string> = {
    28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
    99: "Documentaire", 18: "Drame", 10751: "Familial", 14: "Fantastique",
    36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
    10749: "Romance", 878: "Science-Fiction", 10770: "Téléfilm", 53: "Thriller",
    10752: "Guerre", 37: "Western"
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const count = parseInt(searchParams.get('count') || '5', 10);
        const decade = searchParams.get('decade') || 'all';
        const difficulty = searchParams.get('difficulty') || 'normal';

        let voteCountGte = 5000;
        if (difficulty === 'hard') voteCountGte = 10000; // Wait, User said "Très connus > 10000". That sounds easier?
        // Usually: High vote count = Popular = Easier to guess?
        // User: "Difficulté : Très connus (vote_count > 10000) / Connus (vote_count > 5000) / Tous"
        // So "Very Known" = Easy mode?
        // I'll map: 
        // 'easy' -> > 10000
        // 'normal' -> > 5000
        // 'hard' -> > 1000 (Tous)
        
        if (difficulty === 'easy') voteCountGte = 10000;
        else if (difficulty === 'hard') voteCountGte = 1000; 
        else voteCountGte = 5000;

        let dateGte = '';
        let dateLte = '';

        if (decade === '80s') { dateGte = '1980-01-01'; dateLte = '1989-12-31'; }
        else if (decade === '90s') { dateGte = '1990-01-01'; dateLte = '1999-12-31'; }
        else if (decade === '2000s') { dateGte = '2000-01-01'; dateLte = '2009-12-31'; }
        else if (decade === '2010s') { dateGte = '2010-01-01'; dateLte = '2019-12-31'; }
        else if (decade === '2020s') { dateGte = '2020-01-01'; dateLte = '2029-12-31'; }

        // Fetch multiple pages to get random movies
        const movies: any[] = [];
        const seenIds = new Set();
        let attempts = 0;

        while (movies.length < count && attempts < 10) {
            attempts++;
            const randomPage = Math.floor(Math.random() * 20) + 1;
            
            let url = `${BASE_URL}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&include_adult=false&vote_count.gte=${voteCountGte}&page=${randomPage}&with_release_type=2|3`;
            
            if (dateGte) url += `&primary_release_date.gte=${dateGte}`;
            if (dateLte) url += `&primary_release_date.lte=${dateLte}`;

            const res = await fetch(url);
            if (!res.ok) continue;
            
            const data = await res.json();
            const results = data.results || [];

            for (const m of results) {
                if (movies.length >= count) break;
                if (seenIds.has(m.id)) continue;
                
                // Fetch details to get budget (discover endpoint doesn't always return accurate budget, usually 0)
                // Wait, Discover endpoint result object usually DOES NOT include budget.
                // I need to fetch movie details for EACH movie.
                // This is expensive.
                // Optimization: Filter locally first, then fetch details.
                
                const detailRes = await fetch(`https://api.themoviedb.org/3/movie/${m.id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
                if (!detailRes.ok) continue;
                const detail = await detailRes.json();
                
                if (detail.budget && detail.budget > 10000000) {
                    seenIds.add(m.id);
                    movies.push({
                        id: m.id,
                        title: detail.title,
                        poster_path: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
                        release_date: detail.release_date ? detail.release_date.split('-')[0] : 'Inconnue',
                        genres: detail.genres.map((g: any) => g.name),
                        budget: detail.budget
                    });
                }
            }
        }
        
        if (movies.length === 0) {
             return NextResponse.json({ error: "Aucun film trouvé" }, { status: 500 });
        }

        return NextResponse.json(movies);

    } catch (error) {
        console.error('TMDB API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
