import { NextResponse } from 'next/server';

// The clock every timer syncs to: never prerendered, never cached. A static
// build froze it at deploy time and pushed every countdown hours off.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { time: Date.now() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
