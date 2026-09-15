import { supabase } from '@/lib/supabase/client';

/**
 * Les distinctions de compte : badges Fondateur, OG et Donateur.
 *
 * Elles sont posées sur le compte (colonnes `users.is_founder`, `is_og`,
 * `is_donor`), jamais sur le pseudo : un joueur qui change de pseudo garde ses
 * badges. Chacun choisit, badge par badge, ceux qu'il affiche
 * (`users.hidden_badges`).
 *
 * Le site affiche des pseudos un peu partout — classements, salons, parties
 * multijoueurs — et souvent sans identifiant de compte sous la main. On charge
 * donc une fois la (très courte) liste des comptes distingués et on la garde en
 * mémoire, indexée par pseudo normalisé.
 */

export type BadgeId = 'founder' | 'og' | 'donor';
export const BADGE_IDS: BadgeId[] = ['founder', 'og', 'donor'];

export type OgProfile = {
  id: string;
  pseudo: string;
  founder: boolean;
  og: boolean;
  donor: boolean;
  /** Les badges que le joueur a choisi de masquer. */
  hidden: BadgeId[];
};

export type OgRegistry = Record<string, OgProfile>;

export const OG_BADGE_LABEL = 'OG';
export const OG_BADGE_TITLE = 'OG — membre de la première heure';
export const FOUNDER_BADGE_LABEL = 'FD';
export const FOUNDER_BADGE_TITLE = 'Fondateur d’IttolecHub';
export const DONOR_BADGE_LABEL = 'DON';
export const DONOR_BADGE_TITLE = 'Donateur — soutient IttolecHub';

export const BADGE_INFO: Record<BadgeId, { title: string; hint: string }> = {
  founder: { title: FOUNDER_BADGE_TITLE, hint: 'Fondateur d’IttolecHub' },
  og: { title: OG_BADGE_TITLE, hint: 'Membre de la première heure' },
  donor: { title: DONOR_BADGE_TITLE, hint: 'A soutenu le site par un don' },
};

/** Les badges que ce compte possède, qu'ils soient affichés ou non. */
export function ownedBadges(p: OgProfile): BadgeId[] {
  return BADGE_IDS.filter((b) => p[b]);
}

/**
 * Les badges à afficher à côté du pseudo, dans l'ordre. Fondateur et OG ne se
 * cumulent pas (le Fondateur passe avant) ; Donateur s'ajoute à l'un ou l'autre.
 */
export function shownBadges(p: OgProfile): BadgeId[] {
  const on = (b: BadgeId) => p[b] && !p.hidden.includes(b);
  const out: BadgeId[] = [];
  if (on('founder')) out.push('founder');
  else if (on('og')) out.push('og');
  if (on('donor')) out.push('donor');
  return out;
}

/** Les pseudos changent de casse au fil des renommages : on compare à plat. */
export const ogKey = (name: string) => name.trim().toLowerCase();

const EMPTY: OgRegistry = {};
/** Au-delà, la liste est relue au retour sur l'onglet. */
const STALE_AFTER_MS = 2 * 60 * 1000;

let registry: OgRegistry = EMPTY;
let fetchedAt = 0;
let loaded = false;
let inflight: Promise<void> | null = null;
let watching = false;

const listeners = new Set<() => void>();

async function load(): Promise<void> {
  const { data, error } = await supabase
    .from('users')
    .select('id, pseudo, is_og, is_founder, is_donor, hidden_badges')
    .or('is_og.eq.true,is_founder.eq.true,is_donor.eq.true');

  // Base pas encore migrée : pas de badge, mais surtout pas de page cassée.
  if (error) {
    loaded = true;
    return;
  }

  const next: OgRegistry = {};
  for (const row of data || []) {
    if (!row?.pseudo) continue;
    next[ogKey(row.pseudo)] = {
      id: row.id,
      pseudo: row.pseudo,
      founder: row.is_founder === true,
      og: row.is_og === true,
      donor: row.is_donor === true,
      hidden: ((row.hidden_badges as string[] | null) || []).filter((b): b is BadgeId => (BADGE_IDS as string[]).includes(b)),
    };
  }

  registry = next;
  loaded = true;
  fetchedAt = Date.now();
  listeners.forEach((l) => l());
}

function start(): Promise<void> {
  if (inflight) return inflight;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Charge la liste au premier besoin, puis ne fait plus rien. */
export function ensureOgLoaded(): void {
  if (loaded) return;
  void start();
}

/** Relit la liste tout de suite (après un changement de pseudo, un toggle…). */
export function refreshOg(): Promise<void> {
  loaded = false;
  return start();
}

/**
 * Un onglet laissé ouvert pendant des heures afficherait une liste périmée :
 * on la relit quand le joueur revient dessus.
 */
export function watchOgFreshness(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - fetchedAt < STALE_AFTER_MS) return;
    void refreshOg();
  });
}

export function subscribeOg(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getOgRegistry = () => registry;
/** Rien côté serveur : le badge apparaît au premier rendu client. */
export const getOgRegistryServer = () => EMPTY;

export function ogProfileIn(reg: OgRegistry, name?: string | null): OgProfile | null {
  if (!name) return null;
  return reg[ogKey(name)] ?? null;
}

/** Affiche ou masque un badge précis sur son propre compte. */
export async function setBadgeVisible(userId: string, badge: BadgeId, visible: boolean): Promise<void> {
  const res = await fetch('/api/og', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, badge, visible }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Erreur');
  await refreshOg();
}
