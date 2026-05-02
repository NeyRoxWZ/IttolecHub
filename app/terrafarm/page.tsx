'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import {
  TERRAFARM_BUILDINGS,
  TERRAFARM_EVENTS,
  TERRAFARM_SEASONS,
  TERRAFARM_SEASON_MS,
  TERRAFARM_ZONES,
  type TerraBuildingCategory,
  type TerraBuildingDef,
  type TerraBuildingId,
  type TerraEventId,
  type TerraSeasonId,
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
  lastTickAt: number;
  seasonStartAt: number;
  mapWidth: number;
  mapHeight: number;
  zoneIndexUnlocked: number;
  tiles: TerraTile[];
  nextEventAt: number;
  activeEvent: ActiveEvent | null;
  lastEventNote: string;
};

const INITIAL_SAVE: TerraFarmSave = {
  version: 1,
  francs: 0,
  totalProduced: 0,
  lifetimeProduced: 0,
  lastTickAt: Date.now(),
  seasonStartAt: Date.now(),
  mapWidth: TERRAFARM_ZONES[0]?.width ?? 3,
  mapHeight: TERRAFARM_ZONES[0]?.height ?? 3,
  zoneIndexUnlocked: 0,
  tiles: [],
  nextEventAt: Date.now() + (4 + Math.random() * 4) * 60_000,
  activeEvent: null,
  lastEventNote: '',
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

export default function TerraFarmPage() {
  const { data, setData, isLoaded } = useCloudSave<TerraFarmSave>('terrafarm', INITIAL_SAVE, { silent: true });

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [selectedBuildingId, setSelectedBuildingId] = useState<TerraBuildingId | null>(null);
  const [howToOpen, setHowToOpen] = useState(true);

  const buildingById = useMemo(() => new Map(TERRAFARM_BUILDINGS.map((b) => [b.id, b] as const)), []);
  const eventById = useMemo(() => new Map(TERRAFARM_EVENTS.map((e) => [e.id, e] as const)), []);

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
      const seasonStartAt = prev.seasonStartAt > 0 ? prev.seasonStartAt : now;
      const nextEventAt = prev.nextEventAt > 0 ? prev.nextEventAt : scheduleNextEventAt(now);
      const lastEventNote = typeof prev.lastEventNote === 'string' ? prev.lastEventNote : '';
      if (seasonStartAt === prev.seasonStartAt && nextEventAt === prev.nextEventAt && lastEventNote === prev.lastEventNote) return prev;
      return { ...prev, seasonStartAt, nextEventAt, lastEventNote, lastTickAt: now };
    });
  }, [isLoaded, setData]);

  const ownedCountByBuilding = useMemo(() => {
    const map = new Map<TerraBuildingId, number>();
    for (const t of data.tiles) {
      map.set(t.buildingId, (map.get(t.buildingId) ?? 0) + 1);
    }
    return map;
  }, [data.tiles]);

  const baseFps = useMemo(() => {
    let sum = 0;
    ownedCountByBuilding.forEach((count, id) => {
      const def = buildingById.get(id);
      if (!def) return;
      sum += def.baseFps * count;
    });
    return sum;
  }, [buildingById, ownedCountByBuilding]);

  const season = useMemo(() => {
    const now = Date.now();
    const id = getSeasonId(now, data.seasonStartAt);
    return TERRAFARM_SEASONS.find((s) => s.id === id) ?? TERRAFARM_SEASONS[0]!;
  }, [data.seasonStartAt]);

  const activeEvent = data.activeEvent;
  const eventMult = activeEvent ? activeEvent.prodMult : 1;
  const seasonMult = season.prodMult;
  const netFps = baseFps * seasonMult * eventMult;

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

        const counts = new Map<TerraBuildingId, number>();
        for (const t of prev.tiles) {
          counts.set(t.buildingId, (counts.get(t.buildingId) ?? 0) + 1);
        }

        let base = 0;
        counts.forEach((count, id) => {
          const def = buildingById.get(id);
          if (!def) return;
          base += def.baseFps * count;
        });

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

        const mult = (event ? event.prodMult : 1) * seasonDef.prodMult;
        const produced = base * mult * steps;

        return {
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
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [buildingById, isLoaded, setData]);

  const unlockedBuildings = useMemo(() => {
    const zoneIndex = data.zoneIndexUnlocked ?? 0;
    return TERRAFARM_BUILDINGS.filter((b) => b.minZoneIndex <= zoneIndex);
  }, [data.zoneIndexUnlocked]);

  const buildingGroups = useMemo(() => groupBuildingsByCategory(unlockedBuildings), [unlockedBuildings]);

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
      const gain = BASE_HARVEST_GAIN;
      return {
        ...prev,
        francs: clampNonNegative(prev.francs + gain),
        totalProduced: clampNonNegative(prev.totalProduced + gain),
        lifetimeProduced: clampNonNegative(prev.lifetimeProduced + gain),
        lastTickAt: prev.lastTickAt > 0 ? prev.lastTickAt : now,
      };
    });
  }, [setData]);

  const placeOnTile = useCallback(
    (x: number, y: number) => {
      setData((prev) => {
        const key = `${x}:${y}`;
        const already = prev.tiles.find((t) => `${t.x}:${t.y}` === key);
        if (already) {
          const def = buildingById.get(already.buildingId);
          if (def) toast(def.name, { description: `Produit ${formatFrancsRate(def.baseFps)} ƒ/s (base)`, duration: 2500 });
          return prev;
        }
        if (!selectedBuildingId) {
          showPlacementToast('Placement', 'Clique un bâtiment dans la boutique, puis clique une tuile.');
          return prev;
        }
        const def = buildingById.get(selectedBuildingId);
        if (!def) return prev;
        if (prev.francs < def.cost) {
          showPlacementToast('Pas assez de ƒ', `Il te manque ${formatFrancs(def.cost - prev.francs)} ƒ.`);
          return prev;
        }

        const next: TerraTile = { x, y, buildingId: def.id, placedAt: Date.now() };
        return { ...prev, francs: clampNonNegative(prev.francs - def.cost), tiles: [...prev.tiles, next] };
      });
    },
    [buildingById, selectedBuildingId, setData, showPlacementToast]
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
                Retour
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
              className="inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              aria-label="Récolter"
            >
              Récolter +{BASE_HARVEST_GAIN} ƒ
            </button>
            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">Francs Paysans</div>
              <div className="text-xl font-display font-black tracking-wider">
                {formatFrancs(data.francs)} <span className="text-accent-primary">ƒ</span>
              </div>
              <div className="text-xs text-tx-secondary font-bold">{formatFrancsRate(netFps)} ƒ/s</div>
            </div>
          </div>
        </div>

        <div className="md:hidden mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
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
                className="mt-2 inline-flex items-center justify-center h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                aria-label="Récolter"
              >
                Récolter +{BASE_HARVEST_GAIN} ƒ
              </button>
            </div>
            <div className="text-right">
              <div className="text-xs text-tx-secondary font-bold">Saison</div>
              <div className="text-sm font-display font-black tracking-wider uppercase">{season.name}</div>
              <div className="text-xs text-tx-secondary font-bold">×{seasonMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-display font-black tracking-wider uppercase">Comment jouer</div>
            <button
              type="button"
              onClick={() => setHowToOpen((v) => !v)}
              className="h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              {howToOpen ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          {howToOpen ? (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm font-bold">
              <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                <div className="text-tx-base font-display font-black tracking-wider uppercase text-sm">1. Démarrer</div>
                <div className="mt-1 text-tx-secondary">
                  Clique <span className="text-tx-base">Récolter</span> pour gagner tes premiers ƒ (sinon tu restes à 0).
                </div>
              </div>
              <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                <div className="text-tx-base font-display font-black tracking-wider uppercase text-sm">2. Construire</div>
                <div className="mt-1 text-tx-secondary">
                  Dans la boutique, choisis un bâtiment (Blé, Tournesol, Poules…). Ensuite clique une tuile pour le poser.
                </div>
              </div>
              <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                <div className="text-tx-base font-display font-black tracking-wider uppercase text-sm">3. Automatique</div>
                <div className="mt-1 text-tx-secondary">
                  Chaque bâtiment ajoute des ƒ/s. Les saisons et événements modifient la production. Quand tu as assez, débloque une nouvelle zone.
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
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

            <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
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
                    {activeEvent ? `×${activeEvent.prodMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}` : '—'}
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
                  <div className="text-tx-base">×{eventMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-display font-black tracking-wider uppercase">Boutique</div>
                  <div className="text-xs text-tx-secondary font-bold">Clique un bâtiment puis clique une tuile.</div>
                </div>
                <div className="hidden md:block text-right">
                  <div className="text-xs text-tx-secondary font-bold">Saison</div>
                  <div className="text-sm font-display font-black tracking-wider uppercase">{season.name}</div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
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
            </div>

            <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
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
      </div>
    </div>
  );
}
