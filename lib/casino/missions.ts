/**
 * Missions, on three clocks.
 *
 * One pool of daily chores gave a player nothing to aim at past the evening.
 * Three scopes run at once so there is always something in progress:
 *
 *   jour     3 goals, reset at midnight — the session's to-do list
 *   semaine  3 goals, reset with the pass on Monday — worth planning around
 *   carriere 4 goals that never reset — the long haul
 *
 * The set is picked from the date and the player id, so everyone gets a
 * stable draw with no scheduled job anywhere.
 */

export type MissionKind =
  | 'wager_total'     // stake N coins in total
  | 'play_count'      // place N bets
  | 'win_count'       // win N times
  | 'streak_reach'    // reach a win streak of N
  | 'multiplier_reach'// land a single win at x N or more
  | 'distinct_games'  // play N different games
  | 'win_total'       // win N coins in total
  | 'crates_opened'   // open N crates
  | 'cosmetics_owned' // own N cosmetics
  | 'tiers_reached';  // reach pass tier N

export type MissionScope = 'jour' | 'semaine' | 'carriere';

export const SCOPE_LABEL: Record<MissionScope, string> = {
  jour: 'Du jour',
  semaine: 'De la semaine',
  carriere: 'Au long cours',
};

export const SCOPE_HINT: Record<MissionScope, string> = {
  jour: 'remise à zéro à minuit',
  semaine: 'remise à zéro lundi',
  carriere: 'jamais remises à zéro',
};

export interface MissionDef {
  id: string;
  kind: MissionKind;
  target: number;
  label: string;
  reward: number;
  xp: number;
  scope: MissionScope;
}

/* ------------------------------------------------------------------ */
/* Pools                                                               */
/* ------------------------------------------------------------------ */

const DAILY: MissionDef[] = [
  { id: 'wager_1k', kind: 'wager_total', target: 1_000, label: 'Miser 1 000 ₶ au total', reward: 300, xp: 150, scope: 'jour' },
  { id: 'wager_5k', kind: 'wager_total', target: 5_000, label: 'Miser 5 000 ₶ au total', reward: 900, xp: 400, scope: 'jour' },
  { id: 'play_15', kind: 'play_count', target: 15, label: 'Jouer 15 parties', reward: 350, xp: 180, scope: 'jour' },
  { id: 'play_40', kind: 'play_count', target: 40, label: 'Jouer 40 parties', reward: 900, xp: 450, scope: 'jour' },
  { id: 'win_5', kind: 'win_count', target: 5, label: 'Remporter 5 parties', reward: 400, xp: 200, scope: 'jour' },
  { id: 'win_15', kind: 'win_count', target: 15, label: 'Remporter 15 parties', reward: 1_100, xp: 500, scope: 'jour' },
  { id: 'streak_3', kind: 'streak_reach', target: 3, label: 'Enchaîner 3 victoires', reward: 500, xp: 250, scope: 'jour' },
  { id: 'mult_5', kind: 'multiplier_reach', target: 5, label: 'Décrocher un gain à ×5', reward: 450, xp: 220, scope: 'jour' },
  { id: 'games_3', kind: 'distinct_games', target: 3, label: 'Jouer à 3 jeux différents', reward: 400, xp: 200, scope: 'jour' },
  { id: 'won_3k', kind: 'win_total', target: 3_000, label: 'Gagner 3 000 ₶ au total', reward: 700, xp: 320, scope: 'jour' },
  { id: 'crate_1', kind: 'crates_opened', target: 1, label: 'Ouvrir une caisse', reward: 350, xp: 180, scope: 'jour' },
];

const WEEKLY: MissionDef[] = [
  { id: 'w_wager_50k', kind: 'wager_total', target: 50_000, label: 'Miser 50 000 ₶ dans la semaine', reward: 4_000, xp: 1_600, scope: 'semaine' },
  { id: 'w_wager_200k', kind: 'wager_total', target: 200_000, label: 'Miser 200 000 ₶ dans la semaine', reward: 12_000, xp: 4_000, scope: 'semaine' },
  { id: 'w_play_200', kind: 'play_count', target: 200, label: 'Jouer 200 parties', reward: 5_000, xp: 2_000, scope: 'semaine' },
  { id: 'w_win_75', kind: 'win_count', target: 75, label: 'Remporter 75 parties', reward: 6_000, xp: 2_400, scope: 'semaine' },
  { id: 'w_streak_7', kind: 'streak_reach', target: 7, label: 'Enchaîner 7 victoires', reward: 7_000, xp: 2_800, scope: 'semaine' },
  { id: 'w_mult_50', kind: 'multiplier_reach', target: 50, label: 'Décrocher un gain à ×50', reward: 8_000, xp: 3_000, scope: 'semaine' },
  { id: 'w_games_10', kind: 'distinct_games', target: 10, label: 'Jouer à 10 jeux différents', reward: 5_500, xp: 2_200, scope: 'semaine' },
  { id: 'w_won_100k', kind: 'win_total', target: 100_000, label: 'Gagner 100 000 ₶ dans la semaine', reward: 9_000, xp: 3_200, scope: 'semaine' },
  { id: 'w_crates_10', kind: 'crates_opened', target: 10, label: 'Ouvrir 10 caisses', reward: 5_000, xp: 2_000, scope: 'semaine' },
  { id: 'w_tier_50', kind: 'tiers_reached', target: 50, label: 'Atteindre le palier 50 du passe', reward: 10_000, xp: 3_500, scope: 'semaine' },
];

/** These four are the same for everyone, and never reset. */
const CAREER: MissionDef[] = [
  { id: 'c_games_all', kind: 'distinct_games', target: 20, label: 'Jouer aux 20 jeux du casino', reward: 25_000, xp: 6_000, scope: 'carriere' },
  { id: 'c_cosmetics_50', kind: 'cosmetics_owned', target: 50, label: 'Posséder 50 cosmétiques', reward: 30_000, xp: 7_000, scope: 'carriere' },
  { id: 'c_wager_5m', kind: 'wager_total', target: 5_000_000, label: 'Miser 5 000 000 ₶ en tout', reward: 50_000, xp: 10_000, scope: 'carriere' },
  { id: 'c_mult_250', kind: 'multiplier_reach', target: 250, label: 'Décrocher un gain à ×250', reward: 60_000, xp: 12_000, scope: 'carriere' },
];

export const MISSION_POOL: MissionDef[] = [...DAILY, ...WEEKLY, ...CAREER];

export const MISSIONS_PER_SCOPE: Record<MissionScope, number> = {
  jour: 3,
  semaine: 3,
  carriere: CAREER.length,
};

export const MISSION_SCOPES: MissionScope[] = ['jour', 'semaine', 'carriere'];

/** Kept for callers that only ever meant the daily set. */
export const MISSIONS_PER_DAY = MISSIONS_PER_SCOPE.jour;

/* ------------------------------------------------------------------ */
/* Game bitmask                                                        */
/* ------------------------------------------------------------------ */

/** Stable game order so `distinct_games` can use a bitmask in one integer. */
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

/* ------------------------------------------------------------------ */
/* Period keys                                                         */
/* ------------------------------------------------------------------ */

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

/** Monday-anchored, so weekly missions turn over with the pass. */
export function weekPeriodKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export function periodKey(scope: MissionScope, date: Date = new Date()): string {
  if (scope === 'jour') return dayKey(date);
  if (scope === 'semaine') return weekPeriodKey(date);
  return 'toujours';
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function poolFor(scope: MissionScope): MissionDef[] {
  if (scope === 'jour') return DAILY;
  if (scope === 'semaine') return WEEKLY;
  return CAREER;
}

export function pickMissions(scope: MissionScope, userId: string, period?: string): MissionDef[] {
  const pool = poolFor(scope);
  // The long ones are a fixed list: they're the destination, not a draw.
  if (scope === 'carriere') return [...pool];

  const key = period ?? periodKey(scope);
  const rand = seededRandom(`${scope}:${key}:${userId}`);
  const remaining = [...pool];
  const picked: MissionDef[] = [];
  const wanted = MISSIONS_PER_SCOPE[scope];

  // Spread the kinds: three wager grinds at once is not a set of goals.
  while (picked.length < wanted && remaining.length > 0) {
    const idx = Math.floor(rand() * remaining.length);
    const def = remaining.splice(idx, 1)[0];
    if (picked.some((p) => p.kind === def.kind)) continue;
    picked.push(def);
  }

  // If the kind filter starved the draw, top it up with anything left.
  for (const def of pool) {
    if (picked.length >= wanted) break;
    if (!picked.some((p) => p.id === def.id)) picked.push(def);
  }

  return picked;
}

/** Kept for callers that only ever meant the daily set. */
export function pickDailyMissions(userId: string, day?: string): MissionDef[] {
  return pickMissions('jour', userId, day);
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
