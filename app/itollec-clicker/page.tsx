'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { BUILDINGS, generateAchievements, generateUpgrades, getBuildingCost, type BuildingId } from '@/lib/itollec-clicker/data';
import { formatCoins, formatShortNumber } from '@/lib/itollec-clicker/format';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

type ActiveBuff = {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
  prodMult: number;
  clickMult: number;
};

type DecreeState = {
  visible: boolean;
  expiresAt: number;
  nextSpawnAt: number;
  chainLeft: number;
  xPct: number;
  yPct: number;
};

type ProdBucket = {
  t: number;
  amount: number;
};

type Wrinkler = {
  id: string;
  angleRad: number;
  storedAbsorbed: number;
  clicks: number;
};

type PrestigeState = {
  medals: number;
  spent: number;
  claimed: number;
  centJoursLevel: number;
  sainteHeleneLevel: number;
};

type ItollecClickerSave = {
  version: number;
  coins: number;
  totalProduced: number;
  lifetimeProduced: number;
  totalSpent: number;
  clickCount: number;
  buildingsOwned: Record<BuildingId, number>;
  upgradesPurchased: string[];
  achievementsUnlocked: string[];
  lastTickAt: number;
  comboClicks: number[];
  comboActive: boolean;
  comboLastClickAt: number;
  buffs: ActiveBuff[];
  decree: DecreeState;
  prodBuckets: ProdBucket[];
  wrinklers: Wrinkler[];
  nextWrinklerAt: number;
  prestige: PrestigeState;
};

const initialBuildingsOwned = BUILDINGS.reduce((acc, b) => {
  acc[b.id] = 0;
  return acc;
}, {} as Record<BuildingId, number>);

const INITIAL_SAVE: ItollecClickerSave = {
  version: 3,
  coins: 0,
  totalProduced: 0,
  lifetimeProduced: 0,
  totalSpent: 0,
  clickCount: 0,
  buildingsOwned: initialBuildingsOwned,
  upgradesPurchased: [],
  achievementsUnlocked: [],
  lastTickAt: Date.now(),
  comboClicks: [],
  comboActive: false,
  comboLastClickAt: 0,
  buffs: [],
  decree: {
    visible: false,
    expiresAt: 0,
    nextSpawnAt: Date.now() + (10 + Math.random() * 5) * 60_000,
    chainLeft: 0,
    xPct: 0.8,
    yPct: 0.25,
  },
  prodBuckets: [],
  wrinklers: [],
  nextWrinklerAt: Date.now() + 45_000,
  prestige: {
    medals: 0,
    spent: 0,
    claimed: 0,
    centJoursLevel: 0,
    sainteHeleneLevel: 0,
  },
};

const BASE_FRENLY_PER_SECOND = 0.1;
const WRINKLER_ABSORB_PCT = 0.05;
const WRINKLER_BONUS_MULT = 1.21;
const PROD_BUCKET_MS = 5_000;
const PROD_BUCKET_WINDOW_MS = 2 * 60 * 60 * 1000;
const PRESTIGE_MEDAL_BASE = 1_000_000;

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1_000_000) {
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return formatShortNumber(value);
}

export default function ItollecClickerPage() {
  const upgrades = useMemo(() => generateUpgrades(), []);
  const achievements = useMemo(() => generateAchievements(), []);
  const achievementById = useMemo(() => new Map(achievements.map((a) => [a.id, a])), [achievements]);
  const buildingNameById = useMemo(() => new Map(BUILDINGS.map((b) => [b.id, b.name])), []);

  const { data, setData, isLoaded } = useCloudSave<ItollecClickerSave>(
    'itollec-clicker',
    INITIAL_SAVE,
    { silent: true }
  );

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const lastAchievementScanAtRef = useRef(0);

  const didInitTickRef = useRef(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (didInitTickRef.current) return;
    didInitTickRef.current = true;
    const now = Date.now();
    const current = dataRef.current;
    if (Math.abs(now - current.lastTickAt) > 1000) {
      setData((prev) => ({ ...prev, lastTickAt: now }));
    }
  }, [isLoaded, setData]);

  const [activePanel, setActivePanel] = useState<'buildings' | 'upgrades' | 'achievements'>('buildings');
  const [showStats, setShowStats] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [achievementQuery, setAchievementQuery] = useState('');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSpot, setTutorialSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tutorialCardTop, setTutorialCardTop] = useState(24);
  const [miniGameOpen, setMiniGameOpen] = useState<null | 'forge' | 'grandjeu' | 'oracle'>(null);

  const moneyRef = useRef<HTMLDivElement | null>(null);
  const sealRef = useRef<HTMLDivElement | null>(null);
  const decreeSpotRef = useRef<HTMLButtonElement | null>(null);
  const wrinklerSpotRef = useRef<HTMLButtonElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const prestigeRef = useRef<HTMLDivElement | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);

  const tutorialSteps = useMemo(
    () => [
      {
        key: 'money',
        title: 'FrenlyCoin',
        body: 'Ta monnaie. Elle augmente avec le temps (FrenlyCoin/s) et avec tes clics.',
      },
      {
        key: 'seal',
        title: 'Grand Sceau',
        body: 'Clique ici pour gagner des FrenlyCoin ₶. Les upgrades peuvent booster la valeur de clic.',
      },
      {
        key: 'tabs',
        title: 'Panneaux',
        body: 'Bâtiments = production. Upgrades = multiplicateurs. Succès = bonus permanent de production.',
      },
      {
        key: 'decree',
        title: 'Décret Impérial',
        body: 'Il apparaît aléatoirement. Clique dessus pour obtenir un bonus temporaire (Frenzy, Lucky, Click Frenzy…).',
      },
      {
        key: 'wrinklers',
        title: 'Révolutionnaires',
        body: 'Ils absorbent une partie de ta production. Clique 3 fois dessus pour les éliminer et récupérer un gros payout.',
      },
      {
        key: 'prestige',
        title: 'Prestige',
        body: 'Quand tu as des Médailles à réclamer, tu peux Abdiquer pour repartir et acheter des bonus permanents.',
      },
    ],
    []
  );

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const done = localStorage.getItem('itollec_clicker_tutorial_done') === '1';
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
    const getEl = () => {
      if (step?.key === 'money') return moneyRef.current;
      if (step?.key === 'seal') return sealRef.current;
      if (step?.key === 'tabs') return tabsRef.current;
      if (step?.key === 'decree') return decreeSpotRef.current;
      if (step?.key === 'wrinklers') return wrinklerSpotRef.current;
      if (step?.key === 'prestige') return prestigeRef.current;
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
    if (!tutorialOpen) return;
    const key = tutorialSteps[tutorialStep]?.key;
    if (key === 'prestige') setShowStats(true);
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
      localStorage.setItem('itollec_clicker_tutorial_done', '1');
    } catch {}
  }, []);

  const buildingMultById = useMemo(() => {
    const mult: Record<BuildingId, number> = { ...initialBuildingsOwned };
    for (const id of Object.keys(mult) as BuildingId[]) {
      mult[id] = 1;
    }
    const purchased = new Set(data.upgradesPurchased);
    for (const u of upgrades) {
      if (!purchased.has(u.id)) continue;
      if (u.effect.type === 'building_mult') {
        mult[u.effect.buildingId] *= u.effect.mult;
      }
    }
    return mult;
  }, [data.upgradesPurchased, upgrades]);

  const buffProdMult = useMemo(() => {
    return data.buffs.reduce((acc, b) => acc * b.prodMult, 1);
  }, [data.buffs]);

  const buffClickMult = useMemo(() => {
    return data.buffs.reduce((acc, b) => acc * b.clickMult, 1);
  }, [data.buffs]);

  const seasonalProdMult = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();

    let mult = 1;
    const isNoel = month === 11;
    if (isNoel) mult *= 1.05;
    const isAusterlitz = month === 11 && day === 2;
    if (isAusterlitz) mult *= 2;
    const isCentJours =
      (month === 2 && day >= 15) || (month > 2 && month < 5) || (month === 5 && day <= 15);
    if (isCentJours) mult *= 1.02;
    return mult;
  }, []);

  const prestigeProdMult = useMemo(() => {
    return 1 + (data.prestige.centJoursLevel ?? 0) * 0.1;
  }, [data.prestige.centJoursLevel]);

  const globalProdMult = useMemo(() => {
    const purchased = new Set(data.upgradesPurchased);
    let mult = 1;
    for (const u of upgrades) {
      if (!purchased.has(u.id)) continue;
      if (u.effect.type === 'global_prod_mult') mult *= u.effect.mult;
    }
    mult *= 1 + data.achievementsUnlocked.length * 0.01;
    mult *= prestigeProdMult;
    mult *= seasonalProdMult;
    mult *= buffProdMult;
    return mult;
  }, [buffProdMult, data.achievementsUnlocked.length, data.upgradesPurchased, prestigeProdMult, seasonalProdMult, upgrades]);

  const clickMult = useMemo(() => {
    const purchased = new Set(data.upgradesPurchased);
    let mult = 1;
    for (const u of upgrades) {
      if (!purchased.has(u.id)) continue;
      if (u.effect.type === 'click_mult') mult *= u.effect.mult;
    }
    return mult;
  }, [data.upgradesPurchased, upgrades]);

  const grossPps = useMemo(() => {
    let total = BASE_FRENLY_PER_SECOND;
    for (const b of BUILDINGS) {
      const owned = data.buildingsOwned[b.id] ?? 0;
      total += b.basePps * owned * buildingMultById[b.id];
    }
    return total * globalProdMult;
  }, [data.buildingsOwned, buildingMultById, globalProdMult]);

  const netPps = useMemo(() => {
    const n = data.wrinklers.length;
    const absorb = Math.min(0.9, n * WRINKLER_ABSORB_PCT);
    return grossPps * (1 - absorb);
  }, [data.wrinklers.length, grossPps]);

  const wrinklerLossPps = useMemo(() => {
    return Math.max(0, grossPps - netPps);
  }, [grossPps, netPps]);

  const wrinklerLossPct = useMemo(() => {
    const pct = Math.min(0.9, data.wrinklers.length * WRINKLER_ABSORB_PCT) * 100;
    return Math.round(pct);
  }, [data.wrinklers.length]);

  const clickValue = useMemo(() => {
    const base = 1;
    const eventMult = data.comboActive ? 2 : 1;
    return base * clickMult * buffClickMult * eventMult;
  }, [buffClickMult, clickMult, data.comboActive]);

  const unlockedUpgrades = useMemo(() => {
    const owned = data.buildingsOwned;
    const purchased = new Set(data.upgradesPurchased);

    return upgrades.filter((u) => {
      if (purchased.has(u.id)) return false;
      if (u.unlock.type === 'building_owned') return (owned[u.unlock.buildingId] ?? 0) >= u.unlock.count;
      if (u.unlock.type === 'total_produced') return data.totalProduced >= u.unlock.amount;
      return data.clickCount >= u.unlock.count;
    });
  }, [data.buildingsOwned, data.clickCount, data.totalProduced, data.upgradesPurchased, upgrades]);

  const visibleBuildings = useMemo(() => {
    return BUILDINGS.filter((b, index) => {
      const owned = data.buildingsOwned[b.id] ?? 0;
      if (owned > 0) return true;
      if (index === 0) return true;
      const prev = BUILDINGS[index - 1];
      return (data.buildingsOwned[prev.id] ?? 0) > 0;
    });
  }, [data.buildingsOwned]);

  const maxOwnedBuildingIndex = useMemo(() => {
    let max = -1;
    for (let i = 0; i < BUILDINGS.length; i++) {
      const b = BUILDINGS[i];
      if ((data.buildingsOwned[b.id] ?? 0) > 0) max = i;
    }
    return max;
  }, [data.buildingsOwned]);

  const visibleUpgrades = useMemo(() => {
    const maxIndex = maxOwnedBuildingIndex;
    const indexById = new Map<BuildingId, number>(BUILDINGS.map((b, i) => [b.id, i]));

    const filtered = unlockedUpgrades.filter((u) => {
      if (u.unlock.type === 'building_owned') {
        const idx = indexById.get(u.unlock.buildingId) ?? 0;
        return idx <= Math.max(0, maxIndex);
      }
      if (u.effect.type === 'building_mult') {
        const idx = indexById.get(u.effect.buildingId) ?? 0;
        return idx <= Math.max(0, maxIndex);
      }
      return true;
    });

    return filtered.slice().sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  }, [maxOwnedBuildingIndex, unlockedUpgrades]);

  const computeAchievementsUnlocked = useCallback((save: ItollecClickerSave): string[] => {
    const unlocked = new Set(save.achievementsUnlocked);
    for (const a of achievements) {
      if (unlocked.has(a.id)) continue;
      const ok =
        a.condition.type === 'total_produced'
          ? save.totalProduced >= a.condition.amount
          : a.condition.type === 'clicks'
            ? save.clickCount >= a.condition.count
            : (save.buildingsOwned[a.condition.buildingId] ?? 0) >= a.condition.count;
      if (ok) unlocked.add(a.id);
    }
    return unlocked.size === save.achievementsUnlocked.length ? save.achievementsUnlocked : Array.from(unlocked);
  }, [achievements]);

  const achievementQueryNormalized = useMemo(() => achievementQuery.trim().toLowerCase(), [achievementQuery]);

  const achievementsForModal = useMemo(() => {
    const unlockedOrder = new Map<string, number>();
    data.achievementsUnlocked.forEach((id, idx) => unlockedOrder.set(id, idx));

    const matchesQuery = (aId: string) => {
      if (!achievementQueryNormalized) return true;
      const a = achievementById.get(aId);
      if (!a) return false;
      const hay = `${a.name} ${a.description}`.toLowerCase();
      return hay.includes(achievementQueryNormalized);
    };

    const unlockedIds = data.achievementsUnlocked.filter((id) => matchesQuery(id));
    const lockedIds = achievements
      .map((a) => a.id)
      .filter((id) => !unlockedOrder.has(id))
      .filter((id) => matchesQuery(id));

    unlockedIds.sort((a, b) => (unlockedOrder.get(a) ?? 0) - (unlockedOrder.get(b) ?? 0));

    return {
      unlockedIds,
      lockedIds,
      unlockedCount: data.achievementsUnlocked.length,
      totalCount: achievements.length,
    };
  }, [achievementById, achievementQueryNormalized, achievements, data.achievementsUnlocked]);

  const prevAchievementsUnlockedRef = useRef<string[]>([]);
  const toastTimeoutsRef = useRef<number[]>([]);

  const getAchievementReason = useCallback(
    (id: string) => {
      const a = achievementById.get(id);
      if (!a) return '';

      if (a.condition.type === 'total_produced') {
        return `Production totale ≥ ${formatShortNumber(a.condition.amount)} ₶`;
      }
      if (a.condition.type === 'clicks') {
        return `Clics ≥ ${a.condition.count.toLocaleString('en-US')}`;
      }
      const buildingName = buildingNameById.get(a.condition.buildingId) ?? a.condition.buildingId;
      return `Posséder ${a.condition.count} « ${buildingName} »`;
    },
    [achievementById, buildingNameById]
  );

  useEffect(() => {
    if (!isLoaded) return;

    const prev = prevAchievementsUnlockedRef.current;
    const next = data.achievementsUnlocked;
    if (prev.length === 0 && next.length > 0) {
      prevAchievementsUnlockedRef.current = next;
      return;
    }

    const prevSet = new Set(prev);
    const newlyUnlocked = next.filter((id) => !prevSet.has(id));
    prevAchievementsUnlockedRef.current = next;

    if (newlyUnlocked.length === 0) return;

    for (const t of toastTimeoutsRef.current) window.clearTimeout(t);
    toastTimeoutsRef.current = [];

    newlyUnlocked.forEach((id, idx) => {
      const a = achievementById.get(id);
      if (!a) return;
      const reason = getAchievementReason(id);
      const timeoutId = window.setTimeout(() => {
        toast('Succès débloqué', { description: `${a.name} — ${reason}`, duration: 4500 });
      }, idx * 350);
      toastTimeoutsRef.current.push(timeoutId);
    });
  }, [achievementById, data.achievementsUnlocked, getAchievementReason, isLoaded]);

  useEffect(() => {
    return () => {
      for (const t of toastTimeoutsRef.current) window.clearTimeout(t);
    };
  }, []);

  const createId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }, []);

  const scheduleNextDecreeAt = useCallback((now: number) => {
    const minutes = 10 + Math.random() * 5;
    return now + minutes * 60_000;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    let lastUiUpdateAt = 0;

    const tick = (now: number) => {
      setData((prev) => {
        const epochNow = Date.now();
        const elapsedMs = Math.max(0, epochNow - prev.lastTickAt);
        const steps = Math.min(10, Math.floor(elapsedMs / 1000));
        const wrinklerAbsorb = Math.min(0.9, prev.wrinklers.length * WRINKLER_ABSORB_PCT);
        const producedFromProd = grossPps * (1 - wrinklerAbsorb) * steps;

        const comboStillActive = prev.comboActive ? epochNow - prev.comboLastClickAt <= 3000 : false;
        const shouldUpdate = steps > 0 || (!comboStillActive && prev.comboActive);
        if (!shouldUpdate) return prev;

        const nextCoins = clampNonNegative(prev.coins + producedFromProd);
        const nextTotalProduced = clampNonNegative(prev.totalProduced + producedFromProd);
        const nextLifetimeProduced = clampNonNegative(prev.lifetimeProduced + producedFromProd);

        const activeBuffs = prev.buffs.filter((b) => epochNow < b.startedAt + b.durationMs);

        let decree = prev.decree;
        if (!decree.visible && decree.nextSpawnAt > epochNow && decree.nextSpawnAt < epochNow + 10 * 60_000) {
          decree = { ...decree, nextSpawnAt: scheduleNextDecreeAt(epochNow), chainLeft: 0 };
        }
        if (decree.visible && epochNow >= decree.expiresAt) {
          const nextSpawnAt = scheduleNextDecreeAt(epochNow);
          decree = { ...decree, visible: false, expiresAt: 0, nextSpawnAt, chainLeft: 0 };
        }
        if (!decree.visible && epochNow >= decree.nextSpawnAt) {
          const xPct = 0.08 + Math.random() * 0.84;
          const yPct = 0.12 + Math.random() * 0.72;
          decree = { ...decree, visible: true, expiresAt: epochNow + 13_000, xPct, yPct };
        }

        let wrinklers = prev.wrinklers;
        const canSpawnWrinkler = epochNow >= prev.nextWrinklerAt && wrinklers.length < 12 && maxOwnedBuildingIndex >= 0;
        let nextWrinklerAt = prev.nextWrinklerAt;
        if (canSpawnWrinkler) {
          const w: Wrinkler = { id: createId(), angleRad: Math.random() * Math.PI * 2, storedAbsorbed: 0, clicks: 0 };
          wrinklers = [...wrinklers, w];
          nextWrinklerAt = epochNow + (20_000 + Math.random() * 35_000);
        }

        if (wrinklers.length > 0 && steps > 0) {
          const absorbPer = grossPps * WRINKLER_ABSORB_PCT * steps;
          wrinklers = wrinklers.map((w) => ({ ...w, storedAbsorbed: w.storedAbsorbed + absorbPer }));
        }

        let prodBuckets = prev.prodBuckets;
        if (producedFromProd > 0) {
          const bucketT = Math.floor(epochNow / PROD_BUCKET_MS) * PROD_BUCKET_MS;
          const last = prodBuckets[prodBuckets.length - 1];
          if (last && last.t === bucketT) {
            prodBuckets = [...prodBuckets.slice(0, -1), { t: last.t, amount: last.amount + producedFromProd }];
          } else {
            prodBuckets = [...prodBuckets, { t: bucketT, amount: producedFromProd }];
          }
          const cutoff = epochNow - PROD_BUCKET_WINDOW_MS;
          prodBuckets = prodBuckets.filter((b) => b.t >= cutoff);
        }

        const nextBase: ItollecClickerSave = {
          ...prev,
          coins: nextCoins,
          totalProduced: nextTotalProduced,
          lifetimeProduced: nextLifetimeProduced,
          lastTickAt: prev.lastTickAt + steps * 1000,
          comboActive: comboStillActive,
          buffs: activeBuffs,
          decree,
          prodBuckets,
          wrinklers,
          nextWrinklerAt,
        };

        if (epochNow - lastUiUpdateAt >= 250 || !comboStillActive) {
          const nextUnlocked = computeAchievementsUnlocked(nextBase);
          const next = nextUnlocked === nextBase.achievementsUnlocked ? nextBase : { ...nextBase, achievementsUnlocked: nextUnlocked };
          lastUiUpdateAt = epochNow;
          lastAchievementScanAtRef.current = epochNow;
          return next;
        }

        return nextBase;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [computeAchievementsUnlocked, createId, grossPps, isLoaded, maxOwnedBuildingIndex, scheduleNextDecreeAt, setData]);

  const handleClickSeal = () => {
    const now = Date.now();
    setData((prev) => {
      const clicks = [...prev.comboClicks, now].filter((t) => now - t <= 5000);
      const comboActive = clicks.length >= 20;
      const gain = (1 * clickMult * buffClickMult) * (comboActive ? 2 : 1);
      const nextBase: ItollecClickerSave = {
        ...prev,
        coins: clampNonNegative(prev.coins + gain),
        totalProduced: clampNonNegative(prev.totalProduced + gain),
        lifetimeProduced: clampNonNegative(prev.lifetimeProduced + gain),
        clickCount: prev.clickCount + 1,
        comboClicks: clicks,
        comboActive,
        comboLastClickAt: now,
      };

      const nowScan = Date.now();
      if (nowScan - lastAchievementScanAtRef.current >= 250) {
        const nextUnlocked = computeAchievementsUnlocked(nextBase);
        if (nextUnlocked !== nextBase.achievementsUnlocked) {
          lastAchievementScanAtRef.current = nowScan;
          return { ...nextBase, achievementsUnlocked: nextUnlocked };
        }
      }

      return nextBase;
    });
  };

  const buyBuilding = (buildingId: BuildingId) => {
    setData((prev) => {
      const def = BUILDINGS.find((b) => b.id === buildingId);
      if (!def) return prev;
      const owned = prev.buildingsOwned[buildingId] ?? 0;
      const cost = getBuildingCost(def, owned);
      if (prev.coins < cost) return prev;

      const nextBase: ItollecClickerSave = {
        ...prev,
        coins: clampNonNegative(prev.coins - cost),
        totalSpent: clampNonNegative(prev.totalSpent + cost),
        buildingsOwned: { ...prev.buildingsOwned, [buildingId]: owned + 1 },
      };

      const nextUnlocked = computeAchievementsUnlocked(nextBase);
      return nextUnlocked === nextBase.achievementsUnlocked ? nextBase : { ...nextBase, achievementsUnlocked: nextUnlocked };
    });
  };

  const buyUpgrade = (upgradeId: string) => {
    setData((prev) => {
      const u = upgrades.find((x) => x.id === upgradeId);
      if (!u) return prev;
      if (prev.upgradesPurchased.includes(u.id)) return prev;
      if (prev.coins < u.cost) return prev;

      const owned = prev.buildingsOwned;
      const unlocked =
        u.unlock.type === 'building_owned'
          ? (owned[u.unlock.buildingId] ?? 0) >= u.unlock.count
          : u.unlock.type === 'total_produced'
            ? prev.totalProduced >= u.unlock.amount
            : prev.clickCount >= u.unlock.count;

      if (!unlocked) return prev;

      const nextBase: ItollecClickerSave = {
        ...prev,
        coins: clampNonNegative(prev.coins - u.cost),
        totalSpent: clampNonNegative(prev.totalSpent + u.cost),
        upgradesPurchased: [...prev.upgradesPurchased, u.id],
      };

      const nextUnlocked = computeAchievementsUnlocked(nextBase);
      return nextUnlocked === nextBase.achievementsUnlocked ? nextBase : { ...nextBase, achievementsUnlocked: nextUnlocked };
    });
  };

  const getRecentProduction = useCallback((buckets: ProdBucket[], now: number) => {
    const cutoff = now - PROD_BUCKET_WINDOW_MS;
    let sum = 0;
    for (const b of buckets) {
      if (b.t >= cutoff) sum += b.amount;
    }
    return sum;
  }, []);

  const addBuff = useCallback(
    (prev: ItollecClickerSave, buff: Omit<ActiveBuff, 'id'>): ItollecClickerSave => {
      const b: ActiveBuff = { ...buff, id: createId() };
      return { ...prev, buffs: [...prev.buffs, b] };
    },
    [createId]
  );

  const clickDecree = () => {
    const now = Date.now();
    setData((prev) => {
      if (!prev.decree.visible) return prev;

      const roll = Math.random();

      const endDecree = (next: ItollecClickerSave) => {
        const nextSpawnAt = scheduleNextDecreeAt(now);
        return {
          ...next,
          decree: { ...next.decree, visible: false, expiresAt: 0, nextSpawnAt, chainLeft: 0 },
        };
      };

      const showDecreeToast = (title: string, description: string) => {
        toast('Décret Impérial', { description: `${title} — ${description}`, duration: 5000 });
      };

      if (roll < 0.28) {
        const next = addBuff(prev, { name: 'Frenzy', startedAt: now, durationMs: 77_000, prodMult: 7, clickMult: 1 });
        showDecreeToast('Frenzy', 'Production ×7 pendant 77s');
        return endDecree(next);
      }

      if (roll < 0.48) {
        const next = addBuff(prev, { name: 'Click Frenzy', startedAt: now, durationMs: 13_000, prodMult: 1, clickMult: 777 });
        showDecreeToast('Click Frenzy', 'Clic ×777 pendant 13s');
        return endDecree(next);
      }

      if (roll < 0.66) {
        const recent = getRecentProduction(prev.prodBuckets, now);
        const gain = recent * 0.13;
        const next: ItollecClickerSave = {
          ...prev,
          coins: clampNonNegative(prev.coins + gain),
          totalProduced: clampNonNegative(prev.totalProduced + gain),
          lifetimeProduced: clampNonNegative(prev.lifetimeProduced + gain),
        };
        showDecreeToast('Lucky!', `+${formatShortNumber(gain)} ₶`);
        return endDecree(next);
      }

      if (roll < 0.80) {
        const next = addBuff(prev, { name: 'Dragon Harvest', startedAt: now, durationMs: 30_000, prodMult: 2, clickMult: 1 });
        showDecreeToast('Dragon Harvest', 'Production ×2 pendant 30s');
        return endDecree(next);
      }

      if (roll < 0.92) {
        const next = addBuff(prev, { name: 'Pledge', startedAt: now, durationMs: 10 * 60_000, prodMult: 1.1, clickMult: 1 });
        showDecreeToast('Pledge', '+10% pendant 10 min');
        return endDecree(next);
      }

      const next = addBuff(prev, { name: 'Pledge', startedAt: now, durationMs: 10 * 60_000, prodMult: 1.1, clickMult: 1 });
      showDecreeToast('Pledge', '+10% pendant 10 min');
      return endDecree(next);
    });
  };

  const clickWrinkler = (wrinklerId: string) => {
    const now = Date.now();
    setData((prev) => {
      const w = prev.wrinklers.find((x) => x.id === wrinklerId);
      if (!w) return prev;
      const nextClicks = w.clicks + 1;
      if (nextClicks < 3) {
        return { ...prev, wrinklers: prev.wrinklers.map((x) => (x.id === wrinklerId ? { ...x, clicks: nextClicks } : x)) };
      }

      const payout = w.storedAbsorbed * WRINKLER_BONUS_MULT;
      toast('Révolutionnaire éliminé', { description: `+${formatShortNumber(payout)} ₶`, duration: 3500 });
      return {
        ...prev,
        coins: clampNonNegative(prev.coins + payout),
        totalProduced: clampNonNegative(prev.totalProduced + payout),
        lifetimeProduced: clampNonNegative(prev.lifetimeProduced + payout),
        wrinklers: prev.wrinklers.filter((x) => x.id !== wrinklerId),
      };
    });
  };

  const prestigeAvailable = useMemo(() => {
    const totalClaimable = Math.floor(Math.sqrt((data.lifetimeProduced ?? 0) / PRESTIGE_MEDAL_BASE));
    const claimableNow = Math.max(0, totalClaimable - (data.prestige.claimed ?? 0));
    const availableMedals = Math.max(0, (data.prestige.medals ?? 0) - (data.prestige.spent ?? 0));
    return { totalClaimable, claimableNow, availableMedals };
  }, [data.lifetimeProduced, data.prestige.claimed, data.prestige.medals, data.prestige.spent]);

  const abdicate = () => {
    const now = Date.now();
    setData((prev) => {
      const totalClaimable = Math.floor(Math.sqrt((prev.lifetimeProduced ?? 0) / PRESTIGE_MEDAL_BASE));
      const gain = Math.max(0, totalClaimable - (prev.prestige.claimed ?? 0));
      if (gain <= 0) return prev;

      const keepPct = Math.min(0.5, (prev.prestige.sainteHeleneLevel ?? 0) * 0.01);
      const keepCoins = prev.coins * keepPct;

      toast('Abdication', { description: `+${gain} Médailles Impériales`, duration: 4500 });

      return {
        ...prev,
        coins: clampNonNegative(keepCoins),
        totalProduced: 0,
        totalSpent: 0,
        buildingsOwned: initialBuildingsOwned,
        upgradesPurchased: [],
        lastTickAt: now,
        comboClicks: [],
        comboActive: false,
        comboLastClickAt: 0,
        buffs: [],
        decree: { ...prev.decree, visible: false, expiresAt: 0, chainLeft: 0, nextSpawnAt: now + (10 + Math.random() * 5) * 60_000 },
        wrinklers: [],
        nextWrinklerAt: now + 45_000,
        prestige: {
          ...prev.prestige,
          medals: (prev.prestige.medals ?? 0) + gain,
          claimed: (prev.prestige.claimed ?? 0) + gain,
        },
      };
    });
  };

  const buyPrestigeUpgrade = (kind: 'centJours' | 'sainteHelene') => {
    setData((prev) => {
      const available = Math.max(0, (prev.prestige.medals ?? 0) - (prev.prestige.spent ?? 0));
      const cost = kind === 'centJours' ? 1 : 3;
      if (available < cost) return prev;
      if (kind === 'sainteHelene' && (prev.prestige.sainteHeleneLevel ?? 0) >= 20) return prev;

      return {
        ...prev,
        prestige: {
          ...prev.prestige,
          spent: (prev.prestige.spent ?? 0) + cost,
          centJoursLevel: kind === 'centJours' ? (prev.prestige.centJoursLevel ?? 0) + 1 : (prev.prestige.centJoursLevel ?? 0),
          sainteHeleneLevel: kind === 'sainteHelene' ? (prev.prestige.sainteHeleneLevel ?? 0) + 1 : (prev.prestige.sainteHeleneLevel ?? 0),
        },
      };
    });
  };

  const runForge = (choice: 'prod' | 'click') => {
    const now = Date.now();
    setData((prev) => {
      const owned = prev.buildingsOwned.forge ?? 0;
      if (owned < 15) return prev;
      const cost = choice === 'prod' ? 500 : 300;
      if (prev.coins < cost) return prev;
      const base: ItollecClickerSave = {
        ...prev,
        coins: clampNonNegative(prev.coins - cost),
        totalSpent: clampNonNegative(prev.totalSpent + cost),
      };
      const next =
        choice === 'prod'
          ? addBuff(base, { name: 'La Forge', startedAt: now, durationMs: 60_000, prodMult: 1.5, clickMult: 1 })
          : addBuff(base, { name: 'La Forge', startedAt: now, durationMs: 60_000, prodMult: 1, clickMult: 2 });

      toast('Mini-jeu : La Forge', { description: choice === 'prod' ? 'Production +50% (60s)' : 'Clic ×2 (60s)', duration: 4000 });
      return next;
    });
    setMiniGameOpen(null);
  };

  const runGrandJeu = (choice: 'diplomatie' | 'propagande') => {
    const now = Date.now();
    setData((prev) => {
      const owned = prev.buildingsOwned.strateges ?? 0;
      if (owned < 15) return prev;
      const next =
        choice === 'diplomatie'
          ? addBuff(prev, { name: 'Le Grand Jeu', startedAt: now, durationMs: 5 * 60_000, prodMult: 1.25, clickMult: 1 })
          : addBuff(prev, { name: 'Le Grand Jeu', startedAt: now, durationMs: 5 * 60_000, prodMult: 1, clickMult: 3 });
      toast('Mini-jeu : Le Grand Jeu', { description: choice === 'diplomatie' ? 'Production +25% (5 min)' : 'Clic ×3 (5 min)', duration: 4000 });
      return next;
    });
    setMiniGameOpen(null);
  };

  const runOracle = () => {
    const now = Date.now();
    setData((prev) => {
      const owned = prev.buildingsOwned.oracle ?? 0;
      if (owned < 15) return prev;
      const bet = prev.coins * 0.25;
      if (bet < 10) return prev;
      const win = Math.random() < 0.45;
      const nextCoins = win ? prev.coins + bet * 2 : prev.coins - bet;
      const next: ItollecClickerSave = {
        ...prev,
        coins: clampNonNegative(nextCoins),
        totalProduced: win ? clampNonNegative(prev.totalProduced + bet * 2) : prev.totalProduced,
        lifetimeProduced: win ? clampNonNegative(prev.lifetimeProduced + bet * 2) : prev.lifetimeProduced,
      };
      toast('Mini-jeu : L’Oracle', { description: win ? `Victoire +${formatShortNumber(bet * 2)} ₶` : `Échec -${formatShortNumber(bet)} ₶`, duration: 4500 });
      return next;
    });
    setMiniGameOpen(null);
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-transparent px-6 pt-8 pb-12">
        <div className="max-w-5xl mx-auto text-center text-tx-secondary font-bold">Chargement...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-6 pt-4 md:pt-6 pb-8">
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/?mode=solo"
              className="h-10 md:h-11 px-3 md:px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
            >
              Accueil
            </Link>
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="h-10 md:h-11 px-3 md:px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center gap-2"
            >
              Stats
              {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setTutorialOpen(true);
                setTutorialStep(0);
              }}
              className="h-10 md:h-11 px-3 md:px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center"
            >
              Tutoriel
            </button>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="text-right" ref={moneyRef}>
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin</div>
              <div className="text-sm font-bold text-tx-base">{formatCoins(data.coins)} ₶</div>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin</div>
                <div className="text-2xl font-display font-black text-tx-base">{formatCoins(data.coins)} ₶</div>
              </div>
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin/s</div>
                <div className="text-2xl font-display font-black text-tx-base">{formatRate(netPps)} ₶/s</div>
                {data.wrinklers.length > 0 && (
                  <div className="mt-2 text-xs font-bold tracking-widest uppercase text-tx-secondary">
                    Perte révolutionnaires: -{wrinklerLossPct}% (-{formatRate(wrinklerLossPps)} ₶/s)
                  </div>
                )}
              </div>
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Clics</div>
                <div className="text-2xl font-display font-black text-tx-base">{formatShortNumber(data.clickCount)}</div>
              </div>
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Succès</div>
                <div className="text-2xl font-display font-black text-tx-base">
                  {formatShortNumber(data.achievementsUnlocked.length)}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4" ref={prestigeRef}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Prestige</div>
                    <div className="text-sm font-bold text-tx-base mt-1">
                      Médailles: {data.prestige.medals} • Dispo: {prestigeAvailable.availableMedals}
                    </div>
                    <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mt-3">
                      À réclamer: {prestigeAvailable.claimableNow}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={abdicate}
                    disabled={prestigeAvailable.claimableNow <= 0}
                    className={cn(
                      'h-12 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                      prestigeAvailable.claimableNow > 0
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Abdiquer
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => buyPrestigeUpgrade('centJours')}
                    disabled={prestigeAvailable.availableMedals < 1}
                    className={cn(
                      'h-12 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 text-left',
                      prestigeAvailable.availableMedals >= 1
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Cent-Jours +10% (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => buyPrestigeUpgrade('sainteHelene')}
                    disabled={prestigeAvailable.availableMedals < 3 || data.prestige.sainteHeleneLevel >= 20}
                    className={cn(
                      'h-12 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 text-left',
                      prestigeAvailable.availableMedals >= 3 && data.prestige.sainteHeleneLevel < 20
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Sainte-Hélène +1% (3)
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Événements</div>
                <div className="text-sm font-bold text-tx-base mt-1">
                  Décrets actifs: {data.buffs.length} • Révolutionnaires: {data.wrinklers.length}
                </div>
                {data.wrinklers.length > 0 && (
                  <div className="text-sm text-tx-secondary font-bold mt-2">
                    Ils absorbent {wrinklerLossPct}% de ta production ({formatRate(wrinklerLossPps)} ₶/s).
                  </div>
                )}
                <div className="text-sm text-tx-secondary font-bold mt-3">
                  Les Décrets Impériaux apparaissent et donnent des bonus temporaires.
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setMiniGameOpen('forge')}
                    disabled={(data.buildingsOwned.forge ?? 0) < 15}
                    className={cn(
                      'h-11 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                      (data.buildingsOwned.forge ?? 0) >= 15
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Forge
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiniGameOpen('grandjeu')}
                    disabled={(data.buildingsOwned.strateges ?? 0) < 15}
                    className={cn(
                      'h-11 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                      (data.buildingsOwned.strateges ?? 0) >= 15
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Grand Jeu
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiniGameOpen('oracle')}
                    disabled={(data.buildingsOwned.oracle ?? 0) < 15}
                    className={cn(
                      'h-11 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                      (data.buildingsOwned.oracle ?? 0) >= 15
                        ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        : 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                    )}
                  >
                    Oracle
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
            <div className="flex items-center justify-between h-12">
              <h1 className="font-display text-2xl md:text-3xl leading-none">ItollecClicker</h1>
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-right">
                <div>Valeur clic</div>
                <div className="text-tx-base">{formatShortNumber(clickValue)} ₶</div>
              </div>
            </div>

            <div className="mt-6 flex-1 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[420px] aspect-square" ref={sealRef}>
                <button
                  type="button"
                  onClick={handleClickSeal}
                  className={cn(
                    'absolute inset-0 rounded-[32px] border-4 border-brand-border bg-brand-inner shadow-brutal',
                    'flex items-center justify-center select-none active:translate-y-[4px] active:shadow-none transition-all'
                  )}
                  aria-label="Cliquer sur le Grand Sceau Impérial"
                >
                  <svg viewBox="0 0 220 220" className="w-[82%] h-[82%]" aria-hidden="true">
                    <defs>
                      <radialGradient id="sealGrad" cx="50%" cy="45%" r="60%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.08" />
                        <stop offset="55%" stopColor="currentColor" stopOpacity="0.02" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
                      </radialGradient>
                    </defs>
                    <circle cx="110" cy="110" r="92" fill="url(#sealGrad)" stroke="currentColor" strokeOpacity="0.25" strokeWidth="10" className="text-tx-base" />
                    <circle cx="110" cy="110" r="64" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="6" className="text-tx-base" />
                    <path
                      d="M110 58l16 30 34 6-24 24 6 34-32-16-32 16 6-34-24-24 34-6z"
                      fill="currentColor"
                      fillOpacity="0.18"
                      className="text-tx-base"
                    />
                    <text x="110" y="152" textAnchor="middle" className="fill-current text-tx-base" fontSize="16" fontFamily="ui-serif, Georgia">
                      SCEAU IMPÉRIAL
                    </text>
                  </svg>
                </button>

                {tutorialOpen && tutorialSteps[tutorialStep]?.key === 'decree' && !data.decree.visible && (
                  <div className="absolute top-4 right-4 h-12 w-12">
                    <button
                      type="button"
                      ref={decreeSpotRef}
                      className="h-12 w-12 rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal flex items-center justify-center"
                      aria-label="Décret Impérial"
                    >
                      <svg viewBox="0 0 64 64" className="h-7 w-7 text-accent-secondary" aria-hidden="true">
                        <circle cx="32" cy="32" r="22" fill="currentColor" fillOpacity="0.15" />
                        <path
                          d="M32 14l6 12 14 2-10 10 2 14-12-6-12 6 2-14-10-10 14-2z"
                          fill="currentColor"
                          fillOpacity="0.35"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                {data.wrinklers.map((w, i) => {
                  const x = Math.cos(w.angleRad) * 170;
                  const y = Math.sin(w.angleRad) * 170;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => clickWrinkler(w.id)}
                      ref={i === 0 ? wrinklerSpotRef : undefined}
                      className="absolute left-1/2 top-1/2 h-10 w-10 rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
                      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
                      aria-label="Révolutionnaire"
                      title="Révolutionnaire (3 clics)"
                    >
                      <span className="font-display font-black text-tx-base">{Math.max(0, 3 - w.clicks)}</span>
                    </button>
                  );
                })}

                {tutorialOpen && tutorialSteps[tutorialStep]?.key === 'wrinklers' && data.wrinklers.length === 0 && (
                  <button
                    type="button"
                    ref={wrinklerSpotRef}
                    className="absolute left-1/2 top-1/2 h-10 w-10 rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal flex items-center justify-center"
                    style={{ transform: 'translate(-50%, -50%) translate(-170px, 120px)' }}
                    aria-label="Révolutionnaire"
                  >
                    <span className="font-display font-black text-tx-base">3</span>
                  </button>
                )}
              </div>

              <div className="mt-4 min-h-[40px] w-full max-w-[420px]">
                {data.comboActive ? (
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner px-4 py-2 shadow-brutal">
                    <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                      Événement : Combo ×2 (20 clics en 5s)
                    </div>
                  </div>
                ) : (
                  <div className="h-[40px]" />
                )}
              </div>

              <div className="mt-6 text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                Clique pour gagner des FrenlyCoin ₶
              </div>
            </div>
          </div>

          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
            <div className="flex items-center justify-between h-12">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-2 flex gap-2" ref={tabsRef}>
                <button
                  type="button"
                  onClick={() => setActivePanel('buildings')}
                  className={cn(
                    'px-4 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                    activePanel === 'buildings'
                      ? 'bg-brand-card text-tx-base border-brand-border'
                      : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                  )}
                >
                  Bâtiments
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('upgrades')}
                  className={cn(
                    'px-4 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                    activePanel === 'upgrades'
                      ? 'bg-brand-card text-tx-base border-brand-border'
                      : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                  )}
                >
                  Upgrades
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('achievements')}
                  className={cn(
                    'px-4 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                    activePanel === 'achievements'
                      ? 'bg-brand-card text-tx-base border-brand-border'
                      : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                  )}
                >
                  Succès
                </button>
              </div>
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-right" />
            </div>

            {activePanel === 'buildings' && (
              <div className="mt-6 space-y-3 overflow-y-auto max-h-[55vh] md:h-[540px] md:max-h-none pr-1">
                {visibleBuildings.map((b) => {
                  const owned = data.buildingsOwned[b.id] ?? 0;
                  const cost = getBuildingCost(b, owned);
                  const affordable = data.coins >= cost;
                  const bPps = b.basePps * buildingMultById[b.id] * globalProdMult;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => buyBuilding(b.id)}
                      disabled={!affordable}
                      className={cn(
                        'w-full text-left rounded-2xl border-2 border-brand-border bg-brand-inner p-4 shadow-brutal transition-colors',
                        affordable ? 'hover:bg-brand-card' : 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display font-black tracking-wider uppercase text-tx-base truncate">{b.name}</div>
                          <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mt-1">
                            {formatShortNumber(bPps)} ₶/s • {owned} possédé{owned > 1 ? 's' : ''}
                          </div>
                          <div className="text-sm text-tx-secondary font-bold mt-3">{b.description}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Coût</div>
                          <div className="font-display font-black text-tx-base">{formatShortNumber(cost)} ₶</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activePanel === 'upgrades' && (
              <div className="mt-6 space-y-3 overflow-y-auto max-h-[55vh] md:h-[540px] md:max-h-none pr-1">
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Disponibles</div>
                  <div className="text-sm font-bold text-tx-base mt-1">{visibleUpgrades.length}</div>
                </div>
                {visibleUpgrades.slice(0, 60).map((u) => {
                  const affordable = data.coins >= u.cost;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => buyUpgrade(u.id)}
                      disabled={!affordable}
                      className={cn(
                        'w-full text-left rounded-2xl border-2 border-brand-border bg-brand-inner p-4 shadow-brutal transition-colors',
                        affordable ? 'hover:bg-brand-card' : 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display font-black tracking-wider uppercase text-tx-base truncate">{u.name}</div>
                          <div className="text-sm text-tx-secondary font-bold mt-2">{u.description}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Coût</div>
                          <div className="font-display font-black text-tx-base">{formatShortNumber(u.cost)} ₶</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {visibleUpgrades.length > 60 && (
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                    +{visibleUpgrades.length - 60} autres upgrades débloqués
                  </div>
                )}
              </div>
            )}

            {activePanel === 'achievements' && (
              <div className="mt-6 space-y-3 overflow-y-auto max-h-[55vh] md:h-[540px] md:max-h-none pr-1">
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Bonus</div>
                  <div className="text-sm font-bold text-tx-base mt-1">
                    +{formatShortNumber(data.achievementsUnlocked.length)}% production globale
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Débloqués</div>
                  <div className="text-sm font-bold text-tx-base mt-1">
                    {data.achievementsUnlocked.length} / {achievements.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAchievementsOpen(true)}
                  className="w-full h-14 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                >
                  Voir la liste
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.decree.visible && (
        <button
          type="button"
          onClick={clickDecree}
          ref={decreeSpotRef}
          className="fixed h-14 w-14 rounded-[28px] border-2 border-brand-border bg-brand-card shadow-brutal flex items-center justify-center hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors z-[9998]"
          style={{
            left: `${data.decree.xPct * 100}vw`,
            top: `${data.decree.yPct * 100}vh`,
            transform: `translate(-50%, -50%) translate(${Math.sin(Date.now() / 450) * 10}px, ${Math.cos(Date.now() / 520) * 8}px)`,
          }}
          aria-label="Décret Impérial"
        >
          <svg viewBox="0 0 64 64" className="h-8 w-8 text-accent-secondary" aria-hidden="true">
            <circle cx="32" cy="32" r="22" fill="currentColor" fillOpacity="0.15" />
            <path
              d="M32 14l6 12 14 2-10 10 2 14-12-6-12 6 2-14-10-10 14-2z"
              fill="currentColor"
              fillOpacity="0.35"
            />
          </svg>
        </button>
      )}

      {achievementsOpen && (
        <div className="fixed inset-0 z-[9999]">
          <button
            type="button"
            onClick={() => setAchievementsOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Fermer"
          />
          <div className="absolute inset-0 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-3xl bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-display text-2xl md:text-3xl font-black tracking-wider uppercase text-tx-base">Succès</div>
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mt-1">
                    {achievementsForModal.unlockedCount} / {achievementsForModal.totalCount} débloqués
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAchievementsOpen(false)}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-6 rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2">Rechercher</div>
                <input
                  value={achievementQuery}
                  onChange={(e) => setAchievementQuery(e.target.value)}
                  className="w-full h-12 rounded-lg border-2 border-brand-border bg-brand-card px-4 text-tx-base font-bold outline-none"
                  placeholder="Nom ou description…"
                  aria-label="Rechercher un succès"
                />
              </div>

              <div className="mt-6 overflow-y-auto h-[520px] pr-1 space-y-3">
                {achievementsForModal.unlockedIds.map((id) => {
                  const a = achievementById.get(id);
                  if (!a) return null;
                  return (
                    <div key={id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 shadow-brutal">
                      <div className="font-display font-black tracking-wider uppercase text-tx-base">{a.name}</div>
                      <div className="text-sm text-tx-secondary font-bold mt-2">{a.description}</div>
                    </div>
                  );
                })}

                {achievementsForModal.lockedIds.map((id) => {
                  const a = achievementById.get(id);
                  if (!a) return null;
                  return (
                    <div key={id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 opacity-50">
                      <div className="font-display font-black tracking-wider uppercase text-tx-base">{a.name}</div>
                      <div className="text-sm text-tx-secondary font-bold mt-2">{a.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {miniGameOpen && (
        <div className="fixed inset-0 z-[9999]">
          <button
            type="button"
            onClick={() => setMiniGameOpen(null)}
            className="absolute inset-0 bg-black/60"
            aria-label="Fermer"
          />
          <div className="absolute inset-0 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-2xl bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal relative">
              <div className="flex items-center justify-between gap-4">
                <div className="font-display text-2xl md:text-3xl font-black tracking-wider uppercase text-tx-base">
                  {miniGameOpen === 'forge' ? 'La Forge' : miniGameOpen === 'grandjeu' ? 'Le Grand Jeu' : 'L’Oracle'}
                </div>
                <button
                  type="button"
                  onClick={() => setMiniGameOpen(null)}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  Fermer
                </button>
              </div>

              {miniGameOpen === 'forge' && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 text-sm text-tx-secondary font-bold">
                    Choisis une allocation d’ouvriers. Chaque option coûte des FrenlyCoin et donne un bonus temporaire.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => runForge('prod')}
                      className="h-14 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors text-left"
                    >
                      Production +50% (500)
                    </button>
                    <button
                      type="button"
                      onClick={() => runForge('click')}
                      className="h-14 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors text-left"
                    >
                      Clic ×2 (300)
                    </button>
                  </div>
                </div>
              )}

              {miniGameOpen === 'grandjeu' && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 text-sm text-tx-secondary font-bold">
                    Choisis une stratégie diplomatique. Effet 5 minutes.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => runGrandJeu('diplomatie')}
                      className="h-14 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors text-left"
                    >
                      Diplomatie +25%
                    </button>
                    <button
                      type="button"
                      onClick={() => runGrandJeu('propagande')}
                      className="h-14 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors text-left"
                    >
                      Propagande Clic ×3
                    </button>
                  </div>
                </div>
              )}

              {miniGameOpen === 'oracle' && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 text-sm text-tx-secondary font-bold">
                    Parie 25% de tes FrenlyCoin. Chance de gagner 45%. En cas de victoire : +200% de la mise.
                  </div>
                  <button
                    type="button"
                    onClick={runOracle}
                    className="w-full h-14 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  >
                    Lancer l’Oracle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tutorialOpen && tutorialSpot && (
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
            <div className="mt-2 font-display text-2xl font-black tracking-wider uppercase text-tx-base">
              {tutorialSteps[tutorialStep]?.title}
            </div>
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
      )}
    </main>
  );
}
