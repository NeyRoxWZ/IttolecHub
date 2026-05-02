export type TerraZoneId = 'parcelle' | 'village' | 'foret' | 'riviere' | 'collines' | 'montagne';

export type TerraBuildingCategory = 'cultures' | 'elevage' | 'transformation' | 'infrastructure' | 'commerce' | 'luxe';

export type TerraBuildingId =
  | 'ble'
  | 'tournesol'
  | 'lavande'
  | 'poules'
  | 'vaches'
  | 'moulin'
  | 'fromagerie'
  | 'boulangerie'
  | 'silo'
  | 'grange'
  | 'etal'
  | 'charrette'
  | 'chapelle'
  | 'manoir';

export type TerraEventId = 'market' | 'drought' | 'storm' | 'visitor' | 'disease';

export type TerraSeasonId = 'printemps' | 'ete' | 'automne' | 'hiver';

export type TerraBuildingDef = {
  id: TerraBuildingId;
  name: string;
  category: TerraBuildingCategory;
  baseFps: number;
  cost: number;
  minZoneIndex: number;
};

export type TerraZoneDef = {
  id: TerraZoneId;
  name: string;
  width: number;
  height: number;
  unlockCost: number;
};

export type TerraEventDef = {
  id: TerraEventId;
  name: string;
  description: string;
  durationMs: number;
  prodMult: number;
};

export type TerraUpgradeEffect =
  | { type: 'global_mult'; mult: number }
  | { type: 'category_mult'; category: TerraBuildingCategory; mult: number }
  | { type: 'building_mult'; buildingId: TerraBuildingId; mult: number }
  | { type: 'harvest_mult'; mult: number };

export type TerraUpgradeUnlock =
  | { type: 'building_owned'; buildingId: TerraBuildingId; count: number }
  | { type: 'lifetime_produced'; amount: number }
  | { type: 'zone_unlocked'; zoneIndex: number }
  | { type: 'harvest_clicks'; count: number };

export type TerraUpgradeDef = {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: TerraUpgradeEffect;
  unlock: TerraUpgradeUnlock;
};

export type TerraAchievementUnlock =
  | { type: 'lifetime_produced'; amount: number }
  | { type: 'harvest_clicks'; count: number }
  | { type: 'tiles_placed'; count: number }
  | { type: 'zone_unlocked'; zoneIndex: number }
  | { type: 'building_owned'; buildingId: TerraBuildingId; count: number };

export type TerraAchievementDef = {
  id: string;
  name: string;
  description: string;
  unlock: TerraAchievementUnlock;
};

export const TERRAFARM_YEAR_MS = 20 * 60_000;
export const TERRAFARM_SEASON_MS = TERRAFARM_YEAR_MS / 4;

export const TERRAFARM_SEASONS: Array<{ id: TerraSeasonId; name: string; prodMult: number }> = [
  { id: 'printemps', name: 'Printemps', prodMult: 1.2 },
  { id: 'ete', name: 'Été', prodMult: 1.0 },
  { id: 'automne', name: 'Automne', prodMult: 1.5 },
  { id: 'hiver', name: 'Hiver', prodMult: 0.7 },
];

export const TERRAFARM_ZONES: TerraZoneDef[] = [
  { id: 'parcelle', name: 'Parcelle', width: 3, height: 3, unlockCost: 0 },
  { id: 'village', name: 'Village voisin', width: 4, height: 4, unlockCost: 25_000 },
  { id: 'foret', name: 'Forêt', width: 5, height: 5, unlockCost: 250_000 },
  { id: 'riviere', name: 'Rivière', width: 6, height: 6, unlockCost: 2_500_000 },
  { id: 'collines', name: 'Collines', width: 7, height: 7, unlockCost: 25_000_000 },
  { id: 'montagne', name: 'Montagne', width: 8, height: 8, unlockCost: 250_000_000 },
];

export const TERRAFARM_BUILDINGS: TerraBuildingDef[] = [
  { id: 'ble', name: 'Blé', category: 'cultures', baseFps: 0.3, cost: 20, minZoneIndex: 0 },
  { id: 'tournesol', name: 'Tournesol', category: 'cultures', baseFps: 0.8, cost: 80, minZoneIndex: 0 },
  { id: 'lavande', name: 'Lavande', category: 'cultures', baseFps: 2.2, cost: 250, minZoneIndex: 1 },
  { id: 'poules', name: 'Poules', category: 'elevage', baseFps: 1.1, cost: 120, minZoneIndex: 0 },
  { id: 'vaches', name: 'Vaches', category: 'elevage', baseFps: 6.5, cost: 900, minZoneIndex: 1 },
  { id: 'moulin', name: 'Moulin', category: 'transformation', baseFps: 12, cost: 2_500, minZoneIndex: 1 },
  { id: 'fromagerie', name: 'Fromagerie', category: 'transformation', baseFps: 45, cost: 15_000, minZoneIndex: 2 },
  { id: 'boulangerie', name: 'Boulangerie', category: 'transformation', baseFps: 120, cost: 45_000, minZoneIndex: 2 },
  { id: 'silo', name: 'Silo', category: 'infrastructure', baseFps: 18, cost: 6_500, minZoneIndex: 1 },
  { id: 'grange', name: 'Grange', category: 'infrastructure', baseFps: 70, cost: 25_000, minZoneIndex: 2 },
  { id: 'etal', name: 'Étal de marché', category: 'commerce', baseFps: 220, cost: 140_000, minZoneIndex: 3 },
  { id: 'charrette', name: 'Charrette', category: 'commerce', baseFps: 520, cost: 420_000, minZoneIndex: 3 },
  { id: 'chapelle', name: 'Chapelle', category: 'luxe', baseFps: 1_700, cost: 2_200_000, minZoneIndex: 4 },
  { id: 'manoir', name: 'Manoir', category: 'luxe', baseFps: 6_000, cost: 7_500_000, minZoneIndex: 4 },
];

export const TERRAFARM_EVENTS: TerraEventDef[] = [
  { id: 'market', name: 'Marché florissant', description: 'Production ×3 pendant 2 min.', durationMs: 2 * 60_000, prodMult: 3 },
  { id: 'drought', name: 'Sécheresse', description: 'Production -20% pendant 5 min.', durationMs: 5 * 60_000, prodMult: 0.8 },
  { id: 'storm', name: 'Tempête', description: 'Dégâts sur une culture. Production -10% pendant 3 min.', durationMs: 3 * 60_000, prodMult: 0.9 },
  { id: 'visitor', name: 'Visiteur mystérieux', description: 'Coup de pouce: +10% pendant 1 min.', durationMs: 60_000, prodMult: 1.1 },
  { id: 'disease', name: 'Maladie du bétail', description: 'Élevage -50% pendant 5 min.', durationMs: 5 * 60_000, prodMult: 0.5 },
];

function createUpgradeId(parts: string[]): string {
  return parts
    .join('_')
    .toLowerCase()
    .replaceAll(' ', '-')
    .replaceAll('é', 'e')
    .replaceAll('è', 'e')
    .replaceAll('ê', 'e')
    .replaceAll('à', 'a')
    .replaceAll('ù', 'u')
    .replaceAll('ô', 'o');
}

export function generateTerraUpgrades(): TerraUpgradeDef[] {
  const upgrades: TerraUpgradeDef[] = [];

  const globalLadder = [
    { id: 'outils', name: 'Outils', steps: ['Faux rouillée', 'Faux en acier', 'Moissonneuse-batteuse', 'Combine GPS'], mult: 1.15 },
    { id: 'irrigation', name: 'Irrigation', steps: ['Arrosoir', 'Canal', 'Goutte-à-goutte', 'Réseau automatique'], mult: 1.12 },
  ] as const;

  globalLadder.forEach((g, idx) => {
    g.steps.forEach((label, i) => {
      const mult = g.mult;
      upgrades.push({
        id: createUpgradeId(['terra', 'global', g.id, String(i + 1)]),
        name: label,
        description: `${g.name} améliorés. Production globale ×${mult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}.`,
        cost: Math.round(250 * Math.pow(8, idx) * Math.pow(6, i)),
        effect: { type: 'global_mult', mult },
        unlock: { type: 'lifetime_produced', amount: Math.round(5_000 * Math.pow(8, idx) * Math.pow(6, i)) },
      });
    });
  });

  const categoryLadder = [
    { id: 'semences', name: 'Semences', category: 'cultures', steps: ['Semences locales', 'Semences hybrides', 'Semences OGM', 'Laboratoire'], mult: 1.25 },
    { id: 'betes', name: 'Bêtes', category: 'elevage', steps: ['Races locales', 'Races améliorées', 'Races primées', 'Races légendaires'], mult: 1.25 },
    { id: 'commerce', name: 'Commerce', category: 'commerce', steps: ['Vente au bord de route', 'Marché', 'Coopérative', 'Export'], mult: 1.25 },
  ] as const;

  categoryLadder.forEach((g, gi) => {
    g.steps.forEach((label, i) => {
      upgrades.push({
        id: createUpgradeId(['terra', 'cat', g.id, String(i + 1)]),
        name: label,
        description: `${g.name} améliorés. ${g.category} ×${g.mult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}.`,
        cost: Math.round(600 * Math.pow(10, gi) * Math.pow(7, i)),
        effect: { type: 'category_mult', category: g.category, mult: g.mult },
        unlock: { type: 'zone_unlocked', zoneIndex: Math.min(5, gi + 1) },
      });
    });
  });

  const tiers = [1, 5, 10, 25, 50, 100, 150, 200, 300, 400];
  for (const b of TERRAFARM_BUILDINGS) {
    for (let i = 0; i < tiers.length; i += 1) {
      const count = tiers[i]!;
      upgrades.push({
        id: createUpgradeId(['terra', 'b', b.id, 't', String(count)]),
        name: `${b.name} — Palier ${count}`,
        description: `${b.name} produit ×2.`,
        cost: Math.round(b.cost * (12 + i * 8) * Math.pow(1.6, i)),
        effect: { type: 'building_mult', buildingId: b.id, mult: 2 },
        unlock: { type: 'building_owned', buildingId: b.id, count },
      });
    }
  }

  return upgrades.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
}

export function generateTerraAchievements(): TerraAchievementDef[] {
  const achievements: TerraAchievementDef[] = [];

  const producedThresholds = [
    100, 500, 2_000, 10_000, 50_000, 250_000, 1_000_000, 5_000_000, 25_000_000, 100_000_000, 500_000_000, 2_500_000_000,
    10_000_000_000, 50_000_000_000, 250_000_000_000, 1_000_000_000_000,
  ];
  producedThresholds.forEach((amt, i) => {
    achievements.push({
      id: `terra_production_${i + 1}`,
      name: `Moisson ${i + 1}`,
      description: `Produire ${amt.toLocaleString('fr-FR')} ƒ au total.`,
      unlock: { type: 'lifetime_produced', amount: amt },
    });
  });

  const clicks = [10, 50, 200, 500, 1_000, 2_500, 5_000, 10_000];
  clicks.forEach((c, i) => {
    achievements.push({
      id: `terra_recolte_${i + 1}`,
      name: `Main verte ${i + 1}`,
      description: `Récolter ${c.toLocaleString('fr-FR')} fois.`,
      unlock: { type: 'harvest_clicks', count: c },
    });
  });

  const placed = [1, 3, 6, 9, 12, 16, 20, 25, 30, 40, 50];
  placed.forEach((c, i) => {
    achievements.push({
      id: `terra_parcelles_${i + 1}`,
      name: `Domaine ${i + 1}`,
      description: `Placer ${c.toLocaleString('fr-FR')} bâtiments sur la carte.`,
      unlock: { type: 'tiles_placed', count: c },
    });
  });

  for (let z = 1; z < TERRAFARM_ZONES.length; z += 1) {
    const zone = TERRAFARM_ZONES[z]!;
    achievements.push({
      id: `terra_zone_${zone.id}`,
      name: zone.name,
      description: `Débloquer la zone : ${zone.name}.`,
      unlock: { type: 'zone_unlocked', zoneIndex: z },
    });
  }

  const perBuildingCounts = [1, 5, 10, 25, 50, 100];
  for (const b of TERRAFARM_BUILDINGS) {
    for (const c of perBuildingCounts) {
      achievements.push({
        id: `terra_${b.id}_${c}`,
        name: `${b.name} ×${c}`,
        description: `Posséder ${c.toLocaleString('fr-FR')} ${b.name}.`,
        unlock: { type: 'building_owned', buildingId: b.id, count: c },
      });
    }
  }

  return achievements.slice(0, 150);
}

