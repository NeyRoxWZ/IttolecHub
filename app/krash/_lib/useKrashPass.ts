'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { krashRewardLabel, type KrashPassReward, type KrashPassTier } from '@/lib/krash/pass';
import { setKrashBalance } from './useKrashWallet';
import { refreshKrashLoadout } from './useKrashLoadout';

export interface KrashPassState {
  period: string;
  endsAt: string;
  season: number;
  xp: number;
  tier: number;
  intoTier: number;
  needed: number;
  premium: boolean;
  premiumPrice: number;
  dayXp: number;
  dayCap: number;
  claimed: { free: number[]; premium: number[] };
  track: KrashPassTier[];
}

let state: KrashPassState | null = null;
const listeners = new Set<() => void>();
const emit = (next: KrashPassState | null) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** Rewards reached and not yet collected, on the tracks the player has. */
export function unclaimedCount(p: KrashPassState | null): number {
  if (!p) return 0;
  let n = 0;
  for (let t = 1; t <= p.tier; t++) {
    if (!p.claimed.free.includes(t)) n++;
    if (p.premium && !p.claimed.premium.includes(t)) n++;
  }
  return n;
}

/** The pass Krash, shared between its page and the rail's badge. */
export function useKrashPass(poll = false) {
  const { user } = useAuth();
  const pass = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/pass?user_id=${user.id}`, { cache: 'no-store' });
      if (res.ok) emit(await res.json());
    } catch {}
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!poll) return;
    const id = setInterval(refresh, 45000);
    return () => clearInterval(id);
  }, [refresh, poll]);

  const post = useCallback(async (body: object) => {
    const res = await fetch('/api/krash/pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, ...body }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    if (!res.ok) { toast.error(data.error ?? 'Impossible'); sfx.lose(); }
    else if (typeof data.balance === 'number') setKrashBalance(data.balance);
    return { ok: res.ok, data };
  }, [user]);

  const afterRewards = useCallback((rewards: KrashPassReward[]) => {
    if (rewards.some((r) => r.kind === 'cosmetic')) { sfx.jackpot(); if (user) void refreshKrashLoadout(user.id); }
    else sfx.coin();
  }, [user]);

  const claim = useCallback(async (tier: number, track: 'free' | 'premium') => {
    const { ok, data } = await post({ action: 'claim', tier, track });
    if (ok) {
      afterRewards([data.reward]);
      toast.success(`Palier ${tier} : ${krashRewardLabel(data.reward)}`);
    }
    await refresh();
  }, [post, refresh, afterRewards]);

  /** Everything reached at once; the page shows what came out. */
  const claimAll = useCallback(async (): Promise<KrashPassReward[]> => {
    const { ok, data } = await post({ action: 'claim_all' });
    const rewards = ok ? (data.rewards as KrashPassReward[]) : [];
    if (rewards.length) afterRewards(rewards);
    await refresh();
    return rewards;
  }, [post, refresh, afterRewards]);

  const buyPremium = useCallback(async () => {
    const { ok } = await post({ action: 'premium' });
    if (ok) { sfx.jackpot(); toast.success('Pass premium activé pour le mois !'); }
    await refresh();
  }, [post, refresh]);

  return { pass, refresh, claim, claimAll, buyPremium };
}
