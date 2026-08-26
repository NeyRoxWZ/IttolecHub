'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Sparkles, Gift as GiftIcon, Gem, Target, ShoppingBag,
  Banknote, Crown, ArrowUpRight, Clock, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';
import { PRESTIGE_THRESHOLD, getPrestigeTitle } from '@/lib/casino/meta';
import { CountUp, LevelBar } from './_components/CasinoUI';
import MissionsModal, { useMissions } from './_components/MissionsModal';
import FeedTicker from './_components/FeedTicker';
import JackpotModal from './_components/JackpotModal';
import PrestigeModal from './_components/PrestigeModal';
import { secondsUntilRotation } from '@/lib/casino/shop';
import { secondsUntilReset } from '@/lib/casino/pass';
import DailyWheelModal from './_components/DailyWheelModal';
import Confetti from './_components/Confetti';

interface CasinoGameEntry { slug: string; name: string; short: string; icon: any; rtp: string }

const CASINO_GAMES: CasinoGameEntry[] = [
  { slug: 'slots', name: 'Frenly Slots', short: 'Aligne 3 symboles', icon: Dices, rtp: '94%' },
  { slug: 'blackjack', name: 'Frenly 21', short: 'Bats le croupier', icon: Spade, rtp: '98%' },
  { slug: 'wheel', name: 'Frenly Wheel', short: 'Rouge, noir ou plein', icon: CircleDot, rtp: '97%' },
  { slug: 'rocket', name: 'Frenly Rocket', short: 'Encaisse avant le crash', icon: Rocket, rtp: '95%' },
  { slug: 'mines', name: 'Frenly Mines', short: 'Évite les mines', icon: Bomb, rtp: '96%' },
  { slug: 'plinko', name: 'Frenly Plinko', short: 'La bille tombe', icon: Circle, rtp: '97%' },
  { slug: 'hilo', name: 'Frenly HiLo', short: 'Plus haut ou plus bas', icon: ArrowUpDown, rtp: '96%' },
  { slug: 'grattage', name: 'Frenly Grattage', short: 'Gratte ton ticket', icon: Ticket, rtp: '90%' },
  { slug: 'poulet', name: 'Frenly Poulet', short: 'Traverse la route', icon: Egg, rtp: '96%' },
  { slug: 'tower', name: 'Frenly Tower', short: 'Monte les étages', icon: Building2, rtp: '96%' },
  { slug: 'keno', name: 'Frenly Keno', short: 'Coche 10 numéros', icon: Grid3x3, rtp: '95%' },
  { slug: 'caisses', name: 'Frenly Caisses', short: '5 caisses, 1 jackpot', icon: Gift, rtp: '93%' },
  { slug: 'coinflip', name: 'Frenly Coinflip', short: 'Pile ou face', icon: Coins, rtp: '97%' },
  { slug: 'dino', name: 'Frenly Dino', short: 'Cours et esquive', icon: Zap, rtp: '95%' },
  { slug: 'chevaux', name: 'Frenly Chevaux', short: 'Mise sur un cheval', icon: Flag, rtp: '94%' },
  { slug: 'bonneteau', name: 'Frenly Bonneteau', short: 'Suis la bille', icon: GlassWater, rtp: '93%' },
  { slug: 'stade', name: 'Frenly Stade', short: 'Domicile ou extérieur', icon: LayoutGrid, rtp: '96%' },
  { slug: 'baccarat', name: 'Frenly Baccarat', short: 'Joueur ou banque', icon: Layers, rtp: '98%' },
  { slug: 'rps', name: 'Pierre-Feuille-Ciseaux', short: 'Un coup, un gagnant', icon: Hand, rtp: '96%' },
  { slug: 'craps', name: 'Frenly Craps', short: 'Ça passe ou ça casse', icon: Dice5, rtp: '98%' },
];

const DISCLAIMER_KEY = 'itollec_casino_disclaimer_seen';

/**
 * Three shapes, three meanings — the bar used to be eight identical pills, so
 * nothing said what was claimable, what merely opened a page, and what was
 * only information.
 *
 *  ClaimPill  — something to collect right now, or a countdown to when it
 *               comes back. Filled and badged when ready, dimmed with a clock
 *               when it isn't.
 *  NavPill    — goes to another page. Outlined, arrow in the corner.
 *  InfoPill   — opens an explanation. Outlined, dashed, "?" in the corner.
 */

function formatWait(seconds: number): string {
  if (seconds <= 0) return 'bientôt';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ClaimPill({
  label, icon: Icon, ready, readyHint, waitSeconds, waitLabel, onClick, busy, tone = 'success',
}: {
  label: string;
  icon: any;
  /** Is there something to collect right now? */
  ready: boolean;
  readyHint: string;
  /** Time until it comes back, when there isn't. */
  waitSeconds?: number;
  waitLabel?: string;
  onClick: () => void;
  busy?: boolean;
  tone?: 'success' | 'primary';
}) {
  const filled = tone === 'success'
    ? 'border-accent-success bg-accent-success text-brand-bg'
    : 'border-accent-primary bg-accent-primary text-brand-bg';

  return (
    <button
      onClick={onClick}
      disabled={busy || !ready}
      className={cn(
        'relative h-14 px-3 rounded-xl border-2 flex items-center gap-2 text-left transition-all focus:outline-none',
        ready ? `${filled} hover:-translate-y-0.5 shadow-brutal` : 'border-brand-border bg-brand-card cursor-default'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', !ready && 'text-tx-muted')} />
      <div className="min-w-0 leading-tight">
        <div className={cn('font-display font-black text-[12px]', ready ? 'text-brand-bg' : 'text-tx-secondary')}>
          {label}
        </div>
        <div className={cn('text-[9px] font-bold truncate flex items-center gap-1', ready ? 'text-brand-bg/75' : 'text-tx-muted')}>
          {busy ? '···' : ready ? readyHint : (
            <>
              <Clock className="h-2.5 w-2.5" />
              {waitLabel || `dans ${formatWait(waitSeconds || 0)}`}
            </>
          )}
        </div>
      </div>
      {ready && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-secondary animate-pulse" />}
    </button>
  );
}

function NavPill({
  label, hint, icon: Icon, badge, onClick,
}: {
  label: string;
  hint: string;
  icon: any;
  /** Number of things waiting behind this page. */
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative h-14 pl-3 pr-6 rounded-xl border-2 border-brand-border bg-brand-card flex items-center gap-2 text-left hover:border-accent-primary hover:-translate-y-0.5 transition-all focus:outline-none"
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-primary" />
      <div className="min-w-0 leading-tight">
        <div className="font-display font-black text-[12px] text-tx-base">{label}</div>
        <div className="text-[9px] font-bold text-tx-muted truncate">{hint}</div>
      </div>
      <ArrowUpRight className="absolute top-1.5 right-1.5 h-3 w-3 text-tx-muted" />
      {!!badge && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-secondary text-white text-[10px] font-black flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function InfoPill({
  label, value, hint, icon: Icon, onClick,
}: {
  label: string;
  value: string;
  hint: string;
  icon: any;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative h-14 pl-3 pr-6 rounded-xl border-2 border-dashed border-accent-primary/60 bg-accent-primary/5 flex items-center gap-2 text-left hover:bg-accent-primary/10 hover:-translate-y-0.5 transition-all focus:outline-none"
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-primary" />
      <div className="min-w-0 leading-tight">
        <div className="font-display font-black text-[13px] text-accent-primary tabular-nums">{value}</div>
        <div className="text-[9px] font-bold text-tx-muted truncate">{label} · {hint}</div>
      </div>
      <span className="absolute top-1 right-1.5 text-[10px] font-black text-tx-muted">?</span>
    </button>
  );
}

export default function CasinoHub() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, stats, claimDaily, claimWheelOfFortune, prestige, refresh } = useCasinoWallet();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [showWheel, setShowWheel] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [prestiging, setPrestiging] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [showMissions, setShowMissions] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [passTier, setPassTier] = useState<number | null>(null);
  const [showPrestige, setShowPrestige] = useState(false);
  const [dailyResetIn, setDailyResetIn] = useState(() => secondsUntilRotation());
  const [passResetIn, setPassResetIn] = useState(() => secondsUntilReset());
  const { missions, reload: reloadMissions, claimable } = useMissions();
  const [cashback, setCashback] = useState<{ amount: number; available: boolean } | null>(null);
  const [claimingCashback, setClaimingCashback] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(DISCLAIMER_KEY)) setShowDisclaimer(true); } catch {}
  }, []);

  // One ticking clock for the whole bar rather than one per pill.
  useEffect(() => {
    const t = setInterval(() => {
      setDailyResetIn(secondsUntilRotation());
      setPassResetIn(secondsUntilReset());
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // The meta pages are reached from pills rather than links, so warm them by
  // hand — otherwise every one of them starts by downloading its chunk.
  useEffect(() => {
    for (const path of ['/casino/shop', '/casino/pass', '/casino/achievements', '/casino/leaderboard']) {
      router.prefetch(path);
    }
  }, [router]);

  useEffect(() => {
    supabase.from('casino_jackpot').select('amount').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setJackpot(Number(data.amount));
    });
    const channel = supabase.channel('casino_jackpot_ticker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'casino_jackpot' }, (p) => {
        setJackpot(Number((p.new as any).amount));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!user) { setPassTier(null); return; }
    fetch(`/api/casino/pass?user_id=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.state) setPassTier(d.state.tier); })
      .catch(() => {});
  }, [user]);

  // Cashback is computed from yesterday's play, so it only needs one fetch.
  useEffect(() => {
    if (!user) { setCashback(null); return; }
    fetch(`/api/casino/cashback/claim?user_id=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCashback({ amount: d.amount, available: d.available }); })
      .catch(() => {});
  }, [user, stats.cashbackClaimedToday]);

  const handleClaimCashback = async () => {
    if (!user) { toast.error('Connecte-toi pour récupérer ton cashback.'); return; }
    if (claimingCashback || !cashback?.available) return;
    setClaimingCashback(true); vibrate(HAPTIC.MEDIUM);
    const res = await fetch('/api/casino/cashback/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json();
    setClaimingCashback(false);
    if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
    sfx.coin(); vibrate(HAPTIC.SUCCESS);
    setCashback({ amount: 0, available: false });
    toast.success(`Cashback : +${data.amount.toLocaleString('fr-FR')} ₶`, {
      description: `${Math.round(data.rate * 100)}% de tes pertes d'hier.`,
    });
    void refresh();
  };

  const dismissDisclaimer = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, '1'); } catch {}
    sfx.click(); setShowDisclaimer(false);
  };

  const handleClaimDaily = async () => {
    if (claimingDaily || stats.dailyClaimedToday) return;
    if (!user) { toast.error('Connecte-toi pour réclamer ton bonus quotidien.'); return; }
    setClaimingDaily(true); vibrate(HAPTIC.MEDIUM);
    const result = await claimDaily();
    setClaimingDaily(false);
    if ('error' in result) { toast.error(result.error); return; }
    vibrate(HAPTIC.SUCCESS); sfx.coin();
    if (result.reward >= 2000) { sfx.bigWin(); setConfetti((c) => c + 1); }
    toast.success(`Bonus quotidien : +${result.reward.toLocaleString('fr-FR')} ₶`, {
      description: `Série de ${result.dailyStreak} jour${result.dailyStreak > 1 ? 's' : ''}.`,
    });
  };

  const handlePrestige = async () => {
    if (prestiging) return;
    setPrestiging(true); vibrate(HAPTIC.MEDIUM);
    const result = await prestige();
    setPrestiging(false);
    setShowPrestige(false);
    if ('error' in result) { toast.error(result.error); return; }
    sfx.jackpot(); setConfetti((c) => c + 1);
    toast.success(`Prestige ! Titre débloqué : ${getPrestigeTitle(result.prestigeCount)}`, { duration: 6000 });
  };

  const prestigeTitle = getPrestigeTitle(stats.prestigeCount);
  const canPrestige = balance >= PRESTIGE_THRESHOLD;
  const pending = (!stats.dailyClaimedToday ? 1 : 0) + (!stats.wheelClaimedToday ? 1 : 0);
  const prestigeProgress = Math.min(100, (balance / PRESTIGE_THRESHOLD) * 100);

  return (
    <main className="lg:[@media(min-height:700px)]:h-[100dvh] lg:[@media(min-height:700px)]:overflow-hidden bg-transparent text-tx-base p-3 sm:p-4 flex flex-col">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      <FeedTicker />
      {showWheel && <DailyWheelModal onClose={() => setShowWheel(false)} onSpin={claimWheelOfFortune} />}
      {showJackpot && <JackpotModal amount={jackpot} onClose={() => setShowJackpot(false)} />}
      {showPrestige && (
        <PrestigeModal
          balance={balance}
          prestigeCount={stats.prestigeCount}
          busy={prestiging}
          onConfirm={handlePrestige}
          onClose={() => setShowPrestige(false)}
        />
      )}
      {showMissions && (
        <MissionsModal
          missions={missions}
          onClose={() => setShowMissions(false)}
          onClaimed={() => { void reloadMissions(); void refresh(); }}
        />
      )}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 fade-in duration-200">
            <div className="flex justify-center mb-4">
              <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl">
                <Info className="w-9 h-9 text-accent-primary" />
              </div>
            </div>
            <h2 className="font-display text-2xl font-black text-center mb-3">Les FrenlyCoins ne valent rien</h2>
            <p className="text-tx-secondary text-sm text-center leading-relaxed mb-6">
              Les FrenlyCoins (₶) sont une monnaie 100% fictive. Impossible de les acheter avec de l&apos;argent réel,
              impossible de les retirer ou de les convertir, dans un sens comme dans l&apos;autre. C&apos;est juste pour le fun.
            </p>
            <button
              onClick={dismissDisclaimer}
              className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-3 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/?mode=solo')}
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Casino</h1>
              {prestigeTitle && <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary">{prestigeTitle}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="h-11 hidden sm:flex items-center px-3 rounded-xl border-2 border-brand-border bg-brand-inner">
              <LevelBar level={stats.level} into={stats.xpIntoLevel} needed={stats.xpForNext} />
            </div>
            {stats.currentStreak > 1 && (
              <div className="h-11 flex items-center gap-1.5 px-3 rounded-xl border-2 border-accent-secondary bg-accent-secondary/10" title="Victoires d'affilée">
                <Flame className="h-4 w-4 text-accent-secondary" />
                <span className="font-display font-black text-sm text-accent-secondary">{stats.currentStreak}</span>
              </div>
            )}
            <div className="h-11 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-3 sm:px-4 rounded-xl shadow-brutal">
              <Coins className="h-4 w-4 text-accent-primary" />
              {isLoaded ? <CountUp value={balance} className="font-display font-black text-base" /> : <span className="font-display font-black">···</span>}
              <span className="text-tx-secondary font-bold text-sm">₶</span>
              {isLocal && <span className="text-[8px] font-black uppercase bg-brand-card border border-brand-border px-1 py-0.5 rounded text-tx-muted" title="Connecte-toi pour sauvegarder ton solde">Local</span>}
            </div>
          </div>
        </header>

        {/* ACTION BAR — grouped by what the thing actually does: collect,
            navigate, read. Each group is separated so the eye can tell them
            apart without reading a word. */}
        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="hidden xl:block text-[9px] font-black uppercase tracking-widest text-tx-muted rotate-180 [writing-mode:vertical-rl]">
              À prendre
            </span>

            <ClaimPill
              label="Bonus du jour"
              icon={GiftIcon}
              ready={!stats.dailyClaimedToday}
              readyHint="250 à 10 000 ₶"
              waitSeconds={dailyResetIn}
              onClick={handleClaimDaily}
              busy={claimingDaily}
            />

            <ClaimPill
              label="Roue gratuite"
              icon={Sparkles}
              tone="primary"
              ready={!stats.wheelClaimedToday}
              readyHint="jusqu’à 10 000 ₶"
              waitSeconds={dailyResetIn}
              onClick={() => { sfx.click(); setShowWheel(true); }}
            />

            <ClaimPill
              label="Cashback"
              icon={Banknote}
              tone="primary"
              ready={!!cashback?.available}
              readyHint={cashback ? `+${cashback.amount.toLocaleString('fr-FR')} ₶` : ''}
              waitSeconds={dailyResetIn}
              waitLabel={stats.cashbackClaimedToday ? `pris · dans ${formatWait(dailyResetIn)}` : 'aucune perte hier'}
              onClick={handleClaimCashback}
              busy={claimingCashback}
            />
          </div>

          <span className="hidden lg:block w-px h-10 bg-brand-border" />

          <div className="flex items-center gap-2">
            <NavPill
              label="Missions"
              hint={`${missions.filter((m) => m.claimed).length}/${missions.length || 3} · reset dans ${formatWait(dailyResetIn)}`}
              icon={Target}
              badge={claimable}
              onClick={() => { sfx.click(); setShowMissions(true); }}
            />

            <NavPill
              label="Frenly Pass"
              hint={`palier ${passTier ?? 0}/100 · fin dans ${formatWait(passResetIn)}`}
              icon={Crown}
              onClick={() => { sfx.click(); router.push('/casino/pass'); }}
            />

            <NavPill
              label="Boutique"
              hint={`5 objets · rotation dans ${formatWait(dailyResetIn)}`}
              icon={ShoppingBag}
              onClick={() => { sfx.click(); router.push('/casino/shop'); }}
            />

            <NavPill
              label="Succès"
              hint="115 à débloquer"
              icon={Award}
              onClick={() => { sfx.click(); router.push('/casino/achievements'); }}
            />

            <NavPill
              label="Classement"
              hint="saison en cours"
              icon={Trophy}
              onClick={() => { sfx.click(); router.push('/casino/leaderboard'); }}
            />
          </div>

          <span className="hidden lg:block w-px h-10 bg-brand-border" />

          <InfoPill
            icon={Gem}
            value={jackpot !== null ? `${jackpot.toLocaleString('fr-FR')} ₶` : '···'}
            label="Cagnotte"
            hint="1 sur 3 000"
            onClick={() => { sfx.click(); setShowJackpot(true); }}
          />

          <div className="ml-auto">
            {canPrestige ? (
              <button
                onClick={() => { sfx.click(); setShowPrestige(true); }}
                className="h-14 px-4 rounded-xl border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal flex items-center gap-2 font-display font-black text-xs tracking-wider hover:brightness-110 transition-all active:translate-y-0.5 focus:outline-none"
              >
                <Sparkles className="h-4 w-4" />
                PRESTIGER
                <span className="text-[9px] font-bold opacity-70">voir avant</span>
              </button>
            ) : (
              <div
                className="h-14 px-3 rounded-xl border-2 border-brand-border bg-brand-card flex flex-col justify-center min-w-[132px]"
                title={`Atteins ${PRESTIGE_THRESHOLD.toLocaleString('fr-FR')} ₶ pour prestiger`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">Prestige</span>
                  <span className="text-[9px] font-black text-accent-primary tabular-nums">{prestigeProgress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-inner border border-brand-border overflow-hidden mb-1">
                  <div className="h-full bg-accent-primary transition-all duration-500" style={{ width: `${prestigeProgress}%` }} />
                </div>
                <span className="text-[9px] font-bold text-tx-muted leading-none">
                  à {PRESTIGE_THRESHOLD.toLocaleString('fr-FR')} ₶
                </span>
              </div>
            )}
          </div>
        </div>

        {/* GAMES — 5×4 grid that fills the remaining height exactly, so the
            cards stay big instead of being squeezed into a corner. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:grid-rows-4 gap-3 flex-1 lg:min-h-0">
          {CASINO_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <Link
                key={game.slug}
                href={`/casino/${game.slug}`}
                prefetch
                onClick={() => sfx.click()}
                className="group h-full min-h-[128px] rounded-2xl border-4 border-brand-border bg-brand-card p-3 flex flex-col items-center justify-center gap-2 shadow-brutal transition-all hover:border-accent-primary hover:-translate-y-1 active:translate-y-0 focus:outline-none"
              >
                <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 group-hover:border-accent-primary group-hover:scale-105 transition-all">
                  <Icon className="h-7 w-7 text-accent-primary" />
                </div>
                <span className="font-display font-black text-sm leading-tight text-center">{game.name}</span>
                <span className="text-[11px] text-tx-secondary leading-tight text-center">{game.short}</span>
                <span className="text-[10px] font-bold text-tx-muted mt-auto">Redistribution {game.rtp}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
