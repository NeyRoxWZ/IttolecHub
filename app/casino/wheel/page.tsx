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
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import CasinoWheel, { type CasinoWheelHandle, type WheelSegment } from '../_components/CasinoWheel';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';
import { brawlChoice } from '@/lib/ui/brawl';

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

const COLOR_HEX = { red: '#FF3B5C', black: '#1A1D4A', green: '#1FB866' } as const;
/** The darker bottom edge of each pocket colour, for raised tiles. */
const COLOR_SHADE = { red: '#C8243F', black: '#0E1030', green: '#158A4B' } as const;

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
      toast.success(`${result.landedNumber} — +${fmt(result.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'wheel').slice(0, 10);
  const landedColor = lastResult ? getPocketColor(lastResult.landedNumber) : null;

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <CasinoWheel
        ref={wheelRef}
        segments={segments}
        size={420}
        settleMs={tempo(1100)}
        settleTurns={2}
        hub={
          <div
            className="w-[112px] h-[112px] rounded-full border-[5px] border-brand-border flex items-center justify-center font-display text-5xl text-stroke transition-colors duration-300"
            style={{
              background: landedColor && !spinning ? COLOR_HEX[landedColor] : '#0E1030',
              boxShadow: `inset 0 -7px 0 ${landedColor && !spinning ? COLOR_SHADE[landedColor] : '#05061A'}`,
            }}
          >
            {lastResult && !spinning ? lastResult.landedNumber : '?'}
          </div>
        }
      />

      <ResultBanner state={lastResult === null ? 'idle' : lastResult.won ? 'win' : 'lose'}>
        {lastResult?.won ? `×${lastResult.multiplier} — +${fmt(lastResult.payout)} ₶` : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="font-display text-lg leading-none mb-2">Type de pari</div>
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
              className={cn(brawlChoice(betType === t), 'h-14 flex flex-col items-center justify-center')}
            >
              <span className="text-base leading-none">{label}</span>
              <span className="text-sm leading-none mt-1 opacity-80">{mult}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="font-display text-lg leading-none mb-2">Ton pari</div>

        {betType === 'color' && (
          <div className="grid grid-cols-2 gap-3">
            {(['red', 'black'] as const).map((c) => (
              <button
                key={c}
                onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBetValue(c); }}
                disabled={spinning}
                className={cn(
                  'h-16 rounded-2xl border-[3px] border-brand-border flex flex-col items-center justify-center transition-transform active:translate-y-[3px] focus:outline-none disabled:opacity-50',
                  betValue === c && 'ring-4 ring-accent-primary scale-[1.03]'
                )}
                style={{ backgroundColor: COLOR_HEX[c], boxShadow: `inset 0 -5px 0 ${COLOR_SHADE[c]}, 0 4px 0 #05061A` }}
              >
                <span className="font-display text-2xl leading-none text-stroke-sm">{c === 'red' ? 'Rouge' : 'Noir'}</span>
                <span className="text-[11px] font-black text-white/80 mt-0.5">18 cases</span>
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
                className={cn(brawlChoice(betValue === d), 'h-16 flex flex-col items-center justify-center')}
              >
                <span className="text-lg leading-none">{d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36'}</span>
                <span className="text-[11px] leading-none mt-1 opacity-75">12 cases</span>
              </button>
            ))}
          </div>
        )}

        {betType === 'number' && (
          <div className="grid grid-cols-7 gap-1.5 p-1">
            {Array.from({ length: 37 }, (_, n) => n).map((n) => {
              const pocket = getPocketColor(n);
              return (
                <button
                  key={n}
                  onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBetValue(n); }}
                  disabled={spinning}
                  className={cn(
                    'h-10 rounded-lg font-display text-base text-white border-2 border-brand-border flex items-center justify-center transition-transform active:translate-y-[2px] focus:outline-none disabled:opacity-50',
                    betValue === n && 'ring-4 ring-accent-primary scale-110 z-10'
                  )}
                  style={{ backgroundColor: COLOR_HEX[pocket], boxShadow: `inset 0 -3px 0 ${COLOR_SHADE[pocket]}` }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={spinning} />

      <PlayRow balance={balance} onClick={handleSpin} loading={spinning} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {spinning ? 'ÇA TOURNE...' : `LANCER · ${fmt(amount)} ₶ (×${WHEEL_PAYOUTS[betType]})`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="wheel"
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
