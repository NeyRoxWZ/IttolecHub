'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Sparkles, Gift as GiftIcon, Gem, Target, ShoppingBag,
  Banknote, Crown, ArrowUpRight, Clock, Backpack, Radio, Users,
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
import OnboardingModal from './_components/OnboardingModal';
import PrestigeModal from './_components/PrestigeModal';
import CasinoMenu, { type MenuEntry } from './_components/CasinoMenu';
import CasinoRail, { type Claim } from './_components/CasinoRail';
import CasinoControls from './_components/CasinoControls';
import ActiveEffectsBar from './_components/ActiveEffectsBar';
import ChestModal, { useChest } from './_components/ChestModal';
import EventBanner from './_components/EventBanner';
import { secondsUntilRotation } from '@/lib/casino/shop';
import { secondsUntilReset } from '@/lib/casino/pass';
import DailyWheelModal from './_components/DailyWheelModal';
import Confetti from './_components/Confetti';
import BalanceChip from './_components/BalanceChip';

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

/** Bumped when the tour changes enough to be worth showing again. */
const ONBOARDING_KEY = 'itollec_casino_onboarding_v1';

/**
 * The bar has ten entries and they must stay on one line: wrapping produced
 * a broken second row and a floating button. Everything is a fixed-height
 * tile in a single horizontally scrollable strip, and the three kinds are
 * told apart by fill, not by a label.
 *
 *  ClaimTile — filled when there is something to take, dark with a clock when
 *              there isn't.
 *  NavTile   — dark card with a corner arrow: it goes somewhere.
 *  InfoTile  — dashed outline with a "?": it explains something.
 */

function formatWait(seconds: number): string {
  if (seconds <= 0) return 'bientôt';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h`;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m} min`;
}

const TILE = 'relative h-14 shrink-0 rounded-xl border-2 flex items-center gap-2 px-3 text-left transition-all focus:outline-none';

function ClaimTile({
  label, icon: Icon, ready, readyHint, waitLabel, onClick, busy,
}: {
  label: string;
  icon: any;
  ready: boolean;
  readyHint: string;
  waitLabel: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || !ready}
      className={cn(
        'relative h-16 sm:h-14 shrink-0 rounded-xl border-2 transition-all focus:outline-none',
        'flex flex-col sm:flex-row items-center sm:gap-2 justify-center sm:justify-start px-2 sm:px-3 text-center sm:text-left',
        ready
          ? 'border-accent-success bg-accent-success text-brand-bg shadow-brutal hover:-translate-y-0.5'
          : 'border-brand-border bg-brand-card cursor-default'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 mb-0.5 sm:mb-0', !ready && 'text-tx-muted')} />
      <div className="min-w-0 w-full leading-tight">
        <div className={cn('font-display font-black text-[11px] sm:text-[12px] truncate', ready ? 'text-brand-bg' : 'text-tx-secondary')}>
          {label}
        </div>
        <div className={cn(
          'text-[9px] font-bold truncate flex items-center justify-center sm:justify-start gap-1',
          ready ? 'text-brand-bg/70' : 'text-tx-muted'
        )}>
          {busy ? '···' : ready ? readyHint : (<><Clock className="h-2.5 w-2.5 shrink-0" />{waitLabel}</>)}
        </div>
      </div>
    </button>
  );
}

function NavTile({
  label, hint, icon: Icon, pending, onClick,
}: {
  label: string;
  hint: string;
  icon: any;
  /** Shown inline rather than as a floating badge, which used to overlap. */
  pending?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        TILE, 'pr-7',
        pending ? 'border-accent-secondary bg-brand-card' : 'border-brand-border bg-brand-card',
        'hover:border-accent-primary hover:-translate-y-0.5'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-primary" />
      <div className="min-w-0 leading-tight">
        <div className="font-display font-black text-[12px] text-tx-base whitespace-nowrap">{label}</div>
        <div className={cn('text-[9px] font-bold whitespace-nowrap', pending ? 'text-accent-secondary' : 'text-tx-muted')}>
          {pending ? `${pending} à réclamer` : hint}
        </div>
      </div>
      <ArrowUpRight className="absolute top-1.5 right-1.5 h-3 w-3 text-tx-muted" />
    </button>
  );
}

export default function CasinoHub() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, stats, claimDaily, claimWheelOfFortune, prestige, refresh } = useCasinoWallet();
  const [showGuide, setShowGuide] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [showWheel, setShowWheel] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [prestiging, setPrestiging] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [showMissions, setShowMissions] = useState(false);
  const [showJackpot, setShowJackpot] = useState(false);
  const [passTier, setPassTier] = useState<number | null>(null);
  const [passClaimable, setPassClaimable] = useState(0);
  const [showPrestige, setShowPrestige] = useState(false);
  const [showChest, setShowChest] = useState(false);
  const { state: chest } = useChest();
  const [dailyResetIn, setDailyResetIn] = useState(() => secondsUntilRotation());
  const [passResetIn, setPassResetIn] = useState(() => secondsUntilReset());
  const { missions, reload: reloadMissions, claimable } = useMissions();
  const [cashback, setCashback] = useState<{ amount: number; available: boolean } | null>(null);
  const [claimingCashback, setClaimingCashback] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(ONBOARDING_KEY)) setShowGuide(true); } catch {}
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
    for (const path of ['/casino/shop', '/casino/pass', '/casino/inventaire', '/casino/achievements', '/casino/leaderboard', '/casino/direct', '/casino/cagnotte']) {
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
      .then((d) => { if (d?.state) { setPassTier(d.state.tier); setPassClaimable(d.claimable || 0); } })
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
    toast.success(`Cashback : +${data.amount.toLocaleString('en-US')} ₶`, {
      description: `${Math.round(data.rate * 100)}% de tes pertes d'hier.`,
    });
    void refresh();
  };

  const closeGuide = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
    sfx.click(); setShowGuide(false);
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
    toast.success(`Bonus quotidien : +${result.reward.toLocaleString('en-US')} ₶`, {
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

  // The row of tiles and the mobile sheet read the same list, so they can't
  // drift apart.
  const destinations: MenuEntry[] = [
    {
      label: 'Missions', icon: Target, pending: claimable,
      hint: `${missions.filter((m) => m.claimed).length}/${missions.length || 10} faites`,
      onSelect: () => { sfx.click(); setShowMissions(true); },
    },
    {
      label: 'Frenly Pass', icon: Crown, pending: passClaimable,
      hint: `palier ${passTier ?? 0}/100`,
      onSelect: () => { sfx.click(); router.push('/casino/pass'); },
    },
    {
      label: 'Inventaire', icon: Backpack, hint: 'objets & cosmétiques',
      onSelect: () => { sfx.click(); router.push('/casino/inventaire'); },
    },
    {
      label: 'Boutique', icon: ShoppingBag, hint: `5 objets · ${formatWait(dailyResetIn)}`,
      onSelect: () => { sfx.click(); router.push('/casino/shop'); },
    },
    {
      label: 'Cagnotte de groupe', icon: Users, hint: 'misez et partagez',
      onSelect: () => { sfx.click(); router.push('/casino/cagnotte'); },
    },
    {
      label: 'En direct', icon: Radio, hint: 'tous les gains et pertes',
      onSelect: () => { sfx.click(); router.push('/casino/direct'); },
    },
    {
      label: 'Succès', icon: Award, hint: '115 à débloquer',
      onSelect: () => { sfx.click(); router.push('/casino/achievements'); },
    },
    {
      label: 'Classement', icon: Trophy, hint: 'saison en cours',
      onSelect: () => { sfx.click(); router.push('/casino/leaderboard'); },
    },
  ];

  // The four things that might have something waiting. Same list for the rail
  // and the mobile band.
  const claims: Claim[] = [
    {
      label: 'Bonus du jour', icon: GiftIcon,
      ready: !stats.dailyClaimedToday,
      readyHint: '250 à 10 000 ₶',
      waitLabel: formatWait(dailyResetIn),
      busy: claimingDaily,
      onClick: handleClaimDaily,
    },
    {
      label: 'Roue gratuite', icon: Sparkles,
      ready: !stats.wheelClaimedToday,
      readyHint: 'jusqu’à 10 000 ₶',
      waitLabel: formatWait(dailyResetIn),
      onClick: () => { sfx.click(); setShowWheel(true); },
    },
    {
      label: 'Coffre 7 jours', icon: Gift,
      ready: !chest?.claimedToday,
      readyHint: chest ? `case ${chest.next}/7` : '',
      waitLabel: chest ? `${chest.day} j d'affilée` : formatWait(dailyResetIn),
      onClick: () => { sfx.click(); setShowChest(true); },
    },
    {
      label: 'Cashback', icon: Banknote,
      ready: !!cashback?.available,
      readyHint: cashback ? `+${cashback.amount.toLocaleString('en-US')} ₶` : '',
      waitLabel: stats.cashbackClaimedToday ? formatWait(dailyResetIn) : 'rien hier',
      busy: claimingCashback,
      onClick: handleClaimCashback,
    },
  ];

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
      {showChest && <ChestModal onClose={() => setShowChest(false)} />}
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

      {showGuide && <OnboardingModal onClose={closeGuide} />}

      <div className="max-w-6xl lg:max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-3 gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => router.push('/?mode=solo')}
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none truncate">Casino</h1>
              {prestigeTitle && (
                <span className="block text-[10px] font-black uppercase tracking-widest text-accent-primary truncate">
                  {prestigeTitle}
                </span>
              )}
            </div>

            <CasinoMenu entries={destinations} pending={claimable + passClaimable} />

            <button
              onClick={() => { sfx.click(); setShowGuide(true); }}
              title="Comment ça marche ?"
              className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-accent-primary hover:border-accent-primary transition-colors focus:outline-none flex items-center justify-center"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { sfx.click(); setShowJackpot(true); }}
              title="Comment gagner la cagnotte ?"
              className="hidden sm:flex h-11 items-center gap-2 px-3 rounded-xl border-2 border-dashed border-accent-primary/60 bg-accent-primary/5 hover:bg-accent-primary/10 transition-colors focus:outline-none"
            >
              <Gem className="h-4 w-4 shrink-0 text-accent-primary" />
              <div className="leading-tight text-left">
                <div className="font-display font-black text-[13px] text-accent-primary tabular-nums">
                  {jackpot !== null ? `${jackpot.toLocaleString('en-US')} ₶` : '···'}
                </div>
                <div className="text-[9px] font-bold text-tx-muted">Cagnotte</div>
              </div>
              {/* Was a grey "?" wedged in the corner; nobody saw it. */}
              <span className="ml-1 h-5 w-5 shrink-0 rounded-full bg-accent-primary text-brand-bg text-[11px] font-black flex items-center justify-center">
                ?
              </span>
            </button>

            {/* Prestige sits next to the pot, same shape: both are status. */}
            {canPrestige ? (
              <button
                onClick={() => { sfx.click(); setShowPrestige(true); }}
                title="Prestiger"
                className="hidden sm:flex h-11 items-center gap-2 px-3 rounded-xl border-2 border-accent-primary bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all focus:outline-none"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="font-display font-black text-xs tracking-wider">PRESTIGER</span>
              </button>
            ) : (
              <button
                onClick={() => { sfx.click(); setShowPrestige(true); }}
                title={`Atteins ${PRESTIGE_THRESHOLD.toLocaleString('en-US')} ₶ pour prestiger`}
                className="hidden sm:flex h-11 items-center gap-2 px-3 rounded-xl border-2 border-brand-border bg-brand-card hover:border-accent-primary transition-colors focus:outline-none"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-accent-primary" />
                <div className="leading-tight text-left min-w-[74px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">
                      Prestige {stats.prestigeCount}
                    </span>
                    <span className="text-[9px] font-black text-accent-primary tabular-nums">
                      {prestigeProgress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 mt-0.5 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
                    <div className="h-full bg-accent-primary transition-all duration-500" style={{ width: `${prestigeProgress}%` }} />
                  </div>
                </div>
              </button>
            )}

            <div className="h-11 hidden sm:flex items-center px-3 rounded-xl border-2 border-brand-border bg-brand-inner">
              <LevelBar level={stats.level} into={stats.xpIntoLevel} needed={stats.xpForNext} />
            </div>

            <CasinoControls className="hidden sm:flex" />
            {stats.currentStreak > 1 && (
              <div className="h-11 flex items-center gap-1.5 px-3 rounded-xl border-2 border-accent-secondary bg-accent-secondary/10" title="Victoires d'affilée">
                <Flame className="h-4 w-4 text-accent-secondary" />
                <span className="font-display font-black text-sm text-accent-secondary">{stats.currentStreak}</span>
              </div>
            )}
            <BalanceChip balance={balance} isLoaded={isLoaded} isLocal={isLocal} />
          </div>
        </header>

        {/* ACTION BAR — phones and small tablets keep it above the grid,
            where there is width to spare and height is not yet the problem.
            From lg it all moves into the rail below. */}
        <div className="flex flex-col gap-2 mb-3 shrink-0 lg:hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 items-stretch gap-2">
            {claims.map((c) => (
              <ClaimTile
                key={c.label}
                label={c.label}
                icon={c.icon}
                ready={c.ready}
                readyHint={c.readyHint}
                waitLabel={c.waitLabel}
                busy={c.busy}
                onClick={c.onClick}
              />
            ))}
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-2">
            {destinations.map((d) => (
              <NavTile
                key={d.label}
                label={d.label}
                hint={d.hint}
                icon={d.icon}
                pending={d.pending}
                onClick={d.onSelect}
              />
            ))}
          </div>

          <EventBanner />

          <ActiveEffectsBar />
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          <CasinoRail
            claims={claims}
            destinations={destinations}
            className="hidden lg:block"
          />

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
      </div>
    </main>
  );
}
