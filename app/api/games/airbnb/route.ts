import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'airbnb_listings.json');
    
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const listings = JSON.parse(fileContent);
    
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    const excludeIds = searchParams.get('exclude')?.split(',') || [];
    
    // Filter out excluded IDs
    const available = listings.filter((p: any) => !excludeIds.includes(p.id));
    
    // If we run out of listings, just recycle (or return all)
    const pool = available.length > 0 ? available : listings;
    
    // Shuffle
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    return NextResponse.json(selected);
  } catch (error) {
    console.error('AirbnbGuessr API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}