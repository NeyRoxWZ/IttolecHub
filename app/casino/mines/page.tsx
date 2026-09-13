'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { brawlChoice } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  generateMinePositions, multiplierAfterReveals,
  MINES_TOTAL_CELLS, MINES_MIN_COUNT, MINES_MAX_COUNT, CASINO_MIN_BET,
} from '@/lib/casino/mines';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
  useAutoPlay, AutoBadge, AutoTargetField,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtGem, ArtBomb, ArtImpact } from '../_components/CasinoArt';

const RULES: RulesSpec = {
  howTo: [
    'Choisis ta mise et le nombre de mines cachées dans la grille de 25 cases.',
    'Retourne les cases une par une. Chaque case sûre fait monter ton multiplicateur.',
    'Plus tu mets de mines, plus chaque case sûre rapporte — mais plus le risque est grand.',
    'Encaisse quand tu veux pour repartir avec ta mise multipliée.',
    'Si tu tombes sur une mine, tu perds ta mise et toutes les positions sont révélées.',
  ],
  payouts: [
    { label: '3 mines · 1 case sûre', value: `×${multiplierAfterReveals(3, 1)}` },
    { label: '3 mines · 5 cases sûres', value: `×${multiplierAfterReveals(3, 5)}` },
    { label: '3 mines · 10 cases sûres', value: `×${multiplierAfterReveals(3, 10)}` },
    { label: '10 mines · 5 cases sûres', value: `×${multiplierAfterReveals(10, 5)}` },
  ],
  rtp: '~96%',
};

type Phase = 'idle' | 'active' | 'busted' | 'cashed';

export default function MinesPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, applyServerBalance, applyServerCashout, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [lockedMineCount, setLockedMineCount] = useState(3);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [minePositions, setMinePositions] = useState<number[] | null>(null);
  const [hitCell, setHitCell] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const active = phase === 'active';
  const potentialPayout = Math.round(lockedAmount * multiplier);
  const maxSafe = MINES_TOTAL_CELLS - lockedMineCount;
  const nextMultiplier = multiplierAfterReveals(lockedMineCount, revealed.length + 1);
  const previewMultiplier = multiplierAfterReveals(mineCount, 1);

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();

    if (user) {
      const res = await fetch('/api/casino/mines/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: { mineCount } }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      applyServerBalance('mines', data.newBalance, amount);
      setLockedAmount(amount); setLockedMineCount(mineCount);
      setRevealed([]); setMinePositions(null); setHitCell(null);
      setMultiplier(1); setPhase('active');
    } else {
      const result = startLocalBet('mines', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      setRoundId('local');
      setLockedAmount(amount); setLockedMineCount(mineCount);
      setRevealed([]); setMinePositions(generateMinePositions(mineCount)); setHitCell(null);
      setMultiplier(1); setPhase('active');
    }
  };

  const handleReveal = async (cellIndex: number) => {
    if (busy || !active || revealed.includes(cellIndex)) return;
    setBusy(true);

    if (user && roundId) {
      const res = await fetch('/api/casino/mines/step', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: { cellIndex } }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      if (!data.safe) {
        setHitCell(cellIndex); setMinePositions(data.minePositions); setPhase('busted');
        vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Boum ! Mine touchée.');
        announceProgression(data.progression);
        return;
      }
      setRevealed(data.revealed); setMultiplier(data.multiplier);
      vibrate(HAPTIC.SOFT); sfx.step(Math.min(8, data.revealed.length));
      if (data.allCleared) toast.success('Grille nettoyée ! Encaisse maintenant.');
    } else {
      const mines = minePositions!;
      setBusy(false);
      if (mines.includes(cellIndex)) {
        setHitCell(cellIndex); setPhase('busted');
        vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Boum ! Mine touchée.');
        return;
      }
      const next = [...revealed, cellIndex];
      setRevealed(next);
      setMultiplier(multiplierAfterReveals(lockedMineCount, next.length));
      vibrate(HAPTIC.SOFT); sfx.step(Math.min(8, next.length));
    }
  };

  const handleCashout = async () => {
    if (busy || !active || revealed.length === 0) return;
    setBusy(true); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/mines/cashout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      applyServerCashout('mines', data.newBalance, data.payout, multiplier);
      setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(data.payout)} ₶ à ×${multiplier}`);
      announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('mines', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(p)} ₶ à ×${multiplier}`);
    }
  };

  /** Auto opens random unopened tiles, then cashes out at a random target. */
  const [autoTarget, setAutoTarget] = useState(3);
  const autoTargetRef = useRef(0);

  const autoTick = () => {
    if (busy) return;
    if (phase === 'idle') {
      autoTargetRef.current = autoTarget;
      void handleStart();
      return;
    }
    if (phase === 'active') {
      if (revealed.length >= autoTargetRef.current) { void handleCashout(); return; }
      const free = Array.from({ length: MINES_TOTAL_CELLS }, (_, i) => i).filter((i) => !revealed.includes(i));
      if (free.length === 0) { void handleCashout(); return; }
      void handleReveal(free[Math.floor(Math.random() * free.length)]);
      return;
    }
    handleReset();
  };

  // The loop lives here, not in the button: this game swaps its panel once a
  // round starts, which used to unmount the button and kill auto mid-round.
  const autoCtl = useAutoPlay({
    run: autoTick,
    ready: isLoaded && !busy && amount >= CASINO_MIN_BET && amount <= balance,
    betKey: amount,
    balance,
  });

  const handleReset = () => {
    sfx.click();
    setPhase('idle'); setRevealed([]); setMinePositions(null);
    setHitCell(null); setMultiplier(1); setRoundId(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'mines').slice(0, 10);
  const finished = phase === 'busted' || phase === 'cashed';

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}
      <style jsx global>{`
        @keyframes minePop { 0% { transform: scale(0.3) rotate(-25deg); opacity: 0; } 60% { transform: scale(1.18) rotate(5deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes mineShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
      `}</style>

      <div className="flex items-center gap-3">
        <span className={cn(
          'font-display text-5xl leading-none tabular-nums [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]',
          phase === 'busted' ? 'text-accent-secondary' : 'text-accent-primary'
        )}>
          ×{multiplier.toFixed(2)}
        </span>
        {active && revealed.length > 0 && (
          <span className="px-3 py-1 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display text-lg">
            <CountUp value={potentialPayout} /> ₶
          </span>
        )}
      </div>

      <div
        className={cn('grid grid-cols-5 gap-2.5 p-4 rounded-[22px] border-4 border-brand-border', phase === 'busted' && 'animate-[mineShake_400ms_ease-out]')}
        style={{
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 16px, transparent 16px 32px), #0E1030',
          boxShadow: 'inset 0 -8px 0 #070920, 0 6px 0 #05061A',
        }}
      >
        {Array.from({ length: MINES_TOTAL_CELLS }, (_, i) => {
          const isRevealed = revealed.includes(i);
          const isMine = finished && minePositions?.includes(i);
          const isHit = hitCell === i;

          return (
            <button
              key={i}
              onClick={() => handleReveal(i)}
              disabled={!active || isRevealed || busy}
              className={cn(
                'w-[62px] h-[62px] sm:w-[74px] sm:h-[74px] rounded-2xl border-[3px] border-brand-border flex items-center justify-center transition-transform duration-150 focus:outline-none',
                isHit ? 'bg-accent-secondary shadow-[inset_0_-5px_0_#C92D63]'
                  : isMine ? 'bg-[#5A2346]'
                  : isRevealed ? 'bg-accent-success shadow-[inset_0_-5px_0_#1E9A55]'
                  : active ? 'bg-accent-info shadow-[inset_0_-5px_0_#2F5BD0,0_4px_0_#05061A] hover:-translate-y-0.5 active:translate-y-[3px] cursor-pointer'
                  : 'bg-[#1A1D4A] shadow-[inset_0_-5px_0_#12143A]'
              )}
            >
              {isHit ? <span style={{ animation: 'minePop 300ms ease-out' }}><ArtImpact size={38} /></span>
                : isMine ? <span className="opacity-55"><ArtBomb size={34} /></span>
                : isRevealed ? <span style={{ animation: 'minePop 260ms ease-out' }}><ArtGem size={34} /></span>
                : null}
            </button>
          );
        })}
      </div>

      {active && (
        <p className="px-3 py-1 rounded-xl border-2 border-brand-border bg-[#0E1030] font-display text-base text-white">
          {revealed.length}/{maxSafe} cases sûres · prochaine <span className="text-accent-primary">×{nextMultiplier}</span>
        </p>
      )}

      <ResultBanner state={phase === 'busted' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'busted' ? 'Mine touchée — mise perdue' : `Encaissé +${fmt(potentialPayout)} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!active ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-lg leading-none">Mines</span>
              <span className="font-display text-sm text-accent-primary">1<sup>re</sup> case ×{previewMultiplier}</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {[1, 3, 5, 10, 24].map((n) => (
                <button
                  key={n}
                  onClick={() => { sfx.select(); setMineCount(n); }}
                  className={cn(brawlChoice(mineCount === n), 'h-11 text-lg')}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="range" min={MINES_MIN_COUNT} max={MINES_MAX_COUNT} value={mineCount}
              onChange={(e) => setMineCount(Number(e.target.value))}
              className="w-full accent-accent-primary"
            />
            <p className="text-xs font-black text-tx-secondary mt-1">{mineCount} mine{mineCount > 1 ? 's' : ''} · {MINES_TOTAL_CELLS - mineCount} cases sûres</p>
          </div>

          <PlayRow
            balance={balance}
            onClick={phase === 'idle' ? handleStart : handleReset}
            onAuto={autoTick}
            control={autoCtl}
            autoExtra={
              <AutoTargetField
                label="Encaisse à"
                value={autoTarget}
                onChange={setAutoTarget}
                min={1} max={MINES_TOTAL_CELLS - mineCount} step={1} suffix="cases"
              />
            }
            loading={busy}
            disabled={!isLoaded || amount < CASINO_MIN_BET}
            blocked={amount > balance}
            betKey={amount}
          >
            {phase === 'idle' ? `MISER · ${fmt(amount)} ₶` : 'REJOUER'}
          </PlayRow>
        </>
      ) : (
        <>
          {/* Mid-round the play button is gone, so this is the only way out
              of an auto run before it finishes. */}
          <AutoBadge control={autoCtl} className="w-full justify-center" />

          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-2xl leading-none mt-0.5">{fmt(lockedAmount)} ₶</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">Mines</div>
              <div className="font-display text-2xl leading-none mt-0.5 text-accent-secondary">{lockedMineCount}</div>
            </div>
          </div>

          <PlayButton onClick={handleCashout} disabled={busy || revealed.length === 0} variant="success">
            {revealed.length === 0 ? 'RETOURNE UNE CASE' : `ENCAISSER ${fmt(potentialPayout)} ₶`}
          </PlayButton>

          <p className="text-[11px] text-tx-muted -mt-2">Clique les cases de la grille pour continuer.</p>
        </>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="mines"
      title="Frenly Mines"
      rules={RULES}
      balance={balance}
      isLoaded={isLoaded}
      isLocal={isLocal}
      streak={stats.currentStreak}
      level={stats.level}
      xpIntoLevel={stats.xpIntoLevel}
      xpForNext={stats.xpForNext}
      stage={stage}
      panel={panel}
    />
  );
}
