import { randomInt } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import { itemById, type ShopItem } from './shop';
import {
  crateById, isCrate, COINS_BY_RARITY, RARITY_ORDER, pickWeighted,
  type CrateOpening, type CrateReward,
} from './crates';
import { CRATE_COSMETICS } from './cosmetics';
import { levelFromXp, levelUpReward, totalXpForLevel } from './progression';
import { grantEffect } from './effects.server';
import {
  rerollMissions, completeBestMission, checkAchievements, statsFromWallet, withCollectionStats,
} from './metaProgression.server';
import { advanceCommunity } from './community.server';

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

/** Take `quantity` units out of the inventory at once. */
async function consumeMany(userId: string, itemId: string, quantity: number): Promise<number> {
  const { data: row } = await supabase.from('casino_inventory')
    .select('quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
  if (!row) return 0;

  const have = Number(row.quantity);
  const take = Math.min(have, quantity);
  if (take <= 0) return 0;

  const left = have - take;
  if (left <= 0) {
    await supabase.from('casino_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
  } else {
    await supabase.from('casino_inventory').update({ quantity: left })
      .eq('user_id', userId).eq('item_id', itemId).eq('quantity', have);
  }
  return take;
}

/**
 * Open crates. Each one is a single pull whose odds come from the crate
 * itself; the owned set is shared across the batch, so ten opened together
 * can never hand out the same piece twice — a duplicate pays coins instead.
 */
export async function openCrates(
  userId: string,
  crateId: string,
  quantity = 1,
): Promise<{ ok: true; openings: CrateOpening[]; newBalance: number } | { ok: false; status: number; error: string }> {
  const crate = crateById(crateId);
  if (!crate) return { ok: false, status: 404, error: 'Caisse inconnue' };

  const wanted = Math.max(1, Math.floor(quantity));
  const opened = await consumeMany(userId, crateId, wanted);
  if (opened === 0) return { ok: false, status: 400, error: 'Tu n’as pas cette caisse.' };

  const { data: inv } = await supabase.from('casino_inventory').select('item_id').eq('user_id', userId);
  const owned = new Set((inv || []).map((r) => r.item_id));

  const openings: CrateOpening[] = [];
  const newCosmetics: string[] = [];
  let coins = 0;

  const weights = RARITY_ORDER.map((r) => crate.odds[r]);

  for (let c = 0; c < opened; c++) {
    const rarity = RARITY_ORDER[pickWeighted(weights, rand())];
    const pool = CRATE_COSMETICS.filter((x) => x.rarity === rarity && !owned.has(x.id));

    if (pool.length > 0) {
      const pick = pool[Math.floor(rand() * pool.length)];
      owned.add(pick.id);
      newCosmetics.push(pick.id);
      openings.push({ crateId, reward: { kind: 'cosmetic', rarity, cosmeticId: pick.id }, coins: 0 });
    } else {
      // Nothing left to collect at that rarity: paid out rather than handed
      // back as a piece the player already has.
      const amount = COINS_BY_RARITY[rarity];
      coins += amount;
      openings.push({ crateId, reward: { kind: 'coins', rarity, amount, duplicate: true }, coins: amount });
    }
  }

  if (newCosmetics.length) {
    await supabase.from('casino_inventory').upsert(
      newCosmetics.map((id) => ({ user_id: userId, item_id: id, quantity: 1 })),
      { onConflict: 'user_id,item_id' }
    );
  }

  if (coins > 0) await credit(userId, coins, 'crate');

  await advanceCommunity(userId, { wagered: 0, plays: 0, won: 0, crates: opened });

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (wallet) {
    await supabase.from('casino_wallets')
      .update({ crates_opened: Number(wallet.crates_opened || 0) + opened })
      .eq('user_id', userId);
    // Opening crates is the one moment collection achievements can move.
    await checkAchievements(userId, await withCollectionStats(userId, statsFromWallet({
      ...wallet, crates_opened: Number(wallet.crates_opened || 0) + opened,
    })));
  }

  const { data: fresh } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  return { ok: true, openings, newBalance: fresh?.balance ?? wallet?.balance ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Using a consumable                                                  */
/* ------------------------------------------------------------------ */

export interface UseResult {
  ok: true;
  message: string;
  newBalance: number;
  openings?: CrateOpening[];
}

export async function consumeItem(
  userId: string,
  itemId: string,
  quantity = 1,
): Promise<UseResult | { ok: false; status: number; error: string }> {
  if (isCrate(itemId)) {
    const res = await openCrates(userId, itemId, quantity);
    if (!res.ok) return res;
    const n = res.openings.length;
    return {
      ok: true,
      message: `${n} caisse${n > 1 ? 's' : ''} ouverte${n > 1 ? 's' : ''}`,
      newBalance: res.newBalance,
      openings: res.openings,
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
      return { ok: true, message: `Le sac contenait ${payout.toLocaleString('en-US')} ₶`, newBalance: await credit(userId, payout, 'mystery') };
    }

    case 'interest': {
      const gain = Math.min(5000, Math.round(balance * (item.magnitude ?? 0.02)));
      return { ok: true, message: `+${gain.toLocaleString('en-US')} ₶ d'intérêts`, newBalance: await credit(userId, gain, 'interest') };
    }

    case 'grant_scratch': {
      let total = 0;
      for (let i = 0; i < (item.magnitude ?? 1); i++) {
        const r = rand();
        total += r < 0.5 ? 0 : r < 0.85 ? 100 : r < 0.97 ? 400 : 2000;
      }
      return {
        ok: true,
        message: total > 0 ? `Tickets : ${total.toLocaleString('en-US')} ₶` : 'Aucun ticket gagnant…',
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
    message: reward > 0 ? `${message} — coffre de niveau : +${reward.toLocaleString('en-US')} ₶` : message,
  };
}
