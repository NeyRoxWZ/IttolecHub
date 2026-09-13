'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { setKrashBalance } from './useKrashWallet';

export interface KrashProgression {
  day: string;
  missions: { id: string; label: string; goal: number; reward: number; progress: number; done: boolean; claimed: boolean }[];
  chest: { canClaim: boolean; streak: number; reward: number };
}

let state: KrashProgression | null = null;
const listeners = new Set<() => void>();
const emit = (next: KrashProgression | null) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** The Krash chest and today's missions, shared across the Krash pages. */
export function useKrashProgression() {
  const { user } = useAuth();
  const progression = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/progression?user_id=${user.id}`, { cache: 'no-store' });
      if (res.ok) emit(await res.json());
    } catch {}
  }, [user]);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const post = useCallback(async (body: object) => {
    const res = await fetch('/api/krash/progression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, ...body }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    if (!res.ok) { toast.error(data.error ?? 'Impossible'); sfx.lose(); }
    else if (typeof data.balance === 'number') setKrashBalance(data.balance);
    return { ok: res.ok, data };
  }, [user]);

  const claimChest = useCallback(async () => {
    const { ok, data } = await post({ action: 'chest' });
    if (ok) {
      sfx.crateOpen();
      toast.success(`Coffre ouvert : +${data.coins.toLocaleString('fr-FR')} ₶`, {
        description: `Série de ${data.streak} jour${data.streak > 1 ? 's' : ''}${data.frozen ? ' · sauvée par le Réveil-matin' : ''}`,
      });
    }
    await refresh();
  }, [post, refresh]);

  const claimMission = useCallback(async (id: string) => {
    const { ok, data } = await post({ action: 'mission', id });
    if (ok) { sfx.cashout(); toast.success(`Mission réussie : +${data.coins.toLocaleString('fr-FR')} ₶`); }
    await refresh();
  }, [post, refresh]);

  return { progression, refresh, claimChest, claimMission };
}
