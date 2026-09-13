/**
 * The community goal.
 *
 * One target per week, sized so no single player can finish it. Everyone's
 * activity pushes the same bar, and when it fills, everyone who contributed
 * gets paid.
 *
 * The goals used to be "wager / play / win / open crates" in rotation, so the
 * week always asked for the same thing. They now cover the whole casino: the
 * live tape, the chat, gifts, duels, missions, the daily chest and wheel, big
 * multipliers, one game in particular, the daily challenge and the pass.
 */

import { weekPeriodKey } from './missions';

export type CommunityKind =
  | 'wager_total' | 'play_count' | 'win_total' | 'crates_opened'
  | 'reactions' | 'chat_messages' | 'gifts_sent' | 'duels_played'
  | 'missions_claimed' | 'chests_opened' | 'daily_wheel' | 'big_wins'
  | 'game_plays' | 'challenge_rounds' | 'pass_tiers';

export interface CommunityQuest {
  id: string;
  kind: CommunityKind;
  target: number;
  label: string;
  /** What every contributor gets when it fills. */
  reward: number;
  /** Split between contributors, in proportion to what they pushed. */
  pool: number;
  unit: string;
  /** For `game_plays`: the game that counts. */
  game?: string;
}

/**
 * What one action adds, by kind. Every field is optional: a route passes only
 * what it knows about (a chat message, a claimed mission…).
 */
export interface CommunityContribution {
  wagered?: number;
  plays?: number;
  won?: number;
  crates?: number;
  reactions?: number;
  chat?: number;
  gifts?: number;
  duels?: number;
  missions?: number;
  chests?: number;
  dailyWheel?: number;
  /** Settled wins at ×10 or more. */
  bigWins?: number;
  challengeRounds?: number;
  passTiers?: number;
  /** The game a play happened in, for `game_plays` goals. */
  game?: string;
}

export function contributionFor(quest: CommunityQuest, c: CommunityContribution): number {
  switch (quest.kind) {
    case 'wager_total': return c.wagered || 0;
    case 'play_count': return c.plays || 0;
    case 'win_total': return c.won || 0;
    case 'crates_opened': return c.crates || 0;
    case 'reactions': return c.reactions || 0;
    case 'chat_messages': return c.chat || 0;
    case 'gifts_sent': return c.gifts || 0;
    case 'duels_played': return c.duels || 0;
    case 'missions_claimed': return c.missions || 0;
    case 'chests_opened': return c.chests || 0;
    case 'daily_wheel': return c.dailyWheel || 0;
    case 'big_wins': return c.bigWins || 0;
    case 'game_plays': return c.game && c.game === quest.game ? c.plays || 0 : 0;
    case 'challenge_rounds': return c.challengeRounds || 0;
    case 'pass_tiers': return c.passTiers || 0;
  }
}

/** The goals that ran until the rotation widened; kept first and in this order. */
const LEGACY_COUNT = 5;

export const COMMUNITY_QUESTS: CommunityQuest[] = [
  { id: 'com_wager_3m', kind: 'wager_total', target: 3_000_000, label: 'Miser 3 000 000 ₶ tous ensemble', reward: 10_000, pool: 150_000, unit: '₶ misés' },
  { id: 'com_play_10k', kind: 'play_count', target: 10_000, label: 'Jouer 10 000 parties tous ensemble', reward: 10_000, pool: 150_000, unit: 'parties' },
  { id: 'com_won_2m', kind: 'win_total', target: 2_000_000, label: 'Gagner 2 000 000 ₶ tous ensemble', reward: 12_000, pool: 180_000, unit: '₶ gagnés' },
  { id: 'com_crates_500', kind: 'crates_opened', target: 500, label: 'Ouvrir 500 caisses tous ensemble', reward: 12_000, pool: 180_000, unit: 'caisses' },
  { id: 'com_wager_8m', kind: 'wager_total', target: 8_000_000, label: 'Miser 8 000 000 ₶ tous ensemble', reward: 20_000, pool: 300_000, unit: '₶ misés' },

  { id: 'com_react_400', kind: 'reactions', target: 400, label: 'Réagir 400 fois dans En direct', reward: 8_000, pool: 120_000, unit: 'réactions' },
  { id: 'com_chat_300', kind: 'chat_messages', target: 300, label: 'Envoyer 300 messages dans le chat', reward: 8_000, pool: 120_000, unit: 'messages' },
  { id: 'com_gifts_60', kind: 'gifts_sent', target: 60, label: 'Offrir 60 cadeaux à des potes', reward: 12_000, pool: 160_000, unit: 'cadeaux' },
  { id: 'com_duels_80', kind: 'duels_played', target: 80, label: 'Jouer 80 duels', reward: 12_000, pool: 160_000, unit: 'duels' },
  { id: 'com_missions_400', kind: 'missions_claimed', target: 400, label: 'Réclamer 400 missions', reward: 10_000, pool: 150_000, unit: 'missions' },
  { id: 'com_chests_150', kind: 'chests_opened', target: 150, label: 'Ouvrir 150 fois le coffre du jour', reward: 10_000, pool: 140_000, unit: 'coffres' },
  { id: 'com_wheel_150', kind: 'daily_wheel', target: 150, label: 'Tourner 150 fois la roue du jour', reward: 10_000, pool: 140_000, unit: 'tours' },
  { id: 'com_bigwins_300', kind: 'big_wins', target: 300, label: 'Décrocher 300 gains à ×10 ou plus', reward: 14_000, pool: 200_000, unit: 'gros gains' },
  { id: 'com_wheel_2k', kind: 'game_plays', game: 'wheel', target: 2_000, label: 'Lancer 2 000 fois la roulette', reward: 10_000, pool: 150_000, unit: 'lancers' },
  { id: 'com_blackjack_1500', kind: 'game_plays', game: 'blackjack', target: 1_500, label: 'Jouer 1 500 mains de blackjack', reward: 10_000, pool: 150_000, unit: 'mains' },
  { id: 'com_mines_1500', kind: 'game_plays', game: 'mines', target: 1_500, label: 'Jouer 1 500 parties de Mines', reward: 10_000, pool: 150_000, unit: 'parties' },
  { id: 'com_dino_1500', kind: 'game_plays', game: 'dino', target: 1_500, label: 'Lancer 1 500 courses de dino', reward: 10_000, pool: 150_000, unit: 'courses' },
  { id: 'com_challenge_300', kind: 'challenge_rounds', target: 300, label: 'Jouer 300 manches du défi du jour', reward: 10_000, pool: 140_000, unit: 'manches' },
  { id: 'com_pass_400', kind: 'pass_tiers', target: 400, label: 'Réclamer 400 paliers du Frenly Pass', reward: 12_000, pool: 160_000, unit: 'paliers' },
];

export function questById(id: string): CommunityQuest | undefined {
  return COMMUNITY_QUESTS.find((q) => q.id === id);
}

/** The first week picked from the widened list; earlier weeks keep their goal. */
const WIDENED_FROM = '2026-09-14';

function hashIndex(period: string, size: number): number {
  let h = 2166136261;
  for (let i = 0; i < period.length; i++) {
    h ^= period.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % size;
}

function previousPeriod(period: string): string {
  const d = new Date(`${period}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function rawQuest(period: string): CommunityQuest {
  if (period < WIDENED_FROM) return COMMUNITY_QUESTS[hashIndex(period, LEGACY_COUNT)];
  return COMMUNITY_QUESTS[hashIndex(period, COMMUNITY_QUESTS.length)];
}

/**
 * The week's goal, picked from the date alone so everyone sees the same one.
 * Never the same kind two weeks running.
 */
export function currentQuest(period: string = weekPeriodKey()): CommunityQuest {
  const quest = rawQuest(period);
  if (period < WIDENED_FROM) return quest;
  const last = rawQuest(previousPeriod(period));
  if (last.kind !== quest.kind) return quest;
  let i = COMMUNITY_QUESTS.indexOf(quest);
  do { i = (i + 1) % COMMUNITY_QUESTS.length; } while (COMMUNITY_QUESTS[i].kind === last.kind);
  return COMMUNITY_QUESTS[i];
}

export function communityPeriod(date?: Date): string {
  return weekPeriodKey(date);
}

/**
 * What one contributor takes home: a flat reward for taking part, plus a share
 * of the pool proportional to what they pushed. Small contributions still
 * count — the flat part is most of a casual player's take.
 */
export function contributorReward(quest: CommunityQuest, contribution: number, total: number): number {
  if (contribution <= 0) return 0;
  const share = total > 0 ? Math.min(1, contribution / total) : 0;
  return quest.reward + Math.round(quest.pool * share);
}
