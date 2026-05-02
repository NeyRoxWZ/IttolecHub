export type ApexAchievementUnlock =
  | { type: 'total_earned'; amount: number }
  | { type: 'cash'; amount: number }
  | { type: 'deals'; count: number }
  | { type: 'projects_released'; sector: string; count: number }
  | { type: 'rep_global'; value: number }
  | { type: 'crypto_profit'; amount: number }
  | { type: 'stocks_profit'; amount: number }
  | { type: 'platform_subscribers'; count: number }
  | { type: 'prestige_stars'; count: number };

export type ApexAchievementDef = {
  id: string;
  name: string;
  description: string;
  unlock: ApexAchievementUnlock;
};

export type ApexAchievementContext = {
  cash: number;
  totalEarned: number;
  dealsCount: number;
  releasedBySector: Record<string, number>;
  reputationGlobal: number;
  cryptoProfit: number;
  stocksProfit: number;
  platformSubscribers: number;
  prestigeStars: number;
};

export function generateApexAchievements(): ApexAchievementDef[] {
  const out: ApexAchievementDef[] = [];

  const push = (def: ApexAchievementDef) => {
    out.push(def);
  };

  const earn = [
    1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
    25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000, 2_500_000_000,
  ];
  earn.forEach((amount, i) => {
    push({
      id: `apx_earn_${i + 1}`,
      name: `Capital ${i + 1}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ au total.`,
      unlock: { type: 'total_earned', amount },
    });
  });

  const cash = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 1_000_000, 10_000_000];
  cash.forEach((amount, i) => {
    push({
      id: `apx_cash_${i + 1}`,
      name: `Trésorerie ${i + 1}`,
      description: `Atteindre ${amount.toLocaleString('fr-FR')} ₶ en trésorerie.`,
      unlock: { type: 'cash', amount },
    });
  });

  const rep = [0.05, 0.1, 0.15, 0.2, 0.28, 0.35, 0.45, 0.55, 0.65, 0.75];
  rep.forEach((value, i) => {
    push({
      id: `apx_rep_${i + 1}`,
      name: `Réputation ${i + 1}`,
      description: `Atteindre ${Math.round(value * 100)}% de réputation globale.`,
      unlock: { type: 'rep_global', value },
    });
  });

  const deal = [1, 2, 3, 5, 8, 12, 18, 25, 40, 60];
  deal.forEach((count, i) => {
    push({
      id: `apx_deals_${i + 1}`,
      name: `Négociateur ${i + 1}`,
      description: `Signer ${count.toLocaleString('fr-FR')} deals.`,
      unlock: { type: 'deals', count },
    });
  });

  const sectors = [
    { id: 'cinema', label: 'Cinéma' },
    { id: 'musique', label: 'Musique' },
    { id: 'series', label: 'Séries' },
    { id: 'live', label: 'Live' },
    { id: 'games', label: 'Jeux vidéo' },
  ] as const;

  const released = [1, 2, 3, 5, 8, 12, 18, 25, 40, 60];
  sectors.forEach((s) => {
    released.forEach((count, i) => {
      push({
        id: `apx_rel_${s.id}_${i + 1}`,
        name: `${s.label} ${i + 1}`,
        description: `Sortir ${count.toLocaleString('fr-FR')} projets (${s.label}).`,
        unlock: { type: 'projects_released', sector: s.id, count },
      });
    });
  });

  const cryptoProfit = [250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 75_000, 250_000, 1_000_000];
  cryptoProfit.forEach((amount, i) => {
    push({
      id: `apx_crypto_${i + 1}`,
      name: `Crypto ${i + 1}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ de profit crypto.`,
      unlock: { type: 'crypto_profit', amount },
    });
  });

  const stockProfit = [250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 75_000, 250_000, 1_000_000];
  stockProfit.forEach((amount, i) => {
    push({
      id: `apx_stocks_${i + 1}`,
      name: `Bourse ${i + 1}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ de profit boursier.`,
      unlock: { type: 'stocks_profit', amount },
    });
  });

  const subs = [50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000];
  subs.forEach((count, i) => {
    push({
      id: `apx_subs_${i + 1}`,
      name: `Plateforme ${i + 1}`,
      description: `Atteindre ${count.toLocaleString('fr-FR')} abonnés.`,
      unlock: { type: 'platform_subscribers', count },
    });
  });

  const stars = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 32, 40];
  stars.forEach((count, i) => {
    push({
      id: `apx_stars_${i + 1}`,
      name: `Apex Stars ${i + 1}`,
      description: `Avoir ${count.toLocaleString('fr-FR')} Apex Stars.`,
      unlock: { type: 'prestige_stars', count },
    });
  });

  return out.slice(0, 150);
}

export function isAchievementUnlocked(def: ApexAchievementDef, ctx: ApexAchievementContext): boolean {
  const u = def.unlock;
  if (u.type === 'total_earned') return ctx.totalEarned >= u.amount;
  if (u.type === 'cash') return ctx.cash >= u.amount;
  if (u.type === 'deals') return ctx.dealsCount >= u.count;
  if (u.type === 'projects_released') return (ctx.releasedBySector[u.sector] ?? 0) >= u.count;
  if (u.type === 'rep_global') return ctx.reputationGlobal >= u.value;
  if (u.type === 'crypto_profit') return ctx.cryptoProfit >= u.amount;
  if (u.type === 'stocks_profit') return ctx.stocksProfit >= u.amount;
  if (u.type === 'platform_subscribers') return ctx.platformSubscribers >= u.count;
  if (u.type === 'prestige_stars') return ctx.prestigeStars >= u.count;
  return false;
}

