import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get('word');
  const target = searchParams.get('target');

  if (!word || !target) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Normalize strings
  const normWord = word.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normTarget = target.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // R1: Check if word is same as target
  if (normWord === normTarget) {
      return NextResponse.json({
          matches: false,
          error: "SAME_WORD" // Client can handle this specific error
      });
  }

  try {
    // 1. Basic suffix check (last 3 letters)
    const suffixMatch = word.slice(-3).toLowerCase() === target.slice(-3).toLowerCase();
    
    // 2. Datamuse check (phonetic)
    // We check if 'word' is in the rhyme list of 'target'
    const res = await fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(target)}&max=1000`);
    const data = await res.json();
    
    const phoneticMatch = data.some((item: any) => item.word.toLowerCase() === word.toLowerCase());
    
    // Also check approximate rhymes (rel_nry)
    let approxMatch = false;
    if (!phoneticMatch) {
        const resApprox = await fetch(`https://api.datamuse.com/words?rel_nry=${encodeURIComponent(target)}&max=1000`);
        const dataApprox = await resApprox.json();
        approxMatch = dataApprox.some((item: any) => item.word.toLowerCase() === word.toLowerCase());
    }

    return NextResponse.json({
      matches: suffixMatch || phoneticMatch || approxMatch,
      details: { suffixMatch, phoneticMatch, approxMatch }
    });

  } catch (error) {
    console.error('Error checking rhyme:', error);
    // Fallback to suffix check on error
    return NextResponse.json({
      matches: word.slice(-3).toLowerCase() === target.slice(-3).toLowerCase(),
      fallback: true
    });
  }
}
