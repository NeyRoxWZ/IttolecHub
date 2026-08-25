import crypto from 'crypto';

// HiLo needs the player to see the current card (and its dynamic payout)
// before they bet, but the actual bet/settle happens in one request to the
// generic play route. Signing the dealt card lets the client carry it back
// without a DB round-trip, while still preventing them from claiming a
// different (more favorable) card than what was actually dealt.
const SECRET = process.env.SUPABASE_SERVICE_KEY || 'itollec-hilo-dev-secret';

export function signCard(card: number): string {
  return crypto.createHmac('sha256', SECRET).update(String(card)).digest('hex');
}

export function verifyCard(card: number, token: string): boolean {
  if (typeof card !== 'number' || typeof token !== 'string') return false;
  return signCard(card) === token;
}
