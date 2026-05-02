export type ApexPrestigeUpgradeId = 'income' | 'starting_cash' | 'hype_decay' | 'negotiation';

export type ApexPrestigeState = {
  stars: number;
  lifetimeStars: number;
  upgrades: Partial<Record<ApexPrestigeUpgradeId, number>>;
};

export type ApexPrestigeUpgradeDef = {
  id: ApexPrestigeUpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  costForLevel: (nextLevel: number) => number;
};

export const APEX_STAR_BASE = 5_000_000;

export function computeStarsFromTotalEarned(totalEarned: number): number {
  const x = Math.max(0, totalEarned);
  return Math.floor(Math.sqrt(x / APEX_STAR_BASE));
}

export function getPrestigeUpgrades(): ApexPrestigeUpgradeDef[] {
  return [
    {
      id: 'income',
      name: 'Capital permanent',
      description: '+5% income par niveau.',
      maxLevel: 20,
      costForLevel: (lvl) => Math.max(1, Math.floor(1 + lvl * 2)),
    },
    {
      id: 'starting_cash',
      name: 'Trésorerie de départ',
      description: '+1 000 ₶ au départ par niveau.',
      maxLevel: 25,
      costForLevel: (lvl) => Math.max(1, Math.floor(1 + lvl)),
    },
    {
      id: 'hype_decay',
      name: 'Hype tenace',
      description: 'Hype décroît plus lentement.',
      maxLevel: 15,
      costForLevel: (lvl) => Math.max(1, Math.floor(2 + lvl)),
    },
    {
      id: 'negotiation',
      name: 'Négociateur',
      description: 'Deals un peu meilleurs.',
      maxLevel: 15,
      costForLevel: (lvl) => Math.max(1, Math.floor(2 + lvl)),
    },
  ];
}

export function getUpgradeLevel(state: ApexPrestigeState, id: ApexPrestigeUpgradeId): number {
  return Math.max(0, Math.floor(state.upgrades[id] ?? 0));
}

export function computePrestigeIncomeMult(state: ApexPrestigeState): number {
  const lvl = getUpgradeLevel(state, 'income');
  return 1 + lvl * 0.05;
}

export function computePrestigeStartingCash(state: ApexPrestigeState): number {
  const lvl = getUpgradeLevel(state, 'starting_cash');
  return lvl * 1000;
}

export function computePrestigeHypeDecayMult(state: ApexPrestigeState): number {
  const lvl = getUpgradeLevel(state, 'hype_decay');
  return Math.max(0.45, 1 - lvl * 0.03);
}

export function computeNegotiationBoost(state: ApexPrestigeState): number {
  const lvl = getUpgradeLevel(state, 'negotiation');
  return Math.min(0.18, lvl * 0.012);
}

