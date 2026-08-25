'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Coins, ShieldCheck, TrendingUp, Sparkles, Wallet, Target, PiggyBank, Palette, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import type { ItemCategory, ShopItem } from '@/lib/casino/shop';
import { CountUp } from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const CATEGORY_META: Record<ItemCategory, { label: string; icon: any; tone: string }> = {
  protection: { label: 'Protection', icon: ShieldCheck, tone: 'text-accent-success border-accent-success/50' },
  gain: { label: 'Gain', icon: TrendingUp, tone: 'text-accent-primary border-accent-primary/50' },
  xp: { label: 'Progression', icon: Sparkles, tone: 'text-accent-primary border-accent-primary/50' },
  mise: { label: 'Mise', icon: Wallet, tone: 'text-accent-secondary border-accent-secondary/50' },
  mission: { label: 'Mission', icon: Target, tone: 'text-accent-success border-accent-success/50' },
  economie: { label: 'Économie', icon: PiggyBank, tone: 'text-accent-primary border-accent-primary/50' },
  cosmetique: { label: 'Cosmétique', icon: Palette, tone: 'text-tx-secondary border-tx-secondary/50' },
};

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/** How long an item lasts, phrased for the card footer. */
function durationLabel(item: ShopItem): string | null {
  if (item.durationMin) return `${item.durationMin} min`;
  if (item.uses) return `${item.uses} mise${item.uses > 1 ? 's' : ''}`;
  return null;
}

export default function CasinoShop() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, refresh } = useCasinoWallet();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [resetIn, setResetIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [confetti, setConfetti] = useState(0);

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/shop${qs}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setOwned(data.owned || []);
      setResetIn(data.resetIn || 0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Local countdown; when it hits zero the shop has rotated, so refetch.
  useEffect(() => {
    if (resetIn <= 0) return;
    const t = setInterval(() => {
      setResetIn((v) => {
        if (v <= 1) { void load(); return 0; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resetIn, load]);

  const buy = async (item: ShopItem) => {
    if (!user) { toast.error('Connecte-toi pour acheter dans la boutique.'); return; }
    if (buying) return;
    if (balance < item.price) { toast.error('Solde insuffisant'); return; }

    setBuying(item.id);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      sfx.coin();
      if (data.newBalance > balance - item.price) { setConfetti((c) => c + 1); sfx.bigWin(); }
      toast.success(item.name, { description: data.message });
      await Promise.all([refresh(), load()]);
    } finally {
      setBuying(null);
    }
  };

  return (
    <main className="lg:[@media(min-height:700px)]:h-[100dvh] lg:[@media(min-height:700px)]:overflow-hidden bg-transparent text-tx-base p-3 sm:p-4 flex flex-col">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/casino')}
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Boutique</h1>
              <span className="text-[11px] text-tx-muted">5 objets par jour, tirés dans un catalogue de 30.</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-11 flex items-center gap-2 px-3 rounded-xl border-2 border-brand-border bg-brand-inner" title="Prochaine rotation de la boutique">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 flex-1 lg:min-h-0">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl border-4 border-brand-border bg-brand-card animate-pulse min-h-[220px]" />
          ))}

          {!loading && items.map((item) => {
            const meta = CATEGORY_META[item.category];
            const Icon = meta.icon;
            const isOwned = item.effect === 'cosmetic' && owned.includes(item.id);
            const tooPoor = balance < item.price;
            const life = durationLabel(item);

            return (
              <div
                key={item.id}
                className="rounded-2xl border-4 border-brand-border bg-brand-card p-4 flex flex-col shadow-brutal min-h-[220px]"
              >
                <div className={cn('self-start flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 bg-brand-inner mb-3', meta.tone)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{meta.label}</span>
                </div>

                <h2 className="font-display font-black text-base leading-tight mb-1.5">{item.name}</h2>
                <p className="text-[12px] text-tx-secondary leading-snug">{item.description}</p>

                {life && (
                  <span className="mt-2 self-start text-[10px] font-bold text-tx-muted border border-brand-border rounded px-1.5 py-0.5">
                    Durée : {life}
                  </span>
                )}

                <div className="mt-auto pt-4">
                  <button
                    onClick={() => buy(item)}
                    disabled={isOwned || tooPoor || buying !== null}
                    className={cn(
                      'w-full h-12 rounded-xl border-4 border-brand-border font-display font-black text-sm tracking-wide',
                      'transition-all active:translate-y-0.5 focus:outline-none',
                      isOwned ? 'bg-brand-inner text-tx-muted cursor-default'
                        : tooPoor ? 'bg-brand-inner text-tx-muted cursor-not-allowed'
                        : 'bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110'
                    )}
                  >
                    {buying === item.id ? '···'
                      : isOwned ? 'POSSÉDÉ'
                      : `${item.price.toLocaleString('fr-FR')} ₶`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-tx-muted mt-3 shrink-0">
          Les objets s&apos;appliquent automatiquement à tes prochaines mises. Rien ne s&apos;achète avec de l&apos;argent réel.
        </p>
      </div>
    </main>
  );
}
