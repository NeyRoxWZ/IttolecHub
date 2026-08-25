'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info, Flame, Trophy, Award, Gem, Sparkles, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';
import { PRESTIGE_THRESHOLD, getPrestigeTitle } from '@/lib/casino/meta';

interface CasinoGameEntry {
  slug: string;
  name: string;
  description: string;
  icon: any;
  rtp: string;
  enabled: boolean;
}

const CASINO_GAMES: CasinoGameEntry[] = [
  { slug: 'slots', name: 'Frenly Slots', description: 'Machine à sous à rouleaux.', icon: Dices, rtp: '~94%', enabled: true },
  { slug: 'blackjack', name: 'Frenly 21', description: 'Blackjack contre le croupier.', icon: Spade, rtp: '~98%', enabled: true },
  { slug: 'wheel', name: 'Frenly Wheel', description: 'Roulette simplifiée.', icon: CircleDot, rtp: '~97.3%', enabled: true },
  { slug: 'rocket', name: 'Frenly Rocket', description: 'Encaisse avant le crash.', icon: Rocket, rtp: '~95%', enabled: true },
  { slug: 'mines', name: 'Frenly Mines', description: 'Évite les mines cachées.', icon: Bomb, rtp: '~96%', enabled: true },
  { slug: 'plinko', name: 'Frenly Plinko', description: 'La bille tombe, le gain varie.', icon: Circle, rtp: '~97%', enabled: true },
  { slug: 'hilo', name: 'Frenly HiLo', description: 'Plus haut ou plus bas ?', icon: ArrowUpDown, rtp: '~96%', enabled: true },
  { slug: 'grattage', name: 'Frenly Grattage', description: 'Ticket pas cher, petit gain.', icon: Ticket, rtp: '~90%', enabled: true },
  { slug: 'poulet', name: 'Frenly Poulet', description: 'Traverse la route sans te faire écraser.', icon: Egg, rtp: '~96%', enabled: true },
  { slug: 'tower', name: 'Frenly Tower', description: 'Grimpe les étages sans piège.', icon: Building2, rtp: '~96%', enabled: true },
  { slug: 'keno', name: 'Frenly Keno', description: 'Choisis tes numéros chanceux.', icon: Grid3x3, rtp: '~95%', enabled: true },
  { slug: 'caisses', name: 'Frenly Caisses', description: 'Trouve le gros lot.', icon: Gift, rtp: '~93%', enabled: true },
  { slug: 'coinflip', name: 'Frenly Coinflip', description: 'Pile ou face, x2.', icon: Coins, rtp: '~97%', enabled: true },
  { slug: 'dino', name: 'Frenly Dino', description: 'Esquive, encaisse avant impact.', icon: Zap, rtp: '~95%', enabled: true },
  { slug: 'chevaux', name: 'Frenly Chevaux', description: 'Course de chevaux fictifs.', icon: Flag, rtp: '~94%', enabled: true },
  { slug: 'bonneteau', name: 'Frenly Bonneteau', description: 'Suis le bon gobelet.', icon: GlassWater, rtp: '~93%', enabled: true },
  { slug: 'stade', name: 'Frenly Stade', description: 'Domicile, Extérieur ou Nul.', icon: LayoutGrid, rtp: '~96%', enabled: true },
  { slug: 'baccarat', name: 'Frenly Baccarat', description: 'Joueur, Banque, ou Égalité.', icon: Layers, rtp: '~98.5%', enabled: true },
  { slug: 'rps', name: 'Frenly Pierre-Feuille-Ciseaux', description: 'Contre la maison, coup unique.', icon: Hand, rtp: '~96%', enabled: true },
  { slug: 'craps', name: 'Frenly Craps Express', description: 'Ça passe ou ça casse.', icon: Dice5, rtp: '~98.6%', enabled: true },
];

const DISCLAIMER_KEY = 'itollec_casino_disclaimer_seen';

export default function CasinoHub() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, stats, claimDaily, claimWheelOfFortune, prestige, refresh } = useCasinoWallet();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [jackpot, setJackpot] = useState<number | null>(null);
  const [showWheelModal, setShowWheelModal] = useState(false);
  const [wheelResult, setWheelResult] = useState<number | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [prestiging, setPrestiging] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISCLAIMER_KEY)) setShowDisclaimer(true);
    } catch {}
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
    setShowDisclaimer(false);
  };

  const handleClaimDaily = async () => {
    if (claimingDaily) return;
    if (!user) { toast.error('Connecte-toi pour réclamer ton bonus quotidien.'); return; }
    setClaimingDaily(true);
    vibrate(HAPTIC.MEDIUM);
    const result = await claimDaily();
    setClaimingDaily(false);
    if ('error' in result) { toast.error(result.error); return; }
    vibrate(HAPTIC.SUCCESS);
    toast.success(`Bonus quotidien : +${result.reward} ₶ (série de ${result.dailyStreak} jour${result.dailyStreak > 1 ? 's' : ''})`, { duration: 5000 });
  };

  const handleSpinWheelOfFortune = async () => {
    if (wheelSpinning) return;
    if (!user) { toast.error('Connecte-toi pour tourner la roue quotidienne.'); return; }
    setWheelSpinning(true);
    setWheelResult(null);
    vibrate(HAPTIC.MEDIUM);
    const result = await claimWheelOfFortune();
    if ('error' in result) {
      setWheelSpinning(false);
      toast.error(result.error);
      return;
    }
    setTimeout(() => {
      setWheelResult(result.reward);
      setWheelSpinning(false);
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Roue quotidienne : +${result.reward} ₶ !`);
    }, 1200);
  };

  const handlePrestige = async () => {
    if (prestiging) return;
    setPrestiging(true);
    vibrate(HAPTIC.MEDIUM);
    const result = await prestige();
    setPrestiging(false);
    if ('error' in result) { toast.error(result.error); return; }
    vibrate(HAPTIC.SUCCESS);
    toast.success(`Prestige ! Nouveau titre: ${getPrestigeTitle(result.prestigeCount)}`, { duration: 6000 });
  };

  const prestigeTitle = getPrestigeTitle(stats.prestigeCount);
  const canPrestige = balance >= PRESTIGE_THRESHOLD;

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      {showDisclaimer && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal animate-in zoom-in fade-in duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl">
                <Info className="w-10 h-10 text-accent-primary" />
              </div>
            </div>
            <h2 className="font-display text-2xl font-black text-center mb-3">FrenlyCoins ne valent rien</h2>
            <p className="text-tx-secondary text-sm text-center leading-relaxed mb-6">
              Les FrenlyCoins (₶) sont une monnaie 100% fictive. Impossible de les acheter avec de l&apos;argent réel,
              impossible de les retirer ou de les convertir, dans un sens comme dans l&apos;autre. C&apos;est juste pour le fun.
            </p>
            <button
              onClick={dismissDisclaimer}
              className="w-full h-14 rounded-lg font-display font-black tracking-wider border-2 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary transition-colors"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}

      {showWheelModal && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !wheelSpinning && setShowWheelModal(false)}>
          <div className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-black mb-4">Roue Quotidienne</h2>
            <div className={cn('mx-auto w-32 h-32 rounded-full border-4 border-brand-border bg-brand-inner flex items-center justify-center mb-4', wheelSpinning && 'animate-spin')}>
              {wheelResult !== null ? (
                <span className="font-display font-black text-2xl text-accent-primary">+{wheelResult}</span>
              ) : (
                <Sparkles className="w-10 h-10 text-accent-primary" />
              )}
            </div>
            {wheelResult === null ? (
              <button
                onClick={handleSpinWheelOfFortune}
                disabled={wheelSpinning}
                className="w-full h-14 rounded-lg font-display font-black tracking-wider border-2 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary transition-colors disabled:opacity-50"
              >
                {wheelSpinning ? 'ÇA TOURNE...' : 'TOURNER (gratuit)'}
              </button>
            ) : (
              <button
                onClick={() => { setShowWheelModal(false); setWheelResult(null); }}
                className="w-full h-14 rounded-lg font-display font-black tracking-wider border-2 border-brand-border bg-brand-inner hover:bg-tx-base hover:text-brand-bg transition-colors"
              >
                Récupérer
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/?mode=solo')}
              className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-black">Casino</h1>
              {prestigeTitle && <span className="text-xs font-black uppercase tracking-widest text-accent-primary">{prestigeTitle}</span>}
            </div>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">
              {isLoaded ? balance.toLocaleString('fr-FR') : '...'}
            </span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && (
              <span className="ml-1 text-[9px] font-black uppercase tracking-wider bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted" title="Connecte-toi pour sauvegarder ton solde">
                Local
              </span>
            )}
          </div>
        </header>

        {/* STATS / ACTIONS BAR */}
        <div className="flex flex-wrap gap-3 mb-6">
          {jackpot !== null && (
            <div className="flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-accent-primary bg-accent-primary/10 shadow-brutal">
              <Gem className="w-4 h-4 text-accent-primary" />
              <span className="text-xs font-bold text-tx-secondary uppercase tracking-widest">Jackpot</span>
              <span className="font-display font-black text-accent-primary tabular-nums">{jackpot.toLocaleString('fr-FR')} ₶</span>
            </div>
          )}

          {stats.currentStreak > 0 && (
            <div className="flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal">
              <Flame className="w-4 h-4 text-accent-secondary" />
              <span className="text-sm font-bold">{stats.currentStreak} d&apos;affilée</span>
            </div>
          )}

          <button onClick={handleClaimDaily} disabled={claimingDaily || stats.dailyClaimedToday} className={cn('flex items-center gap-2 h-11 px-4 rounded-xl border-2 shadow-brutal font-bold text-sm transition-colors focus:outline-none', stats.dailyClaimedToday ? 'border-brand-border bg-brand-inner text-tx-muted cursor-not-allowed' : 'border-brand-border bg-brand-inner hover:border-accent-primary')}>
            <Calendar className="w-4 h-4" />
            {stats.dailyClaimedToday ? 'Bonus réclamé' : 'Bonus quotidien'}
          </button>

          <button onClick={() => setShowWheelModal(true)} disabled={stats.wheelClaimedToday} className={cn('flex items-center gap-2 h-11 px-4 rounded-xl border-2 shadow-brutal font-bold text-sm transition-colors focus:outline-none', stats.wheelClaimedToday ? 'border-brand-border bg-brand-inner text-tx-muted cursor-not-allowed' : 'border-brand-border bg-brand-inner hover:border-accent-primary')}>
            <Sparkles className="w-4 h-4" />
            {stats.wheelClaimedToday ? 'Roue tournée' : 'Roue quotidienne'}
          </button>

          <button onClick={() => router.push('/casino/achievements')} className="flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal font-bold text-sm hover:border-accent-primary transition-colors focus:outline-none">
            <Award className="w-4 h-4" />
            Succès
          </button>

          <button onClick={() => router.push('/casino/leaderboard')} className="flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal font-bold text-sm hover:border-accent-primary transition-colors focus:outline-none">
            <Trophy className="w-4 h-4" />
            Classement
          </button>

          {canPrestige && (
            <button onClick={handlePrestige} disabled={prestiging} className="flex items-center gap-2 h-11 px-4 rounded-xl border-2 border-accent-primary bg-accent-primary text-brand-bg shadow-brutal font-bold text-sm hover:bg-brand-inner hover:text-accent-primary transition-colors focus:outline-none">
              <Sparkles className="w-4 h-4" />
              {prestiging ? '...' : 'Prestiger'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CASINO_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.slug}
                disabled={!game.enabled}
                onClick={() => game.enabled && router.push(`/casino/${game.slug}`)}
                className={cn(
                  'text-left rounded-2xl border-4 border-brand-border bg-brand-card p-4 flex flex-col gap-3 transition-all shadow-brutal',
                  game.enabled ? 'hover:border-accent-primary hover:-translate-y-0.5 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                    <Icon className="h-6 w-6 text-accent-primary" />
                  </div>
                  {!game.enabled && (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-brand-inner border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">
                      Bientôt
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm leading-tight">{game.name}</h3>
                  <p className="text-xs text-tx-secondary mt-1 leading-snug">{game.description}</p>
                </div>
                <span className="text-[10px] font-bold text-tx-muted uppercase tracking-widest mt-auto">RTP {game.rtp}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
