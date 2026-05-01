'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { BUILDINGS, generateAchievements, generateUpgrades, getBuildingCost, type BuildingId } from '@/lib/itollec-clicker/data';
import { formatShortNumber } from '@/lib/itollec-clicker/format';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';

type ItollecClickerSave = {
  version: number;
  coins: number;
  totalProduced: number;
  totalSpent: number;
  clickCount: number;
  buildingsOwned: Record<BuildingId, number>;
  upgradesPurchased: string[];
  achievementsUnlocked: string[];
  lastTickAt: number;
  comboClicks: number[];
  comboActive: boolean;
  comboLastClickAt: number;
};

const initialBuildingsOwned = BUILDINGS.reduce((acc, b) => {
  acc[b.id] = 0;
  return acc;
}, {} as Record<BuildingId, number>);

const INITIAL_SAVE: ItollecClickerSave = {
  version: 1,
  coins: 0,
  totalProduced: 0,
  totalSpent: 0,
  clickCount: 0,
  buildingsOwned: initialBuildingsOwned,
  upgradesPurchased: [],
  achievementsUnlocked: [],
  lastTickAt: Date.now(),
  comboClicks: [],
  comboActive: false,
  comboLastClickAt: 0,
};

const BASE_FRENLY_PER_SECOND = 0.1;

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

  const { data, setData, isLoaded } = useCloudSave<ItollecClickerSave>(
    'itollec-clicker',
    INITIAL_SAVE,
    { silent: true }
  );

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const didInitTickRef = useRef(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (didInitTickRef.current) return;
    didInitTickRef.current = true;
    const now = Date.now();
    const current = dataRef.current;
    if (Math.abs(now - current.lastTickAt) > 1000) {
      setData({ ...current, lastTickAt: now });
    }
  }, [isLoaded, setData]);

  const [activePanel, setActivePanel] = useState<'buildings' | 'upgrades' | 'achievements'>('buildings');
  const [showStats, setShowStats] = useState(false);

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

  const globalProdMult = useMemo(() => {
    const purchased = new Set(data.upgradesPurchased);
    let mult = 1;
    for (const u of upgrades) {
      if (!purchased.has(u.id)) continue;
      if (u.effect.type === 'global_prod_mult') mult *= u.effect.mult;
    }
    mult *= 1 + data.achievementsUnlocked.length * 0.01;
    return mult;
  }, [data.upgradesPurchased, data.achievementsUnlocked.length, upgrades]);

  const clickMult = useMemo(() => {
    const purchased = new Set(data.upgradesPurchased);
    let mult = 1;
    for (const u of upgrades) {
      if (!purchased.has(u.id)) continue;
      if (u.effect.type === 'click_mult') mult *= u.effect.mult;
    }
    return mult;
  }, [data.upgradesPurchased, upgrades]);

  const pps = useMemo(() => {
    let total = BASE_FRENLY_PER_SECOND;
    for (const b of BUILDINGS) {
      const owned = data.buildingsOwned[b.id] ?? 0;
      total += b.basePps * owned * buildingMultById[b.id];
    }
    return total * globalProdMult;
  }, [data.buildingsOwned, buildingMultById, globalProdMult]);

  const clickValue = useMemo(() => {
    const base = 1;
    const eventMult = data.comboActive ? 2 : 1;
    return base * clickMult * eventMult;
  }, [clickMult, data.comboActive]);

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

  const unlockedAchievements = useMemo(() => {
    const unlocked = new Set(data.achievementsUnlocked);
    return achievements.filter((a) => unlocked.has(a.id));
  }, [achievements, data.achievementsUnlocked]);

  const lockedAchievements = useMemo(() => {
    const unlocked = new Set(data.achievementsUnlocked);
    return achievements.filter((a) => !unlocked.has(a.id));
  }, [achievements, data.achievementsUnlocked]);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    let lastUiUpdateAt = 0;

    const tick = (now: number) => {
      const current = dataRef.current;
      const dtRaw = Math.max(0, (now - current.lastTickAt) / 1000);
      const dt = Math.min(dtRaw, 0.25);
      const newCoinsFromProd = pps * dt;

      const comboStillActive = current.comboActive ? now - current.comboLastClickAt <= 3000 : false;

      const shouldUpdate = dt > 0.05 || (!comboStillActive && current.comboActive);

      if (shouldUpdate) {
        const nextCoins = clampNonNegative(current.coins + newCoinsFromProd);
        const nextTotalProduced = clampNonNegative(current.totalProduced + newCoinsFromProd);

        const next: ItollecClickerSave = {
          ...current,
          coins: nextCoins,
          totalProduced: nextTotalProduced,
          lastTickAt: now,
          comboActive: comboStillActive,
        };

        if (now - lastUiUpdateAt >= 250 || !comboStillActive) {
          const newlyUnlocked = new Set(next.achievementsUnlocked);
          for (const a of achievements) {
            if (newlyUnlocked.has(a.id)) continue;
            const ok =
              a.condition.type === 'total_produced'
                ? next.totalProduced >= a.condition.amount
                : a.condition.type === 'clicks'
                  ? next.clickCount >= a.condition.count
                  : (next.buildingsOwned[a.condition.buildingId] ?? 0) >= a.condition.count;

            if (ok) newlyUnlocked.add(a.id);
          }

          const nextWithAchievements =
            newlyUnlocked.size === next.achievementsUnlocked.length
              ? next
              : { ...next, achievementsUnlocked: Array.from(newlyUnlocked) };

          setData(nextWithAchievements);
          lastUiUpdateAt = now;
        } else {
          dataRef.current = next;
        }
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [achievements, isLoaded, pps, setData]);

  const registerComboClick = (now: number) => {
    const current = dataRef.current;
    const clicks = [...current.comboClicks, now].filter((t) => now - t <= 5000);
    const active = clicks.length >= 20;
    return { clicks, active, lastClickAt: now };
  };

  const handleClickSeal = () => {
    const now = Date.now();
    const current = dataRef.current;
    const combo = registerComboClick(now);
    const gain = clickValue;

    setData({
      ...current,
      coins: clampNonNegative(current.coins + gain),
      totalProduced: clampNonNegative(current.totalProduced + gain),
      clickCount: current.clickCount + 1,
      lastTickAt: now,
      comboClicks: combo.clicks,
      comboActive: combo.active,
      comboLastClickAt: combo.lastClickAt,
    });
  };

  const buyBuilding = (buildingId: BuildingId) => {
    const current = dataRef.current;
    const def = BUILDINGS.find((b) => b.id === buildingId);
    if (!def) return;
    const owned = current.buildingsOwned[buildingId] ?? 0;
    const cost = getBuildingCost(def, owned);
    if (current.coins < cost) return;

    setData({
      ...current,
      coins: clampNonNegative(current.coins - cost),
      totalSpent: clampNonNegative(current.totalSpent + cost),
      buildingsOwned: { ...current.buildingsOwned, [buildingId]: owned + 1 },
      lastTickAt: Date.now(),
    });
  };

  const buyUpgrade = (upgradeId: string) => {
    const current = dataRef.current;
    const u = upgrades.find((x) => x.id === upgradeId);
    if (!u) return;
    if (current.upgradesPurchased.includes(u.id)) return;
    if (current.coins < u.cost) return;

    const owned = current.buildingsOwned;
    const unlocked =
      u.unlock.type === 'building_owned'
        ? (owned[u.unlock.buildingId] ?? 0) >= u.unlock.count
        : u.unlock.type === 'total_produced'
          ? current.totalProduced >= u.unlock.amount
          : current.clickCount >= u.unlock.count;

    if (!unlocked) return;

    setData({
      ...current,
      coins: clampNonNegative(current.coins - u.cost),
      totalSpent: clampNonNegative(current.totalSpent + u.cost),
      upgradesPurchased: [...current.upgradesPurchased, u.id],
      lastTickAt: Date.now(),
    });
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
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/?mode=solo"
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
            >
              Accueil
            </Link>
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center gap-2"
            >
              Stats
              {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin</div>
              <div className="text-sm font-bold text-tx-base">{formatShortNumber(data.coins)} ₶</div>
            </div>
          </div>
        </div>

        {showStats && (
          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin</div>
                <div className="text-2xl font-display font-black text-tx-base">{formatShortNumber(data.coins)} ₶</div>
              </div>
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">FrenlyCoin/s</div>
                <div className="text-2xl font-display font-black text-tx-base">{formatRate(pps)} ₶/s</div>
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
              {data.comboActive && (
                <div className="mb-4 rounded-2xl border-2 border-brand-border bg-brand-inner px-4 py-2 shadow-brutal">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                    Événement : Combo de clic ×2
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleClickSeal}
                className={cn(
                  'w-full max-w-[420px] aspect-square rounded-[32px] border-4 border-brand-border bg-brand-inner shadow-brutal',
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

              <div className="mt-6 text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                Clique pour gagner des FrenlyCoin ₶
              </div>
            </div>
          </div>

          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
            <div className="flex items-center justify-between h-12">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-2 flex gap-2">
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
              <div className="mt-6 space-y-3 overflow-y-auto h-[540px] pr-1">
                {BUILDINGS.map((b) => {
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
              <div className="mt-6 space-y-3 overflow-y-auto h-[540px] pr-1">
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Disponibles</div>
                  <div className="text-sm font-bold text-tx-base mt-1">{unlockedUpgrades.length}</div>
                </div>
                {unlockedUpgrades.slice(0, 60).map((u) => {
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
                {unlockedUpgrades.length > 60 && (
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary text-center">
                    +{unlockedUpgrades.length - 60} autres upgrades débloqués
                  </div>
                )}
              </div>
            )}

            {activePanel === 'achievements' && (
              <div className="mt-6 space-y-3 overflow-y-auto h-[540px] pr-1">
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Bonus</div>
                  <div className="text-sm font-bold text-tx-base mt-1">
                    +{formatShortNumber(data.achievementsUnlocked.length)}% production globale
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Débloqués</div>
                  <div className="text-sm font-bold text-tx-base mt-1">
                    {unlockedAchievements.length} / {achievements.length}
                  </div>
                </div>
                {unlockedAchievements.slice(0, 40).map((a) => (
                  <div key={a.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 shadow-brutal">
                    <div className="font-display font-black tracking-wider uppercase text-tx-base">{a.name}</div>
                    <div className="text-sm text-tx-secondary font-bold mt-2">{a.description}</div>
                  </div>
                ))}
                <div className="rounded-2xl border-2 border-brand-border bg-transparent p-4">
                  <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">À débloquer</div>
                  <div className="text-sm font-bold text-tx-base mt-1">{lockedAchievements.length}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
