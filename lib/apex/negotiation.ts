export type NegotiationStatus = 'active' | 'accepted' | 'walked';

export type Negotiation = {
  id: string;
  kind: 'rights' | 'generic';
  partner: string;
  round: number;
  maxRounds: number;
  minAccept: number;
  offer: number;
  status: NegotiationStatus;
};

export function createNegotiationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createNegotiation(args: {
  kind: Negotiation['kind'];
  partner: string;
  baseValue: number;
  difficulty: number;
  maxRounds: number;
}): Negotiation {
  const difficulty = Math.min(1, Math.max(0, args.difficulty));
  const minAccept = Math.max(1, args.baseValue * (0.72 + difficulty * 0.22));
  const firstOffer = Math.max(1, args.baseValue * (0.55 + difficulty * 0.1));
  return {
    id: createNegotiationId(),
    kind: args.kind,
    partner: args.partner,
    round: 1,
    maxRounds: Math.max(1, Math.floor(args.maxRounds)),
    minAccept,
    offer: firstOffer,
    status: 'active',
  };
}

export function acceptNegotiation(n: Negotiation): Negotiation {
  if (n.status !== 'active') return n;
  return { ...n, status: 'accepted' };
}

export function playerCounter(n: Negotiation, target: number): { next: Negotiation; message: string } {
  if (n.status !== 'active') return { next: n, message: 'Négociation terminée.' };
  const counter = Math.max(1, target);

  const closeEnough = counter >= n.minAccept;
  const acceptChance = closeEnough ? 0.85 : Math.max(0.05, counter / n.minAccept) * 0.5;
  const roll = Math.random();

  if (roll < acceptChance) {
    return { next: { ...n, offer: counter, status: 'accepted' }, message: 'Accord conclu.' };
  }

  const nextRound = n.round + 1;
  if (nextRound > n.maxRounds) {
    return { next: { ...n, status: 'walked' }, message: `${n.partner} se retire.` };
  }

  const pressure = nextRound / n.maxRounds;
  const concession = 0.15 + 0.25 * pressure;
  const nextOffer = Math.min(n.minAccept, Math.max(n.offer, counter) * (1 - concession));
  const clamped = Math.max(1, Math.floor(nextOffer));

  return {
    next: { ...n, round: nextRound, offer: clamped },
    message: `${n.partner} contre-propose.`,
  };
}

