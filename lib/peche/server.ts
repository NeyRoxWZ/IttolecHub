import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import {
  ACHIEVEMENTS, COSMETIC_BY_ID, COSMETIC_SLOTS, PASS_TIERS, SHOP_ITEMS, SPECIES, TREE, getSpecies,
  type AchievementMetric, type CosmeticSlot, type GearId, type MaterialId, type TreeId, type Variant,
} from './data';
import {
  AUTO_MAX_CATCHES_PER_CALL, AUTO_MAX_GAP_MS, CHEST_DAYS, JACKPOT_RATE, MIN_REEL_MS, ORDER_BONUS, PROMO_DISCOUNT, QUALITY,
  autoEfficiency, autoInterval, bossFor, bossReward, catchMods, catchPoints, chestReward, dailyMarket, dayKey, gaugeFor,
  gearCost, itemPrice, levelFromXp, lvl, mareeThreshold, marketMultiplier, maxGearLevel, missionReward, missionsFor,
  monthKey, newOrder, packPrice, passLevel, passReward, perlesFor, rollCatch, rollCosmetic, rollMaterials,
  saleMultiplier, shoalAt, shopOffer, treeCost, weatherAt, weekKey, xpForCatch, zoneBase,
  type Catch, type CatchMods, type Effects, type GearLevels, type Materials, type MissionSet, type Order, type Quality, type TreeLevels,
} from './engine';

/**
 * Frenly Pêche — server side. The server draws every catch and holds the only
 * copy of the player's state; the browser only plays the reeling gauge.
 *
 * Writes go through a version check: two requests landing together (the auto
 * rod and a manual catch) must not overwrite each other. Shared things (the
 * weekly boss, the jackpot, the live feed) go through their own tables and
 * database functions, after the player's own write has landed.
 */

interface BagItem { n: number; v: number }
interface PendingCast extends Catch { id: string; at: number }
type Stats = Partial<Record<'perfect' | 'legendary' | 'mythic' | 'chroma' | 'or' | 'chests' | 'orders' | 'missions' | 'weekCaught', number>>;
interface PassState { month: string; xp: number; claimed: number[] }

interface Row {
  user_id: string;
  balance: number;
  run_earned: number;
  lifetime_earned: number;
  materials: Materials;
  gear: GearLevels;
  zone: number;
  xp: number;
  maree: number;
  perles: number;
  tree: TreeLevels;
  bag: Record<string, BagItem>;
  total_caught: number;
  pending_cast: PendingCast | null;
  last_auto_at: string | null;
  version: number;
  chest_day: number;
  chest_claimed_at: string | null;
  missions: MissionSet | Record<string, never>;
  orders: Order[];
  effects: Effects;
  shop_day: string | null;
  shop_bought: string[];
  cosmetics: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
  packs: number;
  best_zone: number;
  stats: Stats;
  achievements: string[];
  pass: PassState | Record<string, never>;
  week_key: string | null;
  week_points: number;
  last_week: { week: string; points: number; caught: number } | null;
  recap_seen: string | null;
}

interface DexRow { species_id: string; caught: number; best_weight: number; variants: string[] }
type DexAcc = Map<string, { n: number; w: number; variants: Set<string> }>;

/** What a write leaves for the shared tables once the player's row is saved. */
interface Shared {
  bossDamage?: number;
  feed?: { speciesId: string; rarity: number; variant: string; weight: number; zone: number }[];
  jackpotUnits?: number;
  jackpotWin?: boolean;
}

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

const boatOf = (row: Row) => lvl(row.gear, 'bateau');

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

async function loadRow(userId: string): Promise<Row | null> {
  const { data } = await supabase.from('peche_players').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as Row;
  const { error } = await supabase.from('peche_players').insert({ user_id: userId });
  if (error && !String(error.message).includes('duplicate')) console.error('Création joueur pêche:', error);
  const { data: again } = await supabase.from('peche_players').select('*').eq('user_id', userId).maybeSingle();
  return (again as Row) || null;
}

async function loadDex(userId: string): Promise<DexRow[]> {
  const { data } = await supabase.from('peche_dex').select('species_id, caught, best_weight, variants').eq('user_id', userId);
  return (data as DexRow[]) || [];
}

const PSEUDO_TTL = 60_000;
const pseudoCache = new Map<string, { pseudo: string; at: number }>();

async function pseudosOf(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];
  for (const id of ids) {
    const hit = pseudoCache.get(id);
    if (hit && Date.now() - hit.at < PSEUDO_TTL) out.set(id, hit.pseudo); else missing.push(id);
  }
  if (missing.length) {
    const { data } = await supabase.from('users').select('id, pseudo').in('id', missing);
    for (const u of data || []) { out.set(u.id, u.pseudo); pseudoCache.set(u.id, { pseudo: u.pseudo, at: Date.now() }); }
  }
  return out;
}

/** Missions of the day/week, orders topped up, today's shop, this week and month. */
function fresh(row: Row): Partial<Row> {
  const today = dayKey();
  const week = weekKey();
  const month = monthKey();
  const cur = row.missions as MissionSet;
  const gen = missionsFor(row.user_id, boatOf(row), today, week);
  const missions: MissionSet = !cur || !cur.day ? gen : {
    day: today, week,
    daily: cur.day === today ? cur.daily : gen.daily,
    weekly: cur.week === week ? cur.weekly : gen.weekly,
  };
  const orders = [...(row.orders || [])];
  while (orders.length < 3) orders.push(newOrder(boatOf(row)));

  const out: Partial<Row> = { missions, orders, shop_day: today, shop_bought: row.shop_day === today ? row.shop_bought || [] : [] };

  if (row.week_key !== week) {
    out.last_week = row.week_key ? { week: row.week_key, points: row.week_points || 0, caught: row.stats?.weekCaught || 0 } : row.last_week;
    out.week_key = week;
    out.week_points = 0;
    out.stats = { ...(row.stats || {}), weekCaught: 0 };
  }
  const pass = row.pass as PassState;
  if (!pass || pass.month !== month) out.pass = { month, xp: 0, claimed: [] };
  return out;
}

export async function stateFor(userId: string) {
  const row = await loadRow(userId);
  if (!row) return null;
  return present(row, await loadDex(userId));
}

function metricValue(row: Row, dexCount: number, metric: AchievementMetric): number {
  switch (metric) {
    case 'caught': return row.total_caught;
    case 'species': return dexCount;
    case 'maree': return row.maree;
    case 'bestZone': return Math.max(row.best_zone || 0, row.zone);
    case 'earned': return row.lifetime_earned;
    default: return Number(row.stats?.[metric] || 0);
  }
}

function present(raw: Row, dex: DexRow[]) {
  const row = { ...raw, ...fresh(raw) } as Row;
  const now = Date.now();
  const boat = boatOf(row);
  const bag = Object.entries(row.bag || {}).map(([key, item]) => {
    const [speciesId, variant = ''] = key.split('|');
    return { key, speciesId, variant: variant as Variant, count: item.n, value: item.v, price: item.v * marketMultiplier(speciesId) * saleMultiplier(row.tree, row.maree, row.effects, now) };
  });
  const last = row.chest_claimed_at ? new Date(row.chest_claimed_at) : null;
  const claimedToday = !!last && dayKey(last) === dayKey();
  const yesterday = dayKey(new Date(now - 86_400_000));
  const streakAlive = !!last && (claimedToday || dayKey(last) === yesterday);
  const nextDay = claimedToday ? row.chest_day : streakAlive && row.chest_day < CHEST_DAYS ? row.chest_day + 1 : 1;
  const offer = shopOffer();
  const pass = row.pass as PassState;
  const level = passLevel(pass.xp || 0);
  const dexCount = dex.length;

  return {
    balance: row.balance,
    runEarned: row.run_earned,
    lifetimeEarned: row.lifetime_earned,
    materials: row.materials || {},
    gear: row.gear || {},
    zone: row.zone,
    bestZone: Math.max(row.best_zone || 0, row.zone),
    xp: row.xp,
    level: levelFromXp(row.xp),
    maree: row.maree,
    perles: row.perles,
    tree: row.tree || {},
    bag,
    totalCaught: row.total_caught,
    dex: dex.map((d) => ({ speciesId: d.species_id, caught: d.caught, bestWeight: d.best_weight, variants: d.variants })),
    market: dailyMarket(),
    weather: weatherAt(now),
    shoal: shoalAt(now),
    effects: Object.fromEntries(Object.entries(row.effects || {}).filter(([, t]) => Number(t) > now)) as Effects,
    threshold: mareeThreshold(row.maree),
    perlesIfPrestige: perlesFor(row.maree, row.run_earned),
    autoInterval: autoInterval(row.gear, row.tree, row.effects, now),
    autoEfficiency: autoEfficiency(row.gear, row.tree),
    saleMultiplier: saleMultiplier(row.tree, row.maree, row.effects, now),
    missions: row.missions as MissionSet,
    missionRewards: { daily: missionReward(boat, false), weekly: missionReward(boat, true) },
    orders: row.orders.map((o) => ({ ...o, have: bagCount(row.bag, o.speciesId), reward: orderReward(row, o) })),
    chest: { day: row.chest_day, claimedToday, nextDay, reward: chestReward(nextDay, boat) },
    shop: {
      items: offer.items.map((it) => ({ ...it, cost: itemPrice(it, boat, it.id === offer.promo), promo: it.id === offer.promo, bought: row.shop_bought.includes(it.id) })),
      promoDiscount: PROMO_DISCOUNT,
      packPrice: packPrice(boat),
    },
    packs: row.packs || 0,
    cosmetics: row.cosmetics || [],
    equipped: row.equipped || {},
    weekPoints: row.week_points || 0,
    recap: row.last_week && row.recap_seen !== row.last_week.week ? row.last_week : null,
    pass: {
      month: pass.month, xp: pass.xp || 0, ...level, claimed: pass.claimed || [],
      tiers: Array.from({ length: PASS_TIERS }, (_, i) => ({ tier: i + 1, ...passReward(i + 1, boat) })),
    },
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, progress: Math.min(a.target, metricValue(row, dexCount, a.metric)), claimed: (row.achievements || []).includes(a.id) })),
  };
}

export type PecheState = ReturnType<typeof present>;

function bagCount(bag: Record<string, BagItem>, speciesId: string): number {
  return Object.entries(bag || {}).filter(([k]) => k.split('|')[0] === speciesId).reduce((s, [, v]) => s + v.n, 0);
}

function orderReward(row: Row, o: Order): number {
  const sp = getSpecies(o.speciesId);
  if (!sp) return 0;
  const typical = zoneBase(sp.zone) * (sp.rarity === 0 ? 1 : 3);
  return typical * o.count * ORDER_BONUS * saleMultiplier(row.tree, row.maree);
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

type Change<T> = Fail | { patch: Partial<Row>; result: T; dex?: DexAcc; shared?: Shared };

/** Read, refresh periods, change, write back if nobody else wrote in between. */
async function mutate<T>(userId: string, change: (row: Row) => Change<T>): Promise<Fail | { ok: true; result: T; state: PecheState }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const loaded = await loadRow(userId);
    if (!loaded) return fail(404, 'Joueur introuvable');
    const periods = fresh(loaded);
    const row = { ...loaded, ...periods } as Row;
    const out = change(row);
    if ('ok' in out) return out;

    const { data } = await supabase.from('peche_players')
      .update({ ...periods, ...out.patch, version: loaded.version + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('version', loaded.version)
      .select('*').maybeSingle();
    if (!data) continue;

    if (out.dex && out.dex.size) await writeDex(userId, out.dex);
    let saved = data as Row;
    if (out.shared) {
      const extra = await writeShared(saved, out.shared);
      if (extra) {
        const { data: again } = await supabase.from('peche_players')
          .update({ balance: saved.balance + extra, run_earned: saved.run_earned + extra, lifetime_earned: saved.lifetime_earned + extra, version: saved.version + 1 })
          .eq('user_id', userId).eq('version', saved.version).select('*').maybeSingle();
        if (again) {
          saved = again as Row;
          (out.result as Record<string, unknown>).jackpot = extra;
        }
      }
    }
    return { ok: true, result: out.result, state: present(saved, await loadDex(userId)) };
  }
  return fail(409, 'Trop de choses à la fois, réessaie.');
}

async function writeDex(userId: string, catches: DexAcc) {
  const ids = Array.from(catches.keys());
  const { data } = await supabase.from('peche_dex').select('species_id, caught, best_weight, variants').eq('user_id', userId).in('species_id', ids);
  const existing = new Map(((data as DexRow[]) || []).map((d) => [d.species_id, d]));
  const rows = ids.map((id) => {
    const add = catches.get(id)!;
    const prev = existing.get(id);
    const variants = new Set([...(prev?.variants || []), ...Array.from(add.variants)].filter(Boolean));
    return { user_id: userId, species_id: id, caught: (prev?.caught || 0) + add.n, best_weight: Math.max(prev?.best_weight || 0, add.w), variants: Array.from(variants) };
  });
  await supabase.from('peche_dex').upsert(rows, { onConflict: 'user_id,species_id' });
}

/** Boss damage, jackpot and feed. Returns coins won from the jackpot, if any. */
async function writeShared(row: Row, shared: Shared): Promise<number> {
  const pseudo = (await pseudosOf([row.user_id])).get(row.user_id) || 'Pêcheur';
  let won = 0;
  try {
    if (shared.bossDamage && shared.bossDamage > 0) {
      const boss = bossFor();
      await supabase.rpc('peche_boss_hit', { p_period: weekKey(), p_user: row.user_id, p_pseudo: pseudo, p_damage: shared.bossDamage, p_max: boss.maxHp });
    }
    if (shared.jackpotUnits && shared.jackpotUnits > 0) {
      await supabase.rpc('peche_jackpot_add', { p_units: shared.jackpotUnits });
    }
    if (shared.jackpotWin) {
      const { data } = await supabase.rpc('peche_jackpot_take', { p_winner: pseudo });
      won = Number(data || 0) * zoneBase(boatOf(row));
    }
    if (shared.feed?.length) {
      await supabase.from('peche_feed').insert(shared.feed.map((f, i) => ({
        user_id: row.user_id, pseudo, species_id: f.speciesId, rarity: f.rarity, variant: f.variant, weight: f.weight, zone: f.zone,
        jackpot: i === 0 && won > 0 ? won : null,
      })));
    }
  } catch (err) {
    console.error('Pêche, écriture partagée:', err);
  }
  return won;
}

function addMaterials(into: Materials, add: Materials): Materials {
  const out: Materials = { ...into };
  for (const [k, v] of Object.entries(add)) out[k as MaterialId] = (out[k as MaterialId] || 0) + (v || 0);
  return out;
}

function bump(missions: MissionSet, type: string, by: number): MissionSet {
  const up = (list: MissionSet['daily']) => list.map((m) => (m.type === type && !m.claimed ? { ...m, progress: Math.min(m.target, m.progress + by) } : m));
  return { ...missions, daily: up(missions.daily), weekly: up(missions.weekly) };
}

const addStat = (stats: Stats, key: keyof Stats, by = 1): Stats => ({ ...stats, [key]: Number(stats[key] || 0) + by });

interface Acc {
  bag: Record<string, BagItem>; materials: Materials; xp: number; caught: number; dex: DexAcc; missions: MissionSet;
  bestZone: number; stats: Stats; points: number; passXp: number; shared: Shared;
}

function startAcc(row: Row): Acc {
  const pass = row.pass as PassState;
  return {
    bag: { ...(row.bag || {}) }, materials: { ...(row.materials || {}) }, xp: row.xp, caught: row.total_caught,
    dex: new Map(), missions: row.missions as MissionSet, bestZone: Math.max(row.best_zone || 0, row.zone),
    stats: { ...(row.stats || {}) }, points: row.week_points || 0, passXp: pass.xp || 0, shared: { bossDamage: 0, feed: [] },
  };
}

function accPatch(row: Row, acc: Acc): Partial<Row> {
  const pass = row.pass as PassState;
  return {
    bag: acc.bag, materials: acc.materials, xp: acc.xp, total_caught: acc.caught, missions: acc.missions, best_zone: acc.bestZone,
    stats: acc.stats, week_points: acc.points, pass: { ...pass, xp: acc.passXp },
  };
}

/** Folds one landed fish into the accumulator: bag, XP, materials, missions, dex, points, boss, feed. */
function land(row: Row, c: Catch, value: number, acc: Acc, perfect: boolean) {
  const key = `${c.speciesId}|${c.variant}`;
  const item = acc.bag[key] || { n: 0, v: 0 };
  acc.bag[key] = { n: item.n + 1, v: item.v + value };
  const mats = rollMaterials(row.zone, c.rarity, row.tree);
  acc.materials = addMaterials(acc.materials, mats);
  acc.xp += xpForCatch(row.zone, c.rarity);
  acc.caught += 1;
  const d = acc.dex.get(c.speciesId) || { n: 0, w: 0, variants: new Set<string>() };
  d.n += 1; d.w = Math.max(d.w, c.weight); if (c.variant) d.variants.add(c.variant);
  acc.dex.set(c.speciesId, d);

  acc.missions = bump(acc.missions, 'catch', 1);
  if (c.rarity >= 1) acc.missions = bump(acc.missions, 'rare', 1);
  if (c.rarity >= 2) acc.missions = bump(acc.missions, 'epic', 1);
  if (perfect) { acc.missions = bump(acc.missions, 'perfect', 1); acc.stats = addStat(acc.stats, 'perfect'); }
  if (dailyMarket().deals.some((dl) => dl.speciesId === c.speciesId)) acc.missions = bump(acc.missions, 'market', 1);
  if (c.rarity === 3) acc.stats = addStat(acc.stats, 'legendary');
  if (c.rarity === 4) acc.stats = addStat(acc.stats, 'mythic');
  if (c.variant === 'chroma') acc.stats = addStat(acc.stats, 'chroma');
  if (c.variant === 'or') { acc.stats = addStat(acc.stats, 'or'); acc.shared.jackpotWin = true; }
  acc.stats = addStat(acc.stats, 'weekCaught');

  const points = catchPoints(c.rarity, c.variant);
  acc.points += points;
  acc.passXp += points;
  acc.shared.bossDamage = (acc.shared.bossDamage || 0) + points;
  if (c.rarity >= 3 || c.variant) acc.shared.feed!.push({ speciesId: c.speciesId, rarity: c.rarity, variant: c.variant, weight: c.weight, zone: row.zone });
  return mats;
}

function modsFor(row: Row, now = Date.now()): CatchMods {
  const mods = catchMods(row.effects, now);
  const shoal = shoalAt(now);
  return shoal.zone === row.zone ? { ...mods, value: mods.value * shoal.mult } : mods;
}

/* ------------------------------------------------------------------ */
/* Fishing                                                             */
/* ------------------------------------------------------------------ */

export function cast(userId: string) {
  return mutate(userId, (row) => {
    const pending = row.pending_cast;
    if (pending && Date.now() - pending.at < 1000) return fail(429, 'Doucement !');
    const c = rollCatch(row.zone, row.gear, row.tree, row.maree, modsFor(row));
    const id = randomUUID();
    return {
      patch: { pending_cast: { ...c, id, at: Date.now() } },
      result: { id, rarity: c.rarity, ...gaugeFor(c.rarity, row.gear, row.effects, Date.now(), c.variant) },
    };
  });
}

interface Landed {
  speciesId: string; rarity: number; weight: number; variant: Variant;
  quality: 'perfect' | 'good'; value: number; materials: Materials; jackpot?: number;
}

export function reel(userId: string, castId: string, quality: Quality) {
  return mutate<{ caught: Landed | null; jackpot?: number }>(userId, (row) => {
    const pending = row.pending_cast;
    if (!pending || pending.id !== castId) return fail(400, 'Plus rien au bout de la ligne.');
    if (Date.now() - pending.at < MIN_REEL_MS) return fail(400, 'Trop rapide pour être vrai.');
    if (quality === 'fail') return { patch: { pending_cast: null }, result: { caught: null } };

    const value = pending.value * QUALITY[quality];
    const acc = startAcc(row);
    const mats = land(row, pending, value, acc, quality === 'perfect');
    return {
      patch: { pending_cast: null, ...accPatch(row, acc) },
      dex: acc.dex,
      shared: acc.shared,
      result: { caught: { speciesId: pending.speciesId, rarity: pending.rarity, weight: pending.weight, variant: pending.variant, quality, value, materials: mats } },
    };
  });
}

export function autoFish(userId: string) {
  return mutate<{ catches: Catch[]; nextAt?: number; jackpot?: number }>(userId, (row) => {
    const now = Date.now();
    const interval = autoInterval(row.gear, row.tree, row.effects, now);
    if (!Number.isFinite(interval)) return fail(400, 'Il te faut une canne auto.');
    const last = row.last_auto_at ? new Date(row.last_auto_at).getTime() : 0;
    if (!last || now - last > AUTO_MAX_GAP_MS) {
      return { patch: { last_auto_at: new Date(now).toISOString() }, result: { catches: [], nextAt: now + interval * 1000 } };
    }
    // A little slack: a browser timer firing a few ms early must not skip a catch.
    const n = Math.min(AUTO_MAX_CATCHES_PER_CALL, Math.floor((now - last + 400) / (interval * 1000)));
    if (n <= 0) return { patch: {}, result: { catches: [], nextAt: last + interval * 1000 } };

    const eff = autoEfficiency(row.gear, row.tree);
    const mods = modsFor(row, now);
    const acc = startAcc(row);
    const catches: Catch[] = [];
    for (let i = 0; i < n; i++) {
      const c = rollCatch(row.zone, row.gear, row.tree, row.maree, mods);
      const value = c.value * eff;
      land(row, c, value, acc, false);
      catches.push({ ...c, value });
    }
    return {
      patch: { ...accPatch(row, acc), last_auto_at: new Date(last + n * interval * 1000).toISOString() },
      dex: acc.dex,
      shared: acc.shared,
      result: { catches, nextAt: last + (n + 1) * interval * 1000 },
    };
  });
}

export function sell(userId: string, key?: string) {
  return mutate(userId, (row) => {
    const bag = { ...(row.bag || {}) };
    const keys = key ? [key] : Object.keys(bag);
    const mult = saleMultiplier(row.tree, row.maree, row.effects);
    let earned = 0;
    for (const k of keys) {
      const item = bag[k];
      if (!item) continue;
      earned += item.v * marketMultiplier(k.split('|')[0]) * mult;
      delete bag[k];
    }
    if (earned <= 0) return fail(400, 'Ta bourriche est vide.');
    return {
      patch: {
        bag, balance: row.balance + earned, run_earned: row.run_earned + earned, lifetime_earned: row.lifetime_earned + earned,
        missions: bump(row.missions as MissionSet, 'sell', earned),
      },
      shared: { jackpotUnits: (earned / zoneBase(boatOf(row))) * JACKPOT_RATE },
      result: { earned },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export function upgrade(userId: string, gear: GearId) {
  return mutate(userId, (row) => {
    if (!['canne', 'moulinet', 'hamecon', 'bateau', 'auto'].includes(gear)) return fail(400, 'Matériel inconnu.');
    const level = lvl(row.gear, gear);
    if (level >= maxGearLevel(gear)) return fail(400, 'Déjà au maximum.');
    const cost = gearCost(gear, level);
    if (row.balance < cost.coins) return fail(400, 'Pas assez de ₶.');
    const materials = { ...(row.materials || {}) };
    for (const [m, q] of Object.entries(cost.mats)) {
      if ((materials[m as MaterialId] || 0) < (q || 0)) return fail(400, 'Pas assez de matériaux.');
      materials[m as MaterialId] = (materials[m as MaterialId] || 0) - (q || 0);
    }
    return { patch: { balance: row.balance - cost.coins, materials, gear: { ...row.gear, [gear]: level + 1 } }, result: { level: level + 1 } };
  });
}

export function travel(userId: string, zone: number) {
  return mutate(userId, (row) => {
    if (!Number.isInteger(zone) || zone < 0) return fail(400, 'Coin inconnu.');
    if (zone > boatOf(row)) return fail(400, 'Améliore ton bateau pour y aller.');
    return { patch: { zone, pending_cast: null, best_zone: Math.max(row.best_zone || 0, zone) }, result: { zone } };
  });
}

export function prestige(userId: string) {
  return mutate(userId, (row) => {
    const gain = perlesFor(row.maree, row.run_earned);
    if (gain <= 0) return fail(400, 'Pas encore assez gagné pour la Grande Marée.');
    const depart = lvl(row.tree, 'depart');
    return {
      patch: {
        balance: 0, run_earned: 0, materials: {}, bag: {}, pending_cast: null, last_auto_at: null,
        gear: depart > 0 ? { bateau: depart } : {}, zone: 0, orders: [],
        maree: row.maree + 1, perles: row.perles + gain,
      },
      result: { perles: gain, maree: row.maree + 1 },
    };
  });
}

export function buyTree(userId: string, node: TreeId) {
  return mutate(userId, (row) => {
    if (!(node in TREE)) return fail(400, 'Bonus inconnu.');
    const level = lvl(row.tree, node);
    const max = TREE[node].max;
    if (max !== undefined && level >= max) return fail(400, 'Déjà au maximum.');
    const cost = treeCost(node, level);
    if (row.perles < cost) return fail(400, 'Pas assez de Perles de marée.');
    const tree = { ...row.tree, [node]: level + 1 };
    const gear = node === 'depart' && lvl(row.gear, 'bateau') < level + 1 ? { ...row.gear, bateau: level + 1 } : row.gear;
    return { patch: { perles: row.perles - cost, tree, gear }, result: { level: level + 1 } };
  });
}

/* ------------------------------------------------------------------ */
/* Daily chest, missions, orders                                       */
/* ------------------------------------------------------------------ */

export function claimChest(userId: string) {
  return mutate(userId, (row) => {
    const now = new Date();
    const last = row.chest_claimed_at ? new Date(row.chest_claimed_at) : null;
    if (last && dayKey(last) === dayKey(now)) return fail(400, 'Coffre déjà ouvert aujourd’hui.');
    const continues = !!last && dayKey(last) === dayKey(new Date(now.getTime() - 86_400_000));
    const day = continues && row.chest_day < CHEST_DAYS ? row.chest_day + 1 : 1;
    const reward = chestReward(day, boatOf(row));
    return {
      patch: {
        chest_day: day, chest_claimed_at: now.toISOString(),
        balance: row.balance + reward.coins, run_earned: row.run_earned + reward.coins, lifetime_earned: row.lifetime_earned + reward.coins,
        packs: (row.packs || 0) + reward.packs,
      },
      result: { day, ...reward },
    };
  });
}

export function claimMission(userId: string, scope: 'daily' | 'weekly', index: number) {
  return mutate(userId, (row) => {
    const set = row.missions as MissionSet;
    const list = scope === 'weekly' ? set.weekly : set.daily;
    const m = list?.[index];
    if (!m) return fail(404, 'Mission introuvable.');
    if (m.claimed) return fail(400, 'Déjà réclamée.');
    if (m.progress < m.target) return fail(400, 'Pas encore terminée.');
    const reward = missionReward(boatOf(row), scope === 'weekly');
    const updated = list.map((x, i) => (i === index ? { ...x, claimed: true } : x));
    return {
      patch: {
        missions: { ...set, [scope]: updated },
        balance: row.balance + reward.coins, run_earned: row.run_earned + reward.coins, lifetime_earned: row.lifetime_earned + reward.coins,
        packs: (row.packs || 0) + reward.packs,
        stats: addStat(row.stats || {}, 'missions'),
      },
      result: reward,
    };
  });
}

export function deliverOrder(userId: string, orderId: string) {
  return mutate(userId, (row) => {
    const order = row.orders.find((o) => o.id === orderId);
    if (!order) return fail(404, 'Commande introuvable.');
    if (bagCount(row.bag, order.speciesId) < order.count) return fail(400, 'Il te manque des poissons.');
    const bag = { ...row.bag };
    let left = order.count;
    const keys = Object.keys(bag).filter((k) => k.split('|')[0] === order.speciesId).sort((a, b) => (bag[a].v / bag[a].n) - (bag[b].v / bag[b].n));
    for (const k of keys) {
      if (left <= 0) break;
      const item = bag[k];
      const take = Math.min(left, item.n);
      const each = item.v / item.n;
      if (take === item.n) delete bag[k]; else bag[k] = { n: item.n - take, v: item.v - each * take };
      left -= take;
    }
    const reward = orderReward(row, order);
    const orders = row.orders.filter((o) => o.id !== orderId).concat(newOrder(boatOf(row)));
    return {
      patch: {
        bag, orders,
        balance: row.balance + reward, run_earned: row.run_earned + reward, lifetime_earned: row.lifetime_earned + reward,
        missions: bump(row.missions as MissionSet, 'orders', 1),
        stats: addStat(row.stats || {}, 'orders'),
      },
      result: { reward },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Shop and cosmetics                                                  */
/* ------------------------------------------------------------------ */

export function buyItem(userId: string, itemId: string) {
  return mutate(userId, (row) => {
    const offer = shopOffer();
    const item = offer.items.find((i) => i.id === itemId) || null;
    if (!item || !SHOP_ITEMS.some((i) => i.id === itemId)) return fail(400, 'Pas en boutique aujourd’hui.');
    if (row.shop_bought.includes(itemId)) return fail(400, 'Déjà acheté aujourd’hui.');
    const cost = itemPrice(item, boatOf(row), offer.promo === itemId);
    if (row.balance < cost) return fail(400, 'Pas assez de ₶.');
    const patch: Partial<Row> = { balance: row.balance - cost, shop_bought: [...row.shop_bought, itemId] };
    if (item.effect && item.minutes) {
      const now = Date.now();
      const current = Math.max(now, Number(row.effects?.[item.effect] || 0));
      patch.effects = { ...row.effects, [item.effect]: current + item.minutes * 60_000 };
    }
    if (item.materials) {
      const q = Math.ceil(20 + Math.min(boatOf(row), 60) * 4);
      patch.materials = addMaterials(row.materials, { fil: q, bois: q, metal: Math.ceil(q / 2), ecaille: 2 });
    }
    return { patch, result: { item: itemId, cost } };
  });
}

export function buyPack(userId: string) {
  return mutate(userId, (row) => {
    const cost = packPrice(boatOf(row));
    if (row.balance < cost) return fail(400, 'Pas assez de ₶.');
    return { patch: { balance: row.balance - cost, packs: (row.packs || 0) + 1 }, result: { cost } };
  });
}

/** Opens up to 20 chests at once; the rarity decides how many padlocks hold. */
export function openPack(userId: string, count = 1) {
  return mutate(userId, (row) => {
    if ((row.packs || 0) <= 0) return fail(400, 'Aucun coffre à ouvrir.');
    const n = Math.max(1, Math.min(20, Math.floor(count) || 1, row.packs || 0));
    const owned = new Set(row.cosmetics || []);
    const refundEach = Math.ceil(packPrice(boatOf(row)) / 3);
    let refund = 0;
    const chests = [];
    for (let i = 0; i < n; i++) {
      const cosmetic = rollCosmetic();
      const duplicate = owned.has(cosmetic.id);
      if (duplicate) refund += refundEach; else owned.add(cosmetic.id);
      chests.push({ cosmeticId: cosmetic.id, rarity: cosmetic.rarity, duplicate, refund: duplicate ? refundEach : 0 });
    }
    return {
      patch: {
        packs: row.packs - n, cosmetics: Array.from(owned),
        balance: row.balance + refund, run_earned: row.run_earned + refund, lifetime_earned: row.lifetime_earned + refund,
        stats: addStat(row.stats || {}, 'chests', n),
      },
      result: { chests },
    };
  });
}

export function equip(userId: string, slot: CosmeticSlot, cosmeticId: string | null) {
  return mutate(userId, (row) => {
    if (!(slot in COSMETIC_SLOTS)) return fail(400, 'Emplacement inconnu.');
    if (cosmeticId) {
      const c = COSMETIC_BY_ID.get(cosmeticId);
      if (!c || c.slot !== slot) return fail(400, 'Cosmétique inconnu.');
      if (!(row.cosmetics || []).includes(cosmeticId)) return fail(400, 'Tu ne l’as pas encore.');
    }
    const equipped = { ...(row.equipped || {}) };
    if (cosmeticId) equipped[slot] = cosmeticId; else delete equipped[slot];
    return { patch: { equipped }, result: { slot, cosmeticId } };
  });
}

/* ------------------------------------------------------------------ */
/* V3: achievements, pass, recap, weekly boss                          */
/* ------------------------------------------------------------------ */

export async function claimAchievement(userId: string, id: string) {
  const dex = await loadDex(userId);
  return mutate(userId, (row) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return fail(404, 'Succès inconnu.');
    if ((row.achievements || []).includes(id)) return fail(400, 'Déjà réclamé.');
    if (metricValue(row, dex.length, a.metric) < a.target) return fail(400, 'Pas encore débloqué.');
    return {
      patch: { achievements: [...(row.achievements || []), id], perles: row.perles + a.perles, packs: (row.packs || 0) + a.packs },
      result: { perles: a.perles, packs: a.packs },
    };
  });
}

export function claimPassTier(userId: string, tier: number) {
  return mutate(userId, (row) => {
    const pass = row.pass as PassState;
    if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) return fail(400, 'Palier inconnu.');
    if ((pass.claimed || []).includes(tier)) return fail(400, 'Déjà réclamé.');
    if (passLevel(pass.xp || 0).tier < tier) return fail(400, 'Palier pas encore atteint.');
    const reward = passReward(tier, boatOf(row));
    return {
      patch: {
        pass: { ...pass, claimed: [...(pass.claimed || []), tier] },
        balance: row.balance + reward.coins, run_earned: row.run_earned + reward.coins, lifetime_earned: row.lifetime_earned + reward.coins,
        packs: (row.packs || 0) + reward.packs, perles: row.perles + reward.perles,
      },
      result: reward,
    };
  });
}

export function seeRecap(userId: string) {
  return mutate(userId, (row) => ({ patch: { recap_seen: row.last_week?.week || null }, result: { ok: true } }));
}

export async function claimBoss(userId: string) {
  const week = weekKey();
  const [{ data: boss }, { data: mine }] = await Promise.all([
    supabase.from('peche_boss').select('*').eq('period', week).maybeSingle(),
    supabase.from('peche_boss_contrib').select('*').eq('period', week).eq('user_id', userId).maybeSingle(),
  ]);
  if (!boss?.defeated_at) return fail(400, 'Le monstre de la semaine n’est pas encore vaincu.');
  if (!mine || Number(mine.damage) <= 0) return fail(400, 'Tu n’as pas participé cette semaine.');
  if (mine.claimed) return fail(400, 'Déjà réclamé.');
  const { data: locked } = await supabase.from('peche_boss_contrib').update({ claimed: true })
    .eq('period', week).eq('user_id', userId).eq('claimed', false).select().maybeSingle();
  if (!locked) return fail(400, 'Déjà réclamé.');
  return mutate(userId, (row) => {
    const reward = bossReward(boatOf(row));
    return {
      patch: {
        balance: row.balance + reward.coins, run_earned: row.run_earned + reward.coins, lifetime_earned: row.lifetime_earned + reward.coins,
        packs: (row.packs || 0) + reward.packs, perles: row.perles + reward.perles,
      },
      result: reward,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Community views (read-only)                                         */
/* ------------------------------------------------------------------ */

export async function communityFor(userId: string) {
  const week = weekKey();
  const boss = bossFor(week);
  const [weekly, marees, feed, bossRow, contrib, jackpot, mine] = await Promise.all([
    supabase.from('peche_players').select('user_id, week_points, maree').eq('week_key', week).gt('week_points', 0).order('week_points', { ascending: false }).limit(20),
    supabase.from('peche_players').select('user_id, maree, lifetime_earned').order('maree', { ascending: false }).order('lifetime_earned', { ascending: false }).limit(20),
    supabase.from('peche_feed').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('peche_boss').select('*').eq('period', week).maybeSingle(),
    supabase.from('peche_boss_contrib').select('user_id, pseudo, damage').eq('period', week).order('damage', { ascending: false }).limit(10),
    supabase.from('peche_jackpot').select('*').eq('id', 1).maybeSingle(),
    supabase.from('peche_boss_contrib').select('damage, claimed').eq('period', week).eq('user_id', userId).maybeSingle(),
  ]);
  const ids = Array.from(new Set([...(weekly.data || []).map((r) => r.user_id), ...(marees.data || []).map((r) => r.user_id)]));
  const names = await pseudosOf(ids);
  const row = await loadRow(userId);
  const boat = row ? boatOf(row) : 0;

  return {
    weekly: (weekly.data || []).map((r) => ({ userId: r.user_id, pseudo: names.get(r.user_id) || '?', points: Number(r.week_points), maree: r.maree })),
    marees: (marees.data || []).map((r) => ({ userId: r.user_id, pseudo: names.get(r.user_id) || '?', maree: r.maree, earned: Number(r.lifetime_earned) })),
    feed: (feed.data || []).map((f) => ({ id: f.id, pseudo: f.pseudo, userId: f.user_id, speciesId: f.species_id, rarity: f.rarity, variant: f.variant, weight: Number(f.weight), jackpot: f.jackpot ? Number(f.jackpot) : null, at: f.created_at })),
    boss: {
      name: boss.name, maxHp: Number(bossRow.data?.max_hp || boss.maxHp), damage: Number(bossRow.data?.damage || 0), defeated: !!bossRow.data?.defeated_at,
      top: (contrib.data || []).map((c) => ({ pseudo: c.pseudo, damage: Number(c.damage) })),
      mine: { damage: Number(mine.data?.damage || 0), claimed: !!mine.data?.claimed },
      reward: bossReward(boat),
    },
    jackpot: {
      value: Number(jackpot.data?.units || 0) * zoneBase(boat),
      lastWinner: jackpot.data?.last_winner || null,
      lastAmount: jackpot.data?.last_amount ? Number(jackpot.data.last_amount) * zoneBase(boat) : null,
      lastAt: jackpot.data?.last_at || null,
    },
  };
}

/** A player's public card: progress, equipped look and their aquarium of best catches. */
export async function playerCard(targetId: string) {
  const [{ data: row }, dex, names] = await Promise.all([
    supabase.from('peche_players').select('maree, xp, total_caught, lifetime_earned, best_zone, zone, equipped, week_points, achievements').eq('user_id', targetId).maybeSingle(),
    loadDex(targetId),
    pseudosOf([targetId]),
  ]);
  if (!row) return null;
  const aquarium = dex
    .map((d) => ({ d, sp: getSpecies(d.species_id) }))
    .filter((x) => x.sp)
    .sort((a, b) => b.sp!.rarity - a.sp!.rarity || b.d.best_weight - a.d.best_weight)
    .slice(0, 8)
    .map(({ d }) => ({ speciesId: d.species_id, bestWeight: d.best_weight, variants: d.variants }));
  return {
    pseudo: names.get(targetId) || '?',
    maree: row.maree, level: levelFromXp(Number(row.xp)).level, totalCaught: Number(row.total_caught),
    earned: Number(row.lifetime_earned), bestZone: Math.max(row.best_zone || 0, row.zone || 0),
    species: dex.length, speciesTotal: SPECIES.length, weekPoints: Number(row.week_points || 0),
    achievements: (row.achievements || []).length, equipped: row.equipped || {}, aquarium,
  };
}
