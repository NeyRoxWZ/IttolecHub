import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface WikiArticle {
    title: string;
    extract: string;
    image?: string;
}

async function fetchRandomArticle(): Promise<WikiArticle | null> {
    try {
        const res = await fetch('https://fr.wikipedia.org/api/rest_v1/page/random/summary');
        if (!res.ok) return null;
        const data = await res.json();
        
        if (!data.extract || data.extract.length < 200) return null;
        
        return {
            title: data.title,
            extract: data.extract,
            image: data.thumbnail?.source
        };
    } catch (e) {
        console.error('Wiki fetch error:', e);
        return null;
    }
}

function obfuscateText(text: string, title: string): string {
    let obfuscated = text;
    
    // 1. Obfuscate Title words (case insensitive)
    const titleWords = title.split(/\s+/).filter(w => w.length > 2);
    titleWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        obfuscated = obfuscated.replace(regex, '_____');
    });

    // 2. Obfuscate Capitalized words (Proper nouns heuristic)
    // We look for words starting with Uppercase, not following a sentence end (. ! ?)
    // But regex lookbehind is not always supported or complex.
    // Simple approach: Replace ALL capitalized words that are not at the very start of the string?
    // User said: "regex sur majuscules".
    // Let's match [A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+
    
    obfuscated = obfuscated.replace(/\b[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+\b/g, (match, offset) => {
        // Keep it if it's the start of the sentence? 
        // Heuristic: Check if previous char is "." or "!" or "?" or start of string.
        // This is imperfect but better than nothing.
        // Actually, user wants to hide "Proper Nouns".
        // Often proper nouns ARE capitalized.
        // If we hide "Le" or "Il", it's annoying.
        // Let's hide words that match the regex AND are not in a whitelist of common starters?
        // Or just hide everything.
        // Let's hide everything for now as per "regex sur majuscules" instruction.
        return '_____';
    });
    
    return obfuscated;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const count = parseInt(searchParams.get('count') || '1', 10);
        // category is ignored as API doesn't support it easily
        
        const articles: any[] = [];
        let attempts = 0;
        
        while (articles.length < count && attempts < 20) {
            attempts++;
            const article = await fetchRandomArticle();
            if (article) {
                // Check uniqueness
                if (articles.find(a => a.title === article.title)) continue;
                
                const obfuscated = obfuscateText(article.extract, article.title);
                
                articles.push({
                    title: article.title,
                    extract_original: article.extract,
                    extract_obfuscated: obfuscated,
                    image_url: article.image
                });
            }
        }
        
        if (articles.length === 0) {
            return NextResponse.json({ error: "Impossible de récupérer des articles" }, { status: 500 });
        }

        return NextResponse.json(articles);

    } catch (error) {
        console.error('Wiki API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
