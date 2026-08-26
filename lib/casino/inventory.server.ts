import { randomInt } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import { itemById, type ShopItem } from './shop';
import { crateById, isCrate, RARITY_BY_COUNT, COINS_BY_RARITY, pickWeighted, type CrateOpening, type CrateReward } from './crates';
import { DROPPABLE_COSMETICS, type Rarity } from './cosmetics';
import { levelFromXp, levelUpReward, totalXpForLevel } from './progression';
import { grantEffect } from './effects.server';
import {
  rerollMissions, completeBestMission, checkAchievements, statsFromWallet, withCollectionStats,
} from './metaProgression.server';

/**
 * Items are bought into an inventory and used from it, rather than firing the
 * moment they're paid for. That's what makes a stock of them meaningful: you
 * can hold three insurances and spend one when a session turns sour.
 */

function rand(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

export async function addToInventory(userId: string, itemId: string, quantity = 1) {
  const { data: existing } = await supabase.from('casino_inventory')
    .select('quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle();

  if (existing) {
    await supabase.from('casino_inventory')
      .update({ quantity: Number(existing.quantity) + quantity })
      .eq('user_id', userId).eq('item_id', itemId);
  } else {
    await supabase.from('casino_inventory').insert({ user_id: userId, item_id: itemId, quantity });
  }
}

/** Take one unit out of the inventory, refusing if the player has none. */
async function consumeOne(userId: string, itemId: string): Promise<boolean> {
  const { data: row } = await supabase.from('casino_inventory')
    .select('quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
  if (!row || Number(row.quantity) < 1) return false;

  const left = Number(row.quantity) - 1;
  if (left <= 0) {
    await supabase.from('casino_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
  } else {
    await supabase.from('casino_inventory').update({ quantity: left })
      .eq('user_id', userId).eq('item_id', itemId).eq('quantity', row.quantity);
  }
  return true;
}

async function credit(userId: string, amount: number, kind: string): Promise<number> {
  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!wallet || amount <= 0) return wallet?.balance ?? 0;
  const newBalance = wallet.balance + amount;
  await supabase.from('casino_wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'bonus', amount, balance_after: newBalance, meta: { kind },
  });
  return newBalance;
}

/* ------------------------------------------------------------------ */
/* Crates                                                              */
/* ------------------------------------------------------------------ */

const RARITIES: Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];

export async function openCrate(userId: string, crateId: string): Promise<{ ok: true; opening: CrateOpening; newBalance: number } | { ok: false; status: number; error: string }> {
  const crate = crateById(crateId);
  if (!crate) return { ok: false, status: 404, error: 'Caisse inconnue' };
  if (!await consumeOne(userId, crateId)) return { ok: false, status: 400, error: 'Tu n’as pas cette caisse.' };

  const count = (3 + pickWeighted(crate.countWeights, rand())) as 3 | 4 | 5;
  const rarityOdds = RARITY_BY_COUNT[count];

  const { data: inv } = await supabase.from('casino_inventory').select('item_id').eq('user_id', userId);
  const owned = new Set((inv || []).map((r) => r.item_id));

  const rewards: CrateReward[] = [];
  const newCosmetics: string[] = [];
  let coins = 0;

  for (let i = 0; i < count; i++) {
    const rarity = RARITIES[pickWeighted(RARITIES.map((r) => rarityOdds[r]), rand())];
    const pool = DROPPABLE_COSMETICS.filter((c) => c.rarity === rarity && !owned.has(c.id) && !newCosmetics.includes(c.id));

    if (pool.length > 0) {
      const pick = pool[Math.floor(rand() * pool.length)];
      newCosmetics.push(pick.id);
      rewards.push({ kind: 'cosmetic', rarity, cosmeticId: pick.id });
    } else {
      // Nothing left to collect at that rarity — pay it out instead of
      // handing back a duplicate the player can't use.
      const amount = COINS_BY_RARITY[rarity];
      coins += amount;
      rewards.push({ kind: 'coins', rarity, amount, duplicate: true });
    }
  }

  if (newCosmetics.length) {
    await supabase.from('casino_inventory').upsert(
      newCosmetics.map((id) => ({ user_id: userId, item_id: id, quantity: 1 })),
      { onConflict: 'user_id,item_id' }
    );
  }

  if (coins > 0) await credit(userId, coins, 'crate');

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wallet) {
    await supabase.from('casino_wallets')
      .update({ crates_opened: Number(wallet.crates_opened || 0) + 1 })
      .eq('user_id', userId);
    // Opening a crate is the one moment collection achievements can move.
    await checkAchievements(userId, await withCollectionStats(userId, statsFromWallet({
      ...wallet, crates_opened: Number(wallet.crates_opened || 0) + 1,
    })));
  }

  const { data: fresh } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  return { ok: true, opening: { crateId, count, rewards, coins }, newBalance: fresh?.balance ?? wallet?.balance ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Using a consumable                                                  */
/* ------------------------------------------------------------------ */

export interface UseResult {
  ok: true;
  message: string;
  newBalance: number;
  opening?: CrateOpening;
}

export async function consumeItem(userId: string, itemId: string): Promise<UseResult | { ok: false; status: number; error: string }> {
  if (isCrate(itemId)) {
    const res = await openCrate(userId, itemId);
    if (!res.ok) return res;
    return {
      ok: true,
      message: `${res.opening.count} objets dans la caisse`,
      newBalance: res.newBalance,
      opening: res.opening,
    };
  }

  const item = itemById(itemId);
  if (!item) return { ok: false, status: 404, error: 'Objet inconnu' };
  if (!await consumeOne(userId, itemId)) return { ok: false, status: 400, error: 'Tu n’as pas cet objet.' };

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false, status: 404, error: 'Portefeuille introuvable' };

  return applyItem(userId, item, wallet);
}

async function applyItem(userId: string, item: ShopItem, wallet: any): Promise<UseResult> {
  const balance: number = wallet.balance;

  switch (item.effect) {
    case 'loss_refund':
    case 'streak_shield':
    case 'win_bonus':
    case 'jackpot_boost':
    case 'xp_multiplier':
    case 'max_bet_pct':
    case 'cashback_boost':
      await grantEffect(userId, item.effect, item.magnitude ?? 1, { uses: item.uses, durationMin: item.durationMin });
      return { ok: true, message: `${item.name} activé.`, newBalance: balance };

    case 'grant_xp':
      return creditXp(userId, wallet, item.magnitude ?? 0, `+${item.magnitude ?? 0} XP`);

    case 'grant_level': {
      const current = levelFromXp(Number(wallet.xp || 0));
      const target = current.level + (item.magnitude ?? 1);
      return creditXp(userId, wallet, totalXpForLevel(target) - Number(wallet.xp || 0), `Niveau ${target} atteint`);
    }

    case 'mystery_coins': {
      const payout = Math.round(item.price * (0.4 + rand() * 2.6));
      return { ok: true, message: `Le sac contenait ${payout.toLocaleString('fr-FR')} ₶`, newBalance: await credit(userId, payout, 'mystery') };
    }

    case 'interest': {
      const gain = Math.min(5000, Math.round(balance * (item.magnitude ?? 0.02)));
      return { ok: true, message: `+${gain.toLocaleString('fr-FR')} ₶ d'intérêts`, newBalance: await credit(userId, gain, 'interest') };
    }

    case 'grant_scratch': {
      let total = 0;
      for (let i = 0; i < (item.magnitude ?? 1); i++) {
        const r = rand();
        total += r < 0.5 ? 0 : r < 0.85 ? 100 : r < 0.97 ? 400 : 2000;
      }
      return {
        ok: true,
        message: total > 0 ? `Tickets : ${total.toLocaleString('fr-FR')} ₶` : 'Aucun ticket gagnant…',
        newBalance: total > 0 ? await credit(userId, total, 'scratch') : balance,
      };
    }

    case 'mission_reroll': {
      const missions = await rerollMissions(userId);
      return { ok: true, message: `Nouvelles missions : ${missions.map((m) => m.def.label).join(', ')}`, newBalance: balance };
    }

    case 'mission_complete': {
      const done = await completeBestMission(userId);
      return { ok: true, message: done ? `Mission terminée : ${done.def.label}` : 'Aucune mission à terminer.', newBalance: balance };
    }
  }

  return { ok: true, message: `${item.name} utilisé.`, newBalance: balance };
}

async function creditXp(userId: string, wallet: any, gain: number, message: string): Promise<UseResult> {
  const before = levelFromXp(Number(wallet.xp || 0));
  const newXp = Number(wallet.xp || 0) + Math.max(0, gain);
  const after = levelFromXp(newXp);

  let reward = 0;
  for (let l = before.level; l < after.level; l++) reward += levelUpReward(l);
  const newBalance = wallet.balance + reward;

  await supabase.from('casino_wallets')
    .update({ xp: newXp, level: after.level, balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (reward > 0) {
    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'bonus', amount: reward,
      balance_after: newBalance, meta: { kind: 'level_up', level: after.level },
    });
  }

  return {
    ok: true,
    newBalance,
    message: reward > 0 ? `${message} — coffre de niveau : +${reward.toLocaleString('fr-FR')} ₶` : message,
  };
}
