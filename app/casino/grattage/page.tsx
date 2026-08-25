'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { scratchTicket, resolveGrattage, CASINO_MIN_BET } from '@/lib/casino/grattage';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
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
      toast.success(`Ticket gagnant — +${r.payout} ₶`);
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

  // Stake of the previous round, for the one-tap rebet chip.
  const lastBet = Number(history.find((h) => h.meta?.amount)?.meta?.amount) || undefined;
  const gameHistory = history.filter((h) => h.game_slug === 'grattage').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      {/* Ticket */}
      <div
        className="relative w-full max-w-[360px] rounded-2xl border-4 border-brand-border p-4 select-none"
        style={{ background: 'linear-gradient(150deg, #7B2D5E 0%, #4A1B3D 55%, #2E1128 100%)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-display text-xs font-black uppercase tracking-widest text-white/80">Frenly Ticket</span>
          <span className="text-[10px] font-bold text-white/60">{phase === 'idle' ? '—' : `${amount} ₶`}</span>
        </div>

        {/* Scratch zone */}
        <div className="relative rounded-xl overflow-hidden border-2 border-black/40" style={{ height: 116 }}>
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="font-display font-black text-white/85 text-sm">Achète un ticket</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-white/55">
            {phase === 'scratching' ? `Gratté à ${Math.round(progress * 100)}%` : phase === 'revealed' ? 'Ticket révélé' : '3 symboles identiques = gagné'}
          </span>
          {phase === 'scratching' && (
            <button onClick={() => result && finishReveal(result)} className="text-[10px] font-black uppercase tracking-wider text-white/70 hover:text-white underline focus:outline-none">
              Tout révéler
            </button>
          )}
        </div>
      </div>

      <ResultBanner state={phase !== 'revealed' || !result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `×${result.multiplier} — +${result.payout} ₶` : 'Ticket perdant'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls lastBet={lastBet} amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={phase === 'scratching' || buying} step={1} />

      {phase === 'scratching' ? (
        <div className="rounded-xl border-2 border-accent-primary bg-accent-primary/10 p-4 text-center">
          <div className="font-display font-black text-sm text-accent-primary">Gratte ton ticket</div>
          <p className="text-xs text-tx-secondary mt-1">Passe le doigt (ou la souris) sur la zone argentée.</p>
        </div>
      ) : (
        <PlayButton onClick={phase === 'idle' ? handleBuy : handleReset} loading={buying} disabled={!isLoaded || amount < CASINO_MIN_BET}>
          {phase === 'idle' ? `ACHETER · ${amount} ₶` : 'NOUVEAU TICKET'}
        </PlayButton>
      )}

      <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Table des gains</div>
        <div className="space-y-1.5 text-xs">
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
