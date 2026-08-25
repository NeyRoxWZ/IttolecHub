export * from './core';
import { secureRandomInt } from './core';

// Card = rank 1-13 (1=Ace, 11=J, 12=Q, 13=K). Infinite-deck model (draw with
// replacement) — no shoe to track, simpler and the odds barely move for a
// single-player table anyway.
export function drawCard(): number {
  return secureRandomInt(13) + 1;
}

function cardValue(rank: number): number {
  return rank === 1 ? 11 : Math.min(rank, 10);
}

export function computeHandValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let acesAs11 = 0;
  for (const r of cards) {
    if (r === 1) { total += 11; acesAs11++; } else total += cardValue(r);
  }
  while (total > 21 && acesAs11 > 0) {
    total -= 10;
    acesAs11--;
  }
  return { total, soft: acesAs11 > 0 };
}

export function isBlackjack(cards: number[]): boolean {
  return cards.length === 2 && computeHandValue(cards).total === 21;
}

export function dealerPlay(dealerCards: number[]): number[] {
  const cards = [...dealerCards];
  while (computeHandValue(cards).total < 17) {
    cards.push(drawCard());
  }
  return cards;
}

export type BlackjackOutcome = 'win' | 'lose' | 'push' | 'blackjack';

export function resolveHand(playerCards: number[], dealerCards: number[]): { outcome: BlackjackOutcome; multiplier: number } {
  const player = computeHandValue(playerCards);
  const dealer = computeHandValue(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (playerBJ && dealerBJ) return { outcome: 'push', multiplier: 1 };
  if (playerBJ) return { outcome: 'blackjack', multiplier: 2.5 };
  if (dealerBJ) return { outcome: 'lose', multiplier: 0 };
  if (player.total > 21) return { outcome: 'lose', multiplier: 0 };
  if (dealer.total > 21) return { outcome: 'win', multiplier: 2 };
  if (player.total > dealer.total) return { outcome: 'win', multiplier: 2 };
  if (player.total < dealer.total) return { outcome: 'lose', multiplier: 0 };
  return { outcome: 'push', multiplier: 1 };
}
