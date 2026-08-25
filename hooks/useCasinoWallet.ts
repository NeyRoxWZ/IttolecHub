'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import {
  spinWheel as localSpinWheel,
  resolveWheelBet,
  getMaxBet,
  CASINO_STARTING_BALANCE,
  CASINO_SAFETY_NET_THRESHOLD,
  CASINO_SAFETY_NET_AMOUNT,
  type WheelBet,
} from '@/lib/casino/wheel';

export interface CasinoTransaction {
  id: string;
  game_slug: string;
  type: string;
  amount: number;
  balance_after: number;
  meta?: any;
  created_at: string;
}

export interface CasinoStats {
  totalWagered: number;
  totalWon: number;
  currentStreak: number;
  bestStreak: number;
  prestigeCount: number;
  biggestMultiplier: number;
  allTimeBestBalance: number;
  dailyStreak: number;
  dailyClaimedToday: boolean;
  wheelClaimedToday: boolean;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  cashbackClaimedToday: boolean;
}

export interface ActiveEffect { effect: string; magnitude: number; uses_left: number | null; expires_at: string | null }
export type EffectMap = Record<string, ActiveEffect>;

const EMPTY_STATS: CasinoStats = {
  totalWagered: 0, totalWon: 0, currentStreak: 0, bestStreak: 0, prestigeCount: 0,
  biggestMultiplier: 0, allTimeBestBalance: CASINO_STARTING_BALANCE, dailyStreak: 0,
  dailyClaimedToday: false, wheelClaimedToday: false,
  xp: 0, level: 1, xpIntoLevel: 0, xpForNext: 200, cashbackClaimedToday: false,
};

/* ------------------------------------------------------------------ */
/* Shared store                                                        */
/* ------------------------------------------------------------------ */

/**
 * The wallet lives in a module-level store rather than per-component state.
 * Without this, every navigation between casino pages remounted the hook and
 * refetched the wallet, so the balance flashed "···" and the page felt slow to
 * open. Now the cached value renders instantly and we only revalidate in the
 * background.
 */
interface WalletSnapshot {
  balance: number;
  history: CasinoTransaction[];
  stats: CasinoStats;
  effects: EffectMap;
  isLoaded: boolean;
}

let snapshot: WalletSnapshot = {
  balance: CASINO_STARTING_BALANCE,
  history: [],
  stats: EMPTY_STATS,
  effects: {},
  isLoaded: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setSnapshot(patch: Partial<WalletSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => snapshot;

/* ------------------------------------------------------------------ */
/* Local (anonymous) wallet                                            */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = 'itollec_casino_wallet';

interface LocalWallet { balance: number; history: CasinoTransaction[] }

function loadLocalWallet(): LocalWallet {
  if (typeof window === 'undefined') return { balance: CASINO_STARTING_BALANCE, history: [] };
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { balance: CASINO_STARTING_BALANCE, history: [] };
}

function saveLocalWallet(w: LocalWallet) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(w)); } catch {}
}

/* ------------------------------------------------------------------ */

export interface WheelSpinResult {
  landedNumber: number;
  won: boolean;
  multiplier: number;
  payout: number;
  netChange: number;
  newBalance: number;
  progression?: Progression;
}

export interface Progression {
  newAchievements: { id: string; name: string; description: string }[];
  jackpotWon: number | null;
  xpGained?: number;
  level?: number;
  levelsGained?: number;
  levelReward?: number;
  missionsCompleted?: { id: string; label: string }[];
  streak?: number;
  streakSaved?: boolean;
}

export interface GenericBetResult {
  won: boolean;
  multiplier: number;
  payout: number;
  netChange: number;
  newBalance: number;
  meta: any;
  progression?: Progression;
}

function announceProgression(progression?: Progression) {
  if (!progression) return;
  if (progression.levelsGained) {
    toast.success(`Niveau ${progression.level} !`, {
      description: progression.levelReward ? `Coffre de niveau : +${progression.levelReward.toLocaleString('fr-FR')} ₶` : undefined,
      duration: 5000,
    });
  }
  if (progression.streakSaved) {
    toast('Bouclier de série consommé — ta série tient bon.', { duration: 4000 });
  }
  for (const m of progression.missionsCompleted || []) {
    toast.success('Mission terminée', { description: `${m.label} — à réclamer dans les missions.`, duration: 5000 });
  }
  if (progression.jackpotWon) {
    toast.success(`JACKPOT ! +${progression.jackpotWon.toLocaleString('fr-FR')} ₶`, { duration: 6000 });
  }
  for (const a of progression.newAchievements) {
    toast.success(`Succès débloqué : ${a.name}`, { description: a.description, duration: 5000 });
  }
}

/** Move the XP bar and streak the moment the server answers. */
function applyProgression(progression?: Progression) {
  if (!progression) return;
  const s = snapshot.stats;
  const xp = s.xp + (progression.xpGained || 0);
  const level = progression.level ?? s.level;
  const patch: Partial<CasinoStats> = { xp, level };
  if (progression.levelsGained) {
    // The exact position inside the new level comes back on the next refresh.
    patch.xpIntoLevel = 0;
  } else {
    patch.xpIntoLevel = s.xpIntoLevel + (progression.xpGained || 0);
  }
  if (progression.streak !== undefined) {
    patch.currentStreak = progression.streak;
    patch.bestStreak = Math.max(s.bestStreak, progression.streak);
  }
  setSnapshot({ stats: { ...s, ...patch } });
}

/** Fold a settled bet into the cached wallet immediately, no round-trip. */
function applySettlement(gameSlug: string, netChange: number, newBalance: number, multiplier: number, meta?: any) {
  const type = multiplier === 0 ? 'bet' : multiplier === 1 ? 'push' : 'win';
  const tx: CasinoTransaction = {
    id: crypto.randomUUID(),
    game_slug: gameSlug,
    type,
    amount: netChange,
    balance_after: newBalance,
    meta,
    created_at: new Date().toISOString(),
  };

  const s = snapshot.stats;
  const isWin = multiplier > 1;
  const isLoss = multiplier === 0;
  const currentStreak = isWin ? s.currentStreak + 1 : isLoss ? 0 : s.currentStreak;

  setSnapshot({
    balance: newBalance,
    history: [tx, ...snapshot.history].slice(0, 50),
    stats: {
      ...s,
      currentStreak,
      bestStreak: Math.max(s.bestStreak, currentStreak),
      biggestMultiplier: Math.max(s.biggestMultiplier, multiplier),
      allTimeBestBalance: Math.max(s.allTimeBestBalance, newBalance),
    },
  });
}

export function useCasinoWallet() {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const inFlightRef = useRef(false);
  const revalidateTimer = useRef<NodeJS.Timeout | null>(null);
  const isLocal = !user;

  const fetchWallet = useCallback(async () => {
    if (user) {
      const res = await fetch(`/api/casino/wallet?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot({
          balance: data.balance,
          history: data.history,
          stats: data.stats ?? EMPTY_STATS,
          effects: data.effects ?? {},
          isLoaded: true,
        });
      }
    } else {
      const w = loadLocalWallet();
      // Local safety net so anonymous players never get stuck at zero either.
      if (w.balance < CASINO_SAFETY_NET_THRESHOLD) {
        w.balance += CASINO_SAFETY_NET_AMOUNT;
        w.history = [
          { id: crypto.randomUUID(), game_slug: 'casino', type: 'safety_net', amount: CASINO_SAFETY_NET_AMOUNT, balance_after: w.balance, created_at: new Date().toISOString() },
          ...w.history,
        ].slice(0, 50);
        saveLocalWallet(w);
      }
      setSnapshot({ balance: w.balance, history: w.history, stats: EMPTY_STATS, effects: {}, isLoaded: true });
    }
  }, [user]);

  // Load once per session; navigating between games reuses the cache.
  useEffect(() => { void fetchWallet(); }, [fetchWallet]);

  /** Reconcile with the server a moment after the action, off the hot path. */
  const scheduleRevalidate = useCallback(() => {
    if (!user) return;
    if (revalidateTimer.current) clearTimeout(revalidateTimer.current);
    revalidateTimer.current = setTimeout(() => { void fetchWallet(); }, 2500);
  }, [user, fetchWallet]);

  useEffect(() => () => { if (revalidateTimer.current) clearTimeout(revalidateTimer.current); }, []);

  // Live balance sync across tabs/devices.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`casino_wallet:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'casino_wallets', filter: `user_id=eq.${user.id}` }, (payload) => {
        setSnapshot({ balance: (payload.new as any).balance });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // A "high roller" item widens the cap; the server enforces the same rule.
  const betPct = store.effects.max_bet_pct?.magnitude;
  const maxBet = betPct ? Math.max(1, Math.floor(store.balance * betPct)) : getMaxBet(store.balance);

  const spinWheelBet = useCallback(async (bet: WheelBet, amount: number): Promise<WheelSpinResult | { error: string }> => {
    if (inFlightRef.current) return { error: 'Une mise est déjà en cours.' };
    inFlightRef.current = true;
    try {
      if (user) {
        const res = await fetch('/api/casino/wheel/spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, bet, amount }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Erreur du serveur' };
        applySettlement('wheel', data.netChange, data.newBalance, data.multiplier, { bet, landedNumber: data.landedNumber, amount });
        applyProgression(data.progression);
        announceProgression(data.progression);
        scheduleRevalidate();
        return data as WheelSpinResult;
      }

      const w = loadLocalWallet();
      if (amount > w.balance) return { error: 'Solde insuffisant' };
      if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };

      const landedNumber = localSpinWheel();
      const { won, multiplier } = resolveWheelBet(landedNumber, bet);
      const payout = won ? amount * multiplier : 0;
      const netChange = payout - amount;
      w.balance += netChange;
      const tx: CasinoTransaction = {
        id: crypto.randomUUID(), game_slug: 'wheel', type: won ? 'win' : 'bet',
        amount: netChange, balance_after: w.balance,
        meta: { bet, landedNumber, multiplier, amount }, created_at: new Date().toISOString(),
      };
      w.history = [tx, ...w.history].slice(0, 50);
      saveLocalWallet(w);
      applySettlement('wheel', netChange, w.balance, multiplier, tx.meta);
      return { landedNumber, won, multiplier, payout, netChange, newBalance: w.balance };
    } finally {
      inFlightRef.current = false;
    }
  }, [user, scheduleRevalidate]);

  /** "One bet, one instant reveal" games. */
  const placeBet = useCallback(async (
    gameSlug: string,
    amount: number,
    payload: any,
    localResolve: () => { won: boolean; multiplier: number; meta: any }
  ): Promise<GenericBetResult | { error: string }> => {
    if (inFlightRef.current) return { error: 'Une mise est déjà en cours.' };
    inFlightRef.current = true;
    try {
      if (user) {
        const res = await fetch(`/api/casino/${gameSlug}/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, amount, payload }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Erreur du serveur' };
        applySettlement(gameSlug, data.netChange, data.newBalance, data.multiplier, { ...data.meta, amount });
        applyProgression(data.progression);
        announceProgression(data.progression);
        scheduleRevalidate();
        return data as GenericBetResult;
      }

      const w = loadLocalWallet();
      if (amount > w.balance) return { error: 'Solde insuffisant' };
      if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };

      const { won, multiplier, meta } = localResolve();
      const payout = Math.round(amount * multiplier);
      const netChange = payout - amount;
      w.balance += netChange;
      const type = multiplier === 0 ? 'bet' : multiplier === 1 ? 'push' : 'win';
      w.history = [
        { id: crypto.randomUUID(), game_slug: gameSlug, type, amount: netChange, balance_after: w.balance, meta: { ...meta, amount, multiplier }, created_at: new Date().toISOString() },
        ...w.history,
      ].slice(0, 50);
      saveLocalWallet(w);
      applySettlement(gameSlug, netChange, w.balance, multiplier, { ...meta, amount });
      return { won, multiplier, payout, netChange, newBalance: w.balance, meta };
    } finally {
      inFlightRef.current = false;
    }
  }, [user, scheduleRevalidate]);

  /* ---- round-based games (Mines/Tower/Poulet/Dino/Rocket/Blackjack) ---- */

  /** Server already returned the new balance — reflect it without a refetch. */
  const applyServerBalance = useCallback((gameSlug: string, newBalance: number, amount: number) => {
    const tx: CasinoTransaction = {
      id: crypto.randomUUID(), game_slug: gameSlug, type: 'bet',
      amount: -amount, balance_after: newBalance, created_at: new Date().toISOString(),
    };
    setSnapshot({ balance: newBalance, history: [tx, ...snapshot.history].slice(0, 50) });
    scheduleRevalidate();
  }, [scheduleRevalidate]);

  const applyServerCashout = useCallback((gameSlug: string, newBalance: number, payout: number, multiplier: number) => {
    applySettlement(gameSlug, payout, newBalance, multiplier);
    scheduleRevalidate();
  }, [scheduleRevalidate]);

  const startLocalBet = useCallback((gameSlug: string, amount: number): { ok: true } | { error: string } => {
    const w = loadLocalWallet();
    if (amount > w.balance) return { error: 'Solde insuffisant' };
    if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };
    w.balance -= amount;
    const tx: CasinoTransaction = {
      id: crypto.randomUUID(), game_slug: gameSlug, type: 'bet',
      amount: -amount, balance_after: w.balance, created_at: new Date().toISOString(),
    };
    w.history = [tx, ...w.history].slice(0, 50);
    saveLocalWallet(w);
    setSnapshot({ balance: w.balance, history: [tx, ...snapshot.history].slice(0, 50) });
    return { ok: true };
  }, []);

  const creditLocal = useCallback((gameSlug: string, payout: number, multiplier: number) => {
    const w = loadLocalWallet();
    w.balance += payout;
    const tx: CasinoTransaction = {
      id: crypto.randomUUID(), game_slug: gameSlug, type: 'win',
      amount: payout, balance_after: w.balance, meta: { multiplier }, created_at: new Date().toISOString(),
    };
    w.history = [tx, ...w.history].slice(0, 50);
    saveLocalWallet(w);
    applySettlement(gameSlug, payout, w.balance, multiplier);
  }, []);

  /* ---- daily rewards / prestige ---- */

  const claimDaily = useCallback(async (): Promise<{ reward: number; dailyStreak: number } | { error: string }> => {
    if (!user) return { error: 'Connecte-toi pour réclamer ton bonus quotidien.' };
    const res = await fetch('/api/casino/daily/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Erreur' };
    setSnapshot({
      balance: data.newBalance,
      stats: { ...snapshot.stats, dailyClaimedToday: true, dailyStreak: data.dailyStreak },
    });
    scheduleRevalidate();
    return data;
  }, [user, scheduleRevalidate]);

  const claimWheelOfFortune = useCallback(async (): Promise<{ reward: number; segmentIndex: number } | { error: string }> => {
    if (!user) return { error: 'Connecte-toi pour tourner la roue quotidienne.' };
    const res = await fetch('/api/casino/wheel-of-fortune/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Erreur' };
    setSnapshot({ balance: data.newBalance, stats: { ...snapshot.stats, wheelClaimedToday: true } });
    scheduleRevalidate();
    return data;
  }, [user, scheduleRevalidate]);

  const prestige = useCallback(async (): Promise<{ prestigeCount: number } | { error: string }> => {
    if (!user) return { error: 'Connecte-toi pour prestiger.' };
    const res = await fetch('/api/casino/prestige', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || 'Erreur' };
    setSnapshot({ balance: data.newBalance, stats: { ...snapshot.stats, prestigeCount: data.prestigeCount } });
    if (data.newAchievements?.length) announceProgression({ newAchievements: data.newAchievements, jackpotWon: null });
    scheduleRevalidate();
    return data;
  }, [user, scheduleRevalidate]);

  return {
    balance: store.balance,
    history: store.history,
    stats: store.stats,
    effects: store.effects,
    isLoaded: store.isLoaded,
    isLocal,
    maxBet,
    spinWheelBet,
    placeBet,
    startLocalBet,
    creditLocal,
    applyServerBalance,
    applyServerCashout,
    claimDaily,
    claimWheelOfFortune,
    prestige,
    announceProgression,
    refresh: fetchWallet,
  };
}
