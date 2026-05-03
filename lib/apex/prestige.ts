export type ApexPrestigeUpgradeId =
  | 'premier_reseau'
  | 'reputation_heritee'
  | 'agent_confiance'
  | 'negociateur_ne'
  | 'memoire_marche'
  | 'tete_reseau'
  | 'hype_machine';

export type ApexPrestigeState = {
  stars: number;
  lifetimeStars: number;
  count?: number;
  upgrades: Partial<Record<ApexPrestigeUpgradeId, boolean>>;
};

export type ApexPrestigeUpgradeDef = {
  id: ApexPrestigeUpgradeId;
  name: string;
  description: string;
  cost: number;
};

export function computeStarsFromRun(args: {
  totalEarned: number;
  sectorsUnlocked: number;
  achievementsUnlocked: number;
}): number {
  const earned = Math.max(0, args.totalEarned);
  const sectors = Math.max(0, Math.floor(args.sectorsUnlocked));
  const achievements = Math.max(0, Math.floor(args.achievementsUnlocked));

  const base = Math.sqrt(earned / 5_000_000);
  const sectorBonus = sectors * 0.35;
  const achievementBonus = Math.min(10, achievements / 30);

  return Math.max(0, Math.floor(base + sectorBonus + achievementBonus));
}

export function getPrestigeUpgrades(): ApexPrestigeUpgradeDef[] {
  return [
    {
      id: 'premier_reseau',
      name: 'Premier Réseau',
      description: 'Commencer avec 25 000 ₶ au lieu de 10 000 ₶.',
      cost: 5,
    },
    {
      id: 'reputation_heritee',
      name: 'Réputation Héritée',
      description: 'Toutes les jauges de réputation commencent à 10.',
      cost: 8,
    },
    {
      id: 'agent_confiance',
      name: "L'Agent de Confiance",
      description: "L'Agent revient deux fois plus vite.",
      cost: 6,
    },
    {
      id: 'negociateur_ne',
      name: 'Négociateur Né',
      description: '+5% de probabilité de succès sur toutes les négociations.',
      cost: 10,
    },
    {
      id: 'memoire_marche',
      name: 'Mémoire du Marché',
      description: 'Cours crypto légèrement prédictibles.',
      cost: 12,
    },
    {
      id: 'tete_reseau',
      name: 'Tête de Réseau',
      description: 'Roster max artistes +3 dès le départ.',
      cost: 15,
    },
    {
      id: 'hype_machine',
      name: 'Hype Machine',
      description: 'Hype initiale de tous les projets +10.',
      cost: 20,
    },
  ];
}

export function hasPrestigeUpgrade(state: ApexPrestigeState, id: ApexPrestigeUpgradeId): boolean {
  return Boolean(state.upgrades[id]);
}

export function computePrestigeIncomeMult(state: ApexPrestigeState): number {
  return 1;
}

export function computePrestigeStartingCash(state: ApexPrestigeState): number {
  return hasPrestigeUpgrade(state, 'premier_reseau') ? 25_000 : 10_000;
}

export function computePrestigeHypeDecayMult(state: ApexPrestigeState): number {
  return 1;
}

export function computeNegotiationBoost(state: ApexPrestigeState): number {
  return hasPrestigeUpgrade(state, 'negociateur_ne') ? 0.05 : 0;
}
