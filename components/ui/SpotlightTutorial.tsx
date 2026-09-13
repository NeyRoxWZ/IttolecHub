'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SpotlightTutorialStep {
  key: string;
  title: string;
  body: string;
}

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  open: boolean;
  stepIndex: number;
  steps: SpotlightTutorialStep[];
  targetEl: HTMLElement | null;
  onStepChange: (nextIndex: number) => void;
  onClose: () => void;
  storageKey?: string;
}

export default function SpotlightTutorial(props: Props) {
  const { open, stepIndex, steps, targetEl, onStepChange, onClose, storageKey: storageKeyProp } = props;
  const [spot, setSpot] = useState<SpotlightRect | null>(null);
  const [cardTop, setCardTop] = useState(24);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = steps[stepIndex] ?? null;
  const maxIndex = Math.max(0, steps.length - 1);
  const canPrev = stepIndex > 0;
  const isLast = stepIndex >= maxIndex;

  const storageKey = useMemo(() => storageKeyProp ?? 'spotlight_tutorial_done', [storageKeyProp]);

  useEffect(() => {
    if (!open) {
      setSpot(null);
      return;
    }

    const update = () => {
      const el = targetEl;
      if (!el) {
        setSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, stepIndex, steps, targetEl]);

  useEffect(() => {
    if (!open || !spot) return;
    const vh = window.innerHeight;
    const cardHeight = cardRef.current?.getBoundingClientRect().height ?? 280;
    const padding = 16;
    const gap = 16;

    const belowTop = spot.top + spot.height + gap;
    const aboveTop = spot.top - cardHeight - gap;

    let top = belowTop;
    if (belowTop + cardHeight > vh - padding) {
      top = aboveTop >= padding ? aboveTop : Math.max(padding, vh - cardHeight - padding);
    }

    top = Math.max(padding, Math.min(vh - cardHeight - padding, top));
    setCardTop(top);
  }, [open, spot, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const el = targetEl;
    if (!el) return;
    try {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {}
  }, [open, stepIndex, targetEl]);

  const close = useCallback(() => {
    onClose();
    try {
      localStorage.setItem(storageKey, '1');
    } catch {}
  }, [onClose, storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, open]);

  if (!open || !step) return null;

  return (
    <div className="fixed inset-0 z-[99999]">
      {spot ? (
        <div
          className="absolute rounded-[22px] border-4 border-accent-primary pointer-events-none"
          style={{
            top: Math.max(8, spot.top - 8),
            left: Math.max(8, spot.left - 8),
            width: Math.max(0, spot.width + 16),
            height: Math.max(0, spot.height + 16),
            boxShadow: '0 0 0 9999px rgba(5,6,26,0.78)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      <div
        ref={cardRef}
        className="absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A]"
        style={{ top: cardTop }}
        role="dialog"
        aria-modal="true"
        aria-label="Tutoriel"
      >
        <div className="w-fit px-2.5 py-1 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-sm">
          Tutoriel {stepIndex + 1} / {steps.length}
        </div>
        <div className="mt-3 font-display text-3xl leading-tight text-stroke">{step.title}</div>
        <div className="mt-3 text-sm text-tx-secondary font-bold leading-relaxed">{step.body}</div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
            disabled={!canPrev}
            className={cn(
              'h-12 px-4 rounded-xl border-[3px] font-display text-lg transition-transform',
              !canPrev
                ? 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                : 'border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] active:translate-y-[3px]'
            )}
          >
            Retour
          </button>

          <button
            type="button"
            onClick={close}
            className="h-12 px-4 rounded-xl font-display text-lg text-tx-secondary hover:text-white transition-colors"
          >
            Passer
          </button>

          <button
            type="button"
            onClick={() => {
              if (isLast) {
                close();
                return;
              }
              onStepChange(Math.min(maxIndex, stepIndex + 1));
            }}
            className="h-12 px-5 rounded-xl border-[3px] border-brand-border font-display text-lg transition-transform bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]"
          >
            {isLast ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

