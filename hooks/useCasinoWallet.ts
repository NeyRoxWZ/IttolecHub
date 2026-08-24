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

  return { balance, history, isLoaded, isLocal, maxBet, spinWheelBet, refresh };
}
