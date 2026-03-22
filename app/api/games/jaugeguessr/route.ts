import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '1', 10);
    
    const filePath = path.join(process.cwd(), 'public', 'jaugeguessr.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Shuffle and pick
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return NextResponse.json(selected);
  } catch (error) {
    console.error('Error reading jaugeguessr.json:', error);
    return NextResponse.json([{ left: "Pire", right: "Meilleur" }], { status: 500 });
  }
}
