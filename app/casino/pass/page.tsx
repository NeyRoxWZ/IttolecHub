'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Clock, Lock, Check, Crown, X, Sparkles, Gift, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  COSMETIC_GAME_ORDER, SLOT_LABEL, RARITY_COLOR, RARITY_LABEL, GLOBAL_SLUG,
  cosmeticById, cosmeticsForGame, gameLabel, gameTheme,
  type Cosmetic, type CosmeticSlot,
} from '@/lib/casino/cosmetics';
import { itemById } from '@/lib/casino/shop';
import type { PassReward, PassTier } from '@/lib/casino/pass';
import { CountUp } from '../_components/CasinoUI';
import CosmeticPreview, { cosmeticEffect } from '../_components/CosmeticPreview';
import Confetti from '../_components/Confetti';
import { refreshCosmetics } from '@/hooks/useGameCosmetics';

interface PassState { tier: number; xp: number; intoTier: number; needed: number; premium: boolean }

function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}j ${h}h ${m}m` : `${h}h ${m}m ${seconds % 60}s`;
}

function rewardCosmetic(reward: PassReward): Cosmetic | undefined {
  return reward.kind === 'cosmetic' ? cosmeticById(reward.cosmeticId || '') : undefined;
}

export default function FrenlyPassPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, refresh, spendOptimistic, setBalance } = useCasinoWallet();

  const [tab, setTab] = useState<'pass' | 'collection'>('pass');
  const [tiers, setTiers] = useState<PassTier[]>([]);
  const [state, setState] = useState<PassState>({ tier: 0, xp: 0, intoTier: 0, needed: 30, premium: false });
  const [owned, setOwned] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<{ free: number[]; premium: number[] }>({ free: [], premium: [] });
  const [claimable, setClaimable] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [equipped, setEquipped] = useState<Record<string, Record<string, string>>>({});
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
      setEquipped(data.equipped || {});
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
    if (loading || tab !== 'pass') return;
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [loading, tab]);

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
      toast.success(`Palier ${tier} réclamé`);
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

  const equip = async (gameSlug: string, slot: CosmeticSlot, cosmeticId: string | null) => {
    if (!user) return;
    sfx.click(); vibrate(HAPTIC.SOFT);
    const res = await fetch('/api/casino/cosmetics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, game_slug: gameSlug, slot, cosmetic_id: cosmeticId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
    setEquipped((prev) => {
      const next = { ...prev, [gameSlug]: { ...(prev[gameSlug] || {}) } };
      if (cosmeticId) next[gameSlug][slot] = cosmeticId;
      else delete next[gameSlug][slot];
      return next;
    });
    // The games read a shared store, so it has to hear about this too.
    void refreshCosmetics(user.id);
  };

  const pct = state.needed > 0 ? Math.min(100, (state.intoTier / state.needed) * 100) : 100;

  return (
    <main className="bg-transparent text-tx-base p-3 sm:p-4 flex flex-col min-h-[100dvh]">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {detail && <TierDetail entry={detail} owned={owned} onClose={() => setDetail(null)} />}

      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/casino"
              prefetch
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
              </Link>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Frenly Pass</h1>
              <span className="text-[11px] text-tx-muted">100 paliers · remis à zéro chaque lundi</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-11 flex items-center gap-2 px-3 rounded-xl border-2 border-brand-border bg-brand-inner" title="Reset du passe">
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

        {/* Progress + premium CTA */}
        <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
          <div className="flex-1 min-w-[260px] rounded-xl border-2 border-brand-border bg-brand-card px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display font-black text-sm">
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
              className="h-12 px-4 rounded-xl border-4 border-brand-border bg-accent-success text-brand-bg shadow-brutal flex items-center gap-2 font-display font-black text-xs tracking-wider hover:brightness-110 transition-all active:translate-y-0.5 focus:outline-none disabled:opacity-50"
            >
              <Gift className="h-4 w-4" />
              {claiming ? '···' : `TOUT RÉCLAMER (${claimable})`}
            </button>
          )}

          {state.premium ? (
            <div className="h-12 px-4 rounded-xl border-2 border-accent-primary bg-accent-primary/10 flex items-center gap-2">
              <Crown className="h-4 w-4 text-accent-primary" />
              <span className="font-display font-black text-xs text-accent-primary">VOIE PREMIUM ACTIVE</span>
            </div>
          ) : (
            <button
              onClick={buyPremium}
              disabled={buying}
              className="h-12 px-4 rounded-xl border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal flex items-center gap-2 font-display font-black text-xs tracking-wider hover:brightness-110 transition-all active:translate-y-0.5 focus:outline-none disabled:opacity-50"
            >
              <Crown className="h-4 w-4" />
              {buying ? '···' : `DÉBLOQUER PREMIUM — ${premiumPrice.toLocaleString('fr-FR')} ₶`}
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-3 shrink-0">
          {([['pass', 'Récompenses'], ['collection', 'Ma collection']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { sfx.click(); setTab(id); }}
              className={cn(
                'h-10 px-4 rounded-xl border-2 font-display font-black text-xs tracking-wide focus:outline-none transition-colors',
                tab === id ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && <div className="h-64 rounded-2xl border-4 border-brand-border bg-brand-card animate-pulse" />}

        {!loading && tab === 'pass' && (
          <>
            <div className="flex items-center gap-4 mb-2 text-[10px] font-black uppercase tracking-widest text-tx-muted shrink-0">
              <span className="flex items-center gap-1.5"><Crown className="h-3 w-3 text-accent-primary" /> Premium</span>
              <span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-accent-success" /> Gratuit</span>
              <span className="normal-case font-bold text-tx-muted">
                Chaque palier se réclame à la main. Ce qui reste est versé au reset du lundi.
              </span>
              <button
                onClick={jumpToCurrent}
                className="ml-auto h-7 px-2.5 rounded-lg border-2 border-accent-primary bg-accent-primary/10 text-accent-primary flex items-center gap-1.5 normal-case text-[11px] font-black hover:bg-accent-primary/20 focus:outline-none"
              >
                Aller à mon palier
                <ArrowRight className="h-3.5 w-3.5" />
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
                      'h-9 rounded-lg border-2 flex items-center justify-center font-display font-black text-sm shrink-0',
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

        {!loading && tab === 'collection' && (
          <Collection owned={owned} equipped={equipped} onEquip={equip} />
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
        'relative h-[186px] w-full rounded-2xl border-4 p-2.5 flex flex-col items-center justify-start gap-1.5 transition-all',
        claimed ? 'border-accent-success/50 bg-accent-success/5'
          : canClaim ? 'border-accent-primary bg-accent-primary/10'
          : reached ? 'border-brand-border bg-brand-card'
          : 'border-brand-border bg-brand-card opacity-60',
        tier.milestone && 'ring-2 ring-accent-primary/40'
      )}
    >
      <button onClick={onClick} className="w-full flex flex-col items-center gap-1 focus:outline-none">
        {cosmetic ? (
          <CosmeticPreview cosmetic={cosmetic} size={86} />
        ) : (
          <div className="h-[86px] w-[86px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center">
            {reward.kind === 'coins' ? <Coins className="h-9 w-9 text-accent-primary" /> : <Sparkles className="h-9 w-9 text-accent-success" />}
          </div>
        )}

        <span className="text-[11px] font-bold text-tx-secondary leading-tight text-center line-clamp-2 px-0.5">
          {reward.kind === 'coins' ? `${(reward.amount || 0).toLocaleString('fr-FR')} ₶`
            : reward.kind === 'item' ? (itemById(reward.itemId || '')?.name || 'Objet')
            : cosmetic?.name}
        </span>
      </button>

      {canClaim ? (
        <button
          onClick={onClaim}
          disabled={busy}
          className="mt-auto w-full h-8 rounded-lg border-2 border-accent-primary bg-accent-primary text-brand-bg font-black text-[10px] tracking-widest focus:outline-none disabled:opacity-50"
        >
          {busy ? '···' : 'RÉCLAMER'}
        </button>
      ) : (
        <div className="mt-auto h-8 flex items-center justify-center text-[10px] font-black tracking-widest">
          {claimed ? <span className="text-accent-success flex items-center gap-1"><Check className="h-3 w-3" /> PRIS</span>
            : !active ? <span className="text-tx-muted flex items-center gap-1"><Lock className="h-3 w-3" /> PREMIUM</span>
            : <span className="text-tx-muted">VERROUILLÉ</span>}
        </div>
      )}
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
      <div className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
              Palier {entry.tier.tier} · {entry.track === 'free' ? 'Gratuit' : 'Premium'}
            </div>
            <h2 className="font-display text-lg font-black leading-tight">
              {cosmetic?.name || item?.name || `${(reward.amount || 0).toLocaleString('fr-FR')} ₶`}
            </h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          {cosmetic ? (
            <CosmeticPreview cosmetic={cosmetic} size={168} />
          ) : (
            <div className="h-[168px] w-[168px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center">
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

function Collection({
  owned, equipped, onEquip,
}: {
  owned: string[];
  equipped: Record<string, Record<string, string>>;
  onEquip: (gameSlug: string, slot: CosmeticSlot, cosmeticId: string | null) => void;
}) {
  const [game, setGame] = useState(COSMETIC_GAME_ORDER[0]);
  const pieces = useMemo(() => cosmeticsForGame(game), [game]);
  const gameEquipped = equipped[game] || {};
  const ownedCount = pieces.filter((c) => owned.includes(c.id)).length;
  const total = pieces.length;

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
        {COSMETIC_GAME_ORDER.map((slug) => {
          const all = cosmeticsForGame(slug);
          const got = all.filter((c) => owned.includes(c.id)).length;
          return (
            <button
              key={slug}
              onClick={() => { sfx.click(); setGame(slug); }}
              className={cn(
                'h-10 px-3 rounded-xl border-2 shrink-0 font-display font-black text-xs focus:outline-none transition-colors',
                game === slug ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
              )}
            >
              {gameLabel(slug)} <span className="text-[10px] text-tx-muted">{got}/{all.length}</span>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-tx-muted shrink-0">
        {game === GLOBAL_SLUG
          ? `Sets généraux — ${ownedCount}/${total} débloqués. Ceux-là s'appliquent à tous les jeux.`
          : `Thème « ${gameTheme(game)} » — ${ownedCount}/${total} débloqués. Ces pièces ne s'appliquent qu'à ce jeu.`}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {pieces.map((piece) => {
          const isOwned = owned.includes(piece.id);
          const isEquipped = gameEquipped[piece.slot] === piece.id;
          const tone = RARITY_COLOR[piece.rarity];

          return (
            <div
              key={piece.id}
              className={cn(
                'rounded-2xl border-4 p-3 flex flex-col items-center gap-2 transition-colors',
                isEquipped ? 'bg-accent-primary/10' : 'bg-brand-card',
                !isOwned && 'opacity-55'
              )}
              style={{ borderColor: isEquipped ? tone : undefined }}
            >
              <div className="w-full flex items-center justify-between gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{SLOT_LABEL[piece.slot]}</span>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: tone }}>
                  {RARITY_LABEL[piece.rarity]}
                </span>
              </div>

              <div className="relative">
                <CosmeticPreview cosmetic={piece} size={82} />
                {!isOwned && (
                  <span className="absolute inset-0 rounded-xl bg-black/55 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-tx-muted" />
                  </span>
                )}
              </div>

              <span className="font-display font-black text-[11px] leading-tight text-center">{piece.name}</span>
              <span className="text-[10px] text-tx-muted leading-tight text-center">{cosmeticEffect(piece)}</span>

              <button
                onClick={() => onEquip(game, piece.slot, isEquipped ? null : piece.id)}
                disabled={!isOwned}
                className={cn(
                  'mt-auto w-full h-8 rounded-lg border-2 font-black text-[10px] tracking-widest focus:outline-none transition-colors',
                  !isOwned ? 'border-brand-border text-tx-muted cursor-not-allowed'
                    : isEquipped ? 'border-accent-primary bg-accent-primary text-brand-bg'
                    : 'border-brand-border bg-brand-inner hover:border-accent-primary'
                )}
              >
                {!isOwned ? 'VERROUILLÉ' : isEquipped ? 'ÉQUIPÉ' : 'ÉQUIPER'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
