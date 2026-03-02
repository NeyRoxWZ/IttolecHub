import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'logo_brands.json');
    
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const logos = JSON.parse(fileContent);
    
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    const excludeSlugs = searchParams.get('exclude')?.split(',') || [];
    const category = searchParams.get('category') || 'all';
    const difficulty = searchParams.get('difficulty') || 'mix';
    
    // Filter by category
    let filtered = logos;
    if (category !== 'all') {
        filtered = filtered.filter((l: any) => l.sector === category);
    }
    
    // Filter by difficulty
    if (difficulty !== 'mix') {
        filtered = filtered.filter((l: any) => l.difficulty === difficulty);
    }
    
    // Filter out excluded IDs (slugs)
    const available = filtered.filter((l: any) => !excludeSlugs.includes(l.slug));
    
    // If we run out of logos, just recycle (or return all filtered)
    const pool = available.length > 0 ? available : filtered;
    
    // Shuffle
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    return NextResponse.json(selected);
  } catch (error) {
    console.error('LogoGuessr API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}