import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const BRANDFETCH_CLIENT_ID = '1idE9skP3OyDrucd4OC';

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'brands.json');
    
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const brands = JSON.parse(fileContent);
    
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    const excludeDomains = searchParams.get('exclude')?.split(',') || [];
    
    // Filter out excluded domains
    const available = brands.filter((b: any) => !excludeDomains.includes(b.domain));
    
    // If we run out of brands, just recycle
    const pool = available.length > 0 ? available : brands;
    
    // Shuffle with Fisher-Yates
    const shuffled = fisherYatesShuffle(pool);
    const selected = shuffled.slice(0, count);
    
    // Transform to logo format with Brandfetch URL
    const logos = selected.map((brand: any) => ({
      name: brand.name,
      domain: brand.domain,
      logoUrl: `https://cdn.brandfetch.io/${brand.domain}/w/400/h/400?c=${BRANDFETCH_CLIENT_ID}`
    }));
    
    return NextResponse.json(logos);
  } catch (error) {
    console.error('LogoGuessr API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}