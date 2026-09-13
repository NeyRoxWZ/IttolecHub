import { supabase } from '@/lib/supabase/server';
import { FLASH, flashMultiplier } from './assets';
import { newsById, priceAt } from './engine.server';
import { KRASH_PASS_XP } from './pass';
import { advancePass, consumeEffect, krashBalanceOf, loadEffects, walletMove } from './meta.server';

/**
 * Flash bets on fresh headlines. The verdict is the target's price a minute
 * after publication against its price at publication, both recomputed from
 * the market, so a bet can be settled whenever its owner next shows up.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

const iso = (t: number) => new Date(t * 1000).toISOString();

export async function placeFlash(
  userId: string,
  input: { newsId: string; hint: number; side: string; stake: number },
): Promise<Result<{ bet: Record<string, unknown>; balance: number }>> {
  if (input.side !== 'up' && input.side !== 'down') return { ok: false, status: 400, error: 'Sens invalide' };
  if (!Number.isInteger(input.stake) || input.stake < FLASH.minStake) {
    return { ok: false, status: 400, error: `Mise minimum : ${FLASH.minStake} ₶` };
  }

  const news = newsById(input.newsId);
  const now = Date.now() / 1000;
  if (!news || news.at > now) return { ok: false, status: 404, error: 'News introuvable' };
  if (now - news.at > FLASH.window) return { ok: false, status: 400, error: 'Trop tard pour parier sur cette news' };

  const hint = news.hints[input.hint];
  if (!hint) return { ok: false, status: 400, error: 'Cible invalide' };

  const [balance, effects] = await Promise.all([krashBalanceOf(userId), loadEffects(userId)]);
  if (balance === null) return { ok: false, status: 404, error: 'Portefeuille introuvable' };
  const maxStake = Math.floor(balance * FLASH.maxStakePct);
  if (input.stake > maxStake) return { ok: false, status: 400, error: `Mise max : ${maxStake} ₶` };

  const debited = await walletMove(userId, -input.stake, 'pari flash', { news: news.id });
  if (debited === null) return { ok: false, status: 400, error: 'Solde insuffisant' };

  const boost = effects.flash_boost?.magnitude ?? 0;
  const multiplier = Math.round(flashMultiplier(hint.up, input.side, news.certainty) * (1 + boost) * 100) / 100;

  const { data: bet, error } = await supabase.from('krash_flash_bets').insert({
    user_id: userId,
    news_id: news.id,
    news_text: news.text,
    label: hint.label,
    asset: hint.ref,
    side: input.side,
    stake: input.stake,
    multiplier,
    published_at: iso(news.at),
    resolve_at: iso(news.at + FLASH.horizon),
  }).select().single();

  if (error || !bet) {
    await walletMove(userId, input.stake, 'remboursement', { reason: 'pari flash en double' });
    return { ok: false, status: 409, error: 'Tu as déjà parié sur cette news' };
  }
  if (boost > 0) await consumeEffect(userId, effects, 'flash_boost');
  return { ok: true, bet, balance: debited };
}

/** Settles every bet whose minute is up. */
async function settleDue(userId: string) {
  const { data: due } = await supabase.from('krash_flash_bets')
    .select('*').eq('user_id', userId).eq('status', 'pending').lte('resolve_at', new Date().toISOString());

  const settled: Record<string, unknown>[] = [];
  for (const bet of due || []) {
    const at = Math.floor(Date.parse(bet.published_at) / 1000);
    const before = priceAt(bet.asset, at);
    const after = priceAt(bet.asset, at + FLASH.horizon);
    const won = bet.side === 'up' ? after > before : after < before;
    const payout = won ? Math.round(bet.stake * Number(bet.multiplier)) : 0;

    const { data: updated } = await supabase.from('krash_flash_bets')
      .update({ status: won ? 'won' : 'lost', payout })
      .eq('id', bet.id).eq('status', 'pending').select().maybeSingle();
    if (!updated) continue;

    await Promise.all([
      payout > 0 ? walletMove(userId, payout, 'pari flash gagné', { news: bet.news_id }) : Promise.resolve(null),
      advancePass(userId, KRASH_PASS_XP.flash, 'trade'),
    ]);
    settled.push({ ...updated, move: after / before - 1 });
  }
  return settled;
}

export async function loadFlash(userId: string) {
  const settledNow = await settleDue(userId);
  const [{ data: bets }, balance] = await Promise.all([
    supabase.from('krash_flash_bets').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(15),
    krashBalanceOf(userId),
  ]);
  return { bets: bets || [], settledNow, balance };
}
