'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { drawCard, dealerPlay, resolveHand, computeHandValue, isBlackjack, type BlackjackOutcome, CASINO_MIN_BET } from '@/lib/casino/blackjack';

const CARD_LABEL = (n: number) => (n === 1 ? 'A' : n === 11 ? 'J' : n === 12 ? 'Q' : n === 13 ? 'K' : String(n));
type Phase = 'idle' | 'playing' | 'finished';

export default function BlackjackPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, startLocalBet, creditLocal, refresh, history } = useCasinoWallet();

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
  const localDealerHoleRef = useRef<number[]>([]); // anon-mode only: real dealer hand kept out of render until reveal

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));
  const playerTotal = computeHandValue(playerCards).total;
  const dealerTotal = computeHandValue(dealerCards).total;
  const canDouble = phase === 'playing' && playerCards.length === 2;

  const finishLocal = (finalDealer: number[], finalPlayerCards: number[], effectiveAmount: number) => {
    const { outcome: o, multiplier } = resolveHand(finalPlayerCards, finalDealer);
    setDealerCards(finalDealer);
    setDealerHidden(false);
    setOutcome(o);
    setPhase('finished');
    if (multiplier > 0) {
      const p = Math.round(effectiveAmount * multiplier);
      creditLocal('blackjack', p, multiplier);
      setPayout(p);
    } else {
      setPayout(0);
    }
    announceOutcome(o, multiplier > 0 ? Math.round(effectiveAmount * multiplier) : 0);
  };

  const announceOutcome = (o: BlackjackOutcome, p: number) => {
    if (o === 'blackjack') { vibrate(HAPTIC.SUCCESS); toast.success(`Blackjack ! +${p} ₶`); }
    else if (o === 'win') { vibrate(HAPTIC.SUCCESS); toast.success(`Gagné +${p} ₶`); }
    else if (o === 'push') { vibrate(HAPTIC.WARNING); toast.info('Égalité — remboursé.'); }
    else { vibrate(HAPTIC.ERROR); toast.error('Perdu.'); }
  };

  const handleDeal = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setBusy(true);
    vibrate(HAPTIC.MEDIUM);
    setOutcome(null);
    setPayout(0);

    if (user) {
      const res = await fetch('/api/casino/blackjack/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      setLockedAmount(amount);
      setPlayerCards(data.playerCards);
      await refresh();

      if (data.finished) {
        setDealerCards(data.dealerCards);
        setDealerHidden(false);
        setOutcome(data.outcome);
        setPayout(data.multiplier > 0 ? Math.round(amount * data.multiplier) : 0);
        setPhase('finished');
        announceOutcome(data.outcome, data.multiplier > 0 ? Math.round(amount * data.multiplier) : 0);
      } else {
        setDealerCards([data.dealerUpCard]);
        setDealerHidden(true);
        setPhase('playing');
      }
    } else {
      const result = startLocalBet('blackjack', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }

      const pCards = [drawCard(), drawCard()];
      const dCards = [drawCard(), drawCard()];
      setRoundId('local');
      setLockedAmount(amount);
      setPlayerCards(pCards);

      if (isBlackjack(pCards) || isBlackjack(dCards)) {
        finishLocal(dCards, pCards, amount);
      } else {
        setDealerCards([dCards[0]]);
        setDealerHidden(true);
        setPhase('playing');
        // stash the real dealer hand for later reveal
        localDealerHoleRef.current = dCards;
      }
    }
  };

  const handleHit = async () => {
    if (busy || phase !== 'playing') return;
    setBusy(true);
    vibrate(HAPTIC.SOFT);

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setPlayerCards(data.playerCards);
      if (data.busted) {
        setDealerCards(data.dealerCards);
        setDealerHidden(false);
        setOutcome('lose');
        setPhase('finished');
        vibrate(HAPTIC.ERROR);
        toast.error('Perdu (dépassé 21).');
      }
    } else {
      const newCards = [...playerCards, drawCard()];
      setBusy(false);
      setPlayerCards(newCards);
      if (computeHandValue(newCards).total > 21) {
        setDealerCards(localDealerHoleRef.current.length ? localDealerHoleRef.current : dealerCards);
        setDealerHidden(false);
        setOutcome('lose');
        setPhase('finished');
        vibrate(HAPTIC.ERROR);
        toast.error('Perdu (dépassé 21).');
      }
    }
  };

  const handleStand = async () => {
    if (busy || phase !== 'playing') return;
    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/stand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setDealerCards(data.dealerCards);
      setDealerHidden(false);
      setOutcome(data.outcome);
      setPhase('finished');
      const p = data.multiplier > 0 ? Math.round(lockedAmount * data.multiplier) : 0;
      setPayout(p);
      announceOutcome(data.outcome, p);
      if (data.newBalance !== undefined) await refresh();
    } else {
      const fullDealer = dealerPlay(localDealerHoleRef.current.length ? localDealerHoleRef.current : dealerCards);
      setBusy(false);
      finishLocal(fullDealer, playerCards, lockedAmount);
    }
  };

  const handleDouble = async () => {
    if (busy || !canDouble) return;
    if (lockedAmount > balance) { toast.error('Solde insuffisant pour doubler.'); return; }
    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/blackjack/double', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setPlayerCards(data.playerCards);
      setLockedAmount(lockedAmount * 2);
      await refresh();
      if (data.busted) {
        setDealerCards(data.dealerCards || dealerCards);
        setDealerHidden(false);
        setOutcome('lose');
        setPhase('finished');
        vibrate(HAPTIC.ERROR);
        toast.error('Perdu (dépassé 21).');
      } else {
        setDealerCards(data.dealerCards);
        setDealerHidden(false);
        setOutcome(data.outcome);
        setPhase('finished');
        const p = data.multiplier > 0 ? Math.round(lockedAmount * 2 * data.multiplier) : 0;
        setPayout(p);
        announceOutcome(data.outcome, p);
      }
    } else {
      const result = startLocalBet('blackjack', lockedAmount);
      if ('error' in result) { setBusy(false); toast.error(result.error); return; }
      const newAmount = lockedAmount * 2;
      const newCards = [...playerCards, drawCard()];
      setLockedAmount(newAmount);
      setPlayerCards(newCards);
      setBusy(false);
      if (computeHandValue(newCards).total > 21) {
        setDealerCards(localDealerHoleRef.current.length ? localDealerHoleRef.current : dealerCards);
        setDealerHidden(false);
        setOutcome('lose');
        setPhase('finished');
        vibrate(HAPTIC.ERROR);
        toast.error('Perdu (dépassé 21).');
      } else {
        const fullDealer = dealerPlay(localDealerHoleRef.current.length ? localDealerHoleRef.current : dealerCards);
        finishLocal(fullDealer, newCards, newAmount);
      }
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setDealerHidden(true);
    setOutcome(null);
    setPayout(0);
    setRoundId(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'blackjack').slice(0, 12);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly 21</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TABLE */}
          <div className="flex flex-col justify-center gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-tx-secondary">Croupier</span>
                {!dealerHidden && <span className="text-xs font-bold text-tx-base">{dealerTotal}</span>}
              </div>
              <div className="flex gap-2">
                {dealerCards.map((c, i) => (
                  <div key={i} className="w-12 h-16 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center font-display font-black text-lg">
                    {CARD_LABEL(c)}
                  </div>
                ))}
                {dealerHidden && phase === 'playing' && (
                  <div className="w-12 h-16 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center text-tx-muted">?</div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-tx-secondary">Toi</span>
                {playerCards.length > 0 && <span className="text-xs font-bold text-tx-base">{playerTotal}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {playerCards.map((c, i) => (
                  <div key={i} className="w-12 h-16 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center font-display font-black text-lg animate-in zoom-in duration-150">
                    {CARD_LABEL(c)}
                  </div>
                ))}
              </div>
            </div>

            <div className="h-10 flex items-center">
              {phase === 'finished' && outcome && (
                <div className={cn(
                  'px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200',
                  outcome === 'push' ? 'border-tx-secondary text-tx-secondary bg-brand-inner' :
                  (outcome === 'win' || outcome === 'blackjack') ? 'border-accent-success text-accent-success bg-accent-success/10' :
                  'border-accent-secondary text-accent-secondary bg-accent-secondary/10'
                )}>
                  {outcome === 'blackjack' ? `Blackjack ! +${payout} ₶` : outcome === 'win' ? `Gagné +${payout} ₶` : outcome === 'push' ? 'Remboursé' : 'Perdu'}
                </div>
              )}
            </div>
          </div>

          {/* CONTROLS */}
          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            {phase === 'idle' || phase === 'finished' ? (
              <>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Mise (max {maxBet} ₶)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAmount((a) => clampAmount(a - 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input type="number" value={amount} onChange={(e) => setAmount(clampAmount(Number(e.target.value) || 0))} className="flex-1 h-11 bg-brand-inner border-2 border-brand-border rounded-lg px-3 text-center font-display font-black" />
                    <button onClick={() => setAmount((a) => clampAmount(a + 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button onClick={() => setAmount(maxBet)} className="h-11 px-3 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner text-xs font-bold hover:border-tx-base">MAX</button>
                  </div>
                </div>
                <button
                  onClick={phase === 'idle' ? handleDeal : handleReset}
                  disabled={busy || !isLoaded || amount < CASINO_MIN_BET}
                  className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary')}
                >
                  {phase === 'idle' ? (busy ? 'DONNE...' : `MISER ${amount} ₶`) : 'REJOUER'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-tx-secondary">Mise: <span className="font-bold text-tx-base">{lockedAmount} ₶</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleHit} disabled={busy} className={cn('h-14 rounded-xl font-display font-black border-2 border-brand-border transition-colors focus:outline-none', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-brand-inner hover:bg-tx-base hover:text-brand-bg hover:border-tx-base')}>
                    TIRER
                  </button>
                  <button onClick={handleStand} disabled={busy} className={cn('h-14 rounded-xl font-display font-black border-2 border-brand-border transition-colors focus:outline-none', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-brand-inner hover:bg-tx-base hover:text-brand-bg hover:border-tx-base')}>
                    RESTER
                  </button>
                </div>
                <button
                  onClick={handleDouble}
                  disabled={busy || !canDouble || lockedAmount > balance}
                  className={cn('h-12 rounded-xl font-display font-bold border-2 border-brand-border transition-colors focus:outline-none', (busy || !canDouble) ? 'opacity-40 cursor-not-allowed bg-brand-inner' : 'bg-brand-inner hover:bg-tx-base hover:text-brand-bg hover:border-tx-base')}
                >
                  DOUBLER ({lockedAmount} ₶ de plus)
                </button>
              </>
            )}

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Dernières mains</span>
                <div className="flex flex-wrap gap-2">
                  {gameHistory.map((h) => (
                    <span key={h.id} className={cn('text-xs font-bold px-2 py-1 rounded-md border-2', h.amount >= 0 ? 'border-accent-success text-accent-success' : 'border-accent-secondary text-accent-secondary')}>
                      {h.amount >= 0 ? '+' : ''}{h.amount}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
