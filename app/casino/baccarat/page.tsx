'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawBaccaratOutcome, resolveBaccarat, BACCARAT_PAYOUTS, CASINO_MIN_BET, type BaccaratBet, type BaccaratOutcome } from '@/lib/casino/baccarat';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, PlayingCard, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Tu ne joues pas les cartes : tu paries seulement sur qui va gagner.',
    'Deux mains sont distribuées — Joueur et Banque. Celle qui approche le plus de 9 gagne.',
    'Parie sur Joueur, Banque, ou Égalité. La Banque gagne un peu plus souvent (45,9% contre 44,6%), d’où la commission de 5% sur ses gains.',
    'Si tu paries Joueur ou Banque et que c’est une égalité, ta mise est remboursée.',
  ],
  payouts: [
    { label: 'Joueur', value: `×${BACCARAT_PAYOUTS.player}` },
    { label: 'Banque (commission 5%)', value: `×${BACCARAT_PAYOUTS.banker}` },
    { label: 'Égalité', value: `×${BACCARAT_PAYOUTS.tie}` },
  ],
  rtp: '~98,9% (Banque) · ~98,8% (Joueur) · ~85,7% (Égalité)',
};

const BETS: { value: BaccaratBet; label: string; hint: string }[] = [
  { value: 'player', label: 'Joueur', hint: '44,6%' },
  { value: 'banker', label: 'Banque', hint: '45,9%' },
  { value: 'tie', label: 'Égalité', hint: '9,5%' },
];
const LABEL: Record<BaccaratOutcome, string> = { player: 'Joueur', banker: 'Banque', tie: 'Égalité' };

export default function BaccaratPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [bet, setBet] = useState<BaccaratBet>('banker');
  const [playing, setPlaying] = useState(false);
  const [scores, setScores] = useState<{ player?: number; banker?: number }>({});
  const [result, setResult] = useState<(GenericBetResult & { outcome: BaccaratOutcome }) | null>(null);
  const [confetti, setConfetti] = useState(0);

  const handlePlay = async () => {
    if (playing) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setPlaying(true); setResult(null); setScores({});
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const r = await placeBet('baccarat', amount, { bet }, () => {
      const outcome = drawBaccaratOutcome();
      return { ...resolveBaccarat(outcome, bet), meta: { outcome, bet } };
    });

    if ('error' in r) { setPlaying(false); toast.error(r.error); return; }

    // Show baccarat totals (0-9) consistent with the outcome already drawn.
    const outcome: BaccaratOutcome = r.meta.outcome;
    let p: number, b: number;
    if (outcome === 'tie') { p = Math.floor(Math.random() * 10); b = p; }
    else {
      const hi = 1 + Math.floor(Math.random() * 9);
      const lo = Math.floor(Math.random() * hi);
      [p, b] = outcome === 'player' ? [hi, lo] : [lo, hi];
    }

    await new Promise((res) => setTimeout(res, tempo(200)));
    setScores({ player: p }); sfx.card();
    await new Promise((res) => setTimeout(res, tempo(260)));
    setScores({ player: p, banker: b }); sfx.reveal();
    await new Promise((res) => setTimeout(res, tempo(220)));

    setPlaying(false);
    setResult({ ...r, outcome });

    if (r.multiplier > 1) {
      vibrate(HAPTIC.SUCCESS);
      if (outcome === 'tie') { sfx.jackpot(); setConfetti((c) => c + 1); }
      else { sfx.win(); setConfetti((c) => c + 1); }
      toast.success(`${LABEL[outcome]} — +${fmt(r.payout)} ₶`);
    } else if (r.multiplier === 1) {
      vibrate(HAPTIC.WARNING); sfx.reveal();
      toast.info('Égalité — mise remboursée.');
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${LABEL[outcome]} — perdu`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'baccarat').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="w-full rounded-2xl border-4 border-brand-border p-6"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #1B5E3F 0%, #0E3524 70%, #0A2419 100%)' }}
      >
        <div className="flex items-center justify-around">
          {(['player', 'banker'] as const).map((side) => {
            const score = scores[side];
            const isWinner = result && result.outcome === side;
            return (
              <div key={side} className="flex flex-col items-center gap-2">
                <span className={cn('text-xs font-black uppercase tracking-widest', isWinner ? 'text-accent-primary' : 'text-white/60')}>
                  {side === 'player' ? 'Joueur' : 'Banque'}
                </span>
                <div className="flex gap-1">
                  <PlayingCard rank={score !== undefined ? Math.max(1, score) : undefined} hidden={score === undefined} index={side === 'player' ? 0 : 2} />
                  <PlayingCard rank={score !== undefined ? Math.max(1, 10 - score) : undefined} hidden={score === undefined} index={side === 'player' ? 1 : 3} />
                </div>
                <span className={cn(
                  'px-4 py-1 rounded-md font-display font-black text-2xl border-2',
                  isWinner ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-black/40 text-white border-white/25'
                )}>
                  {score !== undefined ? score : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {result?.outcome === 'tie' && (
          <div className="text-center mt-4 font-display font-black text-accent-primary tracking-widest">ÉGALITÉ</div>
        )}
      </div>

      <ResultBanner state={!result ? 'idle' : result.multiplier === 1 ? 'push' : result.multiplier > 1 ? 'win' : 'lose'}>
        {result && result.multiplier > 1 ? `${LABEL[result.outcome]} — +${fmt(result.payout)} ₶`
          : result?.multiplier === 1 ? 'Égalité — remboursé'
          : result ? `${LABEL[result.outcome]} — perdu` : ''}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton pari</div>
        <div className="space-y-2">
          {BETS.map((b) => (
            <button
              key={b.value}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBet(b.value); }}
              disabled={playing}
              className={cn(
                'w-full h-14 rounded-xl border-2 flex items-center justify-between px-4 font-bold transition-all focus:outline-none disabled:opacity-50',
                bet === b.value ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base/60'
              )}
            >
              <span>{b.label}<span className={cn('ml-2 text-[10px] font-bold', bet === b.value ? 'text-brand-bg/70' : 'text-tx-muted')}>{b.hint}</span></span>
              <span>×{BACCARAT_PAYOUTS[b.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={playing} />

      <PlayRow balance={balance} onClick={handlePlay} loading={playing} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {playing ? 'DISTRIBUTION...' : `PARIER · ${fmt(amount)} ₶`}
      </PlayRow>

      <p className="text-[11px] text-tx-muted">Sur Joueur ou Banque, une égalité rembourse ta mise.</p>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="baccarat" title="Frenly Baccarat" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
