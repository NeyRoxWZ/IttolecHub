import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'all';
    
    const url = region === 'all' 
      ? 'https://restcountries.com/v3.1/all?fields=name,flags,region,translations'
      : `https://restcountries.com/v3.1/region/${region}?fields=name,flags,region,translations`;
    
    const res = await fetch(url);
    if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch countries' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in flag API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
