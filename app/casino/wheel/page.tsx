'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type WheelSpinResult } from '@/hooks/useCasinoWallet';
import {
  WHEEL_ORDER, WHEEL_PAYOUTS, getPocketColor, CASINO_MIN_BET,
  type WheelBet, type WheelBetType,
} from '@/lib/casino/wheel';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import CasinoWheel, { type CasinoWheelHandle, type WheelSegment } from '../_components/CasinoWheel';
import Confetti from '../_components/Confetti';

const RULES: RulesSpec = {
  howTo: [
    'La roue compte 37 cases : 1 à 36, plus un zéro vert.',
    'Choisis ton type de pari : une couleur, une douzaine, ou un numéro plein.',
    'Place ta mise et lance la roue.',
    'Si la bille s’arrête sur une case couverte par ton pari, tu es payé selon le tableau.',
    'Le zéro vert ne fait gagner ni le rouge, ni le noir, ni aucune douzaine.',
  ],
  payouts: [
    { label: 'Couleur (rouge / noir) — 18 cases', value: '×2' },
    { label: 'Douzaine (1-12, 13-24, 25-36)', value: '×3' },
    { label: 'Numéro plein — 1 case', value: '×36' },
  ],
  rtp: '~97,3%',
};

const COLOR_HEX = { red: '#E01E45', black: '#0F0F16', green: '#0F9D58' } as const;

export default function FrenlyWheelPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, spinWheelBet, history } = useCasinoWallet();
  const wheelRef = useRef<CasinoWheelHandle>(null);

  const [betType, setBetType] = useState<WheelBetType>('color');
  const [betValue, setBetValue] = useState<any>('red');
  const [amount, setAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<WheelSpinResult | null>(null);
  const [confetti, setConfetti] = useState(0);

  const segments: WheelSegment[] = useMemo(
    () => WHEEL_ORDER.map((n) => {
      const color = getPocketColor(n);
      return { label: String(n), color: COLOR_HEX[color], textColor: '#fff' };
    }),
    []
  );

  const handleSpin = async () => {
    if (spinning) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setSpinning(true); setLastResult(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();
    wheelRef.current?.startSpin();

    const bet: WheelBet = { type: betType, value: betValue };
    const result = await spinWheelBet(bet, amount);

    if ('error' in result) {
      wheelRef.current?.stop();
      setSpinning(false);
      toast.error(result.error);
      return;
    }

    await wheelRef.current?.settleOn(WHEEL_ORDER.indexOf(result.landedNumber));

    setLastResult(result);
    setSpinning(false);

    if (result.won) {
      vibrate(HAPTIC.SUCCESS);
      if (result.multiplier >= 10) { sfx.bigWin(); setConfetti((c) => c + 1); }
      else sfx.win();
      toast.success(`${result.landedNumber} — +${result.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
    }
  };

  // Stake of the previous round, for the one-tap rebet chip.
  const lastBet = Number(history.find((h) => h.meta?.amount)?.meta?.amount) || undefined;
  const gameHistory = history.filter((h) => h.game_slug === 'wheel').slice(0, 10);
  const landedColor = lastResult ? getPocketColor(lastResult.landedNumber) : null;

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <CasinoWheel
        ref={wheelRef}
        segments={segments}
        size={420}
        settleMs={2000}
        hub={
          <div
            className="w-[104px] h-[104px] rounded-full border-4 border-brand-border flex items-center justify-center font-display font-black text-4xl transition-colors duration-300"
            style={{
              background: landedColor && !spinning ? COLOR_HEX[landedColor] : '#1E1E28',
              color: '#fff',
            }}
          >
            {lastResult && !spinning ? lastResult.landedNumber : '—'}
          </div>
        }
      />

      <ResultBanner state={lastResult === null ? 'idle' : lastResult.won ? 'win' : 'lose'}>
        {lastResult?.won ? `×${lastResult.multiplier} — +${lastResult.payout} ₶` : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Type de pari</div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { t: 'color' as const, label: 'Couleur', mult: '×2' },
            { t: 'dozen' as const, label: 'Douzaine', mult: '×3' },
            { t: 'number' as const, label: 'Numéro', mult: '×36' },
          ]).map(({ t, label, mult }) => (
            <button
              key={t}
              onClick={() => {
                sfx.select(); vibrate(HAPTIC.SOFT);
                setBetType(t);
                setBetValue(t === 'color' ? 'red' : t === 'dozen' ? 1 : 0);
              }}
              disabled={spinning}
              className={cn(
                'h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all focus:outline-none disabled:opacity-50',
                betType === t ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border hover:border-tx-base/50'
              )}
            >
              <span className="text-xs font-bold">{label}</span>
              <span className="text-[10px] font-black text-accent-primary">{mult}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton pari</div>

        {betType === 'color' && (
          <div className="grid grid-cols-2 gap-2">
            {(['red', 'black'] as const).map((c) => (
              <button
                key={c}
                onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBetValue(c); }}
                disabled={spinning}
                className={cn(
                  'h-16 rounded-xl font-display font-black border-4 transition-all focus:outline-none disabled:opacity-50',
                  betValue === c ? 'border-accent-primary scale-[1.02]' : 'border-brand-border'
                )}
                style={{ backgroundColor: COLOR_HEX[c], color: '#fff' }}
              >
                {c === 'red' ? 'ROUGE' : 'NOIR'}
                <div className="text-[9px] font-bold opacity-70">18 cases</div>
              </button>
            ))}
          </div>
        )}

        {betType === 'dozen' && (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBetValue(d); }}
                disabled={spinning}
                className={cn(
                  'h-16 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-sm transition-all focus:outline-none disabled:opacity-50',
                  betValue === d ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary'
                )}
              >
                {d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36'}
                <span className="text-[9px] opacity-60">12 cases</span>
              </button>
            ))}
          </div>
        )}

        {betType === 'number' && (
          <div className="grid grid-cols-7 gap-1 p-1">
            {Array.from({ length: 37 }, (_, n) => n).map((n) => (
              <button
                key={n}
                onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBetValue(n); }}
                disabled={spinning}
                className={cn(
                  'h-10 rounded-md font-bold text-sm border-2 flex items-center justify-center transition-all focus:outline-none disabled:opacity-50',
                  betValue === n ? 'border-accent-primary scale-110 z-10' : 'border-black/40'
                )}
                style={{ backgroundColor: COLOR_HEX[getPocketColor(n)], color: '#fff' }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <BetControls lastBet={lastBet} amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={spinning} />

      <PlayButton onClick={handleSpin} loading={spinning} disabled={!isLoaded || amount < CASINO_MIN_BET}>
        {spinning ? 'ÇA TOURNE...' : `LANCER · ${amount} ₶ (×${WHEEL_PAYOUTS[betType]})`}
      </PlayButton>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      title="Frenly Wheel"
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
