'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Coins, ShieldCheck, TrendingUp, Sparkles, Wallet, Target, PiggyBank,
  Clock, Package, Plus, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import { askToSignIn } from '@/lib/askToSignIn';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import type { ItemCategory, ShopItem } from '@/lib/casino/shop';
import { RARITY_ORDER, type CrateDef, type CrateOpening } from '@/lib/casino/crates';
import { RARITY_COLOR, RARITY_LABEL } from '@/lib/casino/cosmetics';
import { CountUp } from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import CrateOpeningModal from '../_components/CrateOpeningModal';
import InventoryPanel, { type InventoryState } from '../_components/InventoryPanel';
import CasinoControls from '../_components/CasinoControls';
import BalanceChip from '../_components/BalanceChip';
import { refreshActiveEffects } from '@/hooks/useActiveEffects';

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
  crate_gold: '#FFC61A',
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
    if (!user) { askToSignIn('La boutique'); return; }
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
        if (data.openings.some((o: CrateOpening) => o.reward.rarity === 'legendaire')) { sfx.jackpot(); setConfetti((c) => c + 1); }
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
    setQty((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const setQuantity = (id: string, value: number) => {
    setQty((prev) => ({ ...prev, [id]: Math.max(1, Math.floor(value) || 1) }));
  };

  return (
    <main className="bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10 flex flex-col min-h-[100dvh]">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {openings && <CrateOpeningModal openings={openings} onClose={() => setOpenings(null)} />}

      <div className="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/casino"
              prefetch
              className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={3} />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl leading-none">Boutique</h1>
              <span className="text-[11px] text-tx-muted">Un exemplaire par objet et par jour. Tout part dans ton inventaire.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-11 flex items-center gap-2 px-3 rounded-xl border-[3px] border-brand-border bg-brand-inner" title="Prochaine rotation des objets du jour">
              <Clock className="h-4 w-4 text-accent-primary" />
              <span className="font-display text-base sm:text-lg tabular-nums whitespace-nowrap">{formatCountdown(resetIn)}</span>
            </div>
            {/* On phones the settings live in the tab bar's "Plus". */}
            <CasinoControls className="hidden lg:flex" />

            <BalanceChip balance={balance} isLoaded={isLoaded} />
          </div>
        </header>

        {/* CRATES — permanent stock */}
        <div className="font-display text-2xl text-white mb-2 mt-1 flex flex-wrap items-center gap-2">
          <Package className="h-3.5 w-3.5" /> Caisses
          <span className="font-body text-sm font-bold text-tx-secondary">
une pièce par caisse — ce qui change, ce sont les chances de rareté
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {crates.map((crate) => {
            const tone = CRATE_TONE[crate.id] || '#FFC61A';
            const quantity = qty[crate.id] || 1;
            return (
              <div key={crate.id} className="rounded-[22px] border-4 border-brand-border bg-brand-card p-3 flex flex-col shadow-brutal">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-10 w-10 rounded-xl border-[3px] border-brand-border flex items-center justify-center shrink-0 shadow-[inset_0_-4px_0_rgba(0,0,0,0.25)]"
                    style={{ background: tone }}>
                    <Package className="h-5 w-5 text-brand-bg" />
                  </span>
                  <h2 className="font-display text-lg leading-tight">{crate.name}</h2>
                </div>
                <p className="text-[11px] text-tx-secondary leading-snug mb-2">{crate.description}</p>

                <div className="space-y-1 mb-2">
                  {RARITY_ORDER.map((r) => (
                    <div key={r} className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black w-[74px] shrink-0" style={{ color: RARITY_COLOR[r] }}>
                        {RARITY_LABEL[r]}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-brand-inner overflow-hidden">
                        <div className="h-full" style={{ width: `${crate.odds[r] * 100}%`, background: RARITY_COLOR[r] }} />
                      </div>
                      <span className="text-[9px] font-bold text-tx-muted w-9 text-right tabular-nums">
                        {(crate.odds[r] * 100).toFixed(crate.odds[r] < 0.01 ? 1 : 0)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-1.5">
                  <QuantityStepper id={crate.id} value={quantity} onBump={bump} onSet={setQuantity} />
                  <button
                    onClick={() => buy(crate.id, crate.name, crate.price)}
                    disabled={busy !== null || balance < crate.price * quantity}
                    className="flex-1 h-10 rounded-xl border-[3px] border-brand-border font-display text-base tracking-wide transition-transform shadow-[inset_0_-4px_0_rgba(0,0,0,0.25),0_3px_0_#05061A] active:translate-y-[3px] focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="font-display text-2xl text-white mb-2 mt-1">
          Objets du jour
          <span className="font-body text-sm font-bold text-tx-secondary"> — 5 tirés dans un catalogue de 30, un seul exemplaire chacun</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse min-h-[210px]" />
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
                <div className={cn('self-start flex items-center gap-1.5 px-2 py-1 rounded-lg border-[3px] bg-brand-inner mb-3', meta.tone)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{meta.label}</span>
                </div>

                <h2 className="font-display text-xl leading-tight mb-1.5">{item.name}</h2>
                <p className="text-[12px] text-tx-secondary leading-snug">{item.description}</p>
                <span className="mt-2 self-start text-[10px] font-bold text-tx-muted border border-brand-border rounded px-1.5 py-0.5">
                  {durationLabel(item)}
                </span>

                <div className="mt-auto pt-3">
                  <button
                    onClick={() => buy(item.id, item.name, item.price, true)}
                    disabled={busy !== null || taken || balance < item.price}
                    className={cn(
                      'w-full h-10 rounded-xl border-[3px] border-brand-border font-display text-base tracking-wide',
                      'transition-all active:translate-y-0.5 focus:outline-none disabled:cursor-not-allowed',
                      taken ? 'bg-brand-inner text-accent-success'
                        : 'bg-accent-primary text-brand-bg hover:brightness-110 disabled:bg-brand-inner disabled:text-tx-muted'
                    )}
                  >
                    {busy === item.id ? '···'
                      : taken ? 'Déjà pris'
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

function QuantityStepper({
  id, value, onBump, onSet,
}: {
  id: string;
  value: number;
  onBump: (id: string, d: number) => void;
  onSet: (id: string, value: number) => void;
}) {
  return (
    <div className="flex items-center h-10 rounded-xl border-[3px] border-brand-border bg-brand-inner shrink-0">
      <button onClick={() => onBump(id, -1)} className="h-full w-7 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none">
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onSet(id, Number(e.target.value))}
        className="w-10 h-full bg-transparent text-center font-display text-base tabular-nums focus:outline-none"
      />
      <button onClick={() => onBump(id, 1)} className="h-full w-7 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none">
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
