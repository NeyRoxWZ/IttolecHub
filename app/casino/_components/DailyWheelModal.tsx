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
import { tempo } from '@/lib/casino/turbo';

// The 6 prize tiers are laid out twice around the wheel (12 slices) so it
// reads as a real wheel instead of six fat wedges. Both copies of a tier pay
// the same, so which one we land on is purely cosmetic.
const SEGMENT_COLORS = ['#2B3170', '#FF4F8B', '#2B3170', '#3B6BFF', '#2B3170', '#FFC61A'];

const SEGMENTS: WheelSegment[] = [...WHEEL_OF_FORTUNE_SEGMENTS, ...WHEEL_OF_FORTUNE_SEGMENTS].map((v, i) => ({
  label: v >= 1000 ? `${v / 1000}k` : String(v),
  color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  // White with the black outline on every wedge: dark text inside a dark
  // outline turned the yellow "10k" into an unreadable blob.
  textColor: '#fff',
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
    <div className="fixed inset-0 z-[200] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-display text-3xl leading-none">Roue quotidienne</h2>
            <p className="text-xs text-tx-secondary font-bold mt-2">Un tour gratuit chaque jour</p>
          </div>
          <button
            onClick={onClose}
            disabled={spinning}
            aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center disabled:opacity-40 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center my-10">
          <CasinoWheel
            ref={wheelRef}
            segments={SEGMENTS}
            size={260}
            labelSize={12}
            settleMs={tempo(1200)}
            hub={
              <div className="w-[72px] h-[72px] rounded-full bg-[#0E1030] border-[5px] border-brand-border flex items-center justify-center">
                {reward !== null
                  ? <span className="font-display text-lg text-accent-primary">+{reward >= 1000 ? `${reward / 1000}k` : reward}</span>
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
              'w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none',
              spinning ? 'bg-brand-inner text-tx-muted cursor-not-allowed shadow-[inset_0_4px_0_#0B0E2A]' : 'bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]'
            )}
          >
            {spinning ? 'Ça tourne…' : 'Tourner, c’est gratuit'}
          </button>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="font-display text-5xl leading-none text-accent-primary [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]">+{reward.toLocaleString('en-US')} ₶</div>
              <p className="text-sm text-tx-secondary font-bold mt-1">Ajouté à ton solde · reviens demain</p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none bg-accent-success text-brand-bg shadow-[inset_0_-6px_0_#1E9A55,0_5px_0_#05061A] active:translate-y-[4px]"
            >
              Encaisser
            </button>
          </>
        )}
      </div>
    </div>
  );
}
