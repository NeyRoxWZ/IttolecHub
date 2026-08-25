/**
 * Daily missions. Three per day, picked deterministically from the date +
 * the player id, so everyone gets a stable set that rolls over at midnight
 * UTC without any scheduled job.
 */

export type MissionKind =
  | 'wager_total'     // stake N coins in total
  | 'play_count'      // place N bets
  | 'win_count'       // win N times
  | 'streak_reach'    // reach a win streak of N
  | 'multiplier_reach'// land a single win at x N or more
  | 'distinct_games'  // play N different games
  | 'win_total';      // win N coins in total

export interface MissionDef {
  id: string;
  kind: MissionKind;
  target: number;
  label: string;
  reward: number;
  xp: number;
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'wager_1k', kind: 'wager_total', target: 1_000, label: 'Miser 1 000 ₶ au total', reward: 300, xp: 150 },
  { id: 'wager_5k', kind: 'wager_total', target: 5_000, label: 'Miser 5 000 ₶ au total', reward: 900, xp: 400 },
  { id: 'wager_20k', kind: 'wager_total', target: 20_000, label: 'Miser 20 000 ₶ au total', reward: 3_000, xp: 1_200 },
  { id: 'play_15', kind: 'play_count', target: 15, label: 'Jouer 15 parties', reward: 350, xp: 180 },
  { id: 'play_40', kind: 'play_count', target: 40, label: 'Jouer 40 parties', reward: 900, xp: 450 },
  { id: 'win_5', kind: 'win_count', target: 5, label: 'Remporter 5 parties', reward: 400, xp: 200 },
  { id: 'win_15', kind: 'win_count', target: 15, label: 'Remporter 15 parties', reward: 1_100, xp: 500 },
  { id: 'streak_3', kind: 'streak_reach', target: 3, label: 'Enchaîner 3 victoires', reward: 500, xp: 250 },
  { id: 'streak_5', kind: 'streak_reach', target: 5, label: 'Enchaîner 5 victoires', reward: 1_400, xp: 600 },
  { id: 'mult_5', kind: 'multiplier_reach', target: 5, label: 'Décrocher un gain à ×5', reward: 450, xp: 220 },
  { id: 'mult_20', kind: 'multiplier_reach', target: 20, label: 'Décrocher un gain à ×20', reward: 1_800, xp: 700 },
  { id: 'games_3', kind: 'distinct_games', target: 3, label: 'Jouer à 3 jeux différents', reward: 400, xp: 200 },
  { id: 'games_6', kind: 'distinct_games', target: 6, label: 'Jouer à 6 jeux différents', reward: 1_200, xp: 550 },
  { id: 'won_3k', kind: 'win_total', target: 3_000, label: 'Gagner 3 000 ₶ au total', reward: 700, xp: 320 },
  { id: 'won_10k', kind: 'win_total', target: 10_000, label: 'Gagner 10 000 ₶ au total', reward: 2_200, xp: 900 },
];

export const MISSIONS_PER_DAY = 3;

/** Stable game order so `distinct_games` can use a bitmask in one bigint. */
export const GAME_SLUGS = [
  'slots', 'blackjack', 'wheel', 'rocket', 'mines', 'plinko', 'hilo', 'grattage',
  'poulet', 'tower', 'keno', 'caisses', 'coinflip', 'dino', 'chevaux', 'bonneteau',
  'stade', 'baccarat', 'rps', 'craps',
];

export function gameBit(slug: string): number {
  const i = GAME_SLUGS.indexOf(slug);
  return i < 0 ? 0 : i;
}

export function countBits(mask: number): number {
  let n = 0;
  let m = mask;
  while (m) { n += m & 1; m >>>= 1; }
  return n;
}

/** Deterministic PRNG so the same day+player always yields the same set. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function pickDailyMissions(userId: string, day: string = dayKey()): MissionDef[] {
  const rand = seededRandom(`${day}:${userId}`);
  const pool = [...MISSION_POOL];
  const picked: MissionDef[] = [];
  // Spread difficulty: never hand out three 20k-wager style grinds at once.
  while (picked.length < MISSIONS_PER_DAY && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length);
    const def = pool.splice(idx, 1)[0];
    if (picked.some((p) => p.kind === def.kind)) continue;
    picked.push(def);
  }
  // Fallback if the kind filter starved the list.
  while (picked.length < MISSIONS_PER_DAY && MISSION_POOL.length > picked.length) {
    const def = MISSION_POOL[Math.floor(rand() * MISSION_POOL.length)];
    if (!picked.some((p) => p.id === def.id)) picked.push(def);
  }
  return picked;
}

export function missionById(id: string): MissionDef | undefined {
  return MISSION_POOL.find((m) => m.id === id);
}

/** Turn stored progress into a comparable value (bitmask for distinct games). */
export function missionValue(def: MissionDef, progress: number): number {
  return def.kind === 'distinct_games' ? countBits(progress) : progress;
}

export function isMissionComplete(def: MissionDef, progress: number): boolean {
  return missionValue(def, progress) >= def.target;
}
