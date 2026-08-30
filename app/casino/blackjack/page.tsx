'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  drawCard, dealerPlay, resolveHand, computeHandValue, isBlackjack,
  type BlackjackOutcome, CASINO_MIN_BET,
} from '@/lib/casino/blackjack';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, PlayingCard, ResultBanner, HistoryStrip,
  type RulesSpec,
  useAutoPlay, AutoBadge,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

type Phase = 'idle' | 'dealing' | 'playing' | 'finished';

const RULES: RulesSpec = {
  howTo: [
    'Choisis ta mise puis distribue. Tu reçois 2 cartes, le croupier 2 (dont une cachée).',
    'Le but : t’approcher de 21 sans dépasser. Au-delà de 21 tu perds immédiatement.',
    'Valeurs : les figures (V, D, R) valent 10, l’As vaut 11 ou 1 (au mieux pour toi), les autres leur chiffre.',
    'Tire autant de cartes que tu veux, ou reste. Le croupier tire ensuite jusqu’à atteindre 17 minimum.',
    'Doubler : uniquement sur tes 2 premières cartes — tu doubles la mise et reçois une seule carte de plus.',
  ],
  payouts: [
    { label: 'Victoire simple', value: '×2' },
    { label: 'Blackjack (21 en 2 cartes)', value: '×2,5' },
    { label: 'Égalité', value: 'Mise remboursée' },
  ],
  rtp: '~98%',
};

const DEAL_STEP_MS = 130;

export default function BlackjackPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, applyServerBalance, applyServerCashout, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [playerCards, setPlayerCards] = useState<number[]>([]);
  const [dealerCards, setDealerCards] = useState<number[]>([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [outcome, setOutcome] = useState<BlackjackOutcome | null>(null);
  const [payout, setPayout] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const localDealerRef = useRef<number[]>([]);

  const playerHand = computeHandValue(playerCards);
  const dealerVisible = dealerHidden ? dealerCards.slice(0, 1) : dealerCards;
  const dealerHand = computeHandValue(dealerVisible);
  const canDouble = phase === 'playing' && playerCards.length === 2 && lockedAmount <= balance;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, tempo(ms)));

  /** Deal cards one at a time so it reads like a real table. */
  const animateDeal = useCallback(async (pCards: number[], dUp: number) => {
    setPlayerCards([]); setDealerCards([]);
    for (let i = 0; i < 2; i++) {
      await sleep(DEAL_STEP_MS);
      setPlayerCards(pCards.slice(0, i + 1));
      sfx.card();
      if (i === 0) {
        await sleep(DEAL_STEP_MS);
        setDealerCards([dUp]);
        sfx.card();
      }
    }
    await sleep(DEAL_STEP_MS);
  }, []);

  const announceOutcome = (o: BlackjackOutcome, p: number) => {
    if (o === 'blackjack') { vibrate(HAPTIC.SUCCESS); sfx.bigWin(); setConfetti((c) => c + 1); toast.success(`Blackjack ! +${fmt(p)} ₶`); }
    else if (o === 'win') { vibrate(HAPTIC.SUCCESS); sfx.win(); toast.success(`Gagné +${fmt(p)} ₶`); }
    else if (o === 'push') { vibrate(HAPTIC.WARNING); sfx.reveal(); toast.info('Égalité — mise remboursée.'); }
    else { vibrate(HAPTIC.ERROR); sfx.lose(); toast.error('Perdu.'); }
  };

  const handleDeal = async () => {
    if (busy || amount > balance) { if (amount > balance) toast.error('Solde insuffisant.'); return; }
    setBusy(true); setOutcome(null); setPayout(0); setDealerHidden(true);
    vibrate(HAPTIC.MEDIUM); sfx.bet();
    setPhase('dealing');

    if (user) {
      const res = await fetch('/api/casino/blackjack/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); setPhase('idle'); toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId); setLockedAmount(amount);
      applyServerBalance('blackjack', data.newBalance, amount);
      await animateDeal(data.playerCards, data.finished ? data.dealerCards[0] : data.dealerUpCard);
      setBusy(false);

      if (data.finished) {
        setDealerCards(data.dealerCards); setDealerHidden(false); sfx.reveal();
        setOutcome(data.outcome); setPhase('finished');
        const p = data.multiplier > 0 ? Math.round(amount * data.multiplier) : 0;
        setPayout(p); announceOutcome(data.outcome, p);
        announceProgression(data.progression);
      } else {
        setPhase('playing');
      }
    } else {
      const result = startLocalBet('blackjack', amount);
      if ('error' in result) { setBusy(false); setPhase('idle'); toast.error(result.error); return; }
      const pCards = [drawCard(), drawCard()];
      const dCards = [drawCard(), drawCard()];
      localDealerRef.current = dCards;
      setRoundId('local'); setLockedAmount(amount);
      await animateDeal(pCards, dCards[0]);
      setBusy(false);

      if (isBlackjack(pCards) || isBlackjack(dCards)) finishLocal(dCards, pCards, amount);
      else setPhase('playing');
    }
  };

  const finishLocal = (finalDealer: number[], finalPlayer: number[], effectiveAmount: number) => {
    const { outcome: o, multiplier } = resolveHand(finalPlayer, finalDealer);
    setDealerCards(finalDealer); setDealerHidden(false); sfx.reveal();
    setOutcome(o); setPhase('finished');
    const p = multiplier > 0 ? Math.round(effectiveAmount * multiplier) : 0;
    if (multiplier > 0) creditLocal('blackjack', p, multiplier);
    setPayout(p);
    announceOutcome(o, p);
  };

  const handleHit = async () => {
    if (busy || phase !== 'playing') return;
    setBusy(true); vibrate(HAPTIC.SOFT); sfx.card();

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/hit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setPlayerCards(data.playerCards);
      if (data.busted) {
        setDealerCards(data.dealerCards); setDealerHidden(false);
        setOutcome('lose'); setPhase('finished');
        vibrate(HAPTIC.ERROR); sfx.bust(); toast.error(`${data.playerTotal} — dépassé !`);
        announceProgression(data.progression);
      }
    } else {
      const newCards = [...playerCards, drawCard()];
      setBusy(false); setPlayerCards(newCards);
      const total = computeHandValue(newCards).total;
      if (total > 21) {
        setDealerCards(localDealerRef.current); setDealerHidden(false);
        setOutcome('lose'); setPhase('finished');
        vibrate(HAPTIC.ERROR); sfx.bust(); toast.error(`${total} — dépassé !`);
      }
    }
  };

  const handleStand = async () => {
    if (busy || phase !== 'playing') return;
    setBusy(true); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/stand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); toast.error(data.error || 'Erreur'); return; }
      await revealDealer(data.dealerCards);
      setBusy(false);
      setOutcome(data.outcome); setPhase('finished');
      const p = data.multiplier > 0 ? Math.round(lockedAmount * data.multiplier) : 0;
      setPayout(p); announceOutcome(data.outcome, p);
      announceProgression(data.progression);
    } else {
      const fullDealer = dealerPlay(localDealerRef.current);
      await revealDealer(fullDealer);
      setBusy(false);
      finishLocal(fullDealer, playerCards, lockedAmount);
    }
  };

  /** Flip the hole card, then draw the dealer's extra cards one by one. */
  const revealDealer = async (finalDealer: number[]) => {
    setDealerHidden(false);
    setDealerCards(finalDealer.slice(0, 2));
    sfx.reveal();
    await sleep(240);
    for (let i = 2; i < finalDealer.length; i++) {
      setDealerCards(finalDealer.slice(0, i + 1));
      sfx.card();
      await sleep(DEAL_STEP_MS);
    }
  };

  const handleDouble = async () => {
    if (busy || !canDouble) return;
    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/double', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); toast.error(data.error || 'Erreur'); return; }
      const doubled = lockedAmount * 2;
      setPlayerCards(data.playerCards); setLockedAmount(doubled); sfx.card();

      if (data.busted) {
        setDealerCards(data.dealerCards || dealerCards); setDealerHidden(false);
        setOutcome('lose'); setPhase('finished'); setBusy(false);
        vibrate(HAPTIC.ERROR); sfx.bust(); toast.error(`${data.playerTotal} — dépassé !`);
      } else {
        await revealDealer(data.dealerCards);
        setBusy(false);
        setOutcome(data.outcome); setPhase('finished');
        const p = data.multiplier > 0 ? Math.round(doubled * data.multiplier) : 0;
        setPayout(p); announceOutcome(data.outcome, p);
      }
      announceProgression(data.progression);
    } else {
      const r = startLocalBet('blackjack', lockedAmount);
      if ('error' in r) { setBusy(false); toast.error(r.error); return; }
      const doubled = lockedAmount * 2;
      const newCards = [...playerCards, drawCard()];
      setLockedAmount(doubled); setPlayerCards(newCards); sfx.card();

      if (computeHandValue(newCards).total > 21) {
        setDealerCards(localDealerRef.current); setDealerHidden(false);
        setOutcome('lose'); setPhase('finished'); setBusy(false);
        vibrate(HAPTIC.ERROR); sfx.bust(); toast.error('Dépassé !');
      } else {
        const fullDealer = dealerPlay(localDealerRef.current);
        await revealDealer(fullDealer);
        setBusy(false);
        finishLocal(fullDealer, newCards, doubled);
      }
    }
  };

  /**
   * Auto plays the textbook line: hit under 17, stand at 17 or more. Nothing
   * clever, but it is what a distracted player does anyway.
   */
  const autoTick = () => {
    if (busy) return;
    if (phase === 'idle') { void handleDeal(); return; }
    if (phase === 'playing') {
      if (playerHand.total < 17) void handleHit();
      else void handleStand();
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
    setPhase('idle'); setPlayerCards([]); setDealerCards([]);
    setDealerHidden(true); setOutcome(null); setPayout(0); setRoundId(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'blackjack').slice(0, 10);
  const bannerState = outcome === null ? 'idle' : outcome === 'push' ? 'push' : (outcome === 'win' || outcome === 'blackjack') ? 'win' : 'lose';

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      {/* Felt table */}
      <div
        className="w-full rounded-3xl border-4 border-brand-border p-6 flex flex-col gap-7"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #1B5E3F 0%, #0E3524 70%, #0A2419 100%)' }}
      >
        {/* Dealer */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Croupier</span>
            {dealerVisible.length > 0 && (
              <span className={cn(
                'px-2.5 py-1 rounded-md font-display font-black text-lg border-2',
                dealerHand.total > 21 ? 'bg-accent-secondary text-white border-accent-secondary' : 'bg-black/40 text-white border-white/25'
              )}>
                {dealerHand.total}{dealerHidden && ' + ?'}
              </span>
            )}
          </div>
          <div className="flex gap-2.5 min-h-[110px] items-center">
            {dealerCards.map((c, i) => (
              <PlayingCard key={`d${i}`} rank={c} index={i} />
            ))}
            {dealerHidden && dealerCards.length > 0 && <PlayingCard hidden index={99} />}
          </div>
        </div>

        <div className="h-px bg-white/15" />

        {/* Player */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2.5 min-h-[110px] items-center flex-wrap justify-center">
            {playerCards.map((c, i) => (
              <PlayingCard key={`p${i}`} rank={c} index={i} highlight={phase === 'finished' && (outcome === 'win' || outcome === 'blackjack')} />
            ))}
            {playerCards.length === 0 && <span className="text-white/35 text-sm font-bold">Mise puis distribue</span>}
          </div>
          <div className="flex items-center gap-2">
            {playerCards.length > 0 && (
              <span className={cn(
                'px-3 py-1 rounded-md font-display font-black text-2xl border-2',
                playerHand.total > 21 ? 'bg-accent-secondary text-white border-accent-secondary'
                  : playerHand.total === 21 ? 'bg-accent-success text-brand-bg border-accent-success'
                  : 'bg-black/40 text-white border-white/25'
              )}>
                {playerHand.total}
                {playerHand.soft && playerHand.total <= 21 && <span className="text-[10px] font-bold opacity-70 ml-1">souple</span>}
              </span>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Toi</span>
          </div>
        </div>
      </div>

      <ResultBanner state={bannerState}>
        {outcome === 'blackjack' ? `BLACKJACK — +${fmt(payout)} ₶`
          : outcome === 'win' ? `Gagné +${fmt(payout)} ₶`
          : outcome === 'push' ? 'Égalité — remboursé'
          : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {phase === 'idle' || phase === 'finished' ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayRow
            balance={balance}
            onClick={phase === 'idle' ? handleDeal : handleReset}
            onAuto={autoTick}
            control={autoCtl}
            loading={busy}
            disabled={!isLoaded || amount < CASINO_MIN_BET}
            blocked={amount > balance}
            betKey={amount}
          >
            {phase === 'idle' ? `DISTRIBUER · ${fmt(amount)} ₶` : 'REJOUER'}
          </PlayRow>
        </>
      ) : (
        <>
          {/* Mid-round the play button is gone, so this is the only way out
              of an auto run before it finishes. */}
          <AutoBadge control={autoCtl} className="w-full justify-center" />

          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise en jeu</div>
            <div className="font-display text-2xl font-black text-accent-primary">{fmt(lockedAmount)} ₶</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PlayButton onClick={handleHit} disabled={busy || phase !== 'playing'} className="h-14 text-base">TIRER</PlayButton>
            <PlayButton onClick={handleStand} disabled={busy || phase !== 'playing'} variant="success" className="h-14 text-base">RESTER</PlayButton>
          </div>

          <button
            onClick={handleDouble}
            disabled={busy || !canDouble}
            className={cn(
              'h-12 rounded-xl border-2 font-display font-black text-sm transition-all focus:outline-none',
              canDouble && !busy
                ? 'border-accent-primary bg-brand-inner text-accent-primary hover:bg-accent-primary hover:text-brand-bg'
                : 'border-brand-border bg-brand-inner text-tx-muted cursor-not-allowed'
            )}
          >
            DOUBLER (+{fmt(lockedAmount)} ₶)
          </button>
          {!canDouble && phase === 'playing' && (
            <p className="text-[11px] text-tx-muted -mt-3">Doubler n’est possible que sur tes 2 premières cartes.</p>
          )}
        </>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="blackjack"
      title="Frenly 21"
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
