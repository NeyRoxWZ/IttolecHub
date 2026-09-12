import { ASSETS, ASSET_BY_ID, KRASH_TICK, MARKETS, SECTORS, type Asset, type MarketId, type Sector } from './assets';
import {
  ARCS, COUNTRIES, TEMPLATES,
  type Arc, type ArcNode, type Certainty, type Country, type Headline, type NewsCategory, type Target,
} from './newsBook';

/**
 * The Krash market.
 *
 * Every price and every headline is a pure function of the clock and a secret
 * seed. That gives the three properties the game needs without a server
 * running in a loop (the hosting plan does not allow one):
 *
 *   - the market is the same for everyone, to the second;
 *   - any past moment can be recomputed, so a leveraged position left open
 *     overnight is liquidated at exactly the price that broke it;
 *   - nothing is stored, so nothing drifts.
 *
 * The seed is what keeps it fair: with it, anyone could compute tomorrow's
 * prices. It never leaves the server, and the API only ever answers for
 * moments that have already happened.
 *
 * A price is its anchor, plus smooth noise at several time scales (seconds to
 * hours — bounded, so it always drifts back), plus the lingering effect of
 * recent news. A headline moves the price a little before it is published
 * (the market smells it), most of the way within seconds after, and the effect
 * fades over the following half hour.
 */

const SEED = process.env.KRASH_SEED || 'krash-dev-seed';

/** Prices change every TICK seconds. */
export const TICK = KRASH_TICK;
/** A headline can appear once per SLOT seconds. */
export const SLOT = 75;
/** Each storyline owns this many slots. */
const ARC_SLOTS = 24;
const EPOCH = Date.UTC(2026, 8, 1) / 1000;

/** Chance that a slot with no storyline in it carries a standalone headline. */
const STANDALONE_RATE = 0.72;

const PRE_MOVE = 30;
const PRE_SHARE = 0.55;
const POST_TAU = 10;
const FADE_START = 900;
const FADE_TAU = 1500;
const EFFECT_LIFETIME = FADE_START + FADE_TAU * 4;

const OCTAVES = [
  { period: 14, amp: 0.1 },
  { period: 80, amp: 0.22 },
  { period: 600, amp: 0.35 },
  { period: 3600, amp: 0.5 },
  { period: 21600, amp: 0.7 },
];

/* ------------------------------------------------------------------ */
/* Randomness                                                           */
/* ------------------------------------------------------------------ */

function fnv(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SEED_INT = fnv(SEED);

/** A uniform number in [0, 1) fixed by three integers and the seed. */
function mix(a: number, b: number, c: number): number {
  let h = SEED_INT ^ Math.imul(a | 0, 0x9e3779b1);
  h = Math.imul(h ^ ((b | 0) + 0x7f4a7c15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ Math.imul(c | 0, 0xc2b2ae35), 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x165667b1);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(key: number, octave: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const r0 = mix(key, i, octave) * 2 - 1;
  const r1 = mix(key, i + 1, octave) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return r0 + (r1 - r0) * u;
}

function noise(key: number, t: number): number {
  let sum = 0;
  for (let o = 0; o < OCTAVES.length; o++) {
    sum += OCTAVES[o].amp * valueNoise(key, o + 1, t / OCTAVES[o].period);
  }
  return sum;
}

const permCache = new Map<string, number[]>();

function permutation(n: number, salt: number, epoch: number): number[] {
  const key = `${n}:${salt}:${epoch}`;
  let perm = permCache.get(key);
  if (!perm) {
    perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(mix(salt, epoch, i) * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    if (permCache.size > 2000) permCache.clear();
    permCache.set(key, perm);
  }
  return perm;
}

/**
 * The counter-th pick from n items, each used once per round of n and never
 * twice in a row across rounds — how headlines avoid repeating.
 */
function pickCycling(counter: number, n: number, salt: number): number {
  const epoch = Math.floor(counter / n);
  const pos = counter - epoch * n;
  const perm = permutation(n, salt, epoch);
  if (epoch > 0 && n > 1 && pos < 2) {
    const last = permutation(n, salt, epoch - 1)[n - 1];
    if (perm[0] === last) return perm[pos === 0 ? 1 : 0];
  }
  return perm[pos];
}

/* ------------------------------------------------------------------ */
/* Headlines                                                            */
/* ------------------------------------------------------------------ */

export interface NewsHint {
  label: string;
  /** Chance the target goes up, as published. */
  up: number;
  markets: MarketId[];
}

export interface NewsEvent {
  id: string;
  at: number;
  category: NewsCategory;
  certainty: Certainty;
  text: string;
  hints: NewsHint[];
  /** Markets it touches, for highlighting. Effects themselves stay server-side. */
  markets: MarketId[];
  arc?: string;
  chapter?: number;
}

interface ResolvedNews extends NewsEvent {
  effects: Map<string, number>;
}

const ASSET_INDEX = new Map(ASSETS.map((a, i) => [a.id, i + 1]));
const FRX_ASSETS = ASSETS.filter((a) => a.market === 'frx');

function companyFor(key: number, sectors?: Sector[]): Asset {
  const pool = sectors?.length ? FRX_ASSETS.filter((a) => sectors.includes(a.sector)) : FRX_ASSETS;
  return pool[Math.floor(mix(key, 3, 53) * pool.length)];
}

interface ArcChapter { slot: number; node: ArcNode; depth: number }

const arcCache = new Map<number, { arc: Arc; chapters: ArcChapter[] }>();

function arcPlan(a: number): { arc: Arc; chapters: ArcChapter[] } {
  const cached = arcCache.get(a);
  if (cached) return cached;

  const arc = ARCS[pickCycling(a, ARCS.length, 7)];
  const end = (a + 1) * ARC_SLOTS - 1;
  const chapters: ArcChapter[] = [];
  let slot = a * ARC_SLOTS + Math.floor(mix(a, 1, 11) * 3);
  let node: ArcNode | undefined = arc.root;
  let depth = 0;

  while (node && slot < end) {
    chapters.push({ slot, node, depth });
    if (!node.next?.length) break;
    let roll = mix(a, depth, 13) * node.next.reduce((s, b) => s + b.weight, 0);
    let chosen: ArcNode = node.next[node.next.length - 1].node;
    for (const branch of node.next) {
      roll -= branch.weight;
      if (roll < 0) { chosen = branch.node; break; }
    }
    slot += 3 + Math.floor(mix(a, depth, 17) * 3);
    node = chosen;
    depth += 1;
  }

  const plan = { arc, chapters };
  if (arcCache.size > 5000) arcCache.clear();
  arcCache.set(a, plan);
  return plan;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function targetAssets(target: Target, company: Asset | null): Asset[] {
  if (target.asset) {
    const asset = target.asset === '{E}' ? company : ASSET_BY_ID.get(target.asset);
    return asset ? [asset] : [];
  }
  if (target.sector) return ASSETS.filter((a) => a.sector === target.sector);
  if (target.market) return ASSETS.filter((a) => a.market === target.market);
  return [];
}

function targetLabel(target: Target, company: Asset | null): string {
  if (target.asset) return (target.asset === '{E}' ? company?.name : ASSET_BY_ID.get(target.asset)?.name) ?? '?';
  if (target.sector) return SECTORS[target.sector].label;
  if (target.market) return MARKETS[target.market].label;
  return '?';
}

function resolveHeadline(
  slot: number, headline: Headline,
  ctx: { company: Asset | null; country: Country | null; number: number | null; arc?: string; chapter?: number },
): ResolvedNews {
  const { company, country, number } = ctx;
  const text = capitalize(
    headline.text
      .replace(/\{E\}/g, company?.name ?? '')
      .replace(/\{L\}/g, country?.leader ?? '')
      .replace(/\{dP\}/g, country?.of ?? '')
      .replace(/\{n\}/g, number !== null ? number.toLocaleString('fr-FR') : '')
  );

  const weight = country?.weight ?? 1;
  const violence = headline.certainty === 'pile' ? 1.15 : 1;
  const effects = new Map<string, number>();
  const hints: NewsHint[] = [];
  const markets = new Set<MarketId>();

  headline.targets.forEach((target, ti) => {
    const assets = targetAssets(target, company);
    if (!assets.length) return;
    const direction = mix(slot, ti, 37) < target.up ? 1 : -1;
    for (const asset of assets) {
      const jitter = 0.7 + 0.6 * mix(slot * 31 + ti, ASSET_INDEX.get(asset.id)!, 41);
      const delta = direction * target.strength * weight * violence * jitter;
      effects.set(asset.id, (effects.get(asset.id) ?? 0) + delta);
      markets.add(asset.market);
    }
    hints.push({
      label: targetLabel(target, company),
      up: target.up,
      markets: Array.from(new Set(assets.map((a) => a.market))),
    });
  });

  return {
    id: String(slot),
    at: EPOCH + slot * SLOT + 5 + Math.floor(mix(slot, 2, 31) * 35),
    category: headline.category,
    certainty: headline.certainty,
    text,
    hints,
    markets: Array.from(markets),
    arc: ctx.arc,
    chapter: ctx.chapter,
    effects,
  };
}

const newsCache = new Map<number, ResolvedNews | null>();

function newsAtSlot(slot: number): ResolvedNews | null {
  if (newsCache.has(slot)) return newsCache.get(slot)!;

  const a = Math.floor(slot / ARC_SLOTS);
  const plan = arcPlan(a);
  const chapter = plan.chapters.find((c) => c.slot === slot);
  let news: ResolvedNews | null = null;

  if (chapter) {
    news = resolveHeadline(slot, chapter.node, {
      company: companyFor(a * 7919 + 1, plan.arc.companyFrom),
      country: null,
      number: null,
      arc: plan.arc.id,
      chapter: chapter.depth,
    });
  } else {
    // Keep a little air around a storyline's chapters, and leave some slots
    // silent so the feed has a rhythm rather than a metronome.
    const crowded = [a - 1, a, a + 1].some((i) => arcPlan(i).chapters.some((c) => Math.abs(c.slot - slot) <= 1));
    if (!crowded && mix(slot, 3, 19) < STANDALONE_RATE) {
      const tpl = TEMPLATES[pickCycling(slot, TEMPLATES.length, 23)];
      const usesCompany = tpl.text.includes('{E}');
      const country = tpl.countries?.length
        ? COUNTRIES.find((c) => c.id === tpl.countries![Math.floor(mix(slot, 5, 29) * tpl.countries!.length)]) ?? null
        : null;
      const number = tpl.number
        ? tpl.number[0] + Math.floor(mix(slot, 6, 43) * (tpl.number[1] - tpl.number[0] + 1))
        : null;
      news = resolveHeadline(slot, tpl, {
        company: usesCompany ? companyFor(slot, tpl.companyFrom) : null,
        country,
        number,
      });
    }
  }

  if (newsCache.size > 20000) newsCache.clear();
  newsCache.set(slot, news);
  return news;
}

function slotOf(t: number): number {
  return Math.floor((t - EPOCH) / SLOT);
}

/** Published headlines in (from, to], newest first. */
export function newsBetween(from: number, to: number): NewsEvent[] {
  const out: NewsEvent[] = [];
  for (let s = slotOf(to); s >= slotOf(from) - 1; s--) {
    const n = newsAtSlot(s);
    if (n && n.at > from && n.at <= to) {
      const { effects: _hidden, ...pub } = n;
      out.push(pub);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Prices                                                               */
/* ------------------------------------------------------------------ */

interface Effect { at: number; delta: number }

function effectsFor(assetId: string, from: number, to: number): Effect[] {
  const out: Effect[] = [];
  for (let s = slotOf(from - EFFECT_LIFETIME) - 1; s <= slotOf(to + PRE_MOVE) + 1; s++) {
    const n = newsAtSlot(s);
    const delta = n?.effects.get(assetId);
    if (delta) out.push({ at: n!.at, delta });
  }
  return out;
}

function impactShare(dt: number): number {
  if (dt <= -PRE_MOVE) return 0;
  if (dt < 0) {
    const x = (dt + PRE_MOVE) / PRE_MOVE;
    return PRE_SHARE * x * x * (3 - 2 * x);
  }
  let share = PRE_SHARE + (1 - PRE_SHARE) * (1 - Math.exp(-dt / POST_TAU));
  if (dt > FADE_START) share *= Math.exp(-(dt - FADE_START) / FADE_TAU);
  return share;
}

function priceWith(asset: Asset, t: number, effects: Effect[]): number {
  const index = ASSET_INDEX.get(asset.id)!;
  const marketKey = 1000 + (asset.market === 'frx' ? 1 : 2);
  const tick = Math.floor(t / TICK);
  let log = Math.log(asset.price)
    + asset.vol * (0.55 * noise(marketKey, t) + 0.85 * noise(index, t))
    + asset.vol * 0.035 * (mix(index, tick, 99) * 2 - 1);
  for (const e of effects) {
    const dt = t - e.at;
    if (dt > -PRE_MOVE && dt < EFFECT_LIFETIME) log += Math.log1p(e.delta) * impactShare(dt);
  }
  return Math.exp(log);
}

export function quantize(t: number): number {
  return Math.floor(t / TICK) * TICK;
}

export function nowTick(): number {
  return quantize(Date.now() / 1000);
}

export function priceAt(assetId: string, t: number): number {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) throw new Error(`Actif inconnu : ${assetId}`);
  const q = quantize(t);
  return priceWith(asset, q, effectsFor(assetId, q, q));
}

/** Evenly spaced prices from `from` to `to` inclusive. */
export function priceSeries(assetId: string, from: number, to: number, step: number): { t: number; p: number }[] {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) return [];
  const effects = effectsFor(assetId, from, to);
  const out: { t: number; p: number }[] = [];
  for (let t = quantize(from); t <= to; t += step) out.push({ t, p: priceWith(asset, t, effects) });
  return out;
}

/**
 * The first tick in (from, to] at which `crossed(price)` holds, scanning the
 * real path hour by hour. How a stop is honoured while nobody is watching.
 */
export function firstCrossing(
  assetId: string, from: number, to: number, crossed: (price: number) => boolean,
): { t: number; p: number } | null {
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) return null;
  const start = quantize(from) + TICK;
  for (let chunk = start; chunk <= to; chunk += 3600) {
    const chunkEnd = Math.min(to, chunk + 3600 - TICK);
    const effects = effectsFor(assetId, chunk, chunkEnd);
    for (let t = chunk; t <= chunkEnd; t += TICK) {
      const p = priceWith(asset, t, effects);
      if (crossed(p)) return { t, p };
    }
  }
  return null;
}
