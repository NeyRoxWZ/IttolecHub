import { NextResponse } from 'next/server';
import { getActiveRound, updateRoundState, bustRound } from '@/lib/casino/roundEngine.server';
import { LADDER_CONFIGS, multiplierAtStep, stepOutcome } from '@/lib/casino/ladder';
import { multiplierAfterReveals, MINES_TOTAL_CELLS } from '@/lib/casino/mines';

export async function POST(request: Request, { params }: { params: { game: string } }) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, params.game);
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    if (params.game === 'mines') {
      const cellIndex = Number(body?.payload?.cellIndex);
      if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= MINES_TOTAL_CELLS) {
        return NextResponse.json({ error: 'Case invalide' }, { status: 400 });
      }
      const { minePositions, revealed, mineCount } = round.state as { minePositions: number[]; revealed: number[]; mineCount: number };
      if (revealed.includes(cellIndex)) return NextResponse.json({ error: 'Case déjà révélée' }, { status: 400 });

      if (minePositions.includes(cellIndex)) {
        await bustRound(roundId);
        return NextResponse.json({ safe: false, status: 'busted', minePositions });
      }

      const newRevealed = [...revealed, cellIndex];
      const multiplier = multiplierAfterReveals(mineCount, newRevealed.length);
      await updateRoundState(roundId, { minePositions, revealed: newRevealed, mineCount }, multiplier);

      const maxSafeReveals = MINES_TOTAL_CELLS - mineCount;
      return NextResponse.json({ safe: true, multiplier, revealed: newRevealed, allCleared: newRevealed.length >= maxSafeReveals });
    }

    if (params.game in LADDER_CONFIGS) {
      const config = LADDER_CONFIGS[params.game as keyof typeof LADDER_CONFIGS];
      const { step } = round.state as { step: number };
      if (step >= config.totalSteps) return NextResponse.json({ error: 'Déjà au sommet' }, { status: 400 });

      const survived = stepOutcome(config);
      if (!survived) {
        await bustRound(roundId);
        return NextResponse.json({ safe: false, status: 'busted' });
      }

      const newStep = step + 1;
      const multiplier = multiplierAtStep(config, newStep);
      await updateRoundState(roundId, { step: newStep }, multiplier);
      return NextResponse.json({ safe: true, multiplier, step: newStep, atTop: newStep >= config.totalSteps });
    }

    return NextResponse.json({ error: 'Jeu inconnu' }, { status: 404 });
  } catch (err) {
    console.error('Erreur casino step:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
