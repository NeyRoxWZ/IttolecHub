import { NextRequest, NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const properties = await readPublicJson<any[]>('/data/rentguessr.json', request);

    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    const excludeIds = searchParams.get('exclude')?.split(',') || [];

    // Filter out excluded IDs
    const available = properties.filter((p: any) => !excludeIds.includes(p.id));

    // If we run out of properties, just recycle (or return all)
    const pool = available.length > 0 ? available : properties;

    // Shuffle
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return NextResponse.json(selected);
  } catch (error) {
    console.error('RentGuessr API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
