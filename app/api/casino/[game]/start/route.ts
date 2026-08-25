import { NextResponse } from 'next/server';
import { startRound } from '@/lib/casino/roundEngine.server';
import { LADDER_CONFIGS } from '@/lib/casino/ladder';
import { generateMinePositions, MINES_MIN_COUNT, MINES_MAX_COUNT } from '@/lib/casino/mines';

export async function POST(request: Request, { params }: { params: { game: string } }) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const amount: number = Number(body?.amount);
    const payload = body?.payload || {};

    let initialState: any;
    let publicState: any;

    if (params.game === 'mines') {
      const mineCount = Number(payload?.mineCount);
      if (!Number.isInteger(mineCount) || mineCount < MINES_MIN_COUNT || mineCount > MINES_MAX_COUNT) {
        return NextResponse.json({ error: 'Nombre de mines invalide' }, { status: 400 });
      }
      const minePositions = generateMinePositions(mineCount);
      initialState = { mineCount, minePositions, revealed: [] };
      publicState = { mineCount, revealed: [] };
    } else if (params.game in LADDER_CONFIGS) {
      initialState = { step: 0 };
      publicState = { step: 0, totalSteps: LADDER_CONFIGS[params.game as keyof typeof LADDER_CONFIGS].totalSteps };
    } else {
      return NextResponse.json({ error: 'Jeu inconnu' }, { status: 404 });
    }

    const result = await startRound({ userId, gameSlug: params.game, amount, initialState });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ roundId: result.roundId, newBalance: result.newBalance, state: publicState, multiplier: 1 });
  } catch (err) {
    console.error('Erreur casino start:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
