export type BuildingId =
  | 'plume'
  | 'paysanne'
  | 'champ_ble'
  | 'carriere'
  | 'forge'
  | 'tresor'
  | 'cathedrale'
  | 'academie'
  | 'flotte'
  | 'alchimiste'
  | 'courriers'
  | 'strateges'
  | 'observatoire'
  | 'glaces'
  | 'oracle'
  | 'bibliotheque'
  | 'cabinet_noir'
  | 'empire_celeste'
  | 'legion';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  basePps: number;
  baseCost: number;
  costMult: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  unlock: { type: 'building_owned'; buildingId: BuildingId; count: number } | { type: 'total_produced'; amount: number } | { type: 'clicks'; count: number };
  effect:
    | { type: 'building_mult'; buildingId: BuildingId; mult: number }
    | { type: 'click_mult'; mult: number }
    | { type: 'global_prod_mult'; mult: number };
  category: 'building' | 'click' | 'global' | 'synergy';
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: 'production' | 'clicks' | 'buildings' | 'misc';
  condition:
    | { type: 'total_produced'; amount: number }
    | { type: 'clicks'; count: number }
    | { type: 'building_owned'; buildingId: BuildingId; count: number };
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'plume', name: 'La Plume', description: 'De l’encre, du papier, et des fortunes qui s’écrivent.', basePps: 0.1, baseCost: 15, costMult: 1.15 },
  { id: 'paysanne', name: 'La Paysanne', description: 'Elle nourrit l’Empire, un pain à la fois.', basePps: 1, baseCost: 100, costMult: 1.15 },
  { id: 'champ_ble', name: 'Le Champ de Blé', description: 'Des vagues d’or sous le vent, des pièces dans les coffres.', basePps: 8, baseCost: 1100, costMult: 1.15 },
  { id: 'carriere', name: 'La Carrière de Pierre', description: 'La pierre sculpte les monuments, et le temps.', basePps: 47, baseCost: 12000, costMult: 1.15 },
  { id: 'forge', name: 'La Forge Impériale', description: 'L’acier chante, les étincelles jurent fidélité.', basePps: 260, baseCost: 130000, costMult: 1.15 },
  { id: 'tresor', name: 'Le Trésor Royal', description: 'Tout ce qui brille finit ici.', basePps: 1400, baseCost: 1400000, costMult: 1.15 },
  { id: 'cathedrale', name: 'La Cathédrale Notre-Dame', description: 'Des vœux en pierre, des revenus en silence.', basePps: 7800, baseCost: 20000000, costMult: 1.15 },
  { id: 'academie', name: 'L’Académie des Sciences', description: 'Le progrès au service du profit.', basePps: 44000, baseCost: 330000000, costMult: 1.15 },
  { id: 'flotte', name: 'La Flotte Marchande', description: 'Des routes salées, des cargaisons dorées.', basePps: 260000, baseCost: 5100000000, costMult: 1.15 },
  { id: 'alchimiste', name: 'L’Atelier de l’Alchimiste', description: 'Transformer le plomb… et le destin.', basePps: 1600000, baseCost: 75000000000, costMult: 1.15 },
  { id: 'courriers', name: 'Le Réseau de Courriers', description: 'Chaque lettre porte une taxe.', basePps: 10000000, baseCost: 1_000_000_000_000, costMult: 1.15 },
  { id: 'strateges', name: 'Le Cabinet des Stratèges', description: 'Des plans parfaits, des gains imparables.', basePps: 65000000, baseCost: 14_000_000_000_000, costMult: 1.15 },
  { id: 'observatoire', name: 'L’Observatoire Impérial', description: 'Lire les étoiles pour prévoir les marchés.', basePps: 430000000, baseCost: 170_000_000_000_000, costMult: 1.15 },
  { id: 'glaces', name: 'La Galerie des Glaces', description: 'Le luxe reflète l’infini.', basePps: 2_900_000_000, baseCost: 2_100_000_000_000_000, costMult: 1.15 },
  { id: 'oracle', name: 'L’Oracle de Joséphine', description: 'Les présages se monnayent très bien.', basePps: 21_000_000_000, baseCost: 26_000_000_000_000_000, costMult: 1.15 },
  { id: 'bibliotheque', name: 'La Bibliothèque Nationale', description: 'Chaque page imprime du pouvoir.', basePps: 150_000_000_000, baseCost: 310_000_000_000_000_000, costMult: 1.15 },
  { id: 'cabinet_noir', name: 'Le Cabinet Noir', description: 'Des secrets vendus au plus offrant.', basePps: 1_100_000_000_000, baseCost: 71_000_000_000_000_000_000, costMult: 1.15 },
  { id: 'empire_celeste', name: 'L’Empire Céleste', description: 'Un royaume au-delà du royaume.', basePps: 8_300_000_000_000, baseCost: 12_000_000_000_000_000_000_000, costMult: 1.15 },
  { id: 'legion', name: 'La Légion d’Honneur Suprême', description: 'La gloire, enfin rentable.', basePps: 64_000_000_000_000, baseCost: 1_000_000_000_000_000_000_000_000, costMult: 1.15 },
];

export function getBuildingCost(building: BuildingDef, owned: number): number {
  return building.baseCost * Math.pow(building.costMult, owned);
}

export const BUILDING_UPGRADE_MILESTONES = [1, 5, 25, 50, 100, 150, 200, 250, 300, 400] as const;

export function generateUpgrades(): UpgradeDef[] {
  const upgrades: UpgradeDef[] = [];

  for (const b of BUILDINGS) {
    for (let i = 0; i < BUILDING_UPGRADE_MILESTONES.length; i++) {
      const need = BUILDING_UPGRADE_MILESTONES[i];
      const mult = 2;
      const id = `b_${b.id}_${need}`;
      upgrades.push({
        id,
        name: `Décret : ${b.name} ×${mult}`,
        description: `La production de « ${b.name} » est multipliée par ${mult}.`,
        cost: Math.round(b.baseCost * Math.pow(10, i + 1)),
        unlock: { type: 'building_owned', buildingId: b.id, count: need },
        effect: { type: 'building_mult', buildingId: b.id, mult },
        category: 'building',
      });
    }
  }

  for (let i = 0; i < 15; i++) {
    const id = `click_${i + 1}`;
    upgrades.push({
      id,
      name: `Décret de Clic ${i + 1}`,
      description: `La valeur de clic est doublée.`,
      cost: Math.round(250 * Math.pow(8, i)),
      unlock: { type: 'clicks', count: Math.max(50, i * 250) },
      effect: { type: 'click_mult', mult: 2 },
      category: 'click',
    });
  }

  for (let i = 0; i < 320; i++) {
    const id = `gazette_${i + 1}`;
    upgrades.push({
      id,
      name: `Gazette Impériale #${i + 1}`,
      description: `+1% de production globale.`,
      cost: Math.round(1_000 * Math.pow(1.35, i)),
      unlock: { type: 'total_produced', amount: Math.round(10_000 * Math.pow(1.5, i)) },
      effect: { type: 'global_prod_mult', mult: 1.01 },
      category: 'global',
    });
  }

  const pairs: Array<[BuildingId, BuildingId]> = [
    ['plume', 'paysanne'],
    ['paysanne', 'champ_ble'],
    ['champ_ble', 'carriere'],
    ['carriere', 'forge'],
    ['forge', 'tresor'],
    ['tresor', 'cathedrale'],
    ['cathedrale', 'academie'],
    ['academie', 'flotte'],
    ['flotte', 'alchimiste'],
    ['alchimiste', 'courriers'],
    ['courriers', 'strateges'],
    ['strateges', 'observatoire'],
    ['observatoire', 'glaces'],
    ['glaces', 'oracle'],
    ['oracle', 'bibliotheque'],
    ['bibliotheque', 'cabinet_noir'],
    ['cabinet_noir', 'empire_celeste'],
    ['empire_celeste', 'legion'],
  ];

  for (let i = 0; i < 30; i++) {
    const [a, b] = pairs[i % pairs.length];
    const id = `syn_${a}_${b}_${i + 1}`;
    upgrades.push({
      id,
      name: `Synergie #${i + 1}`,
      description: `« ${BUILDINGS.find((x) => x.id === a)?.name ?? a } » renforce « ${BUILDINGS.find((x) => x.id === b)?.name ?? b } ».`,
      cost: Math.round(50_000 * Math.pow(2.2, i)),
      unlock: { type: 'building_owned', buildingId: a, count: 25 + (i % 6) * 25 },
      effect: { type: 'building_mult', buildingId: b, mult: 1.05 },
      category: 'synergy',
    });
  }

  return upgrades.slice(0, 540);
}

export function generateAchievements(): AchievementDef[] {
  const achievements: AchievementDef[] = [];

  const prodThresholds: number[] = [];
  let prod = 10;
  for (let i = 0; i < 90; i++) {
    prodThresholds.push(Math.round(prod));
    prod *= 1.85;
  }
  for (let i = 0; i < prodThresholds.length; i++) {
    const amount = prodThresholds[i];
    achievements.push({
      id: `prod_${i + 1}`,
      name: `Chronique #${i + 1}`,
      description: `Produire ${amount.toLocaleString('en-US')} ₶ au total.`,
      category: 'production',
      condition: { type: 'total_produced', amount },
    });
  }

  const clickThresholds: number[] = [];
  let clicks = 10;
  for (let i = 0; i < 80; i++) {
    clickThresholds.push(Math.round(clicks));
    clicks *= 1.55;
  }
  for (let i = 0; i < clickThresholds.length; i++) {
    const count = clickThresholds[i];
    achievements.push({
      id: `click_${i + 1}`,
      name: `Doigt d’Acier #${i + 1}`,
      description: `Cliquer ${count.toLocaleString('en-US')} fois.`,
      category: 'clicks',
      condition: { type: 'clicks', count },
    });
  }

  const buildingThresholds = [1, 10, 25, 50, 100, 200];
  for (const b of BUILDINGS) {
    for (const count of buildingThresholds) {
      achievements.push({
        id: `own_${b.id}_${count}`,
        name: `${b.name} ×${count}`,
        description: `Posséder ${count} « ${b.name} ».`,
        category: 'buildings',
        condition: { type: 'building_owned', buildingId: b.id, count },
      });
    }
  }

  return achievements.slice(0, 260);
}
