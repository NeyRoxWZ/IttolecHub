'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Clock, Lock, Check, Crown, X, Sparkles, Gift, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  cosmeticById, gameLabel, gameTheme, RARITY_COLOR, RARITY_LABEL, type Cosmetic,
} from '@/lib/casino/cosmetics';
import { itemById } from '@/lib/casino/shop';
import type { PassReward, PassTier } from '@/lib/casino/pass';
import { CountUp } from '../_components/CasinoUI';
import CosmeticPreview, { cosmeticEffect } from '../_components/CosmeticPreview';
import Confetti from '../_components/Confetti';
import CosmeticStockPanel from '../_components/CosmeticStockPanel';
import EquipButton from '../_components/EquipButton';
import CasinoControls from '../_components/CasinoControls';
import BalanceChip from '../_components/BalanceChip';

interface PassState { tier: number; xp: number; intoTier: number; needed: number; premium: boolean }

function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}j ${h}h ${m}m` : `${h}h ${m}m ${seconds % 60}s`;
}

/**
 * The exact moment the next pass starts, in the player's own timezone. A
 * countdown alone left people guessing whether "18j 4h" meant tonight or
 * tomorrow morning; the reset is midnight UTC, which is 01:00 or 02:00 in
 * France depending on the season.
 */
function resetDateLabel(seconds: number): string {
  if (seconds <= 0) return '';
  const at = new Date(Date.now() + seconds * 1000);
  // Round to the minute: the countdown ticks every second and the label
  // should not flicker between :59 and :00.
  at.setSeconds(0, 0);
  if (at.getMinutes() % 5 !== 0) at.setMinutes(Math.round(at.getMinutes() / 5) * 5);
  return at.toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

function rewardCosmetic(reward: PassReward): Cosmetic | undefined {
  return reward.kind === 'cosmetic' ? cosmeticById(reward.cosmeticId || '') : undefined;
}

export default function FrenlyPassPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, refresh, spendOptimistic, setBalance } = useCasinoWallet();

  const [tiers, setTiers] = useState<PassTier[]>([]);
  const [state, setState] = useState<PassState>({ tier: 0, xp: 0, intoTier: 0, needed: 30, premium: false });
  const [owned, setOwned] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<{ free: number[]; premium: number[] }>({ free: [], premium: [] });
  const [claimable, setClaimable] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [justWon, setJustWon] = useState<Cosmetic | null>(null);
  const [premiumPrice, setPremiumPrice] = useState(25000);
  const [resetIn, setResetIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [detail, setDetail] = useState<{ tier: PassTier; track: 'free' | 'premium' } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const [passRes, cosmRes] = await Promise.all([
      fetch(`/api/casino/pass${qs}`),
      user ? fetch(`/api/casino/cosmetics?user_id=${user.id}`) : Promise.resolve(null),
    ]);
    if (passRes.ok) {
      const data = await passRes.json();
      setTiers(data.tiers || []);
      setState(data.state);
      setOwned(data.owned || []);
      setPremiumPrice(data.premiumPrice);
      setResetIn(data.resetIn || 0);
      setClaimed(data.claimed || { free: [], premium: [] });
      setClaimable(data.claimable || 0);
    }
    if (cosmRes && cosmRes.ok) {
      const data = await cosmRes.json();
      setOwned(data.owned || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Arriving from the hub used to keep the previous page's scroll position.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (resetIn <= 0) return;
    const t = setInterval(() => setResetIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [resetIn]);

  // The track always opens at the very beginning; jumping to the current tier
  // is a deliberate action rather than something the page does behind you.
  useEffect(() => {
    if (loading) return;
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [loading]);

  const jumpToCurrent = () => {
    const track = trackRef.current;
    if (!track) return;
    const el = track.querySelector<HTMLElement>(`[data-tier="${Math.max(1, state.tier)}"]`);
    if (!el) return;
    sfx.click();
    track.scrollTo({ left: Math.max(0, el.offsetLeft - track.clientWidth / 2 + el.clientWidth / 2), behavior: 'smooth' });
  };

  const buyPremium = async () => {
    if (!user) { toast.error('Connecte-toi pour débloquer la voie premium.'); return; }
    if (buying || state.premium) return;
    if (balance < premiumPrice) { toast.error('Solde insuffisant'); return; }

    setBuying(true); vibrate(HAPTIC.MEDIUM);
    const before = balance;
    spendOptimistic(premiumPrice);
    try {
      const res = await fetch('/api/casino/pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, action: 'premium' }),
      });
      const data = await res.json();
      if (!res.ok) { setBalance(before); toast.error(data.error || 'Erreur'); return; }
      setBalance(data.newBalance);
      sfx.jackpot(); setConfetti((c) => c + 1);
      toast.success('Voie premium débloquée', {
        description: data.unlockedTiers
          ? `${data.unlockedTiers} palier${data.unlockedTiers > 1 ? 's' : ''} premium à réclamer tout de suite.`
          : 'Chaque palier atteint te donnera les deux récompenses.',
      });
      void load();
    } finally {
      setBuying(false);
    }
  };

  const claimTier = async (tier: number, track: 'free' | 'premium') => {
    if (!user || claiming) return;
    setClaiming(true);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, action: 'claim', tier, track }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      sfx.coin();
      setBalance(data.newBalance);
      setClaimed((prev) => ({ ...prev, [track]: [...prev[track], tier] }));
      setClaimable((c) => Math.max(0, c - 1));

      // A cosmetic straight from the track: offer it rather than sending the
      // player hunting for it in the inventory.
      const won = data.reward?.cosmeticId ? cosmeticById(data.reward.cosmeticId) : null;
      setJustWon(won || null);
      if (!won) toast.success(`Palier ${tier} réclamé`);
      void load();
    } finally {
      setClaiming(false);
    }
  };

  const claimAll = async () => {
    if (!user || claiming || claimable === 0) return;
    setClaiming(true);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/pass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, action: 'claim_all' }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      sfx.jackpot(); setConfetti((c) => c + 1);
      setBalance(data.newBalance);
      toast.success(`${data.granted.length} récompense${data.granted.length > 1 ? 's' : ''} récupérée${data.granted.length > 1 ? 's' : ''}`);
      void load();
    } finally {
      setClaiming(false);
    }
  };

  const pct = state.needed > 0 ? Math.min(100, (state.intoTier / state.needed) * 100) : 100;

  return (
    <main className="bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10 flex flex-col min-h-[100dvh]">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {detail && <TierDetail entry={detail} owned={owned} onClose={() => setDetail(null)} />}
      {justWon && <JustWon cosmetic={justWon} onClose={() => setJustWon(null)} />}

      <div className="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/casino"
              prefetch
              className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Link>
            <div className="min-w-0">
              <h1 className="font-display text-3xl sm:text-4xl leading-none">Frenly Pass</h1>
              <span className="text-[11px] text-tx-muted">
                100 paliers · remis à zéro le 1er du mois ·{' '}
                <Link href="/casino/inventaire" prefetch className="text-tx-base font-black underline underline-offset-2">
                  ta collection
                </Link>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="h-11 flex items-center gap-2 px-3 rounded-xl border-[3px] border-brand-border bg-brand-inner"
              title={resetIn > 0 ? `Nouveau pass le ${resetDateLabel(resetIn)}` : 'Reset du passe'}
            >
              <Clock className="h-4 w-4 shrink-0 text-accent-primary" />
              <div className="leading-tight">
                <div className="font-display text-lg tabular-nums">{formatCountdown(resetIn)}</div>
                {resetIn > 0 && (
                  <div className="text-[9px] font-bold text-tx-muted whitespace-nowrap">
                    nouveau pass {resetDateLabel(resetIn)}
                  </div>
                )}
              </div>
            </div>
            {/* On phones the settings live in the tab bar's "Plus". */}
            <CasinoControls className="hidden lg:flex" />

            <BalanceChip balance={balance} isLoaded={isLoaded} />
          </div>
        </header>

        {/* Progress + premium CTA */}
        <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
          <div className="flex-1 min-w-[260px] rounded-xl border-[3px] border-brand-border bg-brand-card px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display text-lg">
                Palier <span className="text-accent-primary">{state.tier}</span> / 100
              </span>
              <span className="text-[11px] font-bold text-tx-muted tabular-nums">
                {state.needed > 0 ? `${state.intoTier} / ${state.needed} XP` : 'Passe terminé'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
              <div className="h-full bg-accent-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {claimable > 0 && (
            <button
              onClick={claimAll}
              disabled={claiming}
              className="h-12 px-4 rounded-xl border-4 border-brand-border bg-accent-success text-brand-bg shadow-brutal flex items-center gap-2 font-display text-base hover:brightness-110 transition-all active:translate-y-0.5 focus:outline-none disabled:opacity-50"
            >
              <Gift className="h-4 w-4" />
              {claiming ? '···' : `TOUT RÉCLAMER (${claimable})`}
            </button>
          )}

          {state.premium ? (
            <div className="h-12 px-4 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg shadow-[inset_0_-4px_0_#1E9A55] flex items-center gap-2">
              <Crown className="h-5 w-5" />
              <span className="font-display text-lg">Voie premium active</span>
            </div>
          ) : (
            <button
              onClick={buyPremium}
              disabled={buying}
              className={cn(BRAWL.yellow, 'h-12 px-4 text-lg')}
            >
              <Crown className="h-5 w-5" />
              {buying ? '···' : `Débloquer premium · ${premiumPrice.toLocaleString('en-US')} ₶`}
            </button>
          )}
        </div>

        <CosmeticStockPanel />

        {loading && <div className="h-64 rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />}

        {!loading && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 shrink-0">
              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-base"><Crown className="h-4 w-4" /> Premium</span>
              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display text-base"><Sparkles className="h-4 w-4" /> Gratuit</span>
              <span className="text-sm font-bold text-tx-secondary">
                Chaque palier se réclame à la main. Ce qui reste est versé au reset du 1er du mois.
              </span>
              <button
                onClick={jumpToCurrent}
                className={cn(BRAWL.dark, 'ml-auto h-9 px-3 text-base')}
              >
                Aller à mon palier
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div ref={trackRef} className="overflow-x-auto pb-3 -mx-1 px-1">
              <div className="flex gap-2 w-max">
                {tiers.map((t) => (
                  <div key={t.tier} data-tier={t.tier} className="flex flex-col gap-2 w-[150px] shrink-0">
                    <TierCell
                      tier={t} track="premium" reached={state.tier >= t.tier}
                      active={state.premium}
                      claimed={claimed.premium.includes(t.tier)}
                      busy={claiming}
                      onClaim={() => claimTier(t.tier, 'premium')}
                      onClick={() => { sfx.click(); setDetail({ tier: t, track: 'premium' }); }}
                    />
                    <div className={cn(
                      'h-9 rounded-lg border-[3px] flex items-center justify-center font-display text-lg shrink-0',
                      state.tier >= t.tier ? 'border-accent-primary bg-accent-primary text-brand-bg'
                        : t.milestone ? 'border-accent-primary/60 text-accent-primary bg-brand-card'
                        : 'border-brand-border bg-brand-card text-tx-muted'
                    )}>
                      {t.tier}
                    </div>
                    <TierCell
                      tier={t} track="free" reached={state.tier >= t.tier}
                      active
                      claimed={claimed.free.includes(t.tier)}
                      busy={claiming}
                      onClaim={() => claimTier(t.tier, 'free')}
                      onClick={() => { sfx.click(); setDetail({ tier: t, track: 'free' }); }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */

function TierCell({
  tier, track, reached, active, claimed, busy, onClaim, onClick,
}: {
  tier: PassTier;
  track: 'free' | 'premium';
  reached: boolean;
  active: boolean;
  claimed: boolean;
  busy: boolean;
  onClaim: () => void;
  onClick: () => void;
}) {
  const reward = track === 'free' ? tier.free : tier.premium;
  const cosmetic = rewardCosmetic(reward);
  const canClaim = reached && active && !claimed;

  return (
    <div
      className={cn(
        'relative h-[186px] w-full rounded-2xl border-4 border-brand-border p-2.5 flex flex-col items-center justify-start gap-1.5 transition-all',
        claimed ? 'bg-[#1B4A3A] shadow-[inset_0_-5px_0_#12352A]'
          : canClaim ? 'bg-[#4A3F1E] shadow-[inset_0_-5px_0_#332B12,0_0_0_3px_#FFC61A]'
          : reached ? 'bg-brand-card shadow-[inset_0_-5px_0_#151942]'
          : 'bg-brand-card shadow-[inset_0_-5px_0_#151942] opacity-60',
        tier.milestone && !canClaim && 'shadow-[inset_0_-5px_0_#151942,0_0_0_3px_rgba(255,198,26,0.45)]'
      )}
    >
      <button onClick={onClick} className="w-full flex flex-col items-center gap-1 focus:outline-none">
        {cosmetic ? (
          <CosmeticPreview cosmetic={cosmetic} size={86} />
        ) : (
          <div className="h-[86px] w-[86px] rounded-xl border-[3px] border-brand-border bg-brand-inner flex items-center justify-center">
            {reward.kind === 'coins' ? <Coins className="h-9 w-9 text-accent-primary" /> : <Sparkles className="h-9 w-9 text-accent-success" />}
          </div>
        )}

        <span className="text-[11px] font-bold text-tx-secondary leading-tight text-center line-clamp-2 px-0.5">
          {reward.kind === 'coins' ? `${(reward.amount || 0).toLocaleString('en-US')} ₶`
            : reward.kind === 'item' ? (itemById(reward.itemId || '')?.name || 'Objet')
            : cosmetic?.name}
        </span>
      </button>

      {canClaim ? (
        <button
          onClick={onClaim}
          disabled={busy}
          className={cn(BRAWL.yellow, 'mt-auto w-full h-9 text-base')}
        >
          {busy ? '···' : 'Réclamer'}
        </button>
      ) : (
        <div className="mt-auto h-9 flex items-center justify-center font-display text-base">
          {claimed ? <span className="text-accent-success flex items-center gap-1"><Check className="h-4 w-4" /> Pris</span>
            : !active ? <span className="text-tx-secondary flex items-center gap-1"><Lock className="h-4 w-4" /> Premium</span>
            : <span className="text-tx-secondary">Verrouillé</span>}
        </div>
      )}
    </div>
  );
}

/** The piece a tier just handed over, with the one action that follows. */
function JustWon({ cosmetic, onClose }: { cosmetic: Cosmetic; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[215] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-xs bg-brand-card border-4 rounded-[22px] p-6 text-center shadow-brutal animate-in zoom-in-95 duration-200"
        style={{ borderColor: RARITY_COLOR[cosmetic.rarity] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: RARITY_COLOR[cosmetic.rarity] }}>
          {RARITY_LABEL[cosmetic.rarity]}
        </div>

        <div className="flex justify-center mb-3">
          <CosmeticPreview cosmetic={cosmetic} size={128} />
        </div>

        <div className="font-display text-xl leading-tight">{cosmetic.name}</div>
        <div className="text-[11px] text-tx-muted mb-4">{gameLabel(cosmetic.gameSlug)}</div>

        <EquipButton cosmetic={cosmetic} className="w-full mb-2" />

        <button
          onClick={onClose}
          className="w-full h-9 rounded-lg border-[3px] border-brand-border bg-brand-inner text-[10px] font-black tracking-widest text-tx-secondary focus:outline-none"
        >
          PLUS TARD
        </button>
      </div>
    </div>
  );
}

function TierDetail({
  entry, owned, onClose,
}: {
  entry: { tier: PassTier; track: 'free' | 'premium' };
  owned: string[];
  onClose: () => void;
}) {
  const reward = entry.track === 'free' ? entry.tier.free : entry.tier.premium;
  const cosmetic = rewardCosmetic(reward);
  const item = reward.kind === 'item' ? itemById(reward.itemId || '') : undefined;

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-brutal animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
              Palier {entry.tier.tier} · {entry.track === 'free' ? 'Gratuit' : 'Premium'}
            </div>
            <h2 className="font-display text-lg leading-tight">
              {cosmetic?.name || item?.name || `${(reward.amount || 0).toLocaleString('en-US')} ₶`}
            </h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-[3px] border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {cosmetic ? (
            <CosmeticPreview cosmetic={cosmetic} size={168} />
          ) : (
            <div className="h-[168px] w-[168px] rounded-xl border-[3px] border-brand-border bg-brand-inner flex items-center justify-center">
              {reward.kind === 'coins' ? <Coins className="h-16 w-16 text-accent-primary" /> : <Sparkles className="h-16 w-16 text-accent-success" />}
            </div>
          )}
        </div>

        <p className="text-sm text-tx-secondary leading-relaxed">
          {cosmetic ? `${cosmeticEffect(cosmetic)} Réservé à ${gameLabel(cosmetic.gameSlug)} — thème « ${gameTheme(cosmetic.gameSlug)} ».`
            : item ? item.description
            : 'Crédité directement sur ton solde.'}
        </p>

        {cosmetic && (
          <div className="mt-4 text-[11px] font-black uppercase tracking-widest">
            {owned.includes(cosmetic.id)
              ? <span className="text-accent-success">Déjà dans ta collection</span>
              : <span className="text-tx-muted">Pas encore obtenu</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
