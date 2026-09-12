'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { sfx } from '@/lib/casino/sfx';
import { ASSET_BY_ID } from '@/lib/krash/assets';

export interface KrashPosition {
  id: string;
  asset: string;
  market: 'frx' | 'crypto';
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
  const wallet = useCasinoWallet();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const [open, setOpen] = useState<KrashPosition[]>([]);
  const [recent, setRecent] = useState<KrashPosition[]>([]);
  const [stats, setStats] = useState<KrashStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/trade?user_id=${user.id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setOpen(data.open);
      setRecent(data.recent);
      setStats(data.stats);
      setLoaded(true);
      for (const p of data.liquidatedNow as KrashPosition[]) {
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

  const post = useCallback(async (body: object) => {
    const res = await fetch('/api/krash/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, ...body }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    return { ok: res.ok, data };
  }, [user]);

  const openPosition = useCallback(async (input: { asset: string; side: 'long' | 'short'; leverage: number; stake: number }) => {
    if (!user) return false;
    setBusy('open');
    try {
      const { ok, data } = await post({ action: 'open', ...input });
      if (!ok) { toast.error(data.error ?? 'Ordre refusé'); sfx.lose(); return false; }
      sfx.bet();
      walletRef.current.setBalance(data.balance);
      const name = ASSET_BY_ID.get(input.asset)?.name ?? input.asset;
      toast.success(`${input.side === 'long' ? 'Achat' : 'Vente'} ${name} x${input.leverage}`, {
        description: `${fmt(input.stake)} ₶ placés · frais ${fmt(data.position.fee)} ₶`,
      });
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  }, [user, post, load]);

  const announce = (pnl: number, stake: number, label: string) => {
    if (pnl >= stake) {
      sfx.bigWin();
      toast.success(`${label} : +${fmt(pnl)} ₶`, { description: 'Gros coup !', duration: 6000 });
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
      if (data.balance !== null) walletRef.current.setBalance(data.balance);
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
      if (data.balance !== null) walletRef.current.setBalance(data.balance);
      if (data.closed > 0) {
        const staked = open.reduce((s, p) => s + p.stake, 0);
        announce(data.pnl, staked, `${data.closed} position${data.closed > 1 ? 's' : ''} retirée${data.closed > 1 ? 's' : ''}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [post, load, open]);

  return { open, recent, stats, loaded, busy, reload: load, openPosition, closePosition, closeAll };
}
