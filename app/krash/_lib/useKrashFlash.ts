'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { setKrashBalance } from './useKrashWallet';

export interface FlashBet {
  id: string;
  news_id: string;
  news_text: string;
  label: string;
  side: 'up' | 'down';
  stake: number;
  multiplier: number;
  resolve_at: string;
  status: 'pending' | 'won' | 'lost';
  payout: number | null;
}

let bets: FlashBet[] = [];
const listeners = new Set<() => void>();
const emit = (next: FlashBet[]) => { bets = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => bets;

/** Flash bets, shared by every headline on the page. */
export function useKrashFlash() {
  const { user } = useAuth();
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/flash?user_id=${user.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      emit(data.bets);
      if (typeof data.balance === 'number') setKrashBalance(data.balance);
      for (const b of data.settledNow as FlashBet[]) {
        if (b.status === 'won') {
          sfx.bigWin();
          toast.success(`Pari flash gagné : +${(b.payout ?? 0).toLocaleString('fr-FR')} ₶`, { description: b.news_text });
        } else {
          sfx.lose();
          toast(`Pari flash perdu : −${b.stake.toLocaleString('fr-FR')} ₶`, { description: b.news_text });
        }
      }
    } catch {}
  }, [user]);

  // Poll faster while a verdict is pending, so it lands close to its minute.
  const pending = list.some((b) => b.status === 'pending');
  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, pending ? 5000 : 20000);
    return () => clearInterval(id);
  }, [refresh, pending]);

  const place = useCallback(async (newsId: string, hint: number, side: 'up' | 'down', stake: number) => {
    if (!user) return false;
    const res = await fetch('/api/krash/flash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, news_id: newsId, hint, side, stake }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    if (!res.ok) { toast.error(data.error ?? 'Pari refusé'); sfx.lose(); return false; }
    sfx.bet();
    setKrashBalance(data.balance);
    emit([data.bet, ...bets]);
    return true;
  }, [user]);

  return { bets: list, place, refresh };
}
