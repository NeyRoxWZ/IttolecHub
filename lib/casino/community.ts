/**
 * The community goal.
 *
 * One target per week, sized so no single player can finish it — three
 * million wagered, ten thousand rounds. Everyone's play pushes the same bar,
 * and when it fills, everyone who contributed gets paid.
 */

import { weekPeriodKey } from './missions';

export type CommunityKind = 'wager_total' | 'play_count' | 'win_total' | 'crates_opened';

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
}

export const COMMUNITY_QUESTS: CommunityQuest[] = [
  {
    id: 'com_wager_3m',
    kind: 'wager_total',
    target: 3_000_000,
    label: 'Miser 3 000 000 ₶ tous ensemble',
    reward: 10_000,
    pool: 150_000,
    unit: '₶ misés',
  },
  {
    id: 'com_play_10k',
    kind: 'play_count',
    target: 10_000,
    label: 'Jouer 10 000 parties tous ensemble',
    reward: 10_000,
    pool: 150_000,
    unit: 'parties',
  },
  {
    id: 'com_won_2m',
    kind: 'win_total',
    target: 2_000_000,
    label: 'Gagner 2 000 000 ₶ tous ensemble',
    reward: 12_000,
    pool: 180_000,
    unit: '₶ gagnés',
  },
  {
    id: 'com_crates_500',
    kind: 'crates_opened',
    target: 500,
    label: 'Ouvrir 500 caisses tous ensemble',
    reward: 12_000,
    pool: 180_000,
    unit: 'caisses',
  },
  {
    id: 'com_wager_8m',
    kind: 'wager_total',
    target: 8_000_000,
    label: 'Miser 8 000 000 ₶ tous ensemble',
    reward: 20_000,
    pool: 300_000,
    unit: '₶ misés',
  },
];

export function questById(id: string): CommunityQuest | undefined {
  return COMMUNITY_QUESTS.find((q) => q.id === id);
}

/** The week's goal, picked from the date alone so everyone sees the same one. */
export function currentQuest(period: string = weekPeriodKey()): CommunityQuest {
  let h = 2166136261;
  for (let i = 0; i < period.length; i++) {
    h ^= period.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return COMMUNITY_QUESTS[Math.abs(h) % COMMUNITY_QUESTS.length];
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
