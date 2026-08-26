import { NextResponse } from 'next/server';
import { cosmeticStock, passCosmeticsForSeason, PASS_SEASONS } from '@/lib/casino/cosmetics';
import { currentSeason, seasonsRemaining } from '@/lib/casino/pass';

/**
 * The catalogue's stock report: how many seasons of pass cosmetics are
 * written, which one is live, and how many are left before new ones have to
 * be created. Read by the owner-only panel on the pass page.
 */
export async function GET() {
  try {
    const stock = cosmeticStock();
    const season = currentSeason();
    const remaining = seasonsRemaining();

    return NextResponse.json({
      total: stock.total,
      perGame: stock.perGame,
      general: stock.general,
      pass: stock.pass,
      crate: stock.crate,
      prestige: stock.prestige,
      currentSeason: season,
      seasonsRemaining: remaining,
      exhausted: season >= PASS_SEASONS,
      seasons: stock.bySeason.map((s) => ({
        season: s.season,
        count: s.count,
        live: s.season === season,
        past: s.season < season,
        preview: passCosmeticsForSeason(s.season).slice(0, 3).map((c) => c.name),
      })),
    });
  } catch (err) {
    console.error('Erreur GET stock cosmétiques:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
