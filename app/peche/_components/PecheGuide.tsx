'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Fish, ShoppingBag, Wrench, Map as MapIcon, Zap, Target, Waves, CloudRain, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';

export const GUIDE_KEY = 'itollec_peche_guide_v2';

const STEPS = [
  { icon: Fish, title: 'Lancer et remonter', body: 'Appuie sur « Lancer la ligne ». Quand ça mord, maintiens le clic, le doigt ou la barre espace pour garder le curseur jaune dans la zone verte, et relâche pour qu’il redescende. Tu as une seconde et demie pour te placer avant que le poisson bouge. Rester dans la zone jusqu’au bout donne une prise parfaite, payée ×1,5.' },
  { icon: Target, title: 'Bourriche et criée', body: 'Tes prises vont dans la bourriche. Vends tout d’un coup ou poisson par poisson. Chaque jour, la criée paie mieux certains poissons (jusqu’à ×3) et un coin est en marée haute (×1,5) : regarde-la avant de vendre.' },
  { icon: Wrench, title: 'Matériel et matériaux', body: 'En pêchant, tu ramasses du fil, du bois, du métal et des écailles rares. Avec les ₶, ils servent à améliorer ta canne (poissons mieux payés), ton moulinet (zone verte plus large), ton hameçon (plus de raretés) et ton bateau.' },
  { icon: MapIcon, title: 'Coins de pêche', body: 'Chaque niveau de bateau ouvre le coin suivant : 40 coins dans 8 régions, chacun avec ses 16 espèces, puis les Profondeurs, sans fin. Plus tu vas loin, plus les poissons valent cher.' },
  { icon: Zap, title: 'Canne auto', body: 'Achète une canne auto dans Matériel, puis active « Auto » : elle pêche toute seule tant que la page est ouverte, à rendement réduit. Tu peux jouer à côté ou juste laisser tourner.' },
  { icon: CloudRain, title: 'Météo', body: 'La météo change toutes les 15 minutes, la même pour tout le monde. La pluie amène des raretés, la brume des variantes et des espèces de marée, l’orage de gros poissons mieux payés, la nuit de lune des variantes ×3.' },
  { icon: BookOpen, title: 'Quêtes', body: 'Ouvre le coffre chaque jour : 7 jours d’affilée donnent une grosse récompense et deux coffres au trésor. Remplis les missions du jour et de la semaine, et livre les commandes de la criée, qui paient trois fois le prix.' },
  { icon: ShoppingBag, title: 'Boutique et cosmétiques', body: 'La boutique change chaque jour avec un article en promo : appâts, criée VIP, canne turbo… Les coffres au trésor contiennent uniquement des cosmétiques (flotteur, canne, décor, effet de prise) qui changent l’apparence de ta pêche.' },
  { icon: Waves, title: 'Les Marées', body: 'Quand tu as assez gagné, lance la Grande Marée : tu repars de zéro, mais tu gagnes des Perles pour un arbre de bonus permanents, un bonus sur toutes tes ventes, un nouveau titre et des espèces de marée. Tu peux recommencer autant de fois que tu veux, chaque Marée demande un peu plus.' },
];

/** The fishing guide: fixed size so the buttons never move between steps. */
export default function PecheGuide({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  const close = () => {
    try { localStorage.setItem(GUIDE_KEY, '1'); } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[260] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg h-[min(520px,92dvh)] flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 p-6 pb-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-14 w-14 shrink-0 rounded-2xl border-[3px] border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-5px_0_#2F5BD0]">
              <Icon className="h-7 w-7 text-white" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-black text-tx-secondary">Guide · {step + 1}/{STEPS.length}</div>
              <h2 className="font-display text-2xl leading-tight truncate">{current.title}</h2>
            </div>
          </div>
          <button onClick={close} aria-label="Fermer le guide" className={cn(BRAWL.dark, 'h-11 w-11 shrink-0')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 flex-1 min-h-0 overflow-y-auto">
          <p className="text-base font-bold text-tx-secondary leading-relaxed">{current.body}</p>
        </div>

        <div className="p-6 pt-4 shrink-0">
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} aria-label={`Étape ${i + 1}`}
                className={cn('h-3 flex-1 rounded-full border-2 border-brand-border', i <= step ? 'bg-accent-primary' : 'bg-[#1A1D4A]')} />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { sfx.click(); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0} aria-label="Étape précédente" className={cn(BRAWL.dark, 'h-14 w-14')}>
              <ChevronLeft className="h-6 w-6" strokeWidth={3} />
            </button>
            <button onClick={() => { sfx.click(); if (last) close(); else setStep((s) => s + 1); }} className={cn(BRAWL.yellow, 'flex-1 h-14 text-2xl')}>
              {last ? 'C’est parti' : 'Suivant'}
              {!last && <ChevronRight className="h-6 w-6" strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
