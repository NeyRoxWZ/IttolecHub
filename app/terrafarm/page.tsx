'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import {
  TERRAFARM_BUILDINGS,
  TERRAFARM_EVENTS,
  generateTerraAchievements,
  generateTerraUpgrades,
  TERRAFARM_SEASONS,
  TERRAFARM_SEASON_MS,
  TERRAFARM_ZONES,
  type TerraBuildingCategory,
  type TerraBuildingDef,
  type TerraBuildingId,
  type TerraAchievementDef,
  type TerraEventId,
  type TerraSeasonId,
  type TerraUpgradeDef,
} from '@/lib/terrafarm/data';
import { formatFrancs, formatFrancsRate } from '@/lib/terrafarm/format';

type TerraTile = {
  x: number;
  y: number;
  buildingId: TerraBuildingId;
  placedAt: number;
};

type ActiveEvent = {
  id: TerraEventId;
  name: string;
  startedAt: number;
  durationMs: number;
  prodMult: number;
};

type TerraFarmSave = {
  version: number;
  francs: number;
  totalProduced: number;
  lifetimeProduced: number;
  totalSpent: number;
  lastTickAt: number;
  seasonStartAt: number;
  mapWidth: number;
  mapHeight: number;
  zoneIndexUnlocked: number;
  tiles: TerraTile[];
  nextEventAt: number;
  activeEvent: ActiveEvent | null;
  lastEventNote: string;
  upgradesPurchased: string[];
  achievementsUnlocked: string[];
  harvestClicks: number;
};

const INITIAL_SAVE: TerraFarmSave = {
  version: 2,
  francs: 0,
  totalProduced: 0,
  lifetimeProduced: 0,
  totalSpent: 0,
  lastTickAt: Date.now(),
  seasonStartAt: Date.now(),
  mapWidth: TERRAFARM_ZONES[0]?.width ?? 3,
  mapHeight: TERRAFARM_ZONES[0]?.height ?? 3,
  zoneIndexUnlocked: 0,
  tiles: [],
  nextEventAt: Date.now() + (4 + Math.random() * 4) * 60_000,
  activeEvent: null,
  lastEventNote: '',
  upgradesPurchased: [],
  achievementsUnlocked: [],
  harvestClicks: 0,
};

const BASE_HARVEST_GAIN = 1;

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function getSeasonId(now: number, seasonStartAt: number): TerraSeasonId {
  const elapsed = Math.max(0, now - seasonStartAt);
  const idx = Math.floor((elapsed % (TERRAFARM_SEASON_MS * 4)) / TERRAFARM_SEASON_MS) % 4;
  return TERRAFARM_SEASONS[idx]?.id ?? 'printemps';
}

function scheduleNextEventAt(now: number): number {
  const minutes = 4 + Math.random() * 4;
  return now + minutes * 60_000;
}

function groupBuildingsByCategory(buildings: TerraBuildingDef[]): Array<{ category: TerraBuildingCategory; items: TerraBuildingDef[] }> {
  const order: TerraBuildingCategory[] = ['cultures', 'elevage', 'transformation', 'infrastructure', 'commerce', 'luxe'];
  const label: Record<TerraBuildingCategory, TerraBuildingCategory> = {
    cultures: 'cultures',
    elevage: 'elevage',
    transformation: 'transformation',
    infrastructure: 'infrastructure',
    commerce: 'commerce',
    luxe: 'luxe',
  };

  return order
    .map((c) => ({
      category: label[c],
      items: buildings.filter((b) => b.category === c),
    }))
    .filter((g) => g.items.length > 0);
}

function computeTileCounts(tiles: TerraTile[]): Map<TerraBuildingId, number> {
  const map = new Map<TerraBuildingId, number>();
  for (const t of tiles) {
    map.set(t.buildingId, (map.get(t.buildingId) ?? 0) + 1);
  }
  return map;
}

function isUpgradeUnlocked(upgrade: TerraUpgradeDef, save: TerraFarmSave, counts: Map<TerraBuildingId, number>): boolean {
  const u = upgrade.unlock;
  if (u.type === 'lifetime_produced') return (save.lifetimeProduced ?? 0) >= u.amount;
  if (u.type === 'zone_unlocked') return (save.zoneIndexUnlocked ?? 0) >= u.zoneIndex;
  if (u.type === 'harvest_clicks') return (save.harvestClicks ?? 0) >= u.count;
  if (u.type === 'building_owned') return (counts.get(u.buildingId) ?? 0) >= u.count;
  return false;
}

function isAchievementUnlocked(achievement: TerraAchievementDef, save: TerraFarmSave, counts: Map<TerraBuildingId, number>): boolean {
  const u = achievement.unlock;
  if (u.type === 'lifetime_produced') return (save.lifetimeProduced ?? 0) >= u.amount;
  if (u.type === 'harvest_clicks') return (save.harvestClicks ?? 0) >= u.count;
  if (u.type === 'tiles_placed') return (save.tiles?.length ?? 0) >= u.count;
  if (u.type === 'zone_unlocked') return (save.zoneIndexUnlocked ?? 0) >= u.zoneIndex;
  if (u.type === 'building_owned') return (counts.get(u.buildingId) ?? 0) >= u.count;
  return false;
}

function areStringArraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function TerraFarmPage() {
  const upgrades = useMemo(() => generateTerraUpgrades(), []);
  const achievements = useMemo(() => generateTerraAchievements(), []);

  const { data, setData, isLoaded } = useCloudSave<TerraFarmSave>('terrafarm', INITIAL_SAVE, { silent: true });

  const [selectedBuildingId, setSelectedBuildingId] = useState<TerraBuildingId | null>(null);
  const [activePanel, setActivePanel] = useState<'buildings' | 'upgrades' | 'achievements'>('buildings');
  const [achievementQuery, setAchievementQuery] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSpot, setTutorialSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tutorialCardTop, setTutorialCardTop] = useState(24);

  const buildingById = useMemo(() => new Map(TERRAFARM_BUILDINGS.map((b) => [b.id, b] as const)), []);
  const eventById = useMemo(() => new Map(TERRAFARM_EVENTS.map((e) => [e.id, e] as const)), []);
  const upgradeById = useMemo(() => new Map(upgrades.map((u) => [u.id, u] as const)), [upgrades]);
  const achievementById = useMemo(() => new Map(achievements.map((a) => [a.id, a] as const)), [achievements]);

  const moneyDesktopRef = useRef<HTMLDivElement | null>(null);
  const moneyMobileRef = useRef<HTMLDivElement | null>(null);
  const harvestDesktopRef = useRef<HTMLButtonElement | null>(null);
  const harvestMobileRef = useRef<HTMLButtonElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const seasonsRef = useRef<HTMLDivElement | null>(null);
  const expansionRef = useRef<HTMLDivElement | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);

  const lastPlacementToastAtRef = useRef(0);
  const showPlacementToast = useCallback((title: string, description: string) => {
    const now = Date.now();
    if (now - lastPlacementToastAtRef.current < 800) return;
    lastPlacementToastAtRef.current = now;
    toast(title, { description, duration: 2500 });
  }, []);

  const lastEventAnnouncedRef = useRef('');
  useEffect(() => {
    if (!data.activeEvent) return;
    const k = `${data.activeEvent.id}:${data.activeEvent.startedAt}`;
    if (k === lastEventAnnouncedRef.current) return;
    lastEventAnnouncedRef.current = k;
    const def = eventById.get(data.activeEvent.id);
    if (!def) return;
    const desc = data.lastEventNote ? `${def.description} ${data.lastEventNote}` : def.description;
    toast(def.name, { description: desc, duration: 4000 });
  }, [data.activeEvent, data.lastEventNote, eventById]);

  useEffect(() => {
    if (!isLoaded) return;
    const now = Date.now();
    setData((prev) => {
      const version = typeof prev.version === 'number' ? prev.version : 0;
      const seasonStartAt = prev.seasonStartAt > 0 ? prev.seasonStartAt : now;
      const nextEventAt = prev.nextEventAt > 0 ? prev.nextEventAt : scheduleNextEventAt(now);
      const lastEventNote = typeof prev.lastEventNote === 'string' ? prev.lastEventNote : '';
      const upgradesPurchased = Array.isArray(prev.upgradesPurchased) ? prev.upgradesPurchased : [];
      const achievementsUnlocked = Array.isArray(prev.achievementsUnlocked) ? prev.achievementsUnlocked : [];
      const harvestClicks = typeof prev.harvestClicks === 'number' ? prev.harvestClicks : 0;
      const totalSpent = typeof prev.totalSpent === 'number' ? prev.totalSpent : 0;

      const next: TerraFarmSave = {
        ...prev,
        version: Math.max(2, version),
        seasonStartAt,
        nextEventAt,
        lastEventNote,
        upgradesPurchased,
        achievementsUnlocked,
        harvestClicks,
        totalSpent,
        lastTickAt: now,
      };

      const changed =
        next.version !== prev.version ||
        seasonStartAt !== prev.seasonStartAt ||
        nextEventAt !== prev.nextEventAt ||
        lastEventNote !== prev.lastEventNote ||
        upgradesPurchased !== prev.upgradesPurchased ||
        achievementsUnlocked !== prev.achievementsUnlocked ||
        harvestClicks !== prev.harvestClicks ||
        totalSpent !== prev.totalSpent;

      return changed ? next : prev;
    });
  }, [isLoaded, setData]);

  const tutorialSteps = useMemo(
    () => [
      { key: 'money', title: 'Francs Paysans', body: 'Ta monnaie. Elle augmente automatiquement grâce à tes bâtiments.' },
      { key: 'harvest', title: 'Récolter', body: 'Clique Récolter pour démarrer (gagner tes premiers ƒ) et accélérer au début.' },
      { key: 'tabs', title: 'Boutique / Upgrades / Succès', body: 'Boutique = poser des bâtiments. Upgrades = multiplicateurs. Succès = bonus permanent.' },
      { key: 'map', title: 'Carte', body: 'Choisis un bâtiment puis clique une tuile pour le placer. Sélectionne un autre bâtiment et reclique pour remplacer.' },
      { key: 'seasons', title: 'Saisons & événements', body: 'Les saisons changent la production. Des événements aléatoires donnent des bonus ou des malus.' },
      { key: 'expansion', title: 'Expansion', body: 'Quand tu as assez de ƒ, débloque une nouvelle zone pour agrandir ta ferme et accéder à de nouveaux bâtiments.' },
    ],
    []
  );

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const done = localStorage.getItem('terrafarm_tutorial_done') === '1';
      if (!done) {
        setTutorialOpen(true);
        setTutorialStep(0);
      }
    } catch {}
  }, [isLoaded]);

  useEffect(() => {
    if (!tutorialOpen) {
      setTutorialSpot(null);
      return;
    }

    const step = tutorialSteps[tutorialStep];
    const pickVisible = (a: HTMLElement | null, b: HTMLElement | null) => {
      const ar = a?.getBoundingClientRect();
      if (a && ar && ar.width > 0 && ar.height > 0) return a;
      const br = b?.getBoundingClientRect();
      if (b && br && br.width > 0 && br.height > 0) return b;
      return a ?? b ?? null;
    };

    const getEl = () => {
      if (step?.key === 'money') return pickVisible(moneyDesktopRef.current, moneyMobileRef.current);
      if (step?.key === 'harvest') return pickVisible(harvestDesktopRef.current, harvestMobileRef.current);
      if (step?.key === 'tabs') return tabsRef.current;
      if (step?.key === 'map') return mapRef.current;
      if (step?.key === 'seasons') return seasonsRef.current;
      if (step?.key === 'expansion') return expansionRef.current;
      return null;
    };

    const update = () => {
      const el = getEl();
      if (!el) {
        setTutorialSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTutorialSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [tutorialOpen, tutorialStep, tutorialSteps]);

  useEffect(() => {
    if (!tutorialOpen || !tutorialSpot) return;
    const vh = window.innerHeight;
    const cardHeight = tutorialCardRef.current?.getBoundingClientRect().height ?? 280;
    const padding = 16;
    const gap = 16;

    const belowTop = tutorialSpot.top + tutorialSpot.height + gap;
    const aboveTop = tutorialSpot.top - cardHeight - gap;

    let top = belowTop;
    if (belowTop + cardHeight > vh - padding) {
      top = aboveTop >= padding ? aboveTop : Math.max(padding, vh - cardHeight - padding);
    }

    top = Math.max(padding, Math.min(vh - cardHeight - padding, top));
    setTutorialCardTop(top);
  }, [tutorialOpen, tutorialSpot, tutorialStep]);

  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    setTutorialStep(0);
    try {
      localStorage.setItem('terrafarm_tutorial_done', '1');
    } catch {}
  }, []);

  const ownedCountByBuilding = useMemo(() => computeTileCounts(data.tiles), [data.tiles]);

  const purchasedUpgrades = useMemo(() => new Set(data.upgradesPurchased ?? []), [data.upgradesPurchased]);

  const upgradeMults = useMemo(() => {
    const category: Record<TerraBuildingCategory, number> = {
      cultures: 1,
      elevage: 1,
      transformation: 1,
      infrastructure: 1,
      commerce: 1,
      luxe: 1,
    };
    const building = new Map<TerraBuildingId, number>();
    TERRAFARM_BUILDINGS.forEach((b) => building.set(b.id, 1));

    let global = 1;
    let harvest = 1;

    for (const u of upgrades) {
      if (!purchasedUpgrades.has(u.id)) continue;
      if (u.effect.type === 'global_mult') global *= u.effect.mult;
      if (u.effect.type === 'harvest_mult') harvest *= u.effect.mult;
      if (u.effect.type === 'category_mult') category[u.effect.category] *= u.effect.mult;
      if (u.effect.type === 'building_mult') building.set(u.effect.buildingId, (building.get(u.effect.buildingId) ?? 1) * u.effect.mult);
    }

    return { global, harvest, category, building };
  }, [purchasedUpgrades, upgrades]);

  const season = useMemo(() => {
    const now = Date.now();
    const id = getSeasonId(now, data.seasonStartAt);
    return TERRAFARM_SEASONS.find((s) => s.id === id) ?? TERRAFARM_SEASONS[0]!;
  }, [data.seasonStartAt]);

  const activeEvent = data.activeEvent;
  const seasonMult = season.prodMult;
  const eventGlobalMult = activeEvent && activeEvent.id !== 'disease' ? activeEvent.prodMult : 1;
  const eventElevageMult = activeEvent && activeEvent.id === 'disease' ? activeEvent.prodMult : 1;
  const achievementProdMult = 1 + Math.max(0, (data.achievementsUnlocked?.length ?? 0)) * 0.01;

  const buildingFps = useMemo(() => {
    let sum = 0;
    ownedCountByBuilding.forEach((count, id) => {
      const def = buildingById.get(id);
      if (!def) return;
      const bMult = upgradeMults.building.get(id) ?? 1;
      const catMult = upgradeMults.category[def.category] ?? 1;
      const eventCatMult = def.category === 'elevage' ? eventElevageMult : 1;
      sum += def.baseFps * count * bMult * catMult * eventCatMult;
    });
    return sum;
  }, [buildingById, eventElevageMult, ownedCountByBuilding, upgradeMults.building, upgradeMults.category]);

  const netFps = buildingFps * upgradeMults.global * achievementProdMult * seasonMult * eventGlobalMult;

  const baseFps = buildingFps * upgradeMults.global * achievementProdMult;
  const eventDisplayMult = activeEvent ? (activeEvent.id === 'disease' ? eventElevageMult : eventGlobalMult) : 1;
  const eventDisplayLabel = activeEvent ? (activeEvent.id === 'disease' ? 'Élevage' : 'Global') : '';

  const harvestGain = BASE_HARVEST_GAIN * upgradeMults.harvest;

  const computeAchievementsUnlockedNow = useCallback(
    (save: TerraFarmSave) => {
      const counts = computeTileCounts(save.tiles ?? []);
      const unlocked: string[] = [];
      for (const a of achievements) {
        if (isAchievementUnlocked(a, save, counts)) unlocked.push(a.id);
      }
      return unlocked;
    },
    [achievements]
  );

  const prevAchievementsUnlockedRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    const prev = prevAchievementsUnlockedRef.current;
    const next = data.achievementsUnlocked ?? [];
    if (!prev) {
      prevAchievementsUnlockedRef.current = next;
      return;
    }
    const prevSet = new Set(prev);
    const newly = next.filter((id) => !prevSet.has(id));
    prevAchievementsUnlockedRef.current = next;
    if (newly.length === 0) return;
    newly.slice(0, 4).forEach((id) => {
      const a = achievementById.get(id);
      if (!a) return;
      toast('Succès débloqué', { description: a.name, duration: 3500 });
    });
  }, [achievementById, data.achievementsUnlocked, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    const tick = () => {
      setData((prev) => {
        const now = Date.now();
        const elapsedMs = Math.max(0, now - prev.lastTickAt);
        const steps = Math.min(10, Math.floor(elapsedMs / 1000));
        if (steps <= 0) return prev;

        const seasonId = getSeasonId(now, prev.seasonStartAt);
        const seasonDef = TERRAFARM_SEASONS.find((s) => s.id === seasonId) ?? TERRAFARM_SEASONS[0]!;

        let event = prev.activeEvent;
        if (event && now >= event.startedAt + event.durationMs) {
          event = null;
        }

        let tiles = prev.tiles;
        let nextEventAt = prev.nextEventAt;
        let lastEventNote = typeof prev.lastEventNote === 'string' ? prev.lastEventNote : '';
        if (!event && now >= prev.nextEventAt) {
          const options = TERRAFARM_EVENTS;
          const def = options[Math.floor(Math.random() * options.length)] ?? options[0]!;
          const e: ActiveEvent = { id: def.id, name: def.name, startedAt: now, durationMs: def.durationMs, prodMult: def.prodMult };
          event = e;
          nextEventAt = scheduleNextEventAt(now);
          lastEventNote = '';

          if (def.id === 'storm') {
            const cropTiles = tiles.filter((t) => buildingById.get(t.buildingId)?.category === 'cultures');
            const toRemove = cropTiles.length > 0 ? Math.max(1, Math.floor(cropTiles.length * 0.1)) : 0;
            if (toRemove > 0 && cropTiles.length > 0) {
              const removeSet = new Set<string>();
              while (removeSet.size < toRemove) {
                const pick = cropTiles[Math.floor(Math.random() * cropTiles.length)];
                if (!pick) break;
                removeSet.add(`${pick.x}:${pick.y}`);
              }
              tiles = tiles.filter((t) => !removeSet.has(`${t.x}:${t.y}`));
              lastEventNote = `(${toRemove} détruites)`;
            }
          }
        }

        const counts = computeTileCounts(tiles);
        const purchased = new Set(prev.upgradesPurchased ?? []);

        const category: Record<TerraBuildingCategory, number> = {
          cultures: 1,
          elevage: 1,
          transformation: 1,
          infrastructure: 1,
          commerce: 1,
          luxe: 1,
        };
        const building = new Map<TerraBuildingId, number>();
        TERRAFARM_BUILDINGS.forEach((b) => building.set(b.id, 1));

        let globalMult = 1;
        for (const u of upgrades) {
          if (!purchased.has(u.id)) continue;
          if (u.effect.type === 'global_mult') globalMult *= u.effect.mult;
          if (u.effect.type === 'category_mult') category[u.effect.category] *= u.effect.mult;
          if (u.effect.type === 'building_mult') building.set(u.effect.buildingId, (building.get(u.effect.buildingId) ?? 1) * u.effect.mult);
        }

        const eventGlobal = event && event.id !== 'disease' ? event.prodMult : 1;
        const eventElevage = event && event.id === 'disease' ? event.prodMult : 1;
        const achievementMult = 1 + Math.max(0, (prev.achievementsUnlocked?.length ?? 0)) * 0.01;

        let buildingFpsNow = 0;
        counts.forEach((count, id) => {
          const def = buildingById.get(id);
          if (!def) return;
          const bMult = building.get(id) ?? 1;
          const catMult = category[def.category] ?? 1;
          const eventCatMult = def.category === 'elevage' ? eventElevage : 1;
          buildingFpsNow += def.baseFps * count * bMult * catMult * eventCatMult;
        });

        const produced = buildingFpsNow * globalMult * achievementMult * seasonDef.prodMult * eventGlobal * steps;

        const nextBase: TerraFarmSave = {
          ...prev,
          francs: clampNonNegative(prev.francs + produced),
          totalProduced: clampNonNegative(prev.totalProduced + produced),
          lifetimeProduced: clampNonNegative(prev.lifetimeProduced + produced),
          lastTickAt: prev.lastTickAt + steps * 1000,
          tiles,
          nextEventAt,
          activeEvent: event,
          lastEventNote,
        };

        const nextAchievements = computeAchievementsUnlockedNow(nextBase);
        if (!areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked)) {
          return { ...nextBase, achievementsUnlocked: nextAchievements };
        }

        return nextBase;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [buildingById, computeAchievementsUnlockedNow, isLoaded, setData, upgrades]);

  const unlockedBuildings = useMemo(() => {
    const zoneIndex = data.zoneIndexUnlocked ?? 0;
    return TERRAFARM_BUILDINGS.filter((b) => b.minZoneIndex <= zoneIndex);
  }, [data.zoneIndexUnlocked]);

  const buildingGroups = useMemo(() => groupBuildingsByCategory(unlockedBuildings), [unlockedBuildings]);

  const unlockedUpgrades = useMemo(() => {
    return upgrades.filter((u) => isUpgradeUnlocked(u, data, ownedCountByBuilding));
  }, [data, ownedCountByBuilding, upgrades]);

  const availableUpgrades = useMemo(() => {
    return unlockedUpgrades.filter((u) => !purchasedUpgrades.has(u.id));
  }, [purchasedUpgrades, unlockedUpgrades]);

  const buyUpgrade = useCallback(
    (upgradeId: string) => {
      const def = upgradeById.get(upgradeId);
      if (!def) return;
      setData((prev) => {
        if ((prev.upgradesPurchased ?? []).includes(def.id)) return prev;
        const counts = computeTileCounts(prev.tiles ?? []);
        if (!isUpgradeUnlocked(def, prev, counts)) return prev;
        if (prev.francs < def.cost) {
          showPlacementToast('Pas assez de ƒ', `Il te manque ${formatFrancs(def.cost - prev.francs)} ƒ.`);
          return prev;
        }
        toast('Upgrade acheté', { description: def.name, duration: 3000 });
        const nextBase: TerraFarmSave = {
          ...prev,
          francs: clampNonNegative(prev.francs - def.cost),
          totalSpent: clampNonNegative(prev.totalSpent + def.cost),
          upgradesPurchased: [...(prev.upgradesPurchased ?? []), def.id],
        };
        const nextAchievements = computeAchievementsUnlockedNow(nextBase);
        return areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked) ? nextBase : { ...nextBase, achievementsUnlocked: nextAchievements };
      });
    },
    [computeAchievementsUnlockedNow, setData, showPlacementToast, upgradeById]
  );

  const achievementsFiltered = useMemo(() => {
    const q = achievementQuery.trim().toLowerCase();
    if (!q) return achievements;
    return achievements.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [achievementQuery, achievements]);

  const gridTiles = useMemo(() => {
    const items: Array<{ x: number; y: number }> = [];
    const w = Math.max(1, Math.floor(data.mapWidth));
    const h = Math.max(1, Math.floor(data.mapHeight));
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        items.push({ x, y });
      }
    }
    return items;
  }, [data.mapHeight, data.mapWidth]);

  const tileByCoord = useMemo(() => {
    const map = new Map<string, TerraTile>();
    for (const t of data.tiles) {
      map.set(`${t.x}:${t.y}`, t);
    }
    return map;
  }, [data.tiles]);

  const harvest = useCallback(() => {
    const now = Date.now();
    setData((prev) => {
      let harvestMult = 1;
      const purchased = new Set(prev.upgradesPurchased ?? []);
      for (const u of upgrades) {
        if (!purchased.has(u.id)) continue;
        if (u.effect.type === 'harvest_mult') harvestMult *= u.effect.mult;
      }
      const gain = BASE_HARVEST_GAIN * harvestMult;

      const nextBase: TerraFarmSave = {
        ...prev,
        francs: clampNonNegative(prev.francs + gain),
        totalProduced: clampNonNegative(prev.totalProduced + gain),
        lifetimeProduced: clampNonNegative(prev.lifetimeProduced + gain),
        lastTickAt: prev.lastTickAt > 0 ? prev.lastTickAt : now,
        harvestClicks: (prev.harvestClicks ?? 0) + 1,
      };

      const nextAchievements = computeAchievementsUnlockedNow(nextBase);
      if (!areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked)) {
        return { ...nextBase, achievementsUnlocked: nextAchievements };
      }
      return nextBase;
    });
  }, [computeAchievementsUnlockedNow, setData, upgrades]);

  const placeOnTile = useCallback(
    (x: number, y: number) => {
      setData((prev) => {
        const key = `${x}:${y}`;
        const idx = prev.tiles.findIndex((t) => `${t.x}:${t.y}` === key);
        const already = idx >= 0 ? prev.tiles[idx] ?? null : null;

        if (!selectedBuildingId) {
          if (already) {
            const def = buildingById.get(already.buildingId);
            if (def) showPlacementToast(def.name, `Sélectionne un autre bâtiment pour remplacer cette tuile.`);
          } else {
            showPlacementToast('Placement', 'Clique un bâtiment dans la boutique, puis clique une tuile.');
          }
          return prev;
        }
        const def = buildingById.get(selectedBuildingId);
        if (!def) return prev;

        if (already) {
          if (already.buildingId === def.id) {
            showPlacementToast(def.name, 'Déjà placé ici.');
            return prev;
          }
          const oldDef = buildingById.get(already.buildingId);
          const refund = oldDef ? oldDef.cost * 0.5 : 0;
          const price = Math.max(0, def.cost - refund);
          if (prev.francs < price) {
            showPlacementToast('Pas assez de ƒ', `Il te manque ${formatFrancs(price - prev.francs)} ƒ.`);
            return prev;
          }

          const nextTiles = [...prev.tiles];
          nextTiles[idx] = { x, y, buildingId: def.id, placedAt: Date.now() };
          const nextBase: TerraFarmSave = {
            ...prev,
            francs: clampNonNegative(prev.francs - price),
            totalSpent: clampNonNegative(prev.totalSpent + price),
            tiles: nextTiles,
          };
          const nextAchievements = computeAchievementsUnlockedNow(nextBase);
          showPlacementToast('Remplacé', `${oldDef?.name ?? '—'} → ${def.name}`);
          return areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked)
            ? nextBase
            : { ...nextBase, achievementsUnlocked: nextAchievements };
        }

        if (prev.francs < def.cost) {
          showPlacementToast('Pas assez de ƒ', `Il te manque ${formatFrancs(def.cost - prev.francs)} ƒ.`);
          return prev;
        }

        const next: TerraTile = { x, y, buildingId: def.id, placedAt: Date.now() };
        const nextBase: TerraFarmSave = {
          ...prev,
          francs: clampNonNegative(prev.francs - def.cost),
          totalSpent: clampNonNegative(prev.totalSpent + def.cost),
          tiles: [...prev.tiles, next],
        };
        const nextAchievements = computeAchievementsUnlockedNow(nextBase);
        return areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked) ? nextBase : { ...nextBase, achievementsUnlocked: nextAchievements };
      });
    },
    [buildingById, computeAchievementsUnlockedNow, selectedBuildingId, setData, showPlacementToast]
  );

  const nextZone = TERRAFARM_ZONES[(data.zoneIndexUnlocked ?? 0) + 1] ?? null;
  const unlockProgress = useMemo(() => {
    if (!nextZone) return { pct: 1, remaining: 0 };
    const pct = nextZone.unlockCost <= 0 ? 1 : Math.min(1, (data.francs ?? 0) / nextZone.unlockCost);
    const remaining = Math.max(0, nextZone.unlockCost - (data.francs ?? 0));
    return { pct, remaining };
  }, [data.francs, nextZone]);

  const unlockNextZone = useCallback(() => {
    if (!nextZone) return;
    setData((prev) => {
      if (prev.francs < nextZone.unlockCost) return prev;
      const nextIndex = (prev.zoneIndexUnlocked ?? 0) + 1;
      const z = TERRAFARM_ZONES[nextIndex];
      if (!z) return prev;
      toast('Expansion', { description: `Nouvelle zone débloquée : ${z.name}`, duration: 4500 });
      return {
        ...prev,
        francs: clampNonNegative(prev.francs - z.unlockCost),
        zoneIndexUnlocked: nextIndex,
        mapWidth: z.width,
        mapHeight: z.height,
      };
    });
  }, [nextZone, setData]);

  const TILE_W = 92;
  const TILE_H = 46;
  const offsetX = (Math.max(1, Math.floor(data.mapHeight)) * TILE_W) / 2;
  const mapWidthPx = ((Math.max(1, Math.floor(data.mapWidth)) + Math.max(1, Math.floor(data.mapHeight))) * TILE_W) / 2 + TILE_W;
  const mapHeightPx = ((Math.max(1, Math.floor(data.mapWidth)) + Math.max(1, Math.floor(data.mapHeight))) * TILE_H) / 2 + TILE_H;

  return (
    <div className="min-h-screen px-4 md:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center h-10 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              >
                Accueil
              </Link>
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-wider uppercase">TerraFarm</h1>
                <div className="text-tx-secondary font-bold text-sm">Ferme infinie — saisons, événements, expansions</div>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={harvest}
              ref={harvestDesktopRef}
              className="inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              aria-label="Récolter"
            >
              Récolter +{formatFrancs(harvestGain)} ƒ
            </button>
            <button
              type="button"
              onClick={() => {
                setTutorialOpen(true);
                setTutorialStep(0);
              }}
              className="inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Tutoriel
            </button>
            <div ref={moneyDesktopRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">Francs Paysans</div>
              <div className="text-xl font-display font-black tracking-wider">
                {formatFrancs(data.francs)} <span className="text-accent-primary">ƒ</span>
              </div>
              <div className="text-xs text-tx-secondary font-bold">{formatFrancsRate(netFps)} ƒ/s</div>
            </div>
          </div>
        </div>

        <div ref={moneyMobileRef} className="md:hidden mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-tx-secondary font-bold">Francs Paysans</div>
              <div className="text-xl font-display font-black tracking-wider">
                {formatFrancs(data.francs)} <span className="text-accent-primary">ƒ</span>
              </div>
              <div className="text-xs text-tx-secondary font-bold">{formatFrancsRate(netFps)} ƒ/s</div>
              <button
                type="button"
                onClick={harvest}
                ref={harvestMobileRef}
                className="mt-2 inline-flex items-center justify-center h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                aria-label="Récolter"
              >
                Récolter +{formatFrancs(harvestGain)} ƒ
              </button>
              <button
                type="button"
                onClick={() => {
                  setTutorialOpen(true);
                  setTutorialStep(0);
                }}
                className="mt-2 inline-flex items-center justify-center h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              >
                Tutoriel
              </button>
            </div>
            <div className="text-right">
              <div className="text-xs text-tx-secondary font-bold">Saison</div>
              <div className="text-sm font-display font-black tracking-wider uppercase">{season.name}</div>
              <div className="text-xs text-tx-secondary font-bold">×{seasonMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <div ref={mapRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-display font-black tracking-wider uppercase">Carte</div>
                  <div className="text-xs text-tx-secondary font-bold">
                    Zone : <span className="text-tx-base">{TERRAFARM_ZONES[data.zoneIndexUnlocked]?.name ?? 'Parcelle'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-tx-secondary font-bold">Placement</div>
                  <div
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      selectedBuildingId
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border'
                    )}
                  >
                    {selectedBuildingId ? buildingById.get(selectedBuildingId)?.name ?? '—' : 'Choisis un bâtiment'}
                  </div>
                  {selectedBuildingId && (
                    <button
                      type="button"
                      onClick={() => setSelectedBuildingId(null)}
                      className="h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 overflow-auto">
                <div className="relative" style={{ width: mapWidthPx, height: mapHeightPx }}>
                  {gridTiles.map(({ x, y }) => {
                    const left = offsetX + ((x - y) * TILE_W) / 2;
                    const top = ((x + y) * TILE_H) / 2;
                    const t = tileByCoord.get(`${x}:${y}`) ?? null;
                    const building = t ? buildingById.get(t.buildingId) ?? null : null;
                    const canPlace = !t && !!selectedBuildingId;
                    const canAfford = selectedBuildingId ? data.francs >= (buildingById.get(selectedBuildingId)?.cost ?? Infinity) : false;

                    return (
                      <button
                        key={`${x}:${y}`}
                        type="button"
                        onClick={() => placeOnTile(x, y)}
                        className={cn(
                          'absolute flex items-center justify-center transition-colors',
                          !t && selectedBuildingId && !canAfford ? 'opacity-55' : 'hover:opacity-95'
                        )}
                        style={{ left, top, width: TILE_W, height: TILE_H }}
                        aria-label={building ? building.name : canPlace ? 'Placer' : 'Tuile'}
                      >
                        <svg viewBox="0 0 100 60" className="w-full h-full" aria-hidden="true">
                          <path
                            d="M50 2 L98 30 L50 58 L2 30 Z"
                            className={cn(
                              'fill-current',
                              building ? 'text-brand-card' : canPlace ? 'text-accent-primary' : 'text-brand-card'
                            )}
                            fillOpacity={building ? 0.9 : canPlace ? 0.22 : 0.55}
                          />
                          <path d="M50 2 L98 30 L50 58 L2 30 Z" className="stroke-current text-brand-border" strokeWidth="3" fill="none" />
                          {building && (
                            <text
                              x="50"
                              y="36"
                              textAnchor="middle"
                              className="fill-current text-tx-base"
                              fontSize="12"
                              fontFamily="ui-sans-serif, system-ui"
                              fontWeight="800"
                            >
                              {building.name.length > 12 ? `${building.name.slice(0, 11)}…` : building.name}
                            </text>
                          )}
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div ref={seasonsRef} className="mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-display font-black tracking-wider uppercase">Saisons & événements</div>
                  <div className="text-xs text-tx-secondary font-bold">
                    Saison actuelle : <span className="text-tx-base">{season.name}</span> (×
                    {seasonMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-tx-secondary font-bold">Événement</div>
                  <div className="text-sm font-display font-black tracking-wider uppercase">{activeEvent ? activeEvent.name : 'Aucun'}</div>
                  <div className="text-xs text-tx-secondary font-bold">
                    {activeEvent
                      ? `${eventDisplayLabel} ×${eventDisplayMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
                <div className="rounded-lg border-2 border-brand-border bg-brand-inner shadow-brutal px-3 py-2">
                  <div className="text-tx-secondary">Base</div>
                  <div className="text-tx-base">{formatFrancsRate(baseFps)} ƒ/s</div>
                </div>
                <div className="rounded-lg border-2 border-brand-border bg-brand-inner shadow-brutal px-3 py-2">
                  <div className="text-tx-secondary">Saison</div>
                  <div className="text-tx-base">×{seasonMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
                </div>
                <div className="rounded-lg border-2 border-brand-border bg-brand-inner shadow-brutal px-3 py-2">
                  <div className="text-tx-secondary">Événement</div>
                  <div className="text-tx-base">
                    {activeEvent
                      ? `${eventDisplayLabel} ×${eventDisplayMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg border-2 border-brand-border bg-brand-inner shadow-brutal px-3 py-2">
                  <div className="text-tx-secondary">Total</div>
                  <div className="text-tx-base">{formatFrancsRate(netFps)} ƒ/s</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div ref={tabsRef} className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActivePanel('buildings')}
                  className={cn(
                    'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    activePanel === 'buildings'
                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Boutique
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('upgrades')}
                  className={cn(
                    'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    activePanel === 'upgrades'
                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Upgrades
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('achievements')}
                  className={cn(
                    'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    activePanel === 'achievements'
                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Succès
                </button>
              </div>

              {activePanel === 'buildings' ? (
                <div className="mt-4 space-y-4">
                  <div className="text-xs text-tx-secondary font-bold">Clique un bâtiment puis clique une tuile. Reclique avec un autre bâtiment pour remplacer.</div>
                  {buildingGroups.map((g) => (
                    <div key={g.category} className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold uppercase tracking-wider">{g.category}</div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {g.items.map((b) => {
                          const selected = b.id === selectedBuildingId;
                          const owned = ownedCountByBuilding.get(b.id) ?? 0;
                          const affordable = data.francs >= b.cost;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBuildingId(b.id)}
                              className={cn(
                                'w-full text-left rounded-lg border-2 px-3 py-2 transition-colors',
                                selected
                                  ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                                  : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-display font-black tracking-wider uppercase text-sm">{b.name}</div>
                                <div className={cn('text-xs font-bold', affordable || selected ? 'text-inherit' : 'text-tx-secondary')}>
                                  {formatFrancs(b.cost)} ƒ
                                </div>
                              </div>
                              <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                +{formatFrancsRate(b.baseFps)} ƒ/s • Possédé : {owned}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activePanel === 'upgrades' ? (
                <div className="mt-4">
                  <div className="text-xs text-tx-secondary font-bold">
                    Disponibles : <span className="text-tx-base">{availableUpgrades.length}</span> • Achetés :{' '}
                    <span className="text-tx-base">{data.upgradesPurchased.length}</span>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {availableUpgrades.length === 0 ? (
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                        Rien à acheter pour le moment. Pose plus de bâtiments / produis plus pour débloquer.
                      </div>
                    ) : (
                      availableUpgrades.slice(0, 80).map((u) => {
                        const affordable = data.francs >= u.cost;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => buyUpgrade(u.id)}
                            disabled={!affordable}
                            className={cn(
                              'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                              affordable
                                ? 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                : 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{u.name}</div>
                                <div className="mt-1 text-xs font-bold">{u.description}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold">{formatFrancs(u.cost)} ƒ</div>
                                <div className="mt-2 text-xs font-display font-black tracking-wider uppercase">
                                  {affordable ? 'Acheter' : '—'}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {activePanel === 'achievements' ? (
                <div className="mt-4">
                  <div className="text-xs text-tx-secondary font-bold">
                    Débloqués : <span className="text-tx-base">{data.achievementsUnlocked.length}</span> / {achievements.length} • Bonus :{' '}
                    <span className="text-tx-base">×{achievementProdMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
                  </div>
                  <input
                    value={achievementQuery}
                    onChange={(e) => setAchievementQuery(e.target.value)}
                    placeholder="Rechercher un succès…"
                    className="mt-3 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                    aria-label="Rechercher un succès"
                  />
                  <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {achievementsFiltered.slice(0, 120).map((a) => {
                      const unlocked = (data.achievementsUnlocked ?? []).includes(a.id);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            'rounded-xl border-2 px-3 py-3',
                            unlocked ? 'bg-brand-inner text-tx-base border-brand-border shadow-brutal' : 'bg-brand-inner text-tx-secondary border-brand-border opacity-70'
                          )}
                        >
                          <div className="font-display font-black tracking-wider uppercase text-sm">{a.name}</div>
                          <div className="mt-1 text-xs font-bold">{a.description}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={expansionRef} className="mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="text-sm font-display font-black tracking-wider uppercase">Expansion</div>
              {nextZone ? (
                <>
                  <div className="mt-1 text-xs text-tx-secondary font-bold">
                    Prochaine zone : <span className="text-tx-base">{nextZone.name}</span> — Coût :{' '}
                    <span className="text-tx-base">{formatFrancs(nextZone.unlockCost)} ƒ</span>
                  </div>

                  <div className="mt-3 rounded-full border-2 border-brand-border bg-brand-inner shadow-brutal h-4 overflow-hidden">
                    <div className="h-full bg-accent-primary" style={{ width: `${Math.round(unlockProgress.pct * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-tx-secondary font-bold">Reste : {formatFrancs(unlockProgress.remaining)} ƒ</div>
                    <button
                      type="button"
                      onClick={unlockNextZone}
                      disabled={data.francs < nextZone.unlockCost}
                      className={cn(
                        'h-11 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                        data.francs < nextZone.unlockCost
                          ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                          : 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                      )}
                    >
                      Débloquer
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-tx-secondary font-bold">Toutes les zones sont débloquées.</div>
              )}
            </div>
          </div>
        </div>

        {data.lastEventNote && data.activeEvent ? (
          <div className="mt-6 text-xs text-tx-secondary font-bold">Note : {data.lastEventNote}</div>
        ) : null}

        {tutorialOpen && tutorialSpot ? (
          <div className="fixed inset-0 z-[99999]">
            <div
              className="absolute rounded-[28px] border-2 border-tx-base pointer-events-none"
              style={{
                top: Math.max(8, tutorialSpot.top - 8),
                left: Math.max(8, tutorialSpot.left - 8),
                width: Math.max(0, tutorialSpot.width + 16),
                height: Math.max(0, tutorialSpot.height + 16),
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
              }}
            />

            <div
              ref={tutorialCardRef}
              className="absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal"
              style={{ top: tutorialCardTop }}
            >
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                Tutoriel {tutorialStep + 1} / {tutorialSteps.length}
              </div>
              <div className="mt-2 font-display text-2xl font-black tracking-wider uppercase text-tx-base">{tutorialSteps[tutorialStep]?.title}</div>
              <div className="mt-3 text-sm text-tx-secondary font-bold leading-relaxed">{tutorialSteps[tutorialStep]?.body}</div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTutorialStep((s) => Math.max(0, s - 1))}
                  disabled={tutorialStep === 0}
                  className={cn(
                    'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    tutorialStep === 0
                      ? 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Retour
                </button>

                <button
                  type="button"
                  onClick={closeTutorial}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors"
                >
                  Passer
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (tutorialStep >= tutorialSteps.length - 1) {
                      closeTutorial();
                      return;
                    }
                    setTutorialStep((s) => Math.min(tutorialSteps.length - 1, s + 1));
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  {tutorialStep >= tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
