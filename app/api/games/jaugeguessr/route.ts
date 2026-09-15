import { NextResponse } from 'next/server';
import { readPublicJson } from '@/lib/staticData.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);

    const data = await readPublicJson<any[]>('/jaugeguessr.json', request);

    // Shuffle and pick
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return NextResponse.json(selected);
  } catch (error) {
    console.error('Error reading jaugeguessr.json:', error);
    return NextResponse.json([{ left: "Pire", right: "Meilleur" }], { status: 500 });
  }
}
