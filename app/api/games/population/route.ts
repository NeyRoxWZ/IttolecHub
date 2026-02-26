import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,population,flags,region,translations');
    if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch countries' }, { status: res.status });
    }
    const data = await res.json();
    // Filter out small territories (< 100k) to avoid obscure places with tiny populations
    const filtered = data.filter((c: any) => c.population > 100000);
    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error in population API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
