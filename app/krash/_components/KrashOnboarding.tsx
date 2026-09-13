'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowUp, Briefcase, ChevronLeft, ChevronRight, Coins, Gift, Info, Newspaper, Palette, ShoppingBag, Sparkles, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { FLASH, KRASH_FEE_RATE, KRASH_MAX_STAKE_PCT, KRASH_REFILL_AMOUNT, KRASH_START_BALANCE, LEVERAGE_UNLOCK } from '@/lib/krash/assets';
import { KRASH_PASS_TIERS, KRASH_PREMIUM_PRICE } from '@/lib/krash/pass';
import { KRASH_COSMETICS } from '@/lib/krash/cosmetics';

export const ONBOARDING_KEY = 'krash_onboarding_v1';

interface Step { icon: typeof Info; title: string; body: ReactNode }

const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;

/**
 * The guided tour, built like the casino's: one idea per page, numbers read
 * from the constants the game actually runs on.
 */
const STEPS: Step[] = [
  {
    icon: Info,
    title: 'Des FrenlyCoins à part',
    body: (
      <>
        <p>Krash a son propre portefeuille de ₶, <b>séparé du casino</b>. La monnaie est 100 % fictive : rien ne s’achète ni ne se retire en vrai argent.</p>
        <p>Tu démarres avec {KRASH_START_BALANCE.toLocaleString('fr-FR')} ₶. À sec, tu peux te renflouer à {KRASH_REFILL_AMOUNT.toLocaleString('fr-FR')} ₶ une fois par jour.</p>
      </>
    ),
  },
  {
    icon: ArrowUp,
    title: 'Acheter ou vendre',
    body: (
      <>
        <p><b className="text-accent-success">Acheter</b> : tu gagnes si la cote <b>monte</b>. <b className="text-rose-400">Vendre</b> : tu gagnes si elle <b>baisse</b>.</p>
        <p>Mise jusqu’à {Math.round(KRASH_MAX_STAKE_PCT * 100)} % de ton solde par position. Frais : {pct(KRASH_FEE_RATE)} du montant à l’ouverture et au retrait.</p>
        <p>Les cotes sont les mêmes pour tout le monde, à la seconde près.</p>
      </>
    ),
  },
  {
    icon: Zap,
    title: 'Le levier',
    body: (
      <>
        <p>Le levier multiplie le mouvement : en x5, une hausse de 1 % rapporte 5 % de ta mise.</p>
        <p>Mais si la cote va trop loin contre toi (20 % en x5, 10 % en x10), la position est <b>liquidée</b> : tu perds la mise. Même quand tu n’es pas connecté.</p>
        <p>x5 se débloque après {LEVERAGE_UNLOCK[5]} trades, x10 après {LEVERAGE_UNLOCK[10]}.</p>
      </>
    ),
  },
  {
    icon: Newspaper,
    title: 'Les news font bouger les cotes',
    body: (
      <>
        <p>Chaque news dit ses chances : « ↑ Luxe 88 % » veut dire 88 % de chances que le luxe monte.</p>
        <p><b>Claire</b> : presque sûr. <b>Floue</b> : probable. <b>50/50</b> : personne ne sait, ça bouge fort.</p>
        <p>Le marché sent venir la news : une partie du mouvement est déjà faite quand elle tombe. Deux fois par jour environ, un <b className="text-rose-400">KRACH</b> ou un <b className="text-accent-success">BULL RUN</b> secoue tout, annoncé par une rumeur.</p>
      </>
    ),
  },
  {
    icon: ArrowDown,
    title: 'Le pari flash',
    body: (
      <>
        <p>Pendant {FLASH.window} secondes après chaque news, parie si sa cible sera plus haute ou plus basse {FLASH.horizon} secondes plus tard.</p>
        <p>Le côté évident rapporte peu, le pari risqué jusqu’à x{FLASH.maxMultiplier}.</p>
      </>
    ),
  },
  {
    icon: Briefcase,
    title: 'Ton argent reste placé',
    body: (
      <>
        <p>Une position reste ouverte jusqu’à ce que tu la <b>retires</b>, même si tu changes de marché ou fermes le jeu.</p>
        <p>La page <b>Placements</b> montre tout ce que tu as placé, avec le gain en direct, et retire tout en un clic.</p>
        <p>Une position à l’achat sur une entreprise rapporte des dividendes tant que tu la gardes.</p>
      </>
    ),
  },
  {
    icon: Gift,
    title: 'Revenir chaque jour',
    body: (
      <>
        <p>Le <b>coffre</b> grimpe avec ta série de jours. Trois <b>missions</b> par jour, les mêmes pour tous.</p>
        <p>Le <b>pass Krash</b> a {KRASH_PASS_TIERS} paliers par mois, remplis en jouant. La voie <b>premium</b> ({KRASH_PREMIUM_PRICE.toLocaleString('fr-FR')} ₶) double les récompenses.</p>
      </>
    ),
  },
  {
    icon: ShoppingBag,
    title: 'Boutique et objets',
    body: (
      <>
        <p>Cinq objets par jour : zéro frais, remboursement de perte, parachute contre la liquidation, bonus de profit, XP double…</p>
        <p>Ils vont dans l’<b>inventaire</b> : tu les utilises quand tu veux, ils agissent sur tes prochains trades.</p>
      </>
    ),
  },
  {
    icon: Palette,
    title: 'Cosmétiques',
    body: (
      <>
        <p>{KRASH_COSMETICS.length} pièces à collectionner : couleurs de courbe, fonds, contours, titres, effets de gain, packs sonores et emblèmes.</p>
        <p>La moitié sort du pass, l’autre des <b>caisses</b>. Tout s’équipe dans l’inventaire.</p>
      </>
    ),
  },
  {
    icon: Coins,
    title: 'À toi de jouer',
    body: (
      <>
        <p>Commence petit : une mise de 50 ₶ sans levier sur une grosse entreprise, puis retire-la. Regarde comment la news la fait bouger.</p>
        <p>Ce guide se rouvre depuis le rail, bouton <b>Guide</b>.</p>
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
              <h2 className="font-display text-xl font-black leading-tight">{current.title}</h2>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-[14px] leading-relaxed text-tx-secondary min-h-[170px]">{current.body}</div>

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
