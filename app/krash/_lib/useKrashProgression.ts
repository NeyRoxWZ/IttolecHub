'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { COSMETICS } from '@/lib/krash/progression';
import { setKrashBalance } from './useKrashWallet';

export interface KrashProgression {
  day: string;
  missions: { id: string; label: string; goal: number; reward: number; progress: number; done: boolean; claimed: boolean }[];
  chest: { canClaim: boolean; streak: number; reward: number };
  pass: { period: string; endsAt: string; xp: number; tier: number; tiers: number; claimed: number[] };
  cosmetics: { unlocked: string[]; title: string | null; chartSkin: string | null };
}

let state: KrashProgression | null = null;
const listeners = new Set<() => void>();
const emit = (next: KrashProgression | null) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

/** Something is waiting to be collected: drives the badge on the tab. */
export function claimableCount(p: KrashProgression | null): number {
  if (!p) return 0;
  const missions = p.missions.filter((m) => m.done && !m.claimed).length;
  let tiers = 0;
  for (let t = 1; t <= p.pass.tier; t++) if (!p.pass.claimed.includes(t)) tiers++;
  return missions + tiers + (p.chest.canClaim ? 1 : 0);
}

/** Chest, missions, pass and cosmetics, shared across the Krash pages. */
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
      toast.success(`Coffre ouvert : +${data.coins.toLocaleString('fr-FR')} ₶`, { description: `Série de ${data.streak} jour${data.streak > 1 ? 's' : ''}` });
    }
    await refresh();
  }, [post, refresh]);

  const claimMission = useCallback(async (id: string) => {
    const { ok, data } = await post({ action: 'mission', id });
    if (ok) { sfx.cashout(); toast.success(`Mission réussie : +${data.coins.toLocaleString('fr-FR')} ₶`); }
    await refresh();
  }, [post, refresh]);

  const claimTier = useCallback(async (tier: number, quiet = false) => {
    const { ok, data } = await post({ action: 'tier', tier });
    if (ok && !quiet) {
      if (data.item) { sfx.jackpot(); toast.success(`Palier ${tier} : ${COSMETICS[data.item]?.label ?? data.item} débloqué !`); }
      else { sfx.coin(); toast.success(`Palier ${tier} : +${data.coins.toLocaleString('fr-FR')} ₶`); }
    }
    return ok ? data : null;
  }, [post]);

  const claimAllTiers = useCallback(async () => {
    if (!state) return;
    let coins = 0;
    const items: string[] = [];
    for (let t = 1; t <= state.pass.tier; t++) {
      if (state.pass.claimed.includes(t)) continue;
      const data = await claimTier(t, true);
      if (data) { coins += data.coins; if (data.item) items.push(data.item); }
    }
    if (coins || items.length) {
      if (items.length) sfx.jackpot(); else sfx.bigWin();
      toast.success(`Pass Krash : +${coins.toLocaleString('fr-FR')} ₶`, {
        description: items.length ? `Débloqué : ${items.map((i) => COSMETICS[i]?.label ?? i).join(', ')}` : undefined,
      });
    }
    await refresh();
  }, [claimTier, refresh]);

  const equip = useCallback(async (kind: 'title' | 'skin', item: string | null) => {
    const { ok } = await post({ action: 'equip', kind, item });
    if (ok) sfx.select();
    await refresh();
  }, [post, refresh]);

  return { progression, refresh, claimChest, claimMission, claimTier, claimAllTiers, equip };
}
