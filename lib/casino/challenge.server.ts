import { supabase } from '@/lib/supabase/server';
import {
  CHALLENGE_ROUNDS, CHALLENGE_STAKE, CHALLENGE_MAX_BET_PCT,
  challengeRounds, challengeGame, dayKey,
} from './challenge';

/**
 * The daily challenge, server side.
 *
 * The bankroll here is not real money — it is a fixed 10 000 ₶ everyone gets
 * for the day, and it never touches a wallet. That is the whole point: the
 * board compares decisions, so it must not reward whoever happens to be rich.
 * The prize for finishing well is paid once, at the end, from nothing.
 */

export const CHALLENGE_PRIZES = [25_000, 12_000, 6_000];

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; status: number };

async function pseudoOf(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  return data?.pseudo || 'Joueur';
}

export async function challengeState(userId: string | null) {
  const day = dayKey();
  const rounds = challengeRounds(day);

  const [{ data: mine }, { data: board }] = await Promise.all([
    userId
      ? supabase.from('casino_challenge').select('*').eq('day', day).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('casino_challenge').select('pseudo, bankroll, round, busted, finished')
      .eq('day', day).order('bankroll', { ascending: false }).limit(20),
  ]);

  return {
    day,
    game: challengeGame(day),
    totalRounds: CHALLENGE_ROUNDS,
    startingBankroll: CHALLENGE_STAKE,
    maxBetPct: CHALLENGE_MAX_BET_PCT,
    prizes: CHALLENGE_PRIZES,
    run: mine
      ? {
          round: mine.round, bankroll: Number(mine.bankroll),
          busted: mine.busted, finished: mine.finished,
          // Only what has already happened is revealed: sending the whole
          // sequence would let anyone read the future off the network tab.
          past: rounds.slice(0, mine.round),
        }
      : null,
    board: board || [],
  };
}

export async function startChallenge(userId: string): Promise<Result> {
  const day = dayKey();
  const { error } = await supabase.from('casino_challenge').insert({
    day, user_id: userId, pseudo: await pseudoOf(userId),
    round: 0, bankroll: CHALLENGE_STAKE,
  });
  // The primary key is what makes this a single attempt per day.
  if (error) return { ok: false, error: 'Tu as déjà joué le défi du jour.', status: 400 };
  return { ok: true };
}

export async function playChallengeRound(
  userId: string, bet: number
): Promise<Result<{ multiplier: number; bankroll: number; round: number; over: boolean }>> {
  const day = dayKey();
  const { data: run } = await supabase.from('casino_challenge')
    .select('*').eq('day', day).eq('user_id', userId).maybeSingle();
  if (!run) return { ok: false, error: 'Commence le défi d’abord.', status: 400 };
  if (run.busted || run.finished) return { ok: false, error: 'Ton run est terminé.', status: 400 };

  const bankroll = Number(run.bankroll);
  const stake = Math.floor(bet);
  const max = Math.floor(bankroll * CHALLENGE_MAX_BET_PCT);
  if (stake < 1) return { ok: false, error: 'Mise invalide', status: 400 };
  if (stake > bankroll) return { ok: false, error: 'Plus que ça dans ta cagnotte.', status: 400 };
  if (stake > max) return { ok: false, error: `Maximum ${max.toLocaleString('en-US')} ₶ par manche.`, status: 400 };

  const multiplier = challengeRounds(day)[run.round];
  const after = bankroll - stake + Math.round(stake * multiplier);
  const round = run.round + 1;
  const busted = after <= 0;
  const finished = busted || round >= CHALLENGE_ROUNDS;

  // Guarded on the round we read: a double click must not replay a draw.
  const { data: saved } = await supabase.from('casino_challenge')
    .update({
      round, bankroll: Math.max(0, after), busted, finished,
      updated_at: new Date().toISOString(),
    })
    .eq('day', day).eq('user_id', userId).eq('round', run.round)
    .select().maybeSingle();
  if (!saved) return { ok: false, error: 'Manche déjà jouée.', status: 409 };

  if (finished) await payIfPodium(day, userId);

  return { ok: true, multiplier, bankroll: Math.max(0, after), round, over: finished };
}

/**
 * Pays the prize the moment a run ends, based on where it stands right then.
 *
 * Deliberately not a end-of-day settlement: there is no scheduled job to run
 * one, and a prize nobody is around to collect is a prize nobody plays for.
 * Finishing early and holding a podium place is itself a gamble.
 */
async function payIfPodium(day: string, userId: string) {
  const { data: board } = await supabase.from('casino_challenge')
    .select('user_id, bankroll').eq('day', day).eq('finished', true)
    .order('bankroll', { ascending: false }).limit(3);

  const place = (board || []).findIndex((r) => r.user_id === userId);
  if (place < 0 || place >= CHALLENGE_PRIZES.length) return;

  const prize = CHALLENGE_PRIZES[place];
  const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!w) return;

  const newBalance = Number(w.balance) + prize;
  await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'bonus',
    amount: prize, balance_after: newBalance,
    meta: { kind: 'challenge_prize', day, place: place + 1 },
  });
}
