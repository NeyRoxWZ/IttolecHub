'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Sparkles, Gift as GiftIcon, Gem, Target, ShoppingBag, Banknote, Crown,
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

/** One compact action pill. `done` greys it out and hides the pending dot. */
function RewardPill({
  label, hint, icon: Icon, tone, done, onClick, busy,
}: {
  label: string;
  hint: string;
  icon: any;
  tone: 'success' | 'primary' | 'neutral';
  done?: boolean;
  onClick: () => void;
  busy?: boolean;
}) {
  const active = {
    success: 'border-accent-success bg-accent-success/10 text-accent-success',
    primary: 'border-accent-primary bg-accent-primary/10 text-accent-primary',
    neutral: 'border-brand-border bg-brand-card text-accent-primary',
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        'relative h-12 px-3 rounded-xl border-2 flex items-center gap-2 text-left transition-all focus:outline-none',
        'hover:-translate-y-0.5 disabled:opacity-50',
        done ? 'border-brand-border bg-brand-card' : active
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', done && 'text-tx-muted')} />
      <div className="min-w-0 leading-tight">
        <div className="font-display font-black text-[12px] text-tx-base">{label}</div>
        <div className="text-[9px] font-bold text-tx-muted truncate">{busy ? '···' : hint}</div>
      </div>
      {!done && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-secondary animate-pulse" />}
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
  const { missions, reload: reloadMissions, claimable } = useMissions();
  const [cashback, setCashback] = useState<{ amount: number; available: boolean } | null>(null);
  const [claimingCashback, setClaimingCashback] = useState(false);

  useEffect(() => {
    try { if (!localStorage.getItem(DISCLAIMER_KEY)) setShowDisclaimer(true); } catch {}
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

        {/* ACTION BAR — one wrapping row of pills. It used to be eight big
            tiles on two rows, which ate the height the games needed and made
            the top of the page unreadable. */}
        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
          <RewardPill
            label="Bonus du jour"
            hint={stats.dailyClaimedToday ? `Pris · ${stats.dailyStreak} j` : '250 à 10 000 ₶'}
            icon={GiftIcon}
            tone="success"
            done={stats.dailyClaimedToday}
            onClick={handleClaimDaily}
            busy={claimingDaily}
          />

          <RewardPill
            label="Roue gratuite"
            hint={stats.wheelClaimedToday ? 'Déjà tournée' : 'Jusqu’à 10 000 ₶'}
            icon={Sparkles}
            tone="primary"
            done={stats.wheelClaimedToday}
            onClick={() => { sfx.click(); setShowWheel(true); }}
          />

          <RewardPill
            label="Cashback"
            hint={stats.cashbackClaimedToday ? 'Déjà pris'
              : cashback?.available ? `+${cashback.amount.toLocaleString('fr-FR')} ₶`
              : 'Rien hier'}
            icon={Banknote}
            tone="primary"
            done={!cashback?.available}
            onClick={handleClaimCashback}
            busy={claimingCashback}
          />

          <RewardPill
            label="Missions"
            hint={claimable > 0 ? `${claimable} à réclamer` : `${missions.filter((m) => m.claimed).length}/${missions.length || 3} faites`}
            icon={Target}
            tone="neutral"
            done={claimable === 0}
            onClick={() => { sfx.click(); setShowMissions(true); }}
          />

          <RewardPill
            label="Frenly Pass"
            hint={passTier !== null ? `Palier ${passTier} / 100` : '100 paliers'}
            icon={Crown}
            tone="primary"
            done={passTier !== null && passTier > 0}
            onClick={() => { sfx.click(); router.push('/casino/pass'); }}
          />

          <RewardPill
            label="Boutique"
            hint="5 objets/jour"
            icon={ShoppingBag}
            tone="neutral"
            done
            onClick={() => { sfx.click(); router.push('/casino/shop'); }}
          />

          <button
            onClick={() => { sfx.click(); setShowJackpot(true); }}
            title="Comment gagner la cagnotte ?"
            className="h-12 px-3 rounded-xl border-2 border-accent-primary/60 bg-accent-primary/10 flex items-center gap-2 hover:border-accent-primary hover:-translate-y-0.5 transition-all focus:outline-none text-left"
          >
            <Gem className="h-4 w-4 shrink-0 text-accent-primary" />
            <div className="min-w-0 leading-tight">
              <div className="font-display font-black text-[13px] text-accent-primary tabular-nums">
                {jackpot !== null ? `${jackpot.toLocaleString('fr-FR')} ₶` : '···'}
              </div>
              <div className="text-[9px] font-bold text-tx-muted">Cagnotte · 1 sur 3 000</div>
            </div>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => { sfx.click(); router.push('/casino/achievements'); }}
              title="Succès"
              className="h-12 w-12 rounded-xl border-2 border-brand-border bg-brand-card flex items-center justify-center text-accent-primary hover:border-accent-primary transition-colors focus:outline-none"
            >
              <Award className="h-4 w-4" />
            </button>
            <button
              onClick={() => { sfx.click(); router.push('/casino/leaderboard'); }}
              title="Classement"
              className="h-12 w-12 rounded-xl border-2 border-brand-border bg-brand-card flex items-center justify-center text-accent-primary hover:border-accent-primary transition-colors focus:outline-none"
            >
              <Trophy className="h-4 w-4" />
            </button>

            {canPrestige ? (
              <button
                onClick={handlePrestige}
                disabled={prestiging}
                className="h-12 px-4 rounded-xl border-2 border-accent-primary bg-accent-primary text-brand-bg flex items-center gap-2 font-display font-black text-xs tracking-wider hover:brightness-110 transition-all focus:outline-none"
              >
                <Sparkles className="h-4 w-4" />
                {prestiging ? '···' : 'PRESTIGER'}
              </button>
            ) : (
              <div
                className="h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-card flex flex-col justify-center min-w-[104px]"
                title={`Atteins ${PRESTIGE_THRESHOLD.toLocaleString('fr-FR')} ₶ pour prestiger`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">Prestige</span>
                  <span className="text-[9px] font-black text-accent-primary tabular-nums">{prestigeProgress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
                  <div className="h-full bg-accent-primary transition-all duration-500" style={{ width: `${prestigeProgress}%` }} />
                </div>
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
