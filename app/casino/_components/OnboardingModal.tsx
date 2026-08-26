'use client';

import { useState, type ReactNode } from 'react';
import {
  X, ChevronLeft, ChevronRight, Coins, Dices, Flame, Gem, Sparkles, Target,
  Banknote, Crown, ShoppingBag, Package, Backpack, Palette, Award, Zap, RotateCcw, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import {
  PRESTIGE_THRESHOLD, JACKPOT_CONTRIBUTION_RATE, JACKPOT_HIT_CHANCE, ACHIEVEMENTS,
} from '@/lib/casino/meta';
import { CASINO_STARTING_BALANCE, CASINO_MAX_BET_PERCENT } from '@/lib/casino/core';
import { STREAK_TIERS, CASHBACK_RATE, PRESTIGE_MAX_REWARDED, prestigeWinBonus } from '@/lib/casino/progression';
import { PASS_TIERS, PASS_PREMIUM_PRICE } from '@/lib/casino/pass';
import { COSMETICS, COSMETIC_SLOTS, SLOT_LABEL } from '@/lib/casino/cosmetics';
import { CRATES } from '@/lib/casino/crates';
import { SHOP_ITEMS, SHOP_SLOTS_PER_DAY } from '@/lib/casino/shop';
import { MISSIONS_PER_DAY } from '@/lib/casino/missions';

interface Step {
  icon: any;
  title: string;
  body: ReactNode;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The full tour. Numbers come from the same constants the game runs on, so a
 * balance change can't leave the explanation lying.
 */
const STEPS: Step[] = [
  {
    icon: Info,
    title: 'Les FrenlyCoins ne valent rien',
    body: (
      <>
        <p>
          Le ₶ est une monnaie <b>100% fictive</b>. Impossible d&apos;en acheter avec de l&apos;argent réel,
          impossible d&apos;en retirer ou d&apos;en convertir, dans un sens comme dans l&apos;autre.
        </p>
        <p>
          Tu démarres avec {CASINO_STARTING_BALANCE.toLocaleString('en-US')} ₶, et si tu tombes à sec
          le casino te renfloue automatiquement. On ne peut pas être bloqué.
        </p>
      </>
    ),
  },
  {
    icon: Dices,
    title: '20 jeux, un tirage honnête',
    body: (
      <>
        <p>
          Chaque résultat est tiré <b>sur le serveur</b>, avant que l&apos;animation ne commence. Ni ta
          mise, ni ton solde, ni ton historique n&apos;influencent le tirage.
        </p>
        <p>
          Chaque jeu affiche sa <b>redistribution</b> (entre 90% et 98,6%) sur sa carte et dans ses
          règles : c&apos;est la part des mises qui revient aux joueurs sur le long terme.
          Le bouton <b>Règles</b> en haut de chaque jeu détaille les gains.
        </p>
      </>
    ),
  },
  {
    icon: Coins,
    title: 'Miser',
    body: (
      <>
        <p>
          Tu ne peux jamais miser plus de <b>{pct(CASINO_MAX_BET_PERCENT)} de ton solde</b> d&apos;un
          coup : pas de tapis en un clic. Certains objets relèvent ce plafond.
        </p>
        <p>
          Les raccourcis <b>½, ×2, 25%, MAX</b> ajustent la mise. Le bouton{' '}
          <b className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" />AUTO</b>{' '}
          rejoue la même mise en boucle jusqu&apos;à ce que tu l&apos;arrêtes ou que tu touches au montant.
        </p>
        <p>
          <b className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />Turbo</b> accélère
          toutes les animations, dans tous les jeux.
        </p>
      </>
    ),
  },
  {
    icon: Flame,
    title: 'Séries de victoires',
    body: (
      <>
        <p>
          Enchaîner des gains ajoute un bonus <b>sur le bénéfice</b> (jamais sur la mise rendue) :
        </p>
        <ul className="list-disc list-inside">
          {[...STREAK_TIERS].reverse().map((t) => (
            <li key={t.min}>
              {t.min} victoires d&apos;affilée → <b>+{pct(t.bonus)}</b> <span className="text-tx-muted">({t.label})</span>
            </li>
          ))}
        </ul>
        <p>Une défaite remet la série à zéro — sauf si tu as un bouclier de série.</p>
      </>
    ),
  },
  {
    icon: Gem,
    title: 'La cagnotte commune',
    body: (
      <>
        <p>
          Chaque mise perdue, dans n&apos;importe quel jeu, verse{' '}
          <b>{pct(JACKPOT_CONTRIBUTION_RATE)}</b> à une cagnotte partagée par tous les joueurs.
        </p>
        <p>
          À chaque mise réglée — gagnée ou perdue — un tirage indépendant a{' '}
          <b>1 chance sur {Math.round(1 / JACKPOT_HIT_CHANCE).toLocaleString('en-US')}</b> de te la
          donner entièrement. Le montant misé n&apos;y change rien : 5 ₶ a exactement les mêmes chances
          que 5 000 ₶.
        </p>
      </>
    ),
  },
  {
    icon: Sparkles,
    title: 'Niveaux et XP',
    body: (
      <>
        <p>
          Chaque mise donne de l&apos;XP, <b>que tu gagnes ou que tu perdes</b>. Une session perdante
          fait quand même avancer quelque chose.
        </p>
        <p>
          Chaque niveau ouvre un coffre crédité automatiquement, et plus tu montes, plus le niveau
          suivant demande d&apos;XP.
        </p>
      </>
    ),
  },
  {
    icon: Target,
    title: 'Les récompenses quotidiennes',
    body: (
      <>
        <ul className="list-disc list-inside space-y-1">
          <li><b>Bonus du jour</b> : de 250 à 10 000 ₶. Reviens plusieurs jours de suite et il est multiplié (×1,5 à 3 jours, ×2 à 7, ×3 à 14).</li>
          <li><b>Roue gratuite</b> : un tour offert par jour.</li>
          <li><b>Cashback</b> : <b>{pct(CASHBACK_RATE)}</b> de tes pertes de la veille, à récupérer une fois par jour.</li>
          <li><b>{MISSIONS_PER_DAY} missions</b> tirées chaque jour, qui paient en ₶ et en XP.</li>
        </ul>
        <p className="text-tx-muted text-[12px]">Tout se remet à zéro à minuit.</p>
      </>
    ),
  },
  {
    icon: Crown,
    title: 'Le Frenly Pass',
    body: (
      <>
        <p>
          <b>{PASS_TIERS} paliers</b>, remis à zéro chaque lundi. Il avance <b>à l&apos;action</b>, pas au
          montant : une mise de 5 ₶ le fait monter autant qu&apos;une mise de 5 000 ₶.
        </p>
        <p>
          Chaque palier se <b>réclame à la main</b>. Ce que tu n&apos;as pas pris avant le reset t&apos;est
          versé automatiquement : rien ne se perd.
        </p>
        <p>
          La <b>voie premium</b> ({PASS_PREMIUM_PRICE.toLocaleString('en-US')} ₶, en ₶ uniquement) ouvre
          une seconde récompense à chaque palier, et rattrape d&apos;un coup tous ceux déjà franchis.
        </p>
      </>
    ),
  },
  {
    icon: ShoppingBag,
    title: 'La boutique',
    body: (
      <>
        <p>
          <b>{SHOP_SLOTS_PER_DAY} objets par jour</b>, tirés dans un catalogue de {SHOP_ITEMS.length}.
          Un seul exemplaire de chacun par jour : c&apos;est un choix, pas un distributeur.
        </p>
        <p>
          Remboursements sur défaite, bouclier de série, bonus de gain, XP multipliée, plafond de
          mise relevé, relance de missions… chaque objet fait autre chose.
        </p>
      </>
    ),
  },
  {
    icon: Package,
    title: 'Les caisses',
    body: (
      <>
        <p>
          Une caisse s&apos;ouvre sur <b>3, 4 ou 5 objets</b>, et le nombre te dit tout avant même la
          première carte :
        </p>
        <ul className="list-disc list-inside">
          <li><b>3</b> → rien de rare.</li>
          <li><b>4</b> → du rare.</li>
          <li><b>5</b> → de l&apos;épique, voire du légendaire.</li>
        </ul>
        <p>
          Une meilleure caisse ne donne pas de meilleurs objets : elle augmente les chances de
          tomber sur un plus grand nombre. Il y en a {CRATES.length}, de{' '}
          {CRATES[0].price.toLocaleString('en-US')} à {CRATES[CRATES.length - 1].price.toLocaleString('en-US')} ₶.
          Jamais de doublon : si tu possèdes déjà tout à cette rareté, c&apos;est payé en ₶.
        </p>
      </>
    ),
  },
  {
    icon: Backpack,
    title: 'L’inventaire',
    body: (
      <>
        <p>
          Un objet acheté ne part pas tout de suite : il attend dans ton inventaire et{' '}
          <b>tu choisis quand l&apos;activer</b>. Une fois lancé, le panneau affiche le temps ou le
          nombre de mises qu&apos;il lui reste.
        </p>
        <p>
          L&apos;onglet <b>Cosmétiques</b> range ta collection par jeu. Ce que tu n&apos;as pas encore
          reste masqué : la surprise appartient à la caisse.
        </p>
      </>
    ),
  },
  {
    icon: Palette,
    title: 'Les cosmétiques',
    body: (
      <>
        <p>
          <b>{COSMETICS.length} pièces</b> réparties sur {COSMETIC_SLOTS.length} emplacements :{' '}
          {COSMETIC_SLOTS.map((s) => SLOT_LABEL[s]).join(', ')}.
        </p>
        <p>
          Chaque pièce a <b>une seule source</b> : le Frenly Pass, les caisses, ou le prestige.
          Les sets <b>généraux</b> s&apos;appliquent partout, les pièces liées à un jeu ne s&apos;affichent
          que dans ce jeu — et prennent le dessus sur le set général.
        </p>
      </>
    ),
  },
  {
    icon: Award,
    title: 'Les succès',
    body: (
      <>
        <p>
          <b>{ACHIEVEMENTS.length} succès</b> classés en catégories, du premier geste à ce que presque
          personne n&apos;atteindra. Chacun paie en ₶ selon sa difficulté, du bronze au mythique.
        </p>
      </>
    ),
  },
  {
    icon: Crown,
    title: 'Prestiger',
    body: (
      <>
        <p>
          À partir de <b>{PRESTIGE_THRESHOLD.toLocaleString('en-US')} ₶</b>, tu peux remettre ton solde
          à {CASINO_STARTING_BALANCE.toLocaleString('en-US')} ₶ en échange d&apos;un gain permanent.
        </p>
        <p>
          Chaque prestige, jusqu&apos;au {PRESTIGE_MAX_REWARDED}<sup>e</sup>, débloque un{' '}
          <b>cosmétique global exclusif</b> — introuvable en caisse ou au passe — et ajoute{' '}
          <b>+0,5%</b> sur le bénéfice de tous tes gains, jusqu&apos;à{' '}
          <b>+{pct(prestigeWinBonus(PRESTIGE_MAX_REWARDED))}</b>.
        </p>
        <p className="text-tx-muted text-[12px]">
          Niveau, XP, succès, cosmétiques, inventaire et passe sont conservés. Seul le solde repart.
        </p>
      </>
    ),
  },
  {
    icon: Banknote,
    title: 'Voilà, tu sais tout',
    body: (
      <>
        <p>
          Tu peux relire ce guide à tout moment avec le bouton <b>?</b> à côté du titre du casino,
          et les règles détaillées de chaque jeu depuis son bouton <b>Règles</b>.
        </p>
        <p className="text-tx-muted text-[12px]">
          Rien ici ne coûte d&apos;argent réel, et rien ne peut en rapporter.
        </p>
      </>
    ),
  },
];

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  const go = (delta: number) => {
    sfx.click();
    vibrate(HAPTIC.SOFT);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92dvh] flex flex-col bg-brand-card border-4 border-brand-border rounded-[28px] shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 shrink-0 rounded-xl border-2 border-accent-primary bg-accent-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-accent-primary" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                Étape {step + 1} / {STEPS.length}
              </div>
              <h2 className="font-display text-lg font-black leading-tight">{current.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Passer le guide"
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 overflow-y-auto flex-1">
          <div className="text-sm text-tx-secondary leading-relaxed space-y-3 [&_b]:text-tx-base [&_ul]:space-y-1">
            {current.body}
          </div>
        </div>

        <div className="p-6 pt-4">
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { sfx.click(); setStep(i); }}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors focus:outline-none',
                  i <= step ? 'bg-accent-primary' : 'bg-brand-inner'
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => go(-1)}
              disabled={step === 0}
              className="h-13 py-3 px-4 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors focus:outline-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => (last ? onClose() : go(1))}
              className="flex-1 py-3 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none flex items-center justify-center gap-2"
            >
              {last ? 'JOUER' : 'SUIVANT'}
              {!last && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
