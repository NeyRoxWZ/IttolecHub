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
          className="absolute rounded-[28px] border-2 border-tx-base pointer-events-none"
          style={{
            top: Math.max(8, spot.top - 8),
            left: Math.max(8, spot.left - 8),
            width: Math.max(0, spot.width + 16),
            height: Math.max(0, spot.height + 16),
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      <div
        ref={cardRef}
        className="absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal"
        style={{ top: cardTop }}
        role="dialog"
        aria-modal="true"
        aria-label="Tutoriel"
      >
        <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
          Tutoriel {stepIndex + 1} / {steps.length}
        </div>
        <div className="mt-2 font-display text-2xl font-black tracking-wider uppercase text-tx-base">{step.title}</div>
        <div className="mt-3 text-sm text-tx-secondary font-bold leading-relaxed">{step.body}</div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onStepChange(Math.max(0, stepIndex - 1))}
            disabled={!canPrev}
            className={cn(
              'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
              !canPrev
                ? 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
            )}
          >
            Retour
          </button>

          <button
            type="button"
            onClick={close}
            className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors"
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
            className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
          >
            {isLast ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

