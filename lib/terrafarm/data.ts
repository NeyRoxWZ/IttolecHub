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

