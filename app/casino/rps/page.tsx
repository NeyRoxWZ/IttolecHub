'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { houseMove, resolveRps, RPS_PAYOUT, CASINO_MIN_BET, type RpsMove } from '@/lib/casino/rps';
import {
  GameShell, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtRps } from '../_components/CasinoArt';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Place ta mise, puis choisis Pierre, Feuille ou Ciseaux.',
    'La maison joue en même temps, au hasard, sans voir ton coup.',
    'Pierre bat Ciseaux · Ciseaux bat Feuille · Feuille bat Pierre.',
    'En cas d’égalité, ta mise t’est intégralement remboursée.',
  ],
  payouts: [
    { label: 'Victoire', value: `×${RPS_PAYOUT}` },
    { label: 'Égalité', value: 'Mise remboursée' },
    { label: 'Défaite', value: 'Mise perdue' },
  ],
  rtp: '~96%',
};

const MOVES: { value: RpsMove; label: string }[] = [
  { value: 'pierre', label: 'Pierre' },
  { value: 'feuille', label: 'Feuille' },
  { value: 'ciseaux', label: 'Ciseaux' },
];

const nameOf = (m: RpsMove) => MOVES.find((x) => x.value === m)!.label;
type RpsResult = GenericBetResult & { outcome: 'win' | 'lose' | 'tie'; house: RpsMove; playerMove: RpsMove };

export default function RpsPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<RpsResult | null>(null);
  const [confetti, setConfetti] = useState(0);

  /** Auto throws at random — against a fair opponent it is the same odds. */
  const autoTick = () => {
    if (playing) return;
    void handlePlay(MOVES[Math.floor(Math.random() * MOVES.length)].value);
  };

  const handlePlay = async (move: RpsMove) => {
    if (playing) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setPlaying(true); setResult(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const [r] = await Promise.all([
      placeBet('rps', amount, { move }, () => {
        const house = houseMove();
        const res = resolveRps(move, house);
        return { won: res.won, multiplier: res.multiplier, meta: { house, playerMove: move, outcome: res.outcome } };
      }),
      // Three "shoot" beats before the reveal.
      (async () => {
        for (let i = 0; i < 3; i++) { sfx.tick(); vibrate(HAPTIC.SOFT); await new Promise((res) => setTimeout(res, tempo(150))); }
      })(),
    ]);

    setPlaying(false);
    if ('error' in r) { toast.error(r.error); return; }

    const full: RpsResult = { ...r, outcome: r.meta.outcome, house: r.meta.house, playerMove: r.meta.playerMove };
    setResult(full);

    if (full.outcome === 'win') {
      vibrate(HAPTIC.SUCCESS); sfx.win(); setConfetti((c) => c + 1);
      toast.success(`${nameOf(full.playerMove)} bat ${nameOf(full.house)} — +${full.payout} ₶`);
    } else if (full.outcome === 'tie') {
      vibrate(HAPTIC.WARNING); sfx.reveal();
      toast.info('Égalité — mise remboursée.');
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${nameOf(full.house)} bat ${nameOf(full.playerMove)} — perdu`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'rps').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-6">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}
      <style jsx global>{`
        @keyframes rpsShake { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-14px) rotate(-8deg); } }
        @keyframes rpsShakeMirror { 0%,100% { transform: translateY(0) rotate(0) scaleX(-1); } 50% { transform: translateY(-14px) rotate(8deg) scaleX(-1); } }
      `}</style>

      <div className="flex items-center justify-center gap-6 sm:gap-10">
        <div className="flex flex-col items-center gap-2">
          <div className="w-36 h-36 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center"
            style={{ animation: playing ? 'rpsShake 280ms ease-in-out infinite' : undefined }}>
            <ArtRps move={result ? result.playerMove : 'pierre'} size={70} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-tx-secondary">Toi</span>
        </div>

        <span className="font-display text-3xl font-black text-tx-muted">VS</span>

        <div className="flex flex-col items-center gap-2">
          <div className="w-36 h-36 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center"
            style={{ animation: playing ? 'rpsShakeMirror 280ms ease-in-out infinite' : undefined, transform: playing ? undefined : 'scaleX(-1)' }}>
            <ArtRps move={result ? result.house : 'pierre'} size={70} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-tx-secondary">Maison</span>
        </div>
      </div>

      <ResultBanner state={!result ? 'idle' : result.outcome === 'tie' ? 'push' : result.outcome === 'win' ? 'win' : 'lose'}>
        {result?.outcome === 'win' ? `Gagné +${result.payout} ₶` : result?.outcome === 'tie' ? 'Égalité — remboursé' : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={playing} />

      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton coup (×{RPS_PAYOUT} si tu gagnes)</div>
        <div className="grid grid-cols-3 gap-2">
          {MOVES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handlePlay(value)}
              disabled={playing || !isLoaded || amount < CASINO_MIN_BET}
              className={cn(
                'h-28 rounded-2xl border-4 border-brand-border bg-brand-inner flex flex-col items-center justify-center gap-1.5 font-bold text-sm transition-all focus:outline-none shadow-brutal',
                playing ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent-primary hover:-translate-y-1 active:translate-y-0'
              )}
            >
              <ArtRps move={value} size={44} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-tx-muted">L’égalité rembourse intégralement ta mise.</p>

      <PlayRow
        balance={balance}
        onClick={autoTick}
        onAuto={autoTick}
        loading={playing}
        disabled={!isLoaded || amount < CASINO_MIN_BET}
        blocked={amount > balance}
        betKey={amount}
      >
        {`COUP AU HASARD · ${amount} ₶`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="rps" title="Pierre-Feuille-Ciseaux" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
