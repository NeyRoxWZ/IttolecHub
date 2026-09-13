'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowUp, ChevronLeft, ChevronRight, Gift, Newspaper, Sparkles, Timer, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { KRASH_REFILL_AMOUNT, KRASH_START_BALANCE, LEVERAGE_UNLOCK } from '@/lib/krash/assets';

/** Bumped when the guide changes enough to be worth showing again. */
export const ONBOARDING_KEY = 'krash_onboarding_v2';

interface Step { icon: typeof Timer; title: string; body: ReactNode }

/**
 * Four pages, then straight to a first trade: the rest is learnt by playing,
 * with the hints on the market page.
 */
const STEPS: Step[] = [
  {
    icon: ArrowUp,
    title: 'Ça monte ou ça baisse ?',
    body: (
      <>
        <p>Choisis une entreprise, une crypto ou un mème. Parie qu’elle <b className="text-accent-success">monte</b> ou qu’elle <b className="text-rose-400">baisse</b>.</p>
        <p>Tu démarres avec {KRASH_START_BALANCE.toLocaleString('fr-FR')} ₶, un portefeuille <b>séparé du casino</b>. À sec, renfloue-toi à {KRASH_REFILL_AMOUNT.toLocaleString('fr-FR')} ₶.</p>
      </>
    ),
  },
  {
    icon: Timer,
    title: '30 secondes et c’est plié',
    body: (
      <>
        <p>Un trade dure 30 s, 1 min ou 5 min, puis le résultat tombe tout seul, en pourcentage. Tu peux aussi retirer avant la fin.</p>
        <p>« Libre » garde la position ouverte jusqu’à ce que tu la retires. Enchaîne les trades gagnants pour un bonus de série.</p>
      </>
    ),
  },
  {
    icon: Zap,
    title: 'Le levier, en gros',
    body: (
      <>
        <p>Le levier <b>multiplie le mouvement de la cote</b> sur ta mise. Tu mises 100 ₶ et la cote monte de 3 % :</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>x1 : +3 ₶</li>
          <li>x2 : +6 ₶</li>
          <li>x10 : <b className="text-accent-success">+30 ₶</b></li>
        </ul>
        <p>Mais ça marche aussi dans l’autre sens. Si la cote va contre toi de <b>100 ÷ levier %</b> (50 % en x2, 10 % en x10), la position est <b className="text-rose-400">liquidée</b> : tu perds la mise, jamais plus.</p>
        <p>Frais : seulement sur un trade gagnant, jamais sur une perte. x5 après {LEVERAGE_UNLOCK[5]} trades, x10 après {LEVERAGE_UNLOCK[10]}.</p>
      </>
    ),
  },
  {
    icon: Newspaper,
    title: 'Les news font tout bouger',
    body: (
      <>
        <p>« ↑ Luxe 88 % » : 88 % de chances que le luxe monte. Une flèche apparaît sur la courbe quand une news touche ton actif.</p>
        <p>Toutes les 12 min 30, un <b className="text-accent-primary">résultat est annoncé</b> avec un compte à rebours : place-toi avant la révélation.</p>
      </>
    ),
  },
  {
    icon: Gift,
    title: 'À toi de jouer',
    body: (
      <>
        <p>Coffre du jour, missions, pass Krash, boutique et cosmétiques : tout est dans le rail à gauche.</p>
        <p>Premier trade : prends un actif de la liste « Ça bouge », laisse 1 min et appuie sur <b>ÇA MONTE</b> ou <b>ÇA BAISSE</b>.</p>
      </>
    ),
  },
];

export default function KrashOnboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[230] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl border-2 border-rose-400 bg-rose-400/10 text-rose-300 flex items-center justify-center">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Guide Krash · {step + 1}/{STEPS.length}</div>
              <h2 className="font-display text-xl font-black leading-tight line-clamp-2 min-h-[2.5em]">{current.title}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fixed height, scrolling inside: the buttons below stay put from step to step. */}
        <div className="space-y-2 text-[14px] leading-relaxed text-tx-secondary h-[min(300px,45dvh)] overflow-y-auto pr-1">{current.body}</div>

        <div className="flex justify-center gap-1.5 my-5">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)} className={cn('h-2 rounded-full transition-all', i === step ? 'w-6 bg-rose-400' : 'w-2 bg-brand-border')} aria-label={`Étape ${i + 1}`} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { sfx.click(); setStep((s) => Math.max(0, s - 1)); }}
            disabled={step === 0}
            className="h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tracking-wider flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> PRÉCÉDENT
          </button>
          <button
            onClick={() => { sfx.click(); if (last) onClose(); else setStep((s) => s + 1); }}
            className="h-12 rounded-xl bg-rose-500 text-white border-2 border-brand-border shadow-brutal font-display font-black tracking-wider flex items-center justify-center gap-1"
          >
            {last ? <><Sparkles className="h-4 w-4" /> C’EST PARTI</> : <>SUIVANT <ChevronRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
