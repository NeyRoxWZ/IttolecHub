'use client';

import { useRef, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { WHEEL_OF_FORTUNE_SEGMENTS } from '@/lib/casino/meta';
import CasinoWheel, { type CasinoWheelHandle, type WheelSegment } from './CasinoWheel';
import Confetti from './Confetti';

// The 6 prize tiers are laid out twice around the wheel (12 slices) so it
// reads as a real wheel instead of six fat wedges. Both copies of a tier pay
// the same, so which one we land on is purely cosmetic.
const SEGMENT_COLORS = ['#334155', '#FF2A55', '#334155', '#4FC3F7', '#334155', '#FFD000'];

const SEGMENTS: WheelSegment[] = [...WHEEL_OF_FORTUNE_SEGMENTS, ...WHEEL_OF_FORTUNE_SEGMENTS].map((v, i) => ({
  label: v >= 1000 ? `${v / 1000}k` : String(v),
  color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  textColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] === '#FFD000' ? '#13131A' : '#fff',
}));

interface Props {
  onClose: () => void;
  onSpin: () => Promise<{ reward: number; segmentIndex: number } | { error: string }>;
}

export default function DailyWheelModal({ onClose, onSpin }: Props) {
  const wheelRef = useRef<CasinoWheelHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);

  const handleSpin = async () => {
    if (spinning || reward !== null) return;
    setSpinning(true);
    vibrate(HAPTIC.MEDIUM);
    sfx.bet();
    wheelRef.current?.startSpin();

    const result = await onSpin();

    if ('error' in result) {
      wheelRef.current?.stop();
      setSpinning(false);
      toast.error(result.error);
      return;
    }

    // Land on either copy of the winning tier.
    const visualIndex = result.segmentIndex + (Math.random() < 0.5 ? 0 : WHEEL_OF_FORTUNE_SEGMENTS.length);
    await wheelRef.current?.settleOn(visualIndex);

    setReward(result.reward);
    setSpinning(false);
    vibrate(HAPTIC.SUCCESS);
    if (result.reward >= 2500) { sfx.bigWin(); setConfetti((c) => c + 1); }
    else { sfx.win(); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-display text-2xl font-black">Roue Quotidienne</h2>
            <p className="text-xs text-tx-secondary font-bold">Un tour gratuit chaque jour</p>
          </div>
          <button
            onClick={onClose}
            disabled={spinning}
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base disabled:opacity-40 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center my-6">
          <CasinoWheel
            ref={wheelRef}
            segments={SEGMENTS}
            size={260}
            labelSize={12}
            settleMs={1900}
            hub={
              <div className="w-16 h-16 rounded-full bg-brand-card border-4 border-brand-border flex items-center justify-center">
                {reward !== null
                  ? <span className="font-display font-black text-sm text-accent-primary">+{reward >= 1000 ? `${reward / 1000}k` : reward}</span>
                  : <Sparkles className={cn('w-6 h-6 text-accent-primary', spinning && 'animate-pulse')} />}
              </div>
            }
          />
        </div>

        {reward === null ? (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className={cn(
              'w-full h-16 rounded-2xl font-display text-lg font-black tracking-wider border-4 border-brand-border shadow-brutal transition-all active:translate-y-1 active:shadow-none focus:outline-none',
              spinning ? 'bg-brand-inner text-tx-muted cursor-not-allowed shadow-none' : 'bg-accent-primary text-brand-bg hover:brightness-110'
            )}
          >
            {spinning ? 'ÇA TOURNE...' : 'TOURNER — GRATUIT'}
          </button>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="font-display text-4xl font-black text-accent-primary">+{reward.toLocaleString('fr-FR')} ₶</div>
              <p className="text-sm text-tx-secondary font-bold mt-1">Ajouté à ton solde · reviens demain</p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-success text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none"
            >
              ENCAISSER
            </button>
          </>
        )}
      </div>
    </div>
  );
}
