'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { scratchTicket, resolveGrattage, CASINO_MIN_BET } from '@/lib/casino/grattage';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
  useAutoPlay, AutoBadge,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtClover, ArtMoneyBag, ArtCrown, ArtDiamond, ArtLemon, ArtStar } from '../_components/CasinoArt';

const RULES: RulesSpec = {
  howTo: [
    'Choisis le prix de ton ticket (à partir de 1 ₶) et achète-le.',
    'Gratte la surface argentée avec le doigt ou la souris pour révéler les 3 cases.',
    'Si les 3 symboles sont identiques, tu remportes le gain associé.',
    'Le résultat du ticket est déjà fixé à l’achat — gratter ne fait que le révéler.',
  ],
  payouts: [
    { label: 'Trois trèfles', value: 'Mise remboursée' },
    { label: 'Trois bourses', value: '×3' },
    { label: 'Trois couronnes', value: '×15' },
    { label: 'Trois diamants', value: '×35' },
  ],
  rtp: '~90%',
};

type FaceKey = 'clover' | 'bag' | 'crown' | 'diamond' | 'lemon' | 'star';

const FACE_ART: Record<FaceKey, (p: { size?: number }) => JSX.Element> = {
  clover: ArtClover, bag: ArtMoneyBag, crown: ArtCrown,
  diamond: ArtDiamond, lemon: ArtLemon, star: ArtStar,
};
const TIER_SYMBOL: Record<string, FaceKey> = { small: 'clover', medium: 'bag', big: 'crown', jackpot: 'diamond' };
const LOSE_POOL: FaceKey[] = ['clover', 'bag', 'crown', 'diamond', 'lemon', 'star'];
const REVEAL_THRESHOLD = 0.5;

function buildFaces(tier: string): FaceKey[] {
  if (tier !== 'lose') {
    const s = TIER_SYMBOL[tier] || 'clover';
    return [s, s, s];
  }
  // Losing ticket: deliberately not three of a kind.
  const a = LOSE_POOL[Math.floor(Math.random() * LOSE_POOL.length)];
  let b = LOSE_POOL[Math.floor(Math.random() * LOSE_POOL.length)];
  while (b === a) b = LOSE_POOL[Math.floor(Math.random() * LOSE_POOL.length)];
  const c = Math.random() < 0.5 ? a : b;
  return [a, b, c].sort(() => Math.random() - 0.5);
}

type Phase = 'idle' | 'scratching' | 'revealed';

export default function GrattagePage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const [faces, setFaces] = useState<FaceKey[] | null>(null);
  const [result, setResult] = useState<GenericBetResult | null>(null);
  const [buying, setBuying] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [progress, setProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const revealedRef = useRef(false);
  const lastTickRef = useRef(0);

  const paintCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#B8BCC4');
    grad.addColorStop(0.35, '#8F949D');
    grad.addColorStop(0.5, '#C9CDD4');
    grad.addColorStop(0.65, '#8F949D');
    grad.addColorStop(1, '#A7ACB5');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRATTE ICI', w / 2, h / 2 + 5);
  }, []);

  useEffect(() => {
    if (phase === 'scratching') {
      revealedRef.current = false;
      setProgress(0);
      requestAnimationFrame(paintCover);
    }
  }, [phase, paintCover]);

  const finishReveal = useCallback((r: GenericBetResult) => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setPhase('revealed');

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (r.won) {
      vibrate(HAPTIC.SUCCESS);
      if (r.multiplier >= 15) { sfx.bigWin(); setConfetti((c) => c + 1); }
      else sfx.win();
      toast.success(`Ticket gagnant — +${fmt(r.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      sfx.lose();
    }
  }, []);

  const scratchAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== 'scratching') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    const now = performance.now();
    if (now - lastTickRef.current > 90) {
      lastTickRef.current = now;
      sfx.tick();
      measureProgress();
    }
  };

  const measureProgress = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || revealedRef.current) return;
    // Sample a coarse grid rather than every pixel — cheap and accurate enough.
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * 220) {
      total++;
      if (data[i] < 40) clear++;
    }
    const ratio = total > 0 ? clear / total : 0;
    setProgress(ratio);
    if (ratio >= REVEAL_THRESHOLD && result) finishReveal(result);
  };

  const handleBuy = async () => {
    if (buying) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBuying(true); setResult(null); vibrate(HAPTIC.SOFT); sfx.bet();

    const r = await placeBet('grattage', amount, {}, () => {
      const { tier, multiplier } = scratchTicket();
      return { ...resolveGrattage(multiplier), meta: { tier } };
    });

    setBuying(false);
    if ('error' in r) { toast.error(r.error); return; }

    setFaces(buildFaces(r.meta.tier));
    setResult(r);
    setPhase('scratching');
  };

  const handleReset = () => { sfx.click(); setPhase('idle'); setResult(null); setFaces(null); setProgress(0); };

  /** Auto buys the ticket and reveals it without asking you to rub anything. */
  const autoTick = () => {
    if (phase === 'idle') { void handleBuy(); return; }
    if (phase === 'scratching') { if (result) finishReveal(result); return; }
    handleReset();
  };

  // Le panneau remplace le bouton pendant la manche, ce qui démontait la
  // boucle : elle vit donc ici, où rien ne la démonte.
  const autoCtl = useAutoPlay({
    run: autoTick,
    ready: isLoaded && !buying && amount >= CASINO_MIN_BET && amount <= balance,
    betKey: amount,
    balance,
  });

  const gameHistory = history.filter((h) => h.game_slug === 'grattage').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      {/* Ticket */}
      <div
        className="relative w-full max-w-[360px] rounded-[24px] border-4 border-brand-border p-4 select-none"
        style={{
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 14px, transparent 14px 28px), #8B3DFF',
          boxShadow: 'inset 0 -8px 0 #6526C9, 0 6px 0 #05061A',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-2xl leading-none text-stroke-sm">Frenly Ticket</span>
          <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-sm">
            {phase === 'idle' ? '?' : `${fmt(amount)} ₶`}
          </span>
        </div>

        {/* Scratch zone */}
        <div className="relative rounded-2xl overflow-hidden border-[3px] border-brand-border" style={{ height: 116 }}>
          <div className="absolute inset-0 flex items-center justify-around bg-white">
            {[0, 1, 2].map((i) => {
              if (phase === 'idle' || !faces) {
                return <span key={i} className="font-display font-black text-3xl text-[#C9CDD4]">?</span>;
              }
              const Art = FACE_ART[faces[i]];
              return <Art key={i} size={44} />;
            })}
          </div>

          {phase === 'scratching' && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
              onPointerDown={(e) => { drawingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratchAt(e.clientX, e.clientY); }}
              onPointerMove={(e) => { if (drawingRef.current) scratchAt(e.clientX, e.clientY); }}
              onPointerUp={() => { drawingRef.current = false; measureProgress(); }}
              onPointerLeave={() => { drawingRef.current = false; }}
            />
          )}

          {phase === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0E1030]/80">
              <span className="font-display text-2xl text-stroke-sm">Achète un ticket</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-black text-white">
            {phase === 'scratching' ? `Gratté à ${Math.round(progress * 100)} %` : phase === 'revealed' ? 'Ticket révélé' : '3 symboles identiques = gagné'}
          </span>
          {phase === 'scratching' && (
            <button
              onClick={() => result && finishReveal(result)}
              className="px-2.5 py-1 rounded-lg border-2 border-brand-border bg-white text-brand-bg font-display text-sm active:translate-y-[2px] focus:outline-none"
            >
              Tout révéler
            </button>
          )}
        </div>
      </div>

      <ResultBanner state={phase !== 'revealed' || !result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `×${result.multiplier} — +${fmt(result.payout)} ₶` : 'Ticket perdant'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={phase === 'scratching' || buying} step={1} />

      {phase === 'scratching' ? (
        <>
        {/* Le bouton de jeu a disparu : seule sortie d'une série auto. */}
        <AutoBadge control={autoCtl} className="w-full justify-center mb-2" />
        <div className="rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg p-4 text-center shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]">
          <div className="font-display text-2xl leading-none">Gratte ton ticket</div>
          <p className="text-sm font-black mt-1">Passe le doigt (ou la souris) sur la zone argentée.</p>
        </div>
        </>
      ) : (
        <PlayRow
          balance={balance}
          onClick={phase === 'idle' ? handleBuy : handleReset}
          onAuto={autoTick}
          control={autoCtl}
          loading={buying}
          disabled={!isLoaded || amount < CASINO_MIN_BET}
          blocked={amount > balance}
          betKey={amount}
        >
          {phase === 'idle' ? `ACHETER · ${fmt(amount)} ₶` : 'NOUVEAU TICKET'}
        </PlayRow>
      )}

      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="font-display text-base leading-none mb-2">Table des gains</div>
        <div className="space-y-1.5 text-sm">
          {([['diamond', '×35'], ['crown', '×15'], ['bag', '×3'], ['clover', '×1']] as [FaceKey, string][]).map(([sym, mult]) => {
            const Art = FACE_ART[sym];
            return (
              <div key={sym} className="flex justify-between items-center">
                <span className="flex gap-1"><Art size={18} /><Art size={18} /><Art size={18} /></span>
                <span className="font-display font-black text-accent-primary">{mult}</span>
              </div>
            );
          })}
        </div>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="grattage"
      title="Frenly Grattage"
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
