'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Coins, Package, PiggyBank, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { RARITY_COLOR, RARITY_LABEL } from '@/lib/krash/cosmetics';
import { RARITY_ORDER, type CrateDef, type CrateOpening } from '@/lib/krash/crates';
import type { KrashItemCategory, KrashShopItem } from '@/lib/krash/shop';
import KrashShell from '../_components/KrashShell';
import KrashCrateModal from '../_components/KrashCrateModal';
import { setKrashBalance, useKrashWallet } from '../_lib/useKrashWallet';
import { refreshKrashLoadout } from '../_lib/useKrashLoadout';

const CATEGORY: Record<KrashItemCategory, { label: string; icon: typeof Coins; color: string }> = {
  protection: { label: 'Protection', icon: ShieldCheck, color: '#00FF94' },
  gain: { label: 'Gain', icon: TrendingUp, color: '#FFD000' },
  trading: { label: 'Trading', icon: Wallet, color: '#FF4D6D' },
  xp: { label: 'Progression', icon: Sparkles, color: '#B061FF' },
  economie: { label: 'Économie', icon: PiggyBank, color: '#00D1B2' },
};

const CRATE_TONE: Record<string, string> = {
  kcrate_wood: '#A9743F', kcrate_silver: '#C7CBD6', kcrate_gold: '#FFD000', kcrate_legendary: '#FF4DA6',
};

function clock(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

function usage(item: KrashShopItem) {
  if (item.durationMin) return `${item.durationMin} min une fois utilisé`;
  if (item.uses) return `${item.uses} utilisation${item.uses > 1 ? 's' : ''}`;
  return 'Effet immédiat';
}

/** The Krash shop, laid out like the casino's: today's five items, then crates. */
export default function KrashShopPage() {
  const { user } = useAuth();
  const wallet = useKrashWallet();
  const [items, setItems] = useState<KrashShopItem[]>([]);
  const [crates, setCrates] = useState<CrateDef[]>([]);
  const [purchased, setPurchased] = useState<string[]>([]);
  const [resetIn, setResetIn] = useState(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [openings, setOpenings] = useState<CrateOpening[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/krash/shop${user ? `?user_id=${user.id}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items); setCrates(data.crates); setPurchased(data.purchased); setResetIn(data.resetIn);
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (resetIn <= 0) return;
    const t = setInterval(() => setResetIn((v) => { if (v <= 1) { void load(); return 0; } return v - 1; }), 1000);
    return () => clearInterval(t);
  }, [resetIn, load]);

  const buy = async (id: string, name: string, quantity = 1) => {
    if (!user || busy) return;
    setBusy(id);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/krash/shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, id, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Achat impossible'); sfx.lose(); return; }
      sfx.coin();
      setKrashBalance(data.balance);
      toast.success(`${quantity > 1 ? `${quantity} × ` : ''}${name} ajouté${quantity > 1 ? 's' : ''} à l’inventaire`);
      void load();
    } finally { setBusy(null); }
  };

  const buyAndOpen = async (crate: CrateDef) => {
    if (!user || busy) return;
    const quantity = qty[crate.id] ?? 1;
    setBusy(crate.id);
    try {
      const bought = await fetch('/api/krash/shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, id: crate.id, quantity }),
      });
      const b = await bought.json();
      if (!bought.ok) { toast.error(b.error ?? 'Achat impossible'); sfx.lose(); return; }
      const opened = await fetch('/api/krash/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: crate.id, quantity }),
      });
      const o = await opened.json();
      if (!opened.ok) { toast.error(o.error ?? 'Ouverture impossible'); return; }
      if (typeof o.balance === 'number') setKrashBalance(o.balance);
      // The pieces just won must count as owned before the recap shows them.
      await refreshKrashLoadout(user.id);
      setOpenings(o.openings);
    } finally { setBusy(null); }
  };

  return (
    <KrashShell title="Boutique">
      {openings && <KrashCrateModal openings={openings} onClose={() => setOpenings(null)} />}

      <section className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display text-2xl font-black">Objets du jour</h2>
            <p className="text-[11px] text-tx-muted">Cinq objets, les mêmes pour tout le monde, un achat par objet. Ils vont dans l’inventaire, tu les utilises quand tu veux.</p>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-black text-tx-muted"><Clock className="h-3.5 w-3.5" /> Nouveaux dans {clock(resetIn)}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => {
            const meta = CATEGORY[item.category];
            const Icon = meta.icon;
            const bought = purchased.includes(item.id);
            const tooPoor = wallet.balance < item.price;
            return (
              <div key={item.id} className="bg-brand-card border-4 border-brand-border rounded-[20px] p-4 shadow-brutal flex flex-col">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                  <Icon className="h-3.5 w-3.5" /> {meta.label}
                </div>
                <div className="font-display font-black text-lg leading-tight mt-1">{item.name}</div>
                <p className="text-[12px] text-tx-secondary leading-snug mt-1 flex-1">{item.description}</p>
                <div className="text-[10px] text-tx-muted mt-2">{usage(item)}</div>
                <button
                  onClick={() => buy(item.id, item.name)}
                  disabled={bought || tooPoor || busy === item.id}
                  className={cn(
                    'mt-3 h-11 rounded-xl border-2 border-brand-border font-display font-black tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-45',
                    bought ? 'bg-brand-inner text-tx-muted' : 'bg-accent-primary text-brand-bg'
                  )}
                >
                  {bought ? 'ACHETÉ' : <><Coins className="h-4 w-4" /> {item.price.toLocaleString('fr-FR')} ₶</>}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-black">Caisses</h2>
        <p className="text-[11px] text-tx-muted mb-3">Une caisse, un cosmétique Krash. Un doublon est remplacé par des ₶.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {crates.map((crate) => {
            const tone = CRATE_TONE[crate.id] ?? '#FFD000';
            const quantity = qty[crate.id] ?? 1;
            const total = crate.price * quantity;
            return (
              <div key={crate.id} className="bg-brand-card border-4 border-brand-border rounded-[20px] p-4 shadow-brutal flex flex-col">
                <div className="flex items-center gap-2">
                  <Package className="h-7 w-7" style={{ color: tone }} />
                  <div className="font-display font-black text-lg leading-tight">{crate.name}</div>
                </div>
                <p className="text-[12px] text-tx-secondary leading-snug mt-1 flex-1">{crate.description}</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2">
                  {RARITY_ORDER.filter((r) => crate.odds[r] > 0).map((r) => (
                    <span key={r} className="text-[10px] font-black tabular-nums" style={{ color: RARITY_COLOR[r] }}>
                      {RARITY_LABEL[r]} {(crate.odds[r] * 100).toFixed(crate.odds[r] < 0.01 ? 1 : 0)} %
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {[1, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => { sfx.click(); setQty((q) => ({ ...q, [crate.id]: n })); }}
                      className={cn('h-8 rounded-lg border-2 text-[11px] font-black', quantity === n ? 'border-accent-primary text-accent-primary' : 'border-brand-border text-tx-muted')}
                    >
                      ×{n}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => buy(crate.id, crate.name, quantity)}
                    disabled={wallet.balance < total || !!busy}
                    className="h-10 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-[11px] tracking-wider disabled:opacity-45"
                  >
                    ACHETER
                  </button>
                  <button
                    onClick={() => buyAndOpen(crate)}
                    disabled={wallet.balance < total || !!busy}
                    className="h-10 rounded-xl border-2 border-brand-border font-display font-black text-[11px] tracking-wider text-brand-bg disabled:opacity-45"
                    style={{ background: tone }}
                  >
                    OUVRIR
                  </button>
                </div>
                <div className="text-center text-[11px] font-black tabular-nums mt-1.5 text-tx-secondary">{total.toLocaleString('fr-FR')} ₶</div>
              </div>
            );
          })}
        </div>
      </section>
    </KrashShell>
  );
}
