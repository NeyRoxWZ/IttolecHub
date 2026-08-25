'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  generateMinePositions, multiplierAfterReveals,
  MINES_TOTAL_CELLS, MINES_MIN_COUNT, MINES_MAX_COUNT, CASINO_MIN_BET,
} from '@/lib/casino/mines';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
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
      toast.success(`Encaissé +${data.payout} ₶ à ×${multiplier}`);
      announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('mines', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${p} ₶ à ×${multiplier}`);
    }
  };

  const handleReset = () => {
    sfx.click();
    setPhase('idle'); setRevealed([]); setMinePositions(null);
    setHitCell(null); setMultiplier(1); setRoundId(null);
  };

  // Stake of the previous round, for the one-tap rebet chip.
  const lastBet = Number(history.find((h) => h.meta?.amount)?.meta?.amount) || undefined;
  const gameHistory = history.filter((h) => h.game_slug === 'mines').slice(0, 10);
  const finished = phase === 'busted' || phase === 'cashed';

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}
      <style jsx global>{`
        @keyframes minePop { 0% { transform: scale(0.3) rotate(-25deg); opacity: 0; } 60% { transform: scale(1.18) rotate(5deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes mineShake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
      `}</style>

      <div className="flex items-baseline gap-3">
        <span className={cn('font-display text-4xl font-black tabular-nums', phase === 'busted' ? 'text-accent-secondary' : 'text-accent-primary')}>
          ×{multiplier.toFixed(2)}
        </span>
        {active && revealed.length > 0 && (
          <span className="text-sm font-bold text-tx-secondary">
            = <CountUp value={potentialPayout} className="text-accent-success" /> ₶
          </span>
        )}
      </div>

      <div
        className={cn('grid grid-cols-5 gap-2.5 p-4 rounded-2xl border-4 border-brand-border', phase === 'busted' && 'animate-[mineShake_400ms_ease-out]')}
        style={{ background: 'linear-gradient(160deg, #16203A 0%, #0D1425 100%)' }}
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
                'w-[62px] h-[62px] sm:w-[74px] sm:h-[74px] rounded-xl border-2 flex items-center justify-center transition-all duration-200 focus:outline-none',
                isHit ? 'border-accent-secondary bg-accent-secondary/35'
                  : isMine ? 'border-accent-secondary/50 bg-accent-secondary/12'
                  : isRevealed ? 'border-accent-success bg-accent-success/18'
                  : active ? 'border-white/15 bg-white/[0.06] hover:bg-white/[0.14] hover:border-accent-primary hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                  : 'border-white/10 bg-white/[0.03]'
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
        <p className="text-xs text-tx-secondary font-bold">
          {revealed.length}/{maxSafe} cases sûres · prochaine ×{nextMultiplier}
        </p>
      )}

      <ResultBanner state={phase === 'busted' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'busted' ? 'Mine touchée — mise perdue' : `Encaissé +${potentialPayout} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!active ? (
        <>
          <BetControls lastBet={lastBet} amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black tracking-widest uppercase text-tx-muted">Mines</span>
              <span className="text-xs font-bold text-accent-primary">1<sup>re</sup> case ×{previewMultiplier}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[1, 3, 5, 10, 24].map((n) => (
                <button
                  key={n}
                  onClick={() => { sfx.select(); setMineCount(n); }}
                  className={cn(
                    'h-10 rounded-lg border-2 text-xs font-black transition-colors focus:outline-none',
                    mineCount === n ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base'
                  )}
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
            <p className="text-[11px] text-tx-muted mt-1">{mineCount} mine{mineCount > 1 ? 's' : ''} · {MINES_TOTAL_CELLS - mineCount} cases sûres</p>
          </div>

          <PlayButton onClick={phase === 'idle' ? handleStart : handleReset} loading={busy} disabled={!isLoaded || amount < CASINO_MIN_BET}>
            {phase === 'idle' ? `MISER · ${amount} ₶` : 'REJOUER'}
          </PlayButton>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-xl font-black">{lockedAmount} ₶</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mines</div>
              <div className="font-display text-xl font-black text-accent-secondary">{lockedMineCount}</div>
            </div>
          </div>

          <PlayButton onClick={handleCashout} disabled={busy || revealed.length === 0} variant="success">
            {revealed.length === 0 ? 'RETOURNE UNE CASE' : `ENCAISSER ${potentialPayout} ₶`}
          </PlayButton>

          <p className="text-[11px] text-tx-muted -mt-2">Clique les cases de la grille pour continuer.</p>
        </>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
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
