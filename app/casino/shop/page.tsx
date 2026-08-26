'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Coins, ShieldCheck, TrendingUp, Sparkles, Wallet, Target, PiggyBank,
  Clock, Package, Plus, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import type { ItemCategory, ShopItem } from '@/lib/casino/shop';
import type { CrateDef, CrateOpening } from '@/lib/casino/crates';
import { CountUp } from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import CrateOpeningModal from '../_components/CrateOpeningModal';
import InventoryPanel, { type InventoryState } from '../_components/InventoryPanel';

const CATEGORY_META: Record<ItemCategory, { label: string; icon: any; tone: string }> = {
  protection: { label: 'Protection', icon: ShieldCheck, tone: 'text-accent-success border-accent-success/50' },
  gain: { label: 'Gain', icon: TrendingUp, tone: 'text-accent-primary border-accent-primary/50' },
  xp: { label: 'Progression', icon: Sparkles, tone: 'text-accent-primary border-accent-primary/50' },
  mise: { label: 'Mise', icon: Wallet, tone: 'text-accent-secondary border-accent-secondary/50' },
  mission: { label: 'Mission', icon: Target, tone: 'text-accent-success border-accent-success/50' },
  economie: { label: 'Économie', icon: PiggyBank, tone: 'text-accent-primary border-accent-primary/50' },
};

const CRATE_TONE: Record<string, string> = {
  crate_wood: '#A9743F',
  crate_silver: '#C7CBD6',
  crate_gold: '#FFD000',
  crate_legendary: '#FF4DA6',
};

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/** What the item does once used, phrased for the card footer. */
function durationLabel(item: ShopItem): string | null {
  if (item.durationMin) return `${item.durationMin} min une fois activé`;
  if (item.uses) return `${item.uses} mise${item.uses > 1 ? 's' : ''}`;
  return 'Effet immédiat';
}

export default function CasinoShop() {
  const { user } = useAuth();
  const { balance, isLoaded, spendOptimistic, setBalance } = useCasinoWallet();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [crates, setCrates] = useState<CrateDef[]>([]);
  const [purchased, setPurchased] = useState<string[]>([]);
  const [inventory, setInventory] = useState<InventoryState>({ items: [], crates: [], effects: {} });
  const [resetIn, setResetIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openings, setOpenings] = useState<CrateOpening[] | null>(null);
  const [confetti, setConfetti] = useState(0);

  const loadShop = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/shop${qs}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setCrates(data.crates || []);
      setPurchased(data.purchased || []);
      setResetIn(data.resetIn || 0);
    }
    setLoading(false);
  }, [user]);

  const loadInventory = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/casino/inventory?user_id=${user.id}`);
    if (res.ok) setInventory(await res.json());
  }, [user]);

  useEffect(() => { void loadShop(); }, [loadShop]);
  useEffect(() => { void loadInventory(); }, [loadInventory]);

  useEffect(() => {
    if (resetIn <= 0) return;
    const t = setInterval(() => {
      setResetIn((v) => {
        if (v <= 1) { void loadShop(); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resetIn, loadShop]);

  const buy = async (id: string, name: string, price: number, once = false) => {
    if (!user) { toast.error('Connecte-toi pour acheter.'); return; }
    if (busy) return;
    if (once && purchased.includes(id)) return;
    const quantity = once ? 1 : (qty[id] || 1);
    const total = price * quantity;
    if (balance < total) { toast.error('Solde insuffisant'); return; }

    setBusy(id);
    vibrate(HAPTIC.MEDIUM);
    sfx.coin();
    const before = balance;
    // Deduct on the spot: the round-trip is confirmation, not permission.
    spendOptimistic(total);
    try {
      const res = await fetch('/api/casino/shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: id, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { setBalance(before); toast.error(data.error || 'Erreur'); return; }
      setBalance(data.newBalance);
      if (once) setPurchased((prev) => [...prev, id]);
      toast.success(name, { description: data.message });
      void loadInventory();
    } finally {
      setBusy(null);
    }
  };

  const use = async (itemId: string, name: string, quantity = 1) => {
    if (!user || busy) return;
    setBusy(itemId);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: itemId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      setBalance(data.newBalance);
      if (data.openings?.length) {
        setOpenings(data.openings);
        if (data.openings.some((o: CrateOpening) => o.count === 5)) { sfx.jackpot(); setConfetti((c) => c + 1); }
        else sfx.win();
      } else {
        sfx.select();
        toast.success(name, { description: data.message });
      }
      void loadInventory();
    } finally {
      setBusy(null);
    }
  };

  const bump = (id: string, delta: number) => {
    sfx.click();
    setQty((prev) => ({ ...prev, [id]: Math.max(1, Math.min(10, (prev[id] || 1) + delta)) }));
  };

  return (
    <main className="bg-transparent text-tx-base p-3 sm:p-4 flex flex-col min-h-[100dvh]">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {openings && <CrateOpeningModal openings={openings} onClose={() => setOpenings(null)} />}

      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/casino"
              prefetch
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Boutique</h1>
              <span className="text-[11px] text-tx-muted">Un exemplaire par objet et par jour. Tout part dans ton inventaire.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-11 flex items-center gap-2 px-3 rounded-xl border-2 border-brand-border bg-brand-inner" title="Prochaine rotation des objets du jour">
              <Clock className="h-4 w-4 text-accent-primary" />
              <span className="font-display font-black text-sm tabular-nums">{formatCountdown(resetIn)}</span>
            </div>
            <div className="h-11 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
              <Coins className="h-4 w-4 text-accent-primary" />
              {isLoaded ? <CountUp value={balance} className="font-display font-black text-base" /> : <span className="font-display font-black">···</span>}
              <span className="text-tx-secondary font-bold text-sm">₶</span>
            </div>
          </div>
        </header>

        {/* CRATES — permanent stock */}
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex flex-wrap items-center gap-2">
          <Package className="h-3.5 w-3.5" /> Caisses
          <span className="normal-case font-bold text-tx-muted">
            3 objets = rien de rare · 4 = du rare · 5 = de l&apos;épique et du légendaire
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {crates.map((crate) => {
            const tone = CRATE_TONE[crate.id] || '#FFD000';
            const quantity = qty[crate.id] || 1;
            return (
              <div key={crate.id} className="rounded-2xl border-4 border-brand-border bg-brand-card p-3 flex flex-col shadow-brutal">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-9 w-9 rounded-lg border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: tone, background: `${tone}1A` }}>
                    <Package className="h-4 w-4" style={{ color: tone }} />
                  </span>
                  <h2 className="font-display font-black text-sm leading-tight">{crate.name}</h2>
                </div>
                <p className="text-[11px] text-tx-secondary leading-snug mb-2">{crate.description}</p>

                <div className="flex gap-1 mb-2">
                  {([3, 4, 5] as const).map((c, i) => (
                    <div key={c} className="flex-1">
                      <div className="text-[9px] font-black text-tx-muted mb-0.5">{c} obj.</div>
                      <div className="h-1.5 rounded-full bg-brand-inner overflow-hidden">
                        <div className="h-full" style={{ width: `${crate.countWeights[i] * 100}%`, background: tone }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-1.5">
                  <QuantityStepper id={crate.id} value={quantity} onBump={bump} />
                  <button
                    onClick={() => buy(crate.id, crate.name, crate.price)}
                    disabled={busy !== null || balance < crate.price * quantity}
                    className="flex-1 h-10 rounded-xl border-2 border-brand-border font-display font-black text-xs tracking-wide transition-all active:translate-y-0.5 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: tone, color: '#12121A' }}
                  >
                    {busy === crate.id ? '···' : `${(crate.price * quantity).toLocaleString('en-US')} ₶`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* DAILY CONSUMABLES */}
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">
          Objets du jour
          <span className="normal-case font-bold"> — 5 tirés dans un catalogue de 30, un seul exemplaire chacun</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border-4 border-brand-border bg-brand-card animate-pulse min-h-[210px]" />
          ))}

          {!loading && items.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            const taken = purchased.includes(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-2xl border-4 bg-brand-card p-4 flex flex-col shadow-brutal min-h-[210px] transition-colors',
                  taken ? 'border-accent-success/60 opacity-60' : 'border-brand-border'
                )}
              >
                <div className={cn('self-start flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 bg-brand-inner mb-3', meta.tone)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{meta.label}</span>
                </div>

                <h2 className="font-display font-black text-base leading-tight mb-1.5">{item.name}</h2>
                <p className="text-[12px] text-tx-secondary leading-snug">{item.description}</p>
                <span className="mt-2 self-start text-[10px] font-bold text-tx-muted border border-brand-border rounded px-1.5 py-0.5">
                  {durationLabel(item)}
                </span>

                <div className="mt-auto pt-3">
                  <button
                    onClick={() => buy(item.id, item.name, item.price, true)}
                    disabled={busy !== null || taken || balance < item.price}
                    className={cn(
                      'w-full h-10 rounded-xl border-2 border-brand-border font-display font-black text-xs tracking-wide',
                      'transition-all active:translate-y-0.5 focus:outline-none disabled:cursor-not-allowed',
                      taken ? 'bg-brand-inner text-accent-success'
                        : 'bg-accent-primary text-brand-bg hover:brightness-110 disabled:bg-brand-inner disabled:text-tx-muted'
                    )}
                  >
                    {busy === item.id ? '···'
                      : taken ? 'DÉJÀ PRIS'
                      : `${item.price.toLocaleString('en-US')} ₶`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <InventoryPanel state={inventory} busy={busy} onUse={use} />
      </div>
    </main>
  );
}

function QuantityStepper({ id, value, onBump }: { id: string; value: number; onBump: (id: string, d: number) => void }) {
  return (
    <div className="flex items-center h-10 rounded-xl border-2 border-brand-border bg-brand-inner shrink-0">
      <button onClick={() => onBump(id, -1)} className="h-full w-7 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none">
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-5 text-center font-display font-black text-xs tabular-nums">{value}</span>
      <button onClick={() => onBump(id, 1)} className="h-full w-7 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
