'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { ASSET_BY_ID } from '@/lib/krash/assets';
import { applyKrashWallet, setKrashBalance } from './useKrashWallet';

export interface KrashPosition {
  id: string;
  asset: string;
  market: string;
  side: 'long' | 'short';
  leverage: number;
  stake: number;
  fee: number;
  entry_price: number;
  opened_at: string;
  status: 'open' | 'closed' | 'liquidated';
  exit_price: number | null;
  closed_at: string | null;
  payout: number | null;
  duration: number | null;
  closes_at: string | null;
  perks?: { fee_free?: boolean };
}

/** A trade the server just closed, as the reveal shows it. */
export interface KrashSettlement {
  position: KrashPosition;
  payout: number;
  pnl: number;
  pct: number;
  bonus: number;
  refund: number;
  fee: number;
  streak: number;
  liquidated: boolean;
}

export interface KrashStats {
  trades: number;
  wins: number;
  liquidations: number;
  realized_pnl: number;
  volume: number;
  best_trade: number;
}

const fmt = (n: number) => Math.abs(n).toLocaleString('fr-FR');

/** The player's positions and the three things they can do with them. */
export function useKrashPositions() {
  const { user } = useAuth();

  const [open, setOpen] = useState<KrashPosition[]>([]);
  const [recent, setRecent] = useState<KrashPosition[]>([]);
  const [stats, setStats] = useState<KrashStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reveals, setReveals] = useState<KrashSettlement[]>([]);
  const dismissReveal = useCallback(() => setReveals((r) => r.slice(1)), []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/trade?user_id=${user.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setOpen(data.open);
      setRecent(data.recent);
      setStats(data.stats);
      applyKrashWallet(data.wallet);
      setLoaded(true);
      // Timed trades the clock just closed get their reveal.
      const timed = (data.settledNow as KrashSettlement[]).filter((s) => s.position.closes_at);
      if (timed.length) setReveals((r) => [...r, ...timed]);
      for (const p of (data.liquidatedNow as KrashPosition[]).filter((l) => !l.closes_at)) {
        sfx.bust();
        toast.error(`Liquidé : ${ASSET_BY_ID.get(p.asset)?.name ?? p.asset} x${p.leverage}`, {
          description: `La cote est allée trop loin contre toi. −${fmt(p.stake + p.fee)} ₶`,
          duration: 6000,
        });
      }
    } catch {
      // Next refresh will catch up.
    }
  }, [user]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  // A timed trade reveals on time rather than at the next poll: ask again
  // just after the earliest deadline, once the server has the closing tick.
  const nextDeadline = open.reduce<number | null>((min, p) => {
    if (!p.closes_at) return min;
    const t = Date.parse(p.closes_at);
    return min === null || t < min ? t : min;
  }, null);
  useEffect(() => {
    if (nextDeadline === null) return;
    const wait = Math.max(500, nextDeadline - Date.now() + 2500);
    const id = setTimeout(load, wait);
    return () => clearTimeout(id);
  }, [nextDeadline, load]);

  const post = useCallback(async (body: object) => {
    const res = await fetch('/api/krash/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, ...body }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    return { ok: res.ok, data };
  }, [user]);

  const openPosition = useCallback(async (input: { asset: string; side: 'long' | 'short'; leverage: number; stake: number; duration?: number | null }) => {
    if (!user) return false;
    setBusy('open');
    try {
      const { ok, data } = await post({ action: 'open', ...input });
      if (!ok) { toast.error(data.error ?? 'Ordre refusé'); sfx.lose(); return false; }
      sfx.bet();
      setKrashBalance(data.balance);
      const name = ASSET_BY_ID.get(input.asset)?.name ?? input.asset;
      toast.success(`${input.side === 'long' ? 'Achat' : 'Vente'} ${name} x${input.leverage}`, {
        description: input.duration ? `${fmt(input.stake)} ₶ · résultat dans ${input.duration < 60 ? `${input.duration} s` : `${input.duration / 60} min`}` : `${fmt(input.stake)} ₶ placés`,
      });
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  }, [user, post, load]);

  const announce = (pnl: number, stake: number, label: string) => {
    if (pnl >= stake) {
      window.dispatchEvent(new Event('krash:bigwin'));
      sfx.jackpot();
      toast.success(`${label} : +${fmt(pnl)} ₶`, { description: 'Gros coup !', duration: 6000 });
    } else if (pnl >= stake * 0.2) {
      sfx.bigWin();
      toast.success(`${label} : +${fmt(pnl)} ₶`, { description: 'Joli trade.' });
    } else if (pnl > 0) {
      sfx.cashout();
      toast.success(`${label} : +${fmt(pnl)} ₶`);
    } else {
      sfx.lose();
      toast(`${label} : −${fmt(pnl)} ₶`);
    }
  };

  const closePosition = useCallback(async (position: KrashPosition) => {
    setBusy(position.id);
    try {
      const { ok, data } = await post({ action: 'close', position_id: position.id });
      if (!ok) { toast.error(data.error ?? 'Retrait impossible'); await load(); return; }
      if (data.balance !== null) setKrashBalance(data.balance);
      if (data.position.status === 'liquidated') {
        sfx.bust();
        toast.error('Trop tard : position déjà liquidée.');
      } else {
        announce(data.pnl, position.stake, `Retiré ${ASSET_BY_ID.get(position.asset)?.name ?? position.asset}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load]);

  const closeAll = useCallback(async () => {
    setBusy('all');
    try {
      const { ok, data } = await post({ action: 'close_all' });
      if (!ok) { toast.error(data.error ?? 'Retrait impossible'); return; }
      if (data.balance !== null) setKrashBalance(data.balance);
      if (data.closed > 0) {
        const staked = open.reduce((s, p) => s + p.stake, 0);
        announce(data.pnl, staked, `${data.closed} position${data.closed > 1 ? 's' : ''} retirée${data.closed > 1 ? 's' : ''}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load, open]);

  return { open, recent, stats, loaded, busy, reload: load, openPosition, closePosition, closeAll, reveals, dismissReveal };
}
