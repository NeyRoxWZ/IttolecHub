/**
 * How an item reads at a glance.
 *
 * The shop was a wall of paragraphs: every card looked the same and the only
 * way to know what an item did was to read it. Each effect now carries a
 * colour, a short verdict and a one-line "what it does", so a card can be
 * understood without reading the description at all.
 */

export type EffectFamily = 'protection' | 'gain' | 'progression' | 'mise' | 'mission' | 'economie' | 'caisse';

export interface EffectStyle {
  family: EffectFamily;
  label: string;
  color: string;
  /** Short verb phrase: what the item actually does. */
  summary: (magnitude?: number, uses?: number, minutes?: number) => string;
}

export const FAMILY_COLOR: Record<EffectFamily, string> = {
  protection: '#00FF94',
  gain: '#FFD000',
  progression: '#B061FF',
  mise: '#FF2A55',
  mission: '#4FA3FF',
  economie: '#00D1B2',
  caisse: '#FF4DA6',
};

export const FAMILY_LABEL: Record<EffectFamily, string> = {
  protection: 'Protection',
  gain: 'Gain',
  progression: 'Progression',
  mise: 'Mise',
  mission: 'Mission',
  economie: 'Économie',
  caisse: 'Caisse',
};

const pct = (n = 0) => `${Math.round(n * 100)}%`;

export const EFFECT_STYLE: Record<string, EffectStyle> = {
  loss_refund: {
    family: 'protection', label: 'Remboursement', color: FAMILY_COLOR.protection,
    summary: (m) => `Rend ${pct(m)} de la mise perdue`,
  },
  streak_shield: {
    family: 'protection', label: 'Bouclier', color: FAMILY_COLOR.protection,
    summary: () => 'Une défaite ne casse pas ta série',
  },
  win_bonus: {
    family: 'gain', label: 'Bonus de gain', color: FAMILY_COLOR.gain,
    summary: (m) => `+${pct(m)} sur le bénéfice`,
  },
  jackpot_boost: {
    family: 'gain', label: 'Chances jackpot', color: FAMILY_COLOR.gain,
    summary: (m) => `Chances de cagnotte ×${m}`,
  },
  xp_multiplier: {
    family: 'progression', label: 'XP', color: FAMILY_COLOR.progression,
    summary: (m) => `XP ×${m}`,
  },
  grant_xp: {
    family: 'progression', label: 'XP immédiate', color: FAMILY_COLOR.progression,
    summary: (m) => `+${(m || 0).toLocaleString('en-US')} XP tout de suite`,
  },
  grant_level: {
    family: 'progression', label: 'Niveau', color: FAMILY_COLOR.progression,
    summary: (m) => `+${m} niveau${(m || 0) > 1 ? 'x' : ''} d'un coup`,
  },
  max_bet_pct: {
    family: 'mise', label: 'Plafond de mise', color: FAMILY_COLOR.mise,
    summary: (m) => `Mise jusqu'à ${pct(m)} du solde`,
  },
  mission_reroll: {
    family: 'mission', label: 'Relance', color: FAMILY_COLOR.mission,
    summary: () => 'Retire de nouvelles missions',
  },
  mission_complete: {
    family: 'mission', label: 'Mission finie', color: FAMILY_COLOR.mission,
    summary: () => 'Termine ta mission la plus avancée',
  },
  mystery_coins: {
    family: 'economie', label: 'Sac mystère', color: FAMILY_COLOR.economie,
    summary: () => 'Entre ×0,4 et ×3 son prix',
  },
  interest: {
    family: 'economie', label: 'Intérêts', color: FAMILY_COLOR.economie,
    summary: (m) => `+${pct(m)} de ton solde`,
  },
  cashback_boost: {
    family: 'economie', label: 'Cashback', color: FAMILY_COLOR.economie,
    summary: () => 'Prochain cashback doublé',
  },
  grant_scratch: {
    family: 'economie', label: 'Grattage', color: FAMILY_COLOR.economie,
    summary: (m) => `${m} tickets à gratter`,
  },
};

export function styleOf(effect: string): EffectStyle {
  return EFFECT_STYLE[effect] ?? {
    family: 'economie',
    label: effect,
    color: FAMILY_COLOR.economie,
    summary: () => '',
  };
}

/** How long an item lasts once activated, in plain words. */
export function lifetimeLabel(uses?: number, durationMin?: number): string {
  if (durationMin) return `${durationMin} min`;
  if (uses) return `${uses} mise${uses > 1 ? 's' : ''}`;
  return 'Immédiat';
}
