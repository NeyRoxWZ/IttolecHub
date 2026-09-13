import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase/server';
import { SPECIES_BY_ID, TREE, ZONES, type GearId, type MaterialId, type TreeId, type Variant } from './data';
import {
  AUTO_MAX_CATCHES_PER_CALL, AUTO_MAX_GAP_MS, MIN_REEL_MS, QUALITY,
  autoEfficiency, autoInterval, dailyMarket, gaugeFor, gearCost, levelFromXp, lvl,
  mareeThreshold, marketMultiplier, maxGearLevel, perlesFor, rollCatch, rollMaterials,
  saleMultiplier, treeCost, xpForCatch,
  type Catch, type GearLevels, type Materials, type Quality, type TreeLevels,
} from './engine';

/**
 * Frenly Pêche — server side. The server draws every catch and holds the only
 * copy of the player's state; the browser only plays the reeling gauge.
 *
 * Writes go through a version check: two requests landing together (the auto
 * rod and a manual catch) must not overwrite each other.
 */

interface BagItem { n: number; v: number }

interface PendingCast extends Catch { id: string; at: number }

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
}

interface DexRow { species_id: string; caught: number; best_weight: number; variants: string[] }

type Fail = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Fail => ({ ok: false, status, error });

async function loadRow(userId: string): Promise<Row | null> {
  const { data } = await supabase.from('peche_players').select('*').eq('user_id', userId).maybeSingle();
  if (data) return data as Row;
  const { data: created, error } = await supabase.from('peche_players').insert({ user_id: userId }).select('*').maybeSingle();
  if (error) {
    // Two first visits at once: the other insert won, read it back.
    const { data: again } = await supabase.from('peche_players').select('*').eq('user_id', userId).maybeSingle();
    return (again as Row) || null;
  }
  return created as Row;
}

async function loadDex(userId: string): Promise<DexRow[]> {
  const { data } = await supabase.from('peche_dex').select('species_id, caught, best_weight, variants').eq('user_id', userId);
  return (data as DexRow[]) || [];
}

export async function stateFor(userId: string) {
  const row = await loadRow(userId);
  if (!row) return null;
  return present(row, await loadDex(userId));
}

function present(row: Row, dex: DexRow[]) {
  const bag = Object.entries(row.bag || {}).map(([key, item]) => {
    const [speciesId, variant = ''] = key.split('|');
    return { key, speciesId, variant: variant as Variant, count: item.n, value: item.v, price: item.v * marketMultiplier(speciesId) * saleMultiplier(row.tree, row.maree) };
  });
  return {
    balance: row.balance,
    runEarned: row.run_earned,
    lifetimeEarned: row.lifetime_earned,
    materials: row.materials || {},
    gear: row.gear || {},
    zone: row.zone,
    xp: row.xp,
    level: levelFromXp(row.xp),
    maree: row.maree,
    perles: row.perles,
    tree: row.tree || {},
    bag,
    totalCaught: row.total_caught,
    dex: dex.map((d) => ({ speciesId: d.species_id, caught: d.caught, bestWeight: d.best_weight, variants: d.variants })),
    market: dailyMarket(),
    threshold: mareeThreshold(row.maree),
    perlesIfPrestige: perlesFor(row.maree, row.run_earned),
    autoInterval: autoInterval(row.gear, row.tree),
    autoEfficiency: autoEfficiency(row.gear, row.tree),
    saleMultiplier: saleMultiplier(row.tree, row.maree),
  };
}

export type PecheState = ReturnType<typeof present>;

/** Read, change, write back if nobody else wrote in between; a few retries. */
async function mutate<T>(
  userId: string,
  change: (row: Row) => Fail | { patch: Partial<Row>; result: T; dex?: Map<string, { n: number; w: number; variants: Set<string> }> },
): Promise<Fail | { ok: true; result: T; state: PecheState }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await loadRow(userId);
    if (!row) return fail(404, 'Joueur introuvable');
    const out = change(row);
    if ('ok' in out) return out;

    const { data } = await supabase.from('peche_players')
      .update({ ...out.patch, version: row.version + 1, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('version', row.version)
      .select('*').maybeSingle();
    if (!data) continue;

    if (out.dex && out.dex.size) await writeDex(userId, out.dex);
    return { ok: true, result: out.result, state: present(data as Row, await loadDex(userId)) };
  }
  return fail(409, 'Trop de choses à la fois, réessaie.');
}

async function writeDex(userId: string, catches: Map<string, { n: number; w: number; variants: Set<string> }>) {
  const ids = Array.from(catches.keys());
  const { data } = await supabase.from('peche_dex').select('species_id, caught, best_weight, variants').eq('user_id', userId).in('species_id', ids);
  const existing = new Map(((data as DexRow[]) || []).map((d) => [d.species_id, d]));
  const rows = ids.map((id) => {
    const add = catches.get(id)!;
    const prev = existing.get(id);
    const variants = new Set([...(prev?.variants || []), ...Array.from(add.variants)].filter(Boolean));
    return {
      user_id: userId, species_id: id,
      caught: (prev?.caught || 0) + add.n,
      best_weight: Math.max(prev?.best_weight || 0, add.w),
      variants: Array.from(variants),
    };
  });
  await supabase.from('peche_dex').upsert(rows, { onConflict: 'user_id,species_id' });
}

function addMaterials(into: Materials, add: Materials): Materials {
  const out: Materials = { ...into };
  for (const [k, v] of Object.entries(add)) out[k as MaterialId] = (out[k as MaterialId] || 0) + (v || 0);
  return out;
}

/** Folds one landed fish into the row: bag, XP, materials, count, dex. */
function land(
  row: Row, c: Catch, value: number,
  acc: { bag: Record<string, BagItem>; materials: Materials; xp: number; caught: number; dex: Map<string, { n: number; w: number; variants: Set<string> }> },
) {
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
  return mats;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export function cast(userId: string) {
  return mutate(userId, (row) => {
    const pending = row.pending_cast;
    if (pending && Date.now() - pending.at < 1000) return fail(429, 'Doucement !');
    const c = rollCatch(row.zone, row.gear, row.tree, row.maree);
    const id = randomUUID();
    return {
      patch: { pending_cast: { ...c, id, at: Date.now() } },
      // The fish stays secret until it is landed: only how hard it fights.
      result: { id, rarity: c.rarity, ...gaugeFor(c.rarity, row.gear) },
    };
  });
}

interface Landed {
  speciesId: string; rarity: number; weight: number; variant: Variant;
  quality: 'perfect' | 'good'; value: number; materials: Materials;
}

export function reel(userId: string, castId: string, quality: Quality) {
  return mutate<{ caught: Landed | null }>(userId, (row) => {
    const pending = row.pending_cast;
    if (!pending || pending.id !== castId) return fail(400, 'Plus rien au bout de la ligne.');
    if (Date.now() - pending.at < MIN_REEL_MS) return fail(400, 'Trop rapide pour être vrai.');

    if (quality === 'fail') {
      return { patch: { pending_cast: null }, result: { caught: null } };
    }

    const value = pending.value * QUALITY[quality];
    const acc = { bag: { ...(row.bag || {}) }, materials: { ...(row.materials || {}) }, xp: row.xp, caught: row.total_caught, dex: new Map() };
    const mats = land(row, pending, value, acc);
    return {
      patch: { pending_cast: null, bag: acc.bag, materials: acc.materials, xp: acc.xp, total_caught: acc.caught },
      dex: acc.dex,
      result: {
        caught: {
          speciesId: pending.speciesId, rarity: pending.rarity, weight: pending.weight, variant: pending.variant,
          quality, value, materials: mats,
        },
      },
    };
  });
}

export function autoFish(userId: string) {
  return mutate(userId, (row) => {
    const interval = autoInterval(row.gear, row.tree);
    if (!Number.isFinite(interval)) return fail(400, 'Il te faut une canne auto.');
    const now = Date.now();
    const last = row.last_auto_at ? new Date(row.last_auto_at).getTime() : 0;
    if (!last || now - last > AUTO_MAX_GAP_MS) {
      // First tick, or back after a long absence: start counting from now.
      return { patch: { last_auto_at: new Date(now).toISOString() }, result: { catches: [] as unknown[] } };
    }
    const n = Math.min(AUTO_MAX_CATCHES_PER_CALL, Math.floor((now - last) / (interval * 1000)));
    if (n <= 0) return { patch: {}, result: { catches: [] as unknown[] } };

    const eff = autoEfficiency(row.gear, row.tree);
    const acc = { bag: { ...(row.bag || {}) }, materials: { ...(row.materials || {}) }, xp: row.xp, caught: row.total_caught, dex: new Map() };
    const catches = [];
    for (let i = 0; i < n; i++) {
      const c = rollCatch(row.zone, row.gear, row.tree, row.maree);
      const value = c.value * eff;
      land(row, c, value, acc);
      catches.push({ speciesId: c.speciesId, rarity: c.rarity, weight: c.weight, variant: c.variant, value });
    }
    return {
      patch: {
        bag: acc.bag, materials: acc.materials, xp: acc.xp, total_caught: acc.caught,
        last_auto_at: new Date(last + n * interval * 1000).toISOString(),
      },
      dex: acc.dex,
      result: { catches },
    };
  });
}

export function sell(userId: string, key?: string) {
  return mutate(userId, (row) => {
    const bag = { ...(row.bag || {}) };
    const keys = key ? [key] : Object.keys(bag);
    const mult = saleMultiplier(row.tree, row.maree);
    let earned = 0;
    for (const k of keys) {
      const item = bag[k];
      if (!item) continue;
      earned += item.v * marketMultiplier(k.split('|')[0]) * mult;
      delete bag[k];
    }
    if (earned <= 0) return fail(400, 'Ta bourriche est vide.');
    return {
      patch: { bag, balance: row.balance + earned, run_earned: row.run_earned + earned, lifetime_earned: row.lifetime_earned + earned },
      result: { earned },
    };
  });
}

export function upgrade(userId: string, gear: GearId) {
  return mutate(userId, (row) => {
    const level = lvl(row.gear, gear);
    if (level >= maxGearLevel(gear)) return fail(400, 'Déjà au maximum.');
    const cost = gearCost(gear, level);
    if (row.balance < cost.coins) return fail(400, 'Pas assez de ₶.');
    const materials = { ...(row.materials || {}) };
    for (const [m, q] of Object.entries(cost.mats)) {
      if ((materials[m as MaterialId] || 0) < (q || 0)) return fail(400, 'Pas assez de matériaux.');
      materials[m as MaterialId] = (materials[m as MaterialId] || 0) - (q || 0);
    }
    return {
      patch: { balance: row.balance - cost.coins, materials, gear: { ...row.gear, [gear]: level + 1 } },
      result: { level: level + 1 },
    };
  });
}

export function travel(userId: string, zone: number) {
  return mutate(userId, (row) => {
    if (!Number.isInteger(zone) || zone < 0 || zone >= ZONES.length) return fail(400, 'Coin inconnu.');
    if (zone > lvl(row.gear, 'bateau')) return fail(400, 'Améliore ton bateau pour y aller.');
    return { patch: { zone, pending_cast: null }, result: { zone } };
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
        gear: depart > 0 ? { bateau: depart } : {},
        zone: 0,
        maree: row.maree + 1,
        perles: row.perles + gain,
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
    // "Bon départ" also lifts the current boat if it is below the new floor.
    const gear = node === 'depart' && lvl(row.gear, 'bateau') < level + 1 ? { ...row.gear, bateau: level + 1 } : row.gear;
    return { patch: { perles: row.perles - cost, tree, gear }, result: { level: level + 1 } };
  });
}

export function speciesKnown(id: string) {
  return SPECIES_BY_ID.has(id);
}
