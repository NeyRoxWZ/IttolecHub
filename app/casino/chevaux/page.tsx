'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { runRace, resolveChevaux, HORSES, CASINO_MIN_BET } from '@/lib/casino/chevaux';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtHorse, ArtFinishFlag } from '../_components/CasinoArt';

const RULES: RulesSpec = {
  howTo: [
    'Choisis un cheval et place ta mise avant le départ.',
    'Chaque cheval a une cote : plus il est favori, moins il rapporte.',
    'Si ton cheval finit premier, tu récupères ta mise multipliée par sa cote.',
    'Les cotes sont calculées pour que chaque cheval ait exactement la même espérance de gain — aucun n’est un meilleur pari qu’un autre.',
  ],
  payouts: HORSES.map((h) => ({ label: `${h.name} (${Math.round(h.probability * 100)}%)`, value: `×${h.payout}` })),
  rtp: '~94%',
};

const RACE_MS = 1900;
type Phase = 'idle' | 'racing' | 'done';

export default function ChevauxPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<number[]>(HORSES.map(() => 0));
  const [result, setResult] = useState<(GenericBetResult & { winnerId: number }) | null>(null);
  const [confetti, setConfetti] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /** Animate a race whose winner is already decided; the others jostle behind. */
  const animateRace = (winnerId: number) => new Promise<void>((resolve) => {
    const start = performance.now();
    // Give each horse a wobbly pace, then force the winner across first.
    const paces = HORSES.map((h) => (h.id === winnerId ? 1 : 0.72 + Math.random() * 0.2));
    const wobble = HORSES.map(() => Math.random() * Math.PI * 2);

    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / RACE_MS);
      setProgress(HORSES.map((h, i) => {
        const jitter = Math.sin(t * 9 + wobble[i]) * 0.03;
        return Math.max(0, Math.min(1, t * paces[i] + jitter * (1 - t)));
      }));
      if (t < 1) rafRef.current = requestAnimationFrame(loop);
      else { setProgress(HORSES.map((h) => (h.id === winnerId ? 1 : 0.8 + Math.random() * 0.12))); resolve(); }
    };
    rafRef.current = requestAnimationFrame(loop);
  });

  const handleRace = async (forced?: number) => {
    const horse = forced ?? selected;
    if (phase === 'racing' || horse === null) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setPhase('racing'); setResult(null); setProgress(HORSES.map(() => 0));
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const r = await placeBet('chevaux', amount, { horseId: horse }, () => {
      const winnerId = runRace();
      return { ...resolveChevaux(winnerId, horse), meta: { winnerId, betHorseId: horse } };
    });

    if ('error' in r) { setPhase('idle'); toast.error(r.error); return; }

    await animateRace(r.meta.winnerId);

    setResult({ ...r, winnerId: r.meta.winnerId });
    setPhase('done');
    const winnerName = HORSES.find((h) => h.id === r.meta.winnerId)?.name;

    if (r.won) {
      vibrate(HAPTIC.SUCCESS); sfx.bigWin(); setConfetti((c) => c + 1);
      toast.success(`${winnerName} gagne — +${fmt(r.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${winnerName} gagne — perdu`);
    }
  };

  const handleReset = () => { sfx.click(); setPhase('idle'); setResult(null); setProgress(HORSES.map(() => 0)); };

  /** Auto backs a random horse each race rather than the same one forever. */
  const autoTick = () => {
    if (phase === 'done') { handleReset(); return; }
    if (phase !== 'idle') return;
    const pick = HORSES[Math.floor(Math.random() * HORSES.length)].id;
    setSelected(pick);
    void handleRace(pick);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'chevaux').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="w-full rounded-2xl border-4 border-brand-border p-3 space-y-1.5"
        style={{ background: 'linear-gradient(180deg, #2F6B3A 0%, #23512C 100%)' }}
      >
        {HORSES.map((h, i) => {
          const isPick = selected === h.id;
          const isWinner = result?.winnerId === h.id;
          return (
            <div key={h.id} className={cn('relative rounded-lg overflow-hidden border-2', isWinner ? 'border-accent-primary' : isPick ? 'border-white/50' : 'border-white/10')}
              style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 22px, transparent 22px 44px)' }}>
              <div className="flex items-center h-14 px-3 gap-3">
                <span className={cn('text-xs font-black w-[110px] shrink-0 truncate', isPick ? 'text-white' : 'text-white/60')}>{h.name}</span>
                <div className="relative flex-1 h-full">
                  <span
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: `calc(${progress[i] * 100}% - 22px)`, transition: phase === 'racing' ? 'none' : 'left 300ms ease-out' }}
                  >
                    <ArtHorse size={34} />
                  </span>
                </div>
                <span className={cn('text-xs font-black shrink-0', isWinner ? 'text-accent-primary' : 'text-white/50')}>×{h.payout}</span>
                <span className="shrink-0"><ArtFinishFlag size={22} /></span>
              </div>
            </div>
          );
        })}
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `+${fmt(result.payout)} ₶` : `${HORSES.find((h) => h.id === result?.winnerId)?.name} l'emporte`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton cheval</div>
        <div className="space-y-1.5">
          {HORSES.map((h) => (
            <button
              key={h.id}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setSelected(h.id); }}
              disabled={phase === 'racing'}
              className={cn(
                'w-full h-11 rounded-xl border-2 flex items-center justify-between px-3 text-sm font-bold transition-all focus:outline-none disabled:opacity-50',
                selected === h.id ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base/60'
              )}
            >
              <span className="truncate">{h.name}</span>
              <span className="shrink-0 ml-2">×{h.payout}</span>
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={phase === 'racing'} />

      <PlayRow
        balance={balance}
        onAuto={autoTick}
        betKey={amount}
        blocked={amount > balance}
        onClick={phase === 'done' ? handleReset : () => handleRace()}
        loading={phase === 'racing'}
        disabled={!isLoaded || amount < CASINO_MIN_BET || (phase !== 'done' && selected === null)}
      >
        {phase === 'done' ? 'REJOUER' : selected === null ? 'CHOISIS UN CHEVAL' : `PARIER · ${fmt(amount)} ₶`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="chevaux" title="Frenly Chevaux" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
