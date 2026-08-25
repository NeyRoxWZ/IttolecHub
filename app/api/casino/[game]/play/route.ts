import { NextResponse } from 'next/server';
import { settleBet } from '@/lib/casino/settleBet.server';
import { flipCoin, resolveCoinflip, type CoinSide } from '@/lib/casino/coinflip';
import { houseMove, resolveRps, type RpsMove } from '@/lib/casino/rps';
import { hideBall, resolveBonneteau } from '@/lib/casino/bonneteau';
import { drawBaccaratOutcome, resolveBaccarat, type BaccaratBet } from '@/lib/casino/baccarat';
import { drawStadeOutcome, resolveStade, type StadeBet } from '@/lib/casino/stade';
import { playPassLine, resolveCraps } from '@/lib/casino/craps';

// Single shared route for every "one bet, one instant reveal" casino game
// (coinflip, rps, bonneteau, ...). Multi-step games (mines, tower, rocket)
// need their own stateful routes and don't go through here.
export async function POST(request: Request, { params }: { params: { game: string } }) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const amount: number = Number(body?.amount);
    const payload = body?.payload;

    let resolveFn: () => { won: boolean; multiplier: number; meta?: any };

    switch (params.game) {
      case 'coinflip': {
        if (payload?.choice !== 'pile' && payload?.choice !== 'face') {
          return NextResponse.json({ error: 'Choix invalide' }, { status: 400 });
        }
        resolveFn = () => {
          const landed = flipCoin();
          const r = resolveCoinflip(landed, payload.choice as CoinSide);
          return { ...r, meta: { landed, choice: payload.choice } };
        };
        break;
      }
      case 'rps': {
        const moves: RpsMove[] = ['pierre', 'feuille', 'ciseaux'];
        if (!moves.includes(payload?.move)) {
          return NextResponse.json({ error: 'Coup invalide' }, { status: 400 });
        }
        resolveFn = () => {
          const house = houseMove();
          const r = resolveRps(payload.move as RpsMove, house);
          return { won: r.won, multiplier: r.multiplier, meta: { house, playerMove: payload.move, outcome: r.outcome } };
        };
        break;
      }
      case 'bonneteau': {
        if (![0, 1, 2].includes(payload?.cup)) {
          return NextResponse.json({ error: 'Gobelet invalide' }, { status: 400 });
        }
        resolveFn = () => {
          const ballCup = hideBall();
          const r = resolveBonneteau(ballCup, payload.cup);
          return { ...r, meta: { ballCup, chosenCup: payload.cup } };
        };
        break;
      }
      case 'baccarat': {
        const bets: BaccaratBet[] = ['player', 'banker', 'tie'];
        if (!bets.includes(payload?.bet)) {
          return NextResponse.json({ error: 'Mise invalide' }, { status: 400 });
        }
        resolveFn = () => {
          const outcome = drawBaccaratOutcome();
          const r = resolveBaccarat(outcome, payload.bet as BaccaratBet);
          return { ...r, meta: { outcome, bet: payload.bet } };
        };
        break;
      }
      case 'stade': {
        const bets: StadeBet[] = ['home', 'away', 'draw'];
        if (!bets.includes(payload?.bet)) {
          return NextResponse.json({ error: 'Mise invalide' }, { status: 400 });
        }
        resolveFn = () => {
          const outcome = drawStadeOutcome();
          const r = resolveStade(outcome, payload.bet as StadeBet);
          return { ...r, meta: { outcome, bet: payload.bet } };
        };
        break;
      }
      case 'craps': {
        resolveFn = () => {
          const { won, rolls, point } = playPassLine();
          const r = resolveCraps(won);
          return { ...r, meta: { rolls, point } };
        };
        break;
      }
      default:
        return NextResponse.json({ error: 'Jeu inconnu' }, { status: 404 });
    }

    const result = await settleBet({ userId, gameSlug: params.game, amount, resolve: resolveFn });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur casino play:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
