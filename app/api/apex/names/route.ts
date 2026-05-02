import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let cached: Record<string, string[]> | null = null;

export const dynamic = 'force-dynamic';

export async function GET() {
  if (cached) {
    return NextResponse.json(cached);
  }

  const filePath = path.join(process.cwd(), 'apex_data.json');
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const normalized: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      normalized[k] = v as string[];
    }
  }

  cached = normalized;
  return NextResponse.json(normalized);
}

