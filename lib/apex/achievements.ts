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

  const push = (def: ApexAchievementDef) => out.push(def);

  const tierNames10 = ['Rookie', 'Scout', 'Pro', 'Elite', 'Master', 'Titan', 'Mythique', 'Légende', 'Icone', 'Apex'];

  const earnedTiers = [
    1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000,
    25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000, 2_500_000_000,
  ];
  earnedTiers.forEach((amount, i) => {
    push({
      id: `apx2_earn_${i + 1}`,
      name: `Empire — ${i + 1}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ au total.`,
      unlock: { type: 'total_earned', amount },
    });
  });

  const cashTiers = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000];
  cashTiers.forEach((amount, i) => {
    push({
      id: `apx2_cash_${i + 1}`,
      name: `Trésor — ${tierNames10[Math.min(9, i)] ?? `N${i + 1}`}`,
      description: `Atteindre ${amount.toLocaleString('fr-FR')} ₶ en trésorerie.`,
      unlock: { type: 'cash', amount },
    });
  });

  const repTiers = [0.06, 0.12, 0.18, 0.25, 0.32, 0.4, 0.5, 0.6, 0.7, 0.78, 0.85, 0.92];
  repTiers.forEach((value, i) => {
    push({
      id: `apx2_rep_${i + 1}`,
      name: `Réputation — ${tierNames10[Math.min(9, Math.floor((i * 10) / repTiers.length))] ?? `N${i + 1}`}`,
      description: `Atteindre ${Math.round(value * 100)}% de réputation globale.`,
      unlock: { type: 'rep_global', value },
    });
  });

  const dealTiers = [1, 2, 3, 5, 8, 12, 18, 25, 35, 50, 75, 110];
  dealTiers.forEach((count, i) => {
    push({
      id: `apx2_deals_${i + 1}`,
      name: `Négociateur — ${i + 1}`,
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

  const releasedTiers = [1, 2, 3, 5, 8, 12, 18, 25, 40, 60];
  sectors.forEach((s) => {
    releasedTiers.forEach((count, i) => {
      push({
        id: `apx2_rel_${s.id}_${i + 1}`,
        name: `${s.label} — ${tierNames10[i] ?? `${i + 1}`}`,
        description: `Sortir ${count.toLocaleString('fr-FR')} projets (${s.label}).`,
        unlock: { type: 'projects_released', sector: s.id, count },
      });
    });
  });

  const cryptoProfitTiers = [250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 60_000, 150_000, 400_000];
  cryptoProfitTiers.forEach((amount, i) => {
    push({
      id: `apx2_crypto_${i + 1}`,
      name: `Crypto — ${tierNames10[i] ?? `${i + 1}`}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ de profit crypto.`,
      unlock: { type: 'crypto_profit', amount },
    });
  });

  const stocksProfitTiers = [250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 60_000, 150_000, 400_000];
  stocksProfitTiers.forEach((amount, i) => {
    push({
      id: `apx2_stocks_${i + 1}`,
      name: `Bourse — ${tierNames10[i] ?? `${i + 1}`}`,
      description: `Gagner ${amount.toLocaleString('fr-FR')} ₶ de profit boursier.`,
      unlock: { type: 'stocks_profit', amount },
    });
  });

  const subscriberTiers = [50, 150, 300, 600, 1_000, 2_000, 4_000, 7_500, 12_500, 20_000, 35_000, 60_000, 100_000, 175_000];
  subscriberTiers.forEach((count, i) => {
    push({
      id: `apx2_subs_${i + 1}`,
      name: `Plateforme — ${i + 1}`,
      description: `Atteindre ${count.toLocaleString('fr-FR')} abonnés.`,
      unlock: { type: 'platform_subscribers', count },
    });
  });

  const starsTiers = [1, 2, 3, 4, 5, 7, 9, 12, 16, 22];
  starsTiers.forEach((count, i) => {
    push({
      id: `apx2_stars_${i + 1}`,
      name: `Apex Stars — ${i + 1}`,
      description: `Avoir ${count.toLocaleString('fr-FR')} Apex Stars.`,
      unlock: { type: 'prestige_stars', count },
    });
  });

  return out;
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

