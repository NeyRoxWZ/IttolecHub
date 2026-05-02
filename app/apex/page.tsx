'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { formatCoins, formatShortNumber } from '@/lib/itollec-clicker/format';
import { drawWithoutReplacement, type DrawState } from '@/lib/apex/draw';
import { acceptNegotiation, createNegotiation, playerCounter, type Negotiation } from '@/lib/apex/negotiation';
import { Film, TrendingUp, Users } from 'lucide-react';

type ApexMovie = {
  id: string;
  title: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: 'producing' | 'ready' | 'released';
  quality: number;
  boxOffice: number;
  rightsUpfront: number;
  rightsPerMin: number;
  rightsSold: boolean;
};

type ApexSave = {
  version: number;
  cash: number;
  hype: number;
  lastTickAt: number;
  totalEarned: number;
  totalSpent: number;
  drawByCategory: Record<string, DrawState>;
  sector: {
    active: 'cinema';
    movies: ApexMovie[];
    selectedMovieId: string | null;
  };
  negotiation: Negotiation | null;
};

const INITIAL_SAVE: ApexSave = {
  version: 1,
  cash: 250,
  hype: 0.12,
  lastTickAt: Date.now(),
  totalEarned: 0,
  totalSpent: 0,
  drawByCategory: {},
  sector: { active: 'cinema', movies: [], selectedMovieId: null },
  negotiation: null,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function computeRightsIncomePerMin(movies: ApexMovie[]): number {
  let sum = 0;
  for (const m of movies) {
    if (m.rightsSold) sum += m.rightsPerMin;
  }
  return sum;
}

export default function ApexPage() {
  const { data, setData, isLoaded } = useCloudSave<ApexSave>('apex', INITIAL_SAVE, { silent: true });
  const [activeTab, setActiveTab] = useState<'production' | 'negociation' | 'catalogue'>('production');

  const [names, setNames] = useState<Record<string, string[]> | null>(null);
  const [namesStatus, setNamesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const cashRef = useRef<HTMLDivElement | null>(null);
  const ppsRef = useRef<HTMLDivElement | null>(null);
  const sectorRef = useRef<HTMLDivElement | null>(null);
  const productionRef = useRef<HTMLDivElement | null>(null);
  const negotiationRef = useRef<HTMLDivElement | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSpot, setTutorialSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tutorialCardTop, setTutorialCardTop] = useState(24);

  const tutorialSteps = useMemo(
    () => [
      { key: 'pps', title: '₶/min', body: 'Ton revenu passif. Il augmente surtout grâce aux contrats de droits.' },
      { key: 'cash', title: 'Trésorerie', body: 'Tes ₶ disponibles. Elles servent à financer des projets et payer des coûts.' },
      { key: 'sector', title: 'Secteurs', body: 'Tu débloqueras d’autres secteurs plus tard. Pour l’instant: Cinéma.' },
      { key: 'production', title: 'Production', body: 'Lance un film, attends la production, puis sors-le pour faire du box-office.' },
      { key: 'negociation', title: 'Négociation', body: 'Négocie les droits pour obtenir un paiement immédiat + un revenu par minute.' },
    ],
    []
  );

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const done = localStorage.getItem('apex_tutorial_done') === '1';
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
      if (step?.key === 'pps') return ppsRef.current;
      if (step?.key === 'cash') return cashRef.current;
      if (step?.key === 'sector') return sectorRef.current;
      if (step?.key === 'production') return productionRef.current;
      if (step?.key === 'negociation') return negotiationRef.current;
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
      localStorage.setItem('apex_tutorial_done', '1');
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setNamesStatus('loading');
      try {
        const res = await fetch('/api/apex/names', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad_status');
        const parsed = (await res.json()) as Record<string, string[]>;
        if (cancelled) return;
        setNames(parsed);
        setNamesStatus('ready');
      } catch {
        if (cancelled) return;
        setNames(null);
        setNamesStatus('error');
        toast('Apex', { description: 'Impossible de charger les noms.', duration: 3500 });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filmNames = useMemo(() => {
    const list = names?.films ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const rightsIncomePerMin = useMemo(() => computeRightsIncomePerMin(data.sector.movies), [data.sector.movies]);

  const ppsPerMin = useMemo(() => {
    const hypeMult = 1 + clamp01(data.hype) * 0.6;
    return rightsIncomePerMin * hypeMult;
  }, [data.hype, rightsIncomePerMin]);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    const tick = () => {
      setData((prev) => {
        const epochNow = Date.now();
        const elapsedMs = Math.max(0, epochNow - prev.lastTickAt);
        const steps = Math.min(10, Math.floor(elapsedMs / 1000));
        if (steps <= 0) return prev;

        const basePerMin = computeRightsIncomePerMin(prev.sector.movies);
        const hype = clamp01(prev.hype);
        const hypeMult = 1 + hype * 0.6;
        const incomePerSec = (basePerMin * hypeMult) / 60;

        let nextCash = clampNonNegative(prev.cash + incomePerSec * steps);
        let nextEarned = clampNonNegative(prev.totalEarned + incomePerSec * steps);

        const decay = Math.exp(-(steps / 300));
        const nextHype = clamp01(hype * decay);

        let movies = prev.sector.movies;
        let changed = false;
        movies = movies.map((m) => {
          if (m.status !== 'producing') return m;
          const done = epochNow >= m.startedAt + m.durationMs;
          if (!done) return m;
          changed = true;
          return { ...m, status: 'ready' as const };
        });

        const next: ApexSave = {
          ...prev,
          cash: nextCash,
          hype: nextHype,
          totalEarned: nextEarned,
          lastTickAt: prev.lastTickAt + steps * 1000,
          sector: { ...prev.sector, movies },
        };

        return changed || nextCash !== prev.cash || nextHype !== prev.hype ? next : prev;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [isLoaded, setData]);

  const selectedMovie = useMemo(() => {
    const id = data.sector.selectedMovieId;
    return id ? data.sector.movies.find((m) => m.id === id) ?? null : null;
  }, [data.sector.movies, data.sector.selectedMovieId]);

  const selectMovie = useCallback(
    (id: string) => {
      setData((prev) => ({ ...prev, sector: { ...prev.sector, selectedMovieId: id } }));
    },
    [setData]
  );

  const startMovie = useCallback(
    (budget: number) => {
      if (namesStatus !== 'ready') return;
      if (filmNames.length === 0) return;

      setData((prev) => {
        if (prev.cash < budget) {
          toast('Cinéma', { description: `Il te manque ${formatShortNumber(budget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const drawPrev = prev.drawByCategory.films;
        const drawn = drawWithoutReplacement({ list: filmNames, prev: drawPrev });

        const quality = 0.35 + Math.random() * 0.65;
        const durationMs = Math.round((18_000 + Math.random() * 12_000) * (0.85 + Math.min(1, budget / 200_000) * 0.5));

        const movie: ApexMovie = {
          id: createId(),
          title: drawn.value,
          budget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          boxOffice: 0,
          rightsUpfront: 0,
          rightsPerMin: 0,
          rightsSold: false,
        };

        toast('Cinéma', { description: `Production lancée: ${movie.title}`, duration: 3500 });

        return {
          ...prev,
          cash: clampNonNegative(prev.cash - budget),
          totalSpent: clampNonNegative(prev.totalSpent + budget),
          drawByCategory: { ...prev.drawByCategory, films: drawn.next },
          sector: { ...prev.sector, movies: [movie, ...prev.sector.movies], selectedMovieId: movie.id },
        };
      });
    },
    [filmNames, namesStatus, setData]
  );

  const releaseMovie = useCallback(() => {
    setData((prev) => {
      const id = prev.sector.selectedMovieId;
      if (!id) return prev;
      const m = prev.sector.movies.find((x) => x.id === id);
      if (!m || m.status !== 'ready') return prev;

      const hype = clamp01(prev.hype);
      const hypeMult = 1 + hype * 1.1;
      const roll = 0.75 + Math.random() * 1.85;
      const boxOffice = m.budget * roll * (0.9 + m.quality * 0.5) * hypeMult;

      toast('Box-office', { description: `+${formatShortNumber(boxOffice)} ₶`, duration: 3500 });

      const nextMovies: ApexMovie[] = prev.sector.movies.map((x) =>
        x.id === id ? ({ ...x, status: 'released' as const, boxOffice } as ApexMovie) : x
      );
      return {
        ...prev,
        cash: clampNonNegative(prev.cash + boxOffice),
        totalEarned: clampNonNegative(prev.totalEarned + boxOffice),
        hype: clamp01(prev.hype + 0.06 + m.quality * 0.05),
        sector: { ...prev.sector, movies: nextMovies },
      };
    });
  }, [setData]);

  const openRightsNegotiation = useCallback(() => {
    setData((prev) => {
      const id = prev.sector.selectedMovieId;
      if (!id) return prev;
      const m = prev.sector.movies.find((x) => x.id === id);
      if (!m || m.status !== 'released' || m.rightsSold) return prev;

      const baseValue = Math.max(250, m.budget * (0.8 + m.quality * 0.6));
      const n = createNegotiation({ kind: 'rights', partner: 'Distributeur', baseValue, difficulty: 0.55, maxRounds: 4 });
      return { ...prev, negotiation: n };
    });
    setActiveTab('negociation');
  }, [setData]);

  const [counterOffer, setCounterOffer] = useState('');

  const acceptCurrentNegotiation = useCallback(() => {
    setData((prev) => {
      if (!prev.negotiation || prev.negotiation.status !== 'active') return prev;
      const n = acceptNegotiation(prev.negotiation);
      const id = prev.sector.selectedMovieId;
      const m = id ? prev.sector.movies.find((x) => x.id === id) ?? null : null;
      if (!m || m.rightsSold || m.status !== 'released') return { ...prev, negotiation: n };

      const upfront = n.offer;
      const perMin = Math.max(1, Math.floor(n.offer * 0.02));
      toast('Droits', { description: `Accord: +${formatShortNumber(upfront)} ₶ et +${formatShortNumber(perMin)} ₶/min`, duration: 4500 });

      const nextMovies: ApexMovie[] = prev.sector.movies.map((x) =>
        x.id === m.id ? ({ ...x, rightsSold: true, rightsUpfront: upfront, rightsPerMin: perMin } as ApexMovie) : x
      );

      return {
        ...prev,
        cash: clampNonNegative(prev.cash + upfront),
        totalEarned: clampNonNegative(prev.totalEarned + upfront),
        negotiation: n,
        sector: { ...prev.sector, movies: nextMovies },
      };
    });
  }, [setData]);

  const counterCurrentNegotiation = useCallback(() => {
    const value = Number(counterOffer.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;

    setData((prev) => {
      const n = prev.negotiation;
      if (!n || n.status !== 'active') return prev;
      const result = playerCounter(n, value);
      toast('Négociation', { description: result.message, duration: 2500 });
      return { ...prev, negotiation: result.next };
    });
  }, [counterOffer, setData]);

  const closeNegotiation = useCallback(() => {
    setData((prev) => ({ ...prev, negotiation: null }));
  }, [setData]);

  const currentProducing = useMemo(() => data.sector.movies.find((m) => m.status === 'producing') ?? null, [data.sector.movies]);
  const currentReady = useMemo(() => data.sector.movies.find((m) => m.status === 'ready') ?? null, [data.sector.movies]);

  const producingProgress = useMemo(() => {
    if (!currentProducing) return 0;
    const now = Date.now();
    const p = (now - currentProducing.startedAt) / currentProducing.durationMs;
    return Math.max(0, Math.min(1, p));
  }, [currentProducing]);

  return (
    <main className="min-h-screen px-4 md:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center h-10 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Accueil
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-wider uppercase">Apex</h1>
              <div className="text-tx-secondary font-bold text-sm">Business & négociation</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTutorialOpen(true);
                setTutorialStep(0);
              }}
              className="hidden md:inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Tutoriel
            </button>

            <div ref={ppsRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">₶/min</div>
              <div className="text-xl font-display font-black tracking-wider">{formatCoins(ppsPerMin)}</div>
            </div>

            <div ref={cashRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">Trésorerie</div>
              <div className="text-xl font-display font-black tracking-wider">{formatCoins(data.cash)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div ref={sectorRef} className="lg:col-span-3 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
            <div className="text-sm font-display font-black tracking-wider uppercase">Secteurs</div>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border-2 border-brand-border bg-accent-primary text-brand-bg shadow-brutal px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display font-black tracking-wider uppercase">Cinéma</div>
                  <Film className="h-5 w-5" />
                </div>
                <div className="mt-1 text-xs font-bold opacity-90">Production • Box-office • Droits</div>
              </div>

              {['Musique', 'Séries & Streaming', 'Événements Live', 'Crypto', 'Jeux Vidéo', 'Bourse'].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border-2 border-brand-border bg-brand-inner px-3 py-3 text-tx-secondary opacity-70"
                >
                  <div className="font-display font-black tracking-wider uppercase">{label}</div>
                  <div className="mt-1 text-xs font-bold">Bientôt</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div ref={productionRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Cinéma</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('production')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'production'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Production
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalogue')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'catalogue'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('negociation')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'negociation'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Négociation
                  </button>
                </div>
              </div>

              {activeTab === 'production' ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-tx-secondary font-bold">Hype</div>
                      <div className="text-xs text-tx-secondary font-bold">{Math.round(clamp01(data.hype) * 100)}%</div>
                    </div>
                    <div className="mt-2 h-3 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                      <div className="h-full bg-accent-primary" style={{ width: `${Math.round(clamp01(data.hype) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Projet en cours</div>
                    {currentProducing ? (
                      <>
                        <div className="mt-2 font-display font-black tracking-wider uppercase">{currentProducing.title}</div>
                        <div className="mt-2 h-3 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                          <div className="h-full bg-accent-primary" style={{ width: `${Math.round(producingProgress * 100)}%` }} />
                        </div>
                      </>
                    ) : currentReady ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-display font-black tracking-wider uppercase">{currentReady.title}</div>
                          <div className="text-xs text-tx-secondary font-bold">Prêt à sortir</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            selectMovie(currentReady.id);
                            releaseMovie();
                          }}
                          className="h-11 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Sortir
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-tx-secondary font-bold">Aucun projet en cours.</div>
                    )}
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Lancer un film</div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Indé', budget: 2500 },
                        { label: 'Studio', budget: 20_000 },
                        { label: 'Blockbuster', budget: 120_000 },
                      ].map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => startMovie(b.budget)}
                          disabled={namesStatus !== 'ready' || data.cash < b.budget}
                          className={cn(
                            'h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                            namesStatus !== 'ready' || data.cash < b.budget
                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                              : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          {b.label} ({formatShortNumber(b.budget)} ₶)
                        </button>
                      ))}
                    </div>
                    {namesStatus === 'loading' ? <div className="mt-2 text-xs text-tx-secondary font-bold">Chargement des noms…</div> : null}
                  </div>
                </div>
              ) : null}

              {activeTab === 'catalogue' ? (
                <div className="mt-4 space-y-2">
                  {data.sector.movies.length === 0 ? (
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                      Aucun film. Lance une production.
                    </div>
                  ) : (
                    data.sector.movies.slice(0, 20).map((m) => {
                      const selected = m.id === data.sector.selectedMovieId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectMovie(m.id)}
                          className={cn(
                            'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                            selected
                              ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                              : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display font-black tracking-wider uppercase text-sm">{m.title}</div>
                              <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                {m.status === 'producing' ? 'En production' : m.status === 'ready' ? 'Prêt' : 'Sorti'}
                                {m.rightsSold ? ` • Droits: +${formatShortNumber(m.rightsPerMin)} ₶/min` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold">{formatShortNumber(m.budget)} ₶</div>
                              <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                {m.boxOffice > 0 ? `Box: ${formatShortNumber(m.boxOffice)} ₶` : '—'}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              {activeTab === 'negociation' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Droits</div>
                    <div className="mt-2 text-sm text-tx-secondary font-bold">
                      Négocie des droits sur un film sorti pour obtenir un cash immédiat + un revenu passif.
                    </div>
                    <button
                      type="button"
                      onClick={openRightsNegotiation}
                      disabled={!selectedMovie || selectedMovie.status !== 'released' || selectedMovie.rightsSold}
                      className={cn(
                        'mt-3 w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                        !selectedMovie || selectedMovie.status !== 'released' || selectedMovie.rightsSold
                          ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                          : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                      )}
                    >
                      Ouvrir négociation
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div ref={negotiationRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Négociation</div>
                <Users className="h-5 w-5 text-tx-secondary" />
              </div>

              {data.negotiation && data.negotiation.status === 'active' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Partenaire</div>
                    <div className="mt-1 font-display font-black tracking-wider uppercase">{data.negotiation.partner}</div>
                    <div className="mt-2 text-xs text-tx-secondary font-bold">
                      Tour {data.negotiation.round} / {data.negotiation.maxRounds}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Offre actuelle</div>
                    <div className="mt-1 text-2xl font-display font-black tracking-wider">{formatShortNumber(data.negotiation.offer)} ₶</div>
                  </div>

                  <button
                    type="button"
                    onClick={acceptCurrentNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    Accepter
                  </button>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Contre-offre (₶)</div>
                    <input
                      value={counterOffer}
                      onChange={(e) => setCounterOffer(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                      placeholder="Ex: 50000"
                      aria-label="Contre-offre"
                    />
                    <button
                      type="button"
                      onClick={counterCurrentNegotiation}
                      className="mt-2 w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                    >
                      Proposer
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-transparent text-tx-secondary border-brand-border hover:text-tx-base hover:border-tx-base"
                  >
                    Fermer
                  </button>
                </div>
              ) : data.negotiation && data.negotiation.status === 'accepted' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Accord conclu</div>
                    <div className="mt-1 text-2xl font-display font-black tracking-wider">{formatShortNumber(data.negotiation.offer)} ₶</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    OK
                  </button>
                </div>
              ) : data.negotiation && data.negotiation.status === 'walked' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Échec</div>
                    <div className="mt-1 text-sm text-tx-secondary font-bold">{data.negotiation.partner} s’est retiré.</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                  <div className="text-sm text-tx-secondary font-bold">Aucune négociation en cours.</div>
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Stats</div>
                <TrendingUp className="h-5 w-5 text-tx-secondary" />
              </div>
              <div className="mt-3 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 space-y-2 text-sm font-bold">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Gagné</span>
                  <span className="font-mono text-tx-base">{formatShortNumber(data.totalEarned)} ₶</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Dépensé</span>
                  <span className="font-mono text-tx-base">{formatShortNumber(data.totalSpent)} ₶</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Droits</span>
                  <span className="font-mono text-tx-base">{formatShortNumber(rightsIncomePerMin)} ₶/min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

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
    </main>
  );
}
