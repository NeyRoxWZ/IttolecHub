'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Sparkles, Gift as GiftIcon, Gem, Target, ShoppingBag,
  Banknote, Crown, ArrowUpRight, Clock, Backpack, Radio, Users, Swords,
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
import { useCommunity, timeLeft } from './_components/CommunityQuest';
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
import RecapModal, { useRecap } from './_components/RecapModal';
import { secondsUntilRotation } from '@/lib/casino/shop';
import { secondsUntilReset } from '@/lib/casino/pass';
import DailyWheelModal from './_components/DailyWheelModal';
import Confetti from './_components/Confetti';
import BalanceChip from './_components/BalanceChip';
import { CASINO_GAMES } from '@/lib/casino/games';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';


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
        'relative h-16 sm:h-14 shrink-0 rounded-xl border-[3px] border-brand-border transition-transform focus:outline-none',
        'flex flex-col sm:flex-row items-center sm:gap-2 justify-center sm:justify-start px-2 sm:px-3 text-center sm:text-left',
        ready
          ? 'bg-accent-success text-brand-bg shadow-[inset_0_-5px_0_#1E9A55,0_4px_0_#05061A] active:translate-y-[3px]'
          : 'bg-brand-inner shadow-[inset_0_3px_0_#0B0E2A] cursor-default'
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
        TILE, 'pr-7 border-[3px] border-brand-border shadow-[0_4px_0_#05061A]',
        pending ? 'bg-[#3A2150]' : 'bg-brand-card',
        'hover:-translate-y-0.5'
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
  const recap = useRecap();
  const [dailyResetIn, setDailyResetIn] = useState(() => secondsUntilRotation());
  const [passResetIn, setPassResetIn] = useState(() => secondsUntilReset());
  const { missions, reload: reloadMissions, claimable: missionsClaimable } = useMissions();
  const { state: community } = useCommunity();
  // The shared goal's reward only lasts until the next goal starts, so it
  // counts as something to collect and is announced once per visit.
  const communityClaimable = community?.completed && community.you && !community.you.claimed && community.you.reward > 0 ? 1 : 0;
  const claimable = missionsClaimable + communityClaimable;
  useEffect(() => {
    if (!communityClaimable || !community) return;
    const key = `itollec_community_nudge_${(community as { period?: string }).period ?? ''}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
    toast.success('Objectif commun atteint !', {
      description: `Récupère ${community.you!.reward.toLocaleString('en-US')} ₶ dans Missions › Commun${community.endsAt ? ` (${timeLeft(community.endsAt)})` : ''}. Après, un nouvel objectif commence et elle est perdue.`,
      duration: 9000,
      action: { label: 'Récupérer', onClick: () => setShowMissions(true) },
    });
  }, [communityClaimable, community]);
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
    for (const path of ['/casino/shop', '/casino/pass', '/casino/inventaire', '/casino/achievements', '/casino/leaderboard', '/casino/direct', '/casino/cagnotte', '/casino/potes', '/casino/defi']) {
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
      label: 'Défi du jour', icon: Target, hint: 'mêmes tirages pour tous',
      onSelect: () => { sfx.click(); router.push('/casino/defi'); },
    },
    {
      label: 'Entre potes', icon: Swords, hint: 'duels, cadeaux, chat',
      onSelect: () => { sfx.click(); router.push('/casino/potes'); },
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
      readyHint: chest?.next ? `case ${chest.next}/7` : '7 jours de cadeaux',
      waitLabel: chest?.day ? `${chest.day} j d'affilée` : formatWait(dailyResetIn),
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
    <main className="lg:[@media(min-height:700px)]:h-[100dvh] lg:[@media(min-height:700px)]:overflow-hidden bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-5 flex flex-col">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      <FeedTicker />
      {showWheel && <DailyWheelModal onClose={() => setShowWheel(false)} onSpin={claimWheelOfFortune} />}
      {showJackpot && <JackpotModal amount={jackpot} onClose={() => setShowJackpot(false)} />}
      {showChest && <ChestModal onClose={() => setShowChest(false)} />}
      {recap.open && <RecapModal onClose={recap.close} />}
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

      <div className="max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-3 gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => router.push('/?mode=solo')}
              aria-label="Retour à l’accueil"
              className={cn(BRAWL.pink, 'h-12 w-12 shrink-0')}
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={3} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl sm:text-4xl leading-none truncate">Casino</h1>
              {prestigeTitle && (
                <span className="block text-[11px] font-black uppercase tracking-widest text-accent-primary truncate mt-1">
                  {prestigeTitle}
                </span>
              )}
            </div>

            <CasinoMenu entries={destinations} pending={claimable + passClaimable} />

            <button
              onClick={() => { sfx.click(); setShowGuide(true); }}
              title="Comment ça marche ?"
              aria-label="Comment ça marche ?"
              className={cn(BRAWL.dark, 'h-12 w-12 shrink-0')}
            >
              <Info className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { sfx.click(); setShowJackpot(true); }}
              title="Comment gagner la cagnotte ?"
              className="hidden sm:flex h-12 items-center gap-2 pl-1.5 pr-3 rounded-2xl border-[3px] border-brand-border bg-brand-bg hover:bg-[#1A1E4A] transition-colors focus:outline-none"
            >
              <span className="h-8 w-8 shrink-0 rounded-xl bg-accent-info border-2 border-brand-border flex items-center justify-center shadow-[inset_0_-3px_0_#2F5BD0]">
                <Gem className="h-4 w-4 text-white" strokeWidth={2.5} />
              </span>
              <div className="leading-tight text-left">
                <div className="font-display text-base text-white tabular-nums">
                  {jackpot !== null ? `${jackpot.toLocaleString('en-US')} ₶` : '···'}
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">Cagnotte</div>
              </div>
              {/* Was a grey "?" wedged in the corner; nobody saw it. */}
              <span className="ml-1 h-6 w-6 shrink-0 rounded-full bg-accent-primary border-2 border-brand-border text-brand-bg font-display text-sm flex items-center justify-center">
                ?
              </span>
            </button>

            {/* Prestige sits next to the pot, same shape: both are status. */}
            {canPrestige ? (
              <button
                onClick={() => { sfx.click(); setShowPrestige(true); }}
                title="Prestiger"
                className={cn(BRAWL.yellow, 'hidden sm:flex h-12 px-4 text-lg')}
              >
                <Sparkles className="h-5 w-5 shrink-0" />
                <span>Prestiger</span>
              </button>
            ) : (
              <button
                onClick={() => { sfx.click(); setShowPrestige(true); }}
                title={`Atteins ${PRESTIGE_THRESHOLD.toLocaleString('en-US')} ₶ pour prestiger`}
                className="hidden sm:flex h-12 items-center gap-2 px-3 rounded-2xl border-[3px] border-brand-border bg-brand-bg hover:bg-[#1A1E4A] transition-colors focus:outline-none"
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

            <div className="h-12 hidden sm:flex items-center pl-1.5 pr-3 rounded-2xl border-[3px] border-brand-border bg-brand-bg">
              <LevelBar level={stats.level} into={stats.xpIntoLevel} needed={stats.xpForNext} />
            </div>

            <CasinoControls className="hidden sm:flex" />
            {stats.currentStreak > 1 && (
              <div className="h-12 flex items-center gap-1.5 pl-1.5 pr-3 rounded-2xl border-[3px] border-brand-border bg-brand-bg" title="Victoires d'affilée">
                <span className="h-8 w-8 rounded-xl bg-[#FF8A1F] border-2 border-brand-border flex items-center justify-center shadow-[inset_0_-3px_0_#CC6508]">
                  <Flame className="h-4 w-4 text-white" strokeWidth={2.5} />
                </span>
                <span className="font-display text-lg text-white">{stats.currentStreak}</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 lg:grid-rows-4 gap-x-3 gap-y-4 flex-1 lg:min-h-0 pb-1.5">
            {CASINO_GAMES.map((game, i) => {
              const Icon = game.icon;
              const swatch = BRAWL_SWATCHES[i % BRAWL_SWATCHES.length];
              return (
                <Link
                  key={game.slug}
                  href={`/casino/${game.slug}`}
                  prefetch
                  onClick={() => sfx.click()}
                  className="group relative h-full min-h-[150px] rounded-2xl border-4 border-brand-border bg-brand-card overflow-hidden flex flex-col shadow-[0_6px_0_#05061A] transition-transform hover:-translate-y-1 active:translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-primary"
                >
                  {/* Coloured top with the game's icon: the card's cover. */}
                  <div
                    className="relative flex-1 min-h-[64px] flex items-center justify-center border-b-4 border-brand-border"
                    style={{ background: swatch.fill, boxShadow: `inset 0 -6px 0 ${swatch.shade}` }}
                  >
                    <Icon className="h-9 w-9 text-white drop-shadow-[0_3px_0_#05061A] transition-transform group-hover:scale-110" strokeWidth={2.5} />
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg bg-brand-bg border-2 border-brand-border font-display text-[11px] text-white" title="Redistribution">
                      {game.rtp}
                    </span>
                  </div>
                  <div className="px-2 py-2 text-center">
                    <div className="font-display text-lg leading-none text-stroke-sm truncate">{game.name.replace(/^Frenly /, '')}</div>
                    <div className="mt-1 text-[11px] font-bold text-tx-secondary leading-tight truncate">{game.short}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
