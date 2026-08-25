'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

interface LocalWallet {
  balance: number;
  history: CasinoTransaction[];
}

const LOCAL_KEY = 'itollec_casino_wallet';

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

export interface WheelSpinResult {
  landedNumber: number;
  won: boolean;
  multiplier: number;
  payout: number;
  netChange: number;
  newBalance: number;
}

export interface GenericBetResult {
  won: boolean;
  multiplier: number;
  payout: number;
  netChange: number;
  newBalance: number;
  meta: any;
}

export function useCasinoWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(CASINO_STARTING_BALANCE);
  const [history, setHistory] = useState<CasinoTransaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLocal = !user;
  const spinningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (user) {
      const res = await fetch(`/api/casino/wallet?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setHistory(data.history);
      }
    } else {
      const w = loadLocalWallet();
      // Local safety net too, so anonymous players never get stuck either.
      if (w.balance < CASINO_SAFETY_NET_THRESHOLD) {
        w.balance += CASINO_SAFETY_NET_AMOUNT;
        w.history = [
          { id: crypto.randomUUID(), game_slug: 'casino', type: 'safety_net', amount: CASINO_SAFETY_NET_AMOUNT, balance_after: w.balance, created_at: new Date().toISOString() },
          ...w.history,
        ].slice(0, 50);
        saveLocalWallet(w);
      }
      setBalance(w.balance);
      setHistory(w.history);
    }
    setIsLoaded(true);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live balance sync across tabs/devices for logged-in players.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`casino_wallet:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'casino_wallets', filter: `user_id=eq.${user.id}` }, (payload) => {
        setBalance((payload.new as any).balance);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const maxBet = getMaxBet(balance);

  const spinWheelBet = useCallback(async (bet: WheelBet, amount: number): Promise<WheelSpinResult | { error: string }> => {
    if (spinningRef.current) return { error: 'Un spin est déjà en cours.' };
    spinningRef.current = true;
    try {
      if (user) {
        const res = await fetch('/api/casino/wheel/spin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, bet, amount }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Erreur du serveur' };
        setBalance(data.newBalance);
        await refresh();
        return data as WheelSpinResult;
      } else {
        const w = loadLocalWallet();
        if (amount > w.balance) return { error: 'Solde insuffisant' };
        if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };

        const landedNumber = localSpinWheel();
        const { won, multiplier } = resolveWheelBet(landedNumber, bet);
        const payout = won ? amount * multiplier : 0;
        const netChange = payout - amount;
        w.balance += netChange;
        w.history = [
          { id: crypto.randomUUID(), game_slug: 'wheel', type: won ? 'win' : 'bet', amount: netChange, balance_after: w.balance, meta: { bet, landedNumber, multiplier, amount }, created_at: new Date().toISOString() },
          ...w.history,
        ].slice(0, 50);
        saveLocalWallet(w);
        setBalance(w.balance);
        setHistory(w.history);
        return { landedNumber, won, multiplier, payout, netChange, newBalance: w.balance };
      }
    } finally {
      spinningRef.current = false;
    }
  }, [user, refresh]);

  // Generic path for "one bet, one instant reveal" games (coinflip, rps,
  // bonneteau, ...). `localResolve` mirrors exactly what the server route
  // computes, so anonymous play behaves the same, just unsynced/unsaved.
  const placeBet = useCallback(async (
    gameSlug: string,
    amount: number,
    payload: any,
    localResolve: () => { won: boolean; multiplier: number; meta: any }
  ): Promise<GenericBetResult | { error: string }> => {
    if (spinningRef.current) return { error: 'Une mise est déjà en cours.' };
    spinningRef.current = true;
    try {
      if (user) {
        const res = await fetch(`/api/casino/${gameSlug}/play`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, amount, payload }),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.error || 'Erreur du serveur' };
        setBalance(data.newBalance);
        await refresh();
        return data as GenericBetResult;
      } else {
        const w = loadLocalWallet();
        if (amount > w.balance) return { error: 'Solde insuffisant' };
        if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };

        const { won, multiplier, meta } = localResolve();
        const payout = Math.round(amount * multiplier);
        const netChange = payout - amount;
        w.balance += netChange;
        const txType = multiplier === 0 ? 'bet' : multiplier === 1 ? 'push' : 'win';
        w.history = [
          { id: crypto.randomUUID(), game_slug: gameSlug, type: txType, amount: netChange, balance_after: w.balance, meta: { ...meta, amount, multiplier }, created_at: new Date().toISOString() },
          ...w.history,
        ].slice(0, 50);
        saveLocalWallet(w);
        setBalance(w.balance);
        setHistory(w.history);
        return { won, multiplier, payout, netChange, newBalance: w.balance, meta };
      }
    } finally {
      spinningRef.current = false;
    }
  }, [user, refresh]);

  // For round-based games (Mines/Tower/Poulet/Dino): anonymous play keeps
  // the round's secret state in the game page's own component state (no
  // need to hide anything from yourself), so the wallet hook only needs to
  // handle the money side — deduct on start, credit on cashout.
  const startLocalBet = useCallback((gameSlug: string, amount: number): { ok: true } | { error: string } => {
    const w = loadLocalWallet();
    if (amount > w.balance) return { error: 'Solde insuffisant' };
    if (amount > getMaxBet(w.balance)) return { error: `Mise max: ${getMaxBet(w.balance)} ₶` };
    w.balance -= amount;
    w.history = [
      { id: crypto.randomUUID(), game_slug: gameSlug, type: 'bet', amount: -amount, balance_after: w.balance, created_at: new Date().toISOString() },
      ...w.history,
    ].slice(0, 50);
    saveLocalWallet(w);
    setBalance(w.balance);
    setHistory(w.history);
    return { ok: true };
  }, []);

  const creditLocal = useCallback((gameSlug: string, payout: number, multiplier: number) => {
    const w = loadLocalWallet();
    w.balance += payout;
    w.history = [
      { id: crypto.randomUUID(), game_slug: gameSlug, type: 'win', amount: payout, balance_after: w.balance, meta: { multiplier }, created_at: new Date().toISOString() },
      ...w.history,
    ].slice(0, 50);
    saveLocalWallet(w);
    setBalance(w.balance);
    setHistory(w.history);
  }, []);

  return { balance, history, isLoaded, isLocal, maxBet, spinWheelBet, placeBet, startLocalBet, creditLocal, refresh };
}
