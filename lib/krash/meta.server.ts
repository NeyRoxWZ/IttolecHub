import { randomInt } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import {
  KRASH_CRATE_COSMETICS, KRASH_SLOTS, isKrashCosmetic, krashCosmeticById, krashSeason, type KrashSlot,
} from './cosmetics';
import {
  KRASH_COINS_BY_RARITY, KRASH_CRATES, RARITY_ORDER, isKrashCrate, krashCrateById, pickWeighted,
  type CrateOpening,
} from './crates';
import { krashDailyShop, krashItemById, krashShopDay, secondsUntilShopRotation } from './shop';
import {
  KRASH_DAILY_TRADE_XP_CAP, KRASH_DAILY_XP_CAP, KRASH_PASS_TIERS, KRASH_PREMIUM_PRICE,
  krashPassEnd, krashPassPeriod, krashPassTrack, krashTierFromXp, type KrashPassReward,
} from './pass';

/**
 * Krash's meta layer — inventory, item effects, crates, shop, cosmetics and
 * the pass — modelled on the casino's and kept on Krash's own tables. Every
 * coin that moves goes through krash_wallet_apply, which refuses to go
 * negative and writes the ledger the balance curve is drawn from.
 */

type Fail = { ok: false; status: number; error: string };

const rand = () => randomInt(0, 1_000_000) / 1_000_000;
const fmt = (n: number) => n.toLocaleString('fr-FR');

/* ------------------------------------------------------------------ */
/* Wallet                                                               */
/* ------------------------------------------------------------------ */

export async function walletMove(
  userId: string, delta: number, kind: string, meta: Record<string, unknown> = {},
): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_apply', {
    p_user: userId, p_delta: delta, p_kind: kind, p_meta: meta,
  });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

export async function krashBalanceOf(userId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_get', { p_user: userId });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

/* ------------------------------------------------------------------ */
/* Effects                                                              */
/* ------------------------------------------------------------------ */

export interface KrashEffect {
  effect: string;
  magnitude: number;
  uses_left: number | null;
  expires_at: string | null;
}

export type KrashEffects = Record<string, KrashEffect>;

export async function loadEffects(userId: string): Promise<KrashEffects> {
  const { data } = await supabase.from('krash_effects').select('*').eq('user_id', userId);
  const map: KrashEffects = {};
  const expired: string[] = [];
  for (const row of (data || []) as KrashEffect[]) {
    if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) { expired.push(row.effect); continue; }
    if (row.uses_left !== null && row.uses_left <= 0) { expired.push(row.effect); continue; }
    map[row.effect] = { ...row, magnitude: Number(row.magnitude) };
  }
  if (expired.length) await supabase.from('krash_effects').delete().eq('user_id', userId).in('effect', expired);
  return map;
}

/** Spends one use of an effect that fired. Time-based effects just run out. */
export async function consumeEffect(userId: string, effects: KrashEffects, name: string) {
  const e = effects[name];
  if (!e || e.uses_left === null) return;
  const left = e.uses_left - 1;
  if (left <= 0) await supabase.from('krash_effects').delete().eq('user_id', userId).eq('effect', name);
  else await supabase.from('krash_effects').update({ uses_left: left }).eq('user_id', userId).eq('effect', name);
}

async function grantEffect(userId: string, effect: string, magnitude: number, opts: { uses?: number; durationMin?: number }) {
  const { data: existing } = await supabase.from('krash_effects').select('*').eq('user_id', userId).eq('effect', effect).maybeSingle();
  const expires = opts.durationMin ? new Date(Date.now() + opts.durationMin * 60_000).toISOString() : null;

  // Using a second one stacks the uses or extends the time.
  if (existing) {
    await supabase.from('krash_effects').update({
      magnitude: Math.max(Number(existing.magnitude), magnitude),
      uses_left: opts.uses !== undefined ? (existing.uses_left ?? 0) + opts.uses : existing.uses_left,
      expires_at: expires && existing.expires_at
        ? new Date(Math.max(Date.parse(expires), Date.parse(existing.expires_at))).toISOString()
        : expires ?? existing.expires_at,
    }).eq('user_id', userId).eq('effect', effect);
    return;
  }
  await supabase.from('krash_effects').insert({
    user_id: userId, effect, magnitude, uses_left: opts.uses ?? null, expires_at: expires,
  });
}

/* ------------------------------------------------------------------ */
/* Inventory                                                            */
/* ------------------------------------------------------------------ */

export async function addItem(userId: string, itemId: string, quantity = 1) {
  const { data: row } = await supabase.from('krash_inventory')
    .select('quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
  if (row) {
    await supabase.from('krash_inventory').update({ quantity: Number(row.quantity) + quantity })
      .eq('user_id', userId).eq('item_id', itemId);
  } else {
    await supabase.from('krash_inventory').insert({ user_id: userId, item_id: itemId, quantity });
  }
}

/** Takes up to `quantity` units; returns how many were actually taken. */
async function takeItems(userId: string, itemId: string, quantity: number): Promise<number> {
  const { data: row } = await supabase.from('krash_inventory')
    .select('quantity').eq('user_id', userId).eq('item_id', itemId).maybeSingle();
  if (!row) return 0;
  const have = Number(row.quantity);
  const take = Math.min(have, Math.max(1, Math.floor(quantity)));
  const query = have - take <= 0
    ? supabase.from('krash_inventory').delete().eq('user_id', userId).eq('item_id', itemId).eq('quantity', have).select()
    : supabase.from('krash_inventory').update({ quantity: have - take }).eq('user_id', userId).eq('item_id', itemId).eq('quantity', have).select();
  const { data } = await query;
  return data && data.length ? take : 0;
}

export async function inventoryState(userId: string) {
  const [{ data: rows }, effects] = await Promise.all([
    supabase.from('krash_inventory').select('item_id, quantity').eq('user_id', userId),
    loadEffects(userId),
  ]);
  const list = rows || [];
  return {
    items: list.filter((r) => krashItemById(r.item_id)).map((r) => ({ id: r.item_id, quantity: Number(r.quantity) })),
    crates: list.filter((r) => isKrashCrate(r.item_id)).map((r) => ({ id: r.item_id, quantity: Number(r.quantity) })),
    cosmetics: list.filter((r) => isKrashCosmetic(r.item_id)).map((r) => r.item_id),
    effects,
  };
}

/* ------------------------------------------------------------------ */
/* Crates                                                               */
/* ------------------------------------------------------------------ */

export async function openCrates(userId: string, crateId: string, quantity = 1):
  Promise<{ ok: true; openings: CrateOpening[]; balance: number | null } | Fail> {
  const crate = krashCrateById(crateId);
  if (!crate) return { ok: false, status: 404, error: 'Caisse inconnue' };
  const opened = await takeItems(userId, crateId, quantity);
  if (!opened) return { ok: false, status: 400, error: 'Tu n’as pas cette caisse.' };

  const { data: inv } = await supabase.from('krash_inventory').select('item_id').eq('user_id', userId);
  const owned = new Set((inv || []).map((r) => r.item_id));
  const weights = RARITY_ORDER.map((r) => crate.odds[r]);
  const openings: CrateOpening[] = [];
  const fresh: string[] = [];
  let coins = 0;

  for (let i = 0; i < opened; i++) {
    const rarity = RARITY_ORDER[pickWeighted(weights, rand())];
    const pool = KRASH_CRATE_COSMETICS.filter((c) => c.rarity === rarity && !owned.has(c.id));
    if (pool.length) {
      const pick = pool[Math.floor(rand() * pool.length)];
      owned.add(pick.id);
      fresh.push(pick.id);
      openings.push({ crateId, reward: { kind: 'cosmetic', rarity, cosmeticId: pick.id }, coins: 0 });
    } else {
      const amount = KRASH_COINS_BY_RARITY[rarity];
      coins += amount;
      openings.push({ crateId, reward: { kind: 'coins', rarity, amount, duplicate: true }, coins: amount });
    }
  }

  if (fresh.length) {
    await supabase.from('krash_inventory').upsert(
      fresh.map((id) => ({ user_id: userId, item_id: id, quantity: 1 })),
      { onConflict: 'user_id,item_id' },
    );
  }
  const balance = coins > 0 ? await walletMove(userId, coins, 'caisse', { crateId }) : await krashBalanceOf(userId);
  return { ok: true, openings, balance };
}

/* ------------------------------------------------------------------ */
/* Shop                                                                 */
/* ------------------------------------------------------------------ */

export async function shopState(userId: string | null) {
  const day = krashShopDay();
  let purchased: string[] = [];
  if (userId) {
    const { data } = await supabase.from('krash_shop_purchases').select('item_id').eq('user_id', userId).eq('day_key', day);
    purchased = (data || []).map((r) => r.item_id);
  }
  return { items: krashDailyShop(day), crates: KRASH_CRATES, purchased, resetIn: secondsUntilShopRotation() };
}

export async function buy(userId: string, id: string, quantity = 1): Promise<{ ok: true; balance: number } | Fail> {
  const crate = krashCrateById(id);
  if (crate) {
    const qty = Math.min(10, Math.max(1, Math.floor(quantity)));
    const balance = await walletMove(userId, -crate.price * qty, 'boutique', { id, qty });
    if (balance === null) return { ok: false, status: 400, error: 'Solde insuffisant' };
    await addItem(userId, id, qty);
    return { ok: true, balance };
  }

  const day = krashShopDay();
  const item = krashDailyShop(day).find((i) => i.id === id);
  if (!item) return { ok: false, status: 400, error: 'Cet objet n’est pas en vente aujourd’hui.' };

  // The purchase row is the lock: each daily item can be bought once.
  const { error } = await supabase.from('krash_shop_purchases').insert({ user_id: userId, day_key: day, item_id: id });
  if (error) return { ok: false, status: 409, error: 'Déjà acheté aujourd’hui.' };

  const balance = await walletMove(userId, -item.price, 'boutique', { id });
  if (balance === null) {
    await supabase.from('krash_shop_purchases').delete().eq('user_id', userId).eq('day_key', day).eq('item_id', id);
    return { ok: false, status: 400, error: 'Solde insuffisant' };
  }
  await addItem(userId, id);
  return { ok: true, balance };
}

export async function useItem(userId: string, itemId: string, quantity = 1):
  Promise<{ ok: true; message: string; balance: number | null; openings?: CrateOpening[] } | Fail> {
  if (isKrashCrate(itemId)) {
    const res = await openCrates(userId, itemId, quantity);
    if (!res.ok) return res;
    const n = res.openings.length;
    return { ok: true, message: `${n} caisse${n > 1 ? 's' : ''} ouverte${n > 1 ? 's' : ''}`, balance: res.balance, openings: res.openings };
  }

  const item = krashItemById(itemId);
  if (!item) return { ok: false, status: 404, error: 'Objet inconnu' };
  if (!await takeItems(userId, itemId, 1)) return { ok: false, status: 400, error: 'Tu n’as pas cet objet.' };

  switch (item.effect) {
    case 'grant_xp': {
      await advancePass(userId, item.magnitude ?? 0, 'activity', { ignoreCap: true });
      return { ok: true, message: `+${fmt(item.magnitude ?? 0)} XP de pass`, balance: await krashBalanceOf(userId) };
    }
    case 'mystery_coins': {
      const payout = Math.round(item.price * (0.4 + rand() * 2.6));
      return { ok: true, message: `Le sac contenait ${fmt(payout)} ₶`, balance: await walletMove(userId, payout, 'sac mystère') };
    }
    case 'interest': {
      const current = (await krashBalanceOf(userId)) ?? 0;
      const gain = Math.min(3000, Math.round(current * (item.magnitude ?? 0.02)));
      return { ok: true, message: `+${fmt(gain)} ₶ d’intérêts`, balance: gain > 0 ? await walletMove(userId, gain, 'intérêts') : current };
    }
    default:
      await grantEffect(userId, item.effect, item.magnitude ?? 1, { uses: item.uses, durationMin: item.durationMin });
      return { ok: true, message: `${item.name} activé.`, balance: await krashBalanceOf(userId) };
  }
}

/* ------------------------------------------------------------------ */
/* Cosmetics                                                            */
/* ------------------------------------------------------------------ */

export async function cosmeticsState(userId: string) {
  const [{ data: inv }, { data: loadout }] = await Promise.all([
    supabase.from('krash_inventory').select('item_id').eq('user_id', userId),
    supabase.from('krash_loadout').select('slot, cosmetic_id').eq('user_id', userId),
  ]);
  const equipped: Partial<Record<KrashSlot, string>> = {};
  for (const r of loadout || []) equipped[r.slot as KrashSlot] = r.cosmetic_id;
  return {
    owned: (inv || []).map((r) => r.item_id).filter(isKrashCosmetic),
    equipped,
    season: krashSeason(),
  };
}

/** One owned piece at random in every slot the player has something for. */
export async function equipRandom(userId: string): Promise<{ ok: true; count: number }> {
  const { data: inv } = await supabase.from('krash_inventory').select('item_id').eq('user_id', userId);
  const owned = (inv || []).map((r) => krashCosmeticById(r.item_id)).filter((c): c is NonNullable<typeof c> => !!c);
  const rows = KRASH_SLOTS.flatMap((slot) => {
    const pool = owned.filter((c) => c.slot === slot);
    if (!pool.length) return [];
    return [{ user_id: userId, slot, cosmetic_id: pool[Math.floor(rand() * pool.length)].id }];
  });
  if (rows.length) await supabase.from('krash_loadout').upsert(rows, { onConflict: 'user_id,slot' });
  return { ok: true, count: rows.length };
}

export async function equipCosmetic(userId: string, slot: string, cosmeticId: string | null): Promise<{ ok: true } | Fail> {
  if (!KRASH_SLOTS.includes(slot as KrashSlot)) return { ok: false, status: 400, error: 'Emplacement inconnu' };
  if (cosmeticId === null) {
    await supabase.from('krash_loadout').delete().eq('user_id', userId).eq('slot', slot);
    return { ok: true };
  }
  const cosmetic = krashCosmeticById(cosmeticId);
  if (!cosmetic || cosmetic.slot !== slot) return { ok: false, status: 400, error: 'Cosmétique invalide' };
  const { data: owned } = await supabase.from('krash_inventory')
    .select('item_id').eq('user_id', userId).eq('item_id', cosmeticId).maybeSingle();
  if (!owned) return { ok: false, status: 403, error: 'Tu ne possèdes pas ce cosmétique.' };
  await supabase.from('krash_loadout').upsert({ user_id: userId, slot, cosmetic_id: cosmeticId }, { onConflict: 'user_id,slot' });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Pass                                                                 */
/* ------------------------------------------------------------------ */

interface PassRow {
  period_key: string;
  xp: number;
  tier: number;
  premium: boolean;
  day_key: string | null;
  day_xp: number;
  day_trade_xp: number;
  swept: boolean;
}

type Track = 'free' | 'premium';

function rewardAt(tier: number, track: Track): KrashPassReward | null {
  const def = krashPassTrack()[tier - 1];
  return def ? def[track] : null;
}

async function grantRewards(userId: string, rewards: KrashPassReward[]) {
  let coins = 0;
  const cosmetics: string[] = [];
  for (const r of rewards) {
    if (r.kind === 'coins') coins += r.amount ?? 0;
    else if (r.kind === 'cosmetic' && r.cosmeticId) cosmetics.push(r.cosmeticId);
    else if (r.kind === 'item' && r.itemId) await addItem(userId, r.itemId);
  }
  if (cosmetics.length) {
    await supabase.from('krash_inventory').upsert(
      cosmetics.map((id) => ({ user_id: userId, item_id: id, quantity: 1 })),
      { onConflict: 'user_id,item_id' },
    );
  }
  if (coins > 0) await walletMove(userId, coins, 'pass', { tiers: rewards.length });
}

/** Unclaimed rewards of a finished month are paid out rather than lost. */
async function sweepPrevious(userId: string, period: string) {
  const { data: stale } = await supabase.from('krash_pass').select('*')
    .eq('user_id', userId).eq('swept', false).neq('period_key', period);
  for (const row of (stale || []) as PassRow[]) {
    const { data: claims } = await supabase.from('krash_pass_claims').select('track, tier')
      .eq('user_id', userId).eq('period_key', row.period_key);
    const taken = new Set((claims || []).map((c) => `${c.track}:${c.tier}`));
    const pending: KrashPassReward[] = [];
    for (let t = 1; t <= row.tier; t++) {
      for (const track of ['free', 'premium'] as Track[]) {
        if (track === 'premium' && !row.premium) continue;
        if (taken.has(`${track}:${t}`)) continue;
        const reward = rewardAt(t, track);
        if (reward) pending.push(reward);
      }
    }
    await grantRewards(userId, pending);
    await supabase.from('krash_pass').update({ swept: true }).eq('user_id', userId).eq('period_key', row.period_key);
  }
}

async function ensurePass(userId: string): Promise<PassRow | null> {
  const period = krashPassPeriod();
  const { data } = await supabase.from('krash_pass').select('*').eq('user_id', userId).eq('period_key', period).maybeSingle();
  if (data) return data as PassRow;
  await sweepPrevious(userId, period);
  await supabase.from('krash_pass').upsert({ user_id: userId, period_key: period }, { onConflict: 'user_id,period_key', ignoreDuplicates: true });
  const { data: created } = await supabase.from('krash_pass').select('*').eq('user_id', userId).eq('period_key', period).maybeSingle();
  return (created as PassRow) ?? null;
}

export type XpSource = 'trade' | 'activity';

/** Adds pass XP within the day's budget. Rewards are claimed by hand. */
export async function advancePass(
  userId: string, xp: number, source: XpSource, opts: { ignoreCap?: boolean } = {},
): Promise<{ tier: number; unlocked: number[] }> {
  const row = await ensurePass(userId);
  if (!row || xp <= 0) return { tier: row?.tier ?? 0, unlocked: [] };

  const effects = await loadEffects(userId);
  const boosted = Math.round(xp * (effects.xp_multiplier?.magnitude ?? 1));

  const day = new Date().toISOString().slice(0, 10);
  const sameDay = row.day_key === day;
  const dayXp = sameDay ? Number(row.day_xp) : 0;
  const dayTradeXp = sameDay ? Number(row.day_trade_xp) : 0;

  let granted = boosted;
  if (!opts.ignoreCap) {
    let allowed = Math.max(0, KRASH_DAILY_XP_CAP - dayXp);
    if (source === 'trade') allowed = Math.min(allowed, Math.max(0, KRASH_DAILY_TRADE_XP_CAP - dayTradeXp));
    granted = Math.min(boosted, allowed);
  }
  if (granted <= 0) return { tier: row.tier, unlocked: [] };

  const newXp = Number(row.xp) + granted;
  const tier = Math.min(KRASH_PASS_TIERS, krashTierFromXp(newXp).tier);
  await supabase.from('krash_pass').update({
    xp: newXp,
    tier,
    day_key: day,
    day_xp: dayXp + granted,
    day_trade_xp: dayTradeXp + (source === 'trade' ? granted : 0),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('period_key', row.period_key);

  const unlocked: number[] = [];
  for (let t = Number(row.tier) + 1; t <= tier; t++) unlocked.push(t);
  return { tier, unlocked };
}

export async function passState(userId: string) {
  const row = await ensurePass(userId);
  const { data: claims } = await supabase.from('krash_pass_claims').select('track, tier')
    .eq('user_id', userId).eq('period_key', krashPassPeriod());
  const xp = Number(row?.xp ?? 0);
  const progress = krashTierFromXp(xp);
  const day = new Date().toISOString().slice(0, 10);
  return {
    period: krashPassPeriod(),
    endsAt: krashPassEnd().toISOString(),
    season: krashSeason(),
    xp,
    tier: progress.tier,
    intoTier: progress.intoTier,
    needed: progress.needed,
    premium: !!row?.premium,
    premiumPrice: KRASH_PREMIUM_PRICE,
    dayXp: row?.day_key === day ? Number(row.day_xp) : 0,
    dayCap: KRASH_DAILY_XP_CAP,
    claimed: {
      free: (claims || []).filter((c) => c.track === 'free').map((c) => c.tier),
      premium: (claims || []).filter((c) => c.track === 'premium').map((c) => c.tier),
    },
    track: krashPassTrack(),
  };
}

export async function claimTier(userId: string, tier: number, track: Track) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Pass introuvable' };
  if (!Number.isInteger(tier) || tier < 1 || tier > row.tier) return { ok: false as const, status: 400, error: 'Palier pas encore atteint.' };
  if (track === 'premium' && !row.premium) return { ok: false as const, status: 400, error: 'Voie premium non débloquée.' };
  const reward = rewardAt(tier, track);
  if (!reward) return { ok: false as const, status: 404, error: 'Récompense introuvable' };

  const { error } = await supabase.from('krash_pass_claims').insert({ user_id: userId, period_key: row.period_key, track, tier });
  if (error) return { ok: false as const, status: 409, error: 'Palier déjà récupéré.' };
  await grantRewards(userId, [reward]);
  return { ok: true as const, reward, balance: await krashBalanceOf(userId) };
}

export async function claimAll(userId: string) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Pass introuvable' };
  const { data: claims } = await supabase.from('krash_pass_claims').select('track, tier')
    .eq('user_id', userId).eq('period_key', row.period_key);
  const taken = new Set((claims || []).map((c) => `${c.track}:${c.tier}`));

  const rewards: KrashPassReward[] = [];
  const rows: { user_id: string; period_key: string; track: Track; tier: number }[] = [];
  for (let t = 1; t <= row.tier; t++) {
    for (const track of ['free', 'premium'] as Track[]) {
      if (track === 'premium' && !row.premium) continue;
      if (taken.has(`${track}:${t}`)) continue;
      const reward = rewardAt(t, track);
      if (!reward) continue;
      rewards.push(reward);
      rows.push({ user_id: userId, period_key: row.period_key, track, tier: t });
    }
  }
  if (!rows.length) return { ok: false as const, status: 400, error: 'Rien à récupérer.' };
  const { error } = await supabase.from('krash_pass_claims').insert(rows);
  if (error) return { ok: false as const, status: 409, error: 'Conflit, réessaie.' };
  await grantRewards(userId, rewards);
  return { ok: true as const, rewards, balance: await krashBalanceOf(userId) };
}

/** Premium for the month; buying late unlocks every premium tier already reached. */
export async function buyPremium(userId: string) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Pass introuvable' };
  if (row.premium) return { ok: false as const, status: 400, error: 'Pass premium déjà actif ce mois-ci.' };

  const balance = await walletMove(userId, -KRASH_PREMIUM_PRICE, 'pass premium', { period: row.period_key });
  if (balance === null) return { ok: false as const, status: 400, error: 'Solde insuffisant' };

  const { data: updated } = await supabase.from('krash_pass').update({ premium: true })
    .eq('user_id', userId).eq('period_key', row.period_key).eq('premium', false).select().maybeSingle();
  if (!updated) {
    await walletMove(userId, KRASH_PREMIUM_PRICE, 'remboursement', { reason: 'premium déjà actif' });
    return { ok: false as const, status: 409, error: 'Pass premium déjà actif.' };
  }
  return { ok: true as const, balance, unlockedTiers: row.tier };
}
