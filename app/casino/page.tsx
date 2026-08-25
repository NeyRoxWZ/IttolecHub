'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Sparkles, Gift as GiftIcon, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';
import { PRESTIGE_THRESHOLD, getPrestigeTitle } from '@/lib/casino/meta';
import { CountUp } from './_components/CasinoUI';
import DailyWheelModal from './_components/DailyWheelModal';
import Confetti from './_components/Confetti';

interface CasinoGameEntry {
  slug: string; name: string; short: string; icon: any; rtp: string; tag: string;
}

const CASINO_GAMES: CasinoGameEntry[] = [
  { slug: 'slots', name: 'Frenly Slots', short: 'Aligne 3 symboles.', icon: Dices, rtp: '94%', tag: 'Machine' },
  { slug: 'blackjack', name: 'Frenly 21', short: 'Bats le croupier sans dépasser 21.', icon: Spade, rtp: '98%', tag: 'Cartes' },
  { slug: 'wheel', name: 'Frenly Wheel', short: 'Rouge, noir ou numéro plein.', icon: CircleDot, rtp: '97%', tag: 'Roulette' },
  { slug: 'rocket', name: 'Frenly Rocket', short: 'Encaisse avant le crash.', icon: Rocket, rtp: '95%', tag: 'Crash' },
  { slug: 'mines', name: 'Frenly Mines', short: 'Retourne les cases sûres.', icon: Bomb, rtp: '96%', tag: 'Cash-out' },
  { slug: 'plinko', name: 'Frenly Plinko', short: 'La bille tombe, le gain varie.', icon: Circle, rtp: '97%', tag: 'Chute' },
  { slug: 'hilo', name: 'Frenly HiLo', short: 'Plus haute ou plus basse ?', icon: ArrowUpDown, rtp: '96%', tag: 'Cartes' },
  { slug: 'grattage', name: 'Frenly Grattage', short: 'Gratte, petits gains fréquents.', icon: Ticket, rtp: '90%', tag: 'Ticket' },
  { slug: 'poulet', name: 'Frenly Poulet', short: 'Traverse sans te faire écraser.', icon: Egg, rtp: '96%', tag: 'Cash-out' },
  { slug: 'tower', name: 'Frenly Tower', short: 'Monte les étages sans piège.', icon: Building2, rtp: '96%', tag: 'Cash-out' },
  { slug: 'keno', name: 'Frenly Keno', short: 'Coche 10 numéros, 20 sortent.', icon: Grid3x3, rtp: '95%', tag: 'Tirage' },
  { slug: 'caisses', name: 'Frenly Caisses', short: '5 caisses, 1 jackpot.', icon: Gift, rtp: '93%', tag: 'Instant' },
  { slug: 'coinflip', name: 'Frenly Coinflip', short: 'Pile ou face.', icon: Coins, rtp: '97%', tag: 'Instant' },
  { slug: 'dino', name: 'Frenly Dino', short: 'Esquive, encaisse avant l’impact.', icon: Zap, rtp: '95%', tag: 'Cash-out' },
  { slug: 'chevaux', name: 'Frenly Chevaux', short: 'Mise sur un cheval à cote.', icon: Flag, rtp: '94%', tag: 'Course' },
  { slug: 'bonneteau', name: 'Frenly Bonneteau', short: 'Suis la bille sous le gobelet.', icon: GlassWater, rtp: '93%', tag: 'Instant' },
  { slug: 'stade', name: 'Frenly Stade', short: 'Domicile, Extérieur ou Nul.', icon: LayoutGrid, rtp: '96%', tag: 'Duel' },
  { slug: 'baccarat', name: 'Frenly Baccarat', short: 'Joueur, Banque ou Égalité.', icon: Layers, rtp: '98%', tag: 'Cartes' },
  { slug: 'rps', name: 'Pierre-Feuille-Ciseaux', short: 'Un coup contre la maison.', icon: Hand, rtp: '96%', tag: 'Duel' },
  { slug: 'craps', name: 'Frenly Craps', short: 'Ça passe ou ça casse.', icon: Dice5, rtp: '98%', tag: 'Dés' },
];

const DISCLAIMER_KEY = 'itollec_casino_disclaimer_seen';

export default function CasinoHub() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, stats, claimDaily, claimWheelOfFortune, prestige } = useCasinoWallet();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [showWheel, setShowWheel] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [prestiging, setPrestiging] = useState(false);
  const [confetti, setConfetti] = useState(0);

  useEffect(() => {
    try { if (!localStorage.getItem(DISCLAIMER_KEY)) setShowDisclaimer(true); } catch {}
  }, []);

  useEffect(() => {
    supabase.from('casino_jackpot').select('amount').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setJackpot(Number(data.amount));
    });
    const channel = supabase.channel('casino_jackpot_ticker')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'casino_jackpot' }, (payload) => {
        setJackpot(Number((payload.new as any).amount));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismissDisclaimer = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, '1'); } catch {}
    sfx.click();
    setShowDisclaimer(false);
  };

  const handleClaimDaily = async () => {
    if (claimingDaily || stats.dailyClaimedToday) return;
    if (!user) { toast.error('Connecte-toi pour réclamer ton bonus quotidien.'); return; }
    setClaimingDaily(true);
    vibrate(HAPTIC.MEDIUM);
    const result = await claimDaily();
    setClaimingDaily(false);
    if ('error' in result) { toast.error(result.error); return; }
    vibrate(HAPTIC.SUCCESS);
    sfx.coin();
    if (result.reward >= 2000) { sfx.bigWin(); setConfetti((c) => c + 1); }
    toast.success(`Bonus quotidien : +${result.reward.toLocaleString('fr-FR')} ₶`, {
      description: `Série de ${result.dailyStreak} jour${result.dailyStreak > 1 ? 's' : ''} — reviens demain pour la garder.`,
      duration: 5000,
    });
  };

  const handlePrestige = async () => {
    if (prestiging) return;
    setPrestiging(true);
    vibrate(HAPTIC.MEDIUM);
    const result = await prestige();
    setPrestiging(false);
    if ('error' in result) { toast.error(result.error); return; }
    sfx.jackpot();
    setConfetti((c) => c + 1);
    toast.success(`Prestige ! Titre débloqué : ${getPrestigeTitle(result.prestigeCount)}`, { duration: 6000 });
  };

  const prestigeTitle = getPrestigeTitle(stats.prestigeCount);
  const canPrestige = balance >= PRESTIGE_THRESHOLD;
  const pendingRewards = (!stats.dailyClaimedToday ? 1 : 0) + (!stats.wheelClaimedToday ? 1 : 0);
  const prestigeProgress = Math.min(100, (balance / PRESTIGE_THRESHOLD) * 100);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {showWheel && <DailyWheelModal onClose={() => setShowWheel(false)} onSpin={claimWheelOfFortune} />}

      {showDisclaimer && (
        <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal animate-in zoom-in-95 fade-in duration-200">
            <div className="flex justify-center mb-4">
              <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl">
                <Info className="w-10 h-10 text-accent-primary" />
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

      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/?mode=solo')}
              className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-black leading-none">Casino</h1>
              {prestigeTitle && (
                <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary">{prestigeTitle}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stats.currentStreak > 1 && (
              <div className="h-11 flex items-center gap-1.5 px-3 rounded-xl border-2 border-accent-secondary bg-accent-secondary/10" title="Victoires d'affilée">
                <Flame className="h-4 w-4 text-accent-secondary" />
                <span className="font-display font-black text-sm text-accent-secondary">{stats.currentStreak}</span>
              </div>
            )}
            <div className="h-11 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
              <Coins className="h-4 w-4 text-accent-primary" />
              {isLoaded ? <CountUp value={balance} className="font-display font-black text-base" /> : <span className="font-display font-black">···</span>}
              <span className="text-tx-secondary font-bold text-sm">₶</span>
              {isLocal && (
                <span className="text-[8px] font-black uppercase bg-brand-card border border-brand-border px-1 py-0.5 rounded text-tx-muted" title="Connecte-toi pour sauvegarder ton solde">
                  Local
                </span>
              )}
            </div>
          </div>
        </header>

        {/* DAILY REWARDS — only loud while something is actually claimable */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display text-sm font-black uppercase tracking-widest text-tx-muted">Récompenses du jour</h2>
            {pendingRewards > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-accent-secondary text-white px-2 py-0.5 rounded-full animate-pulse">
                {pendingRewards} à récupérer
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Login bonus */}
            <button
              onClick={handleClaimDaily}
              disabled={stats.dailyClaimedToday || claimingDaily}
              className={cn(
                'relative text-left rounded-2xl border-4 p-4 flex items-center gap-4 transition-all focus:outline-none',
                stats.dailyClaimedToday
                  ? 'border-brand-border bg-brand-card opacity-55 cursor-default'
                  : 'border-accent-success bg-accent-success/10 shadow-brutal hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
              )}
            >
              <div className={cn('rounded-xl border-2 p-3 shrink-0', stats.dailyClaimedToday ? 'border-brand-border bg-brand-inner' : 'border-accent-success bg-brand-inner')}>
                <GiftIcon className={cn('h-6 w-6', stats.dailyClaimedToday ? 'text-tx-muted' : 'text-accent-success')} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-black text-sm">Bonus de connexion</div>
                <div className="text-xs text-tx-secondary">
                  {stats.dailyClaimedToday
                    ? `Déjà pris — série de ${stats.dailyStreak} j. Reviens demain.`
                    : '250 à 10 000 ₶ — clique pour récupérer'}
                </div>
              </div>
              {!stats.dailyClaimedToday && <ChevronRight className="h-5 w-5 text-accent-success shrink-0" />}
            </button>

            {/* Daily wheel */}
            <button
              onClick={() => { sfx.click(); setShowWheel(true); }}
              disabled={stats.wheelClaimedToday}
              className={cn(
                'relative text-left rounded-2xl border-4 p-4 flex items-center gap-4 transition-all focus:outline-none',
                stats.wheelClaimedToday
                  ? 'border-brand-border bg-brand-card opacity-55 cursor-default'
                  : 'border-accent-primary bg-accent-primary/10 shadow-brutal hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
              )}
            >
              <div className={cn('rounded-xl border-2 p-3 shrink-0', stats.wheelClaimedToday ? 'border-brand-border bg-brand-inner' : 'border-accent-primary bg-brand-inner')}>
                <Sparkles className={cn('h-6 w-6', stats.wheelClaimedToday ? 'text-tx-muted' : 'text-accent-primary')} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-black text-sm">Roue de la fortune</div>
                <div className="text-xs text-tx-secondary">
                  {stats.wheelClaimedToday ? 'Déjà tournée — reviens demain.' : 'Un tour gratuit, jusqu’à 10 000 ₶'}
                </div>
              </div>
              {!stats.wheelClaimedToday && <ChevronRight className="h-5 w-5 text-accent-primary shrink-0" />}
            </button>
          </div>
        </section>

        {/* JACKPOT + PROGRESSION */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="sm:col-span-2 rounded-2xl border-4 border-brand-border bg-brand-card p-4">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Jackpot commun</span>
              <span className="text-[10px] font-bold text-tx-muted">1 chance sur 3000 par mise</span>
            </div>
            <div className="font-display text-3xl font-black text-accent-primary">
              {jackpot !== null ? <CountUp value={jackpot} /> : '···'} <span className="text-lg">₶</span>
            </div>
            <p className="text-xs text-tx-secondary mt-1">
              Chaque mise perdue sur n&apos;importe quel jeu fait grossir cette cagnotte. Une mise au hasard la rafle entièrement.
            </p>
          </div>

          <div className="rounded-2xl border-4 border-brand-border bg-brand-card p-4 flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-1">Prestige</span>
            {canPrestige ? (
              <>
                <p className="text-xs text-tx-secondary mb-2 flex-1">Solde remis à 250 ₶, titre permanent débloqué.</p>
                <button
                  onClick={handlePrestige}
                  disabled={prestiging}
                  className="h-10 rounded-xl border-2 border-accent-primary bg-accent-primary text-brand-bg font-display font-black text-sm hover:brightness-110 transition-all focus:outline-none"
                >
                  {prestiging ? '···' : 'PRESTIGER'}
                </button>
              </>
            ) : (
              <>
                <div className="font-display text-lg font-black">{prestigeProgress.toFixed(1)}%</div>
                <div className="h-2 rounded-full bg-brand-inner border border-brand-border overflow-hidden my-2">
                  <div className="h-full bg-accent-primary transition-all duration-500" style={{ width: `${prestigeProgress}%` }} />
                </div>
                <p className="text-[11px] text-tx-secondary">Atteins 1 000 000 ₶ pour prestiger.</p>
              </>
            )}
          </div>
        </section>

        {/* NAV */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => { sfx.click(); router.push('/casino/achievements'); }} className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-brand-border bg-brand-inner font-bold text-sm hover:border-accent-primary transition-colors focus:outline-none">
            <Award className="w-4 h-4 text-accent-primary" /> Succès
          </button>
          <button onClick={() => { sfx.click(); router.push('/casino/leaderboard'); }} className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-brand-border bg-brand-inner font-bold text-sm hover:border-accent-primary transition-colors focus:outline-none">
            <Trophy className="w-4 h-4 text-accent-primary" /> Classement
          </button>
        </div>

        {/* GAMES */}
        <h2 className="font-display text-sm font-black uppercase tracking-widest text-tx-muted mb-3">Les jeux</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CASINO_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.slug}
                onClick={() => { sfx.click(); router.push(`/casino/${game.slug}`); }}
                className="group text-left rounded-2xl border-4 border-brand-border bg-brand-card p-4 flex flex-col gap-2.5 shadow-brutal transition-all hover:border-accent-primary hover:-translate-y-1 active:translate-y-0 focus:outline-none"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5 group-hover:border-accent-primary transition-colors">
                    <Icon className="h-5 w-5 text-accent-primary" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-tx-muted border border-brand-border rounded px-1.5 py-0.5">
                    {game.tag}
                  </span>
                </div>
                <div>
                  <h3 className="font-display font-black text-sm leading-tight">{game.name}</h3>
                  <p className="text-[11px] text-tx-secondary mt-1 leading-snug">{game.short}</p>
                </div>
                <span className="text-[10px] font-bold text-tx-muted mt-auto">Redistribution {game.rtp}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
