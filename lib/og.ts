import { supabase } from '@/lib/supabase/client';

/**
 * Les distinctions de compte : badge OG et badge Fondateur.
 *
 * Elles sont posées sur le compte (colonnes `users.is_og` et `users.is_founder`),
 * jamais sur le pseudo : un joueur qui change de pseudo garde ses badges. Chacun
 * choisit de les afficher ou de les masquer (`users.og_badge_visible`).
 *
 * Le site affiche des pseudos un peu partout — classements, salons, parties
 * multijoueurs — et souvent sans identifiant de compte sous la main. On charge
 * donc une fois la (très courte) liste des comptes distingués et on la garde en
 * mémoire, indexée par pseudo normalisé.
 */

export type OgProfile = {
  id: string;
  pseudo: string;
  /** Le joueur a choisi d'afficher sa distinction. */
  visible: boolean;
  /** Fondateur du site : passe avant le badge OG. */
  founder: boolean;
};

export type OgRegistry = Record<string, OgProfile>;

export const OG_BADGE_LABEL = 'OG';
export const OG_BADGE_TITLE = 'OG — membre de la première heure';
export const FOUNDER_BADGE_LABEL = 'FD';
export const FOUNDER_BADGE_TITLE = 'Fondateur d’IttolecHub';

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
    .select('id, pseudo, og_badge_visible, is_founder')
    .or('is_og.eq.true,is_founder.eq.true');

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
      visible: row.og_badge_visible !== false,
      founder: row.is_founder === true,
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

/** Met à jour le choix affiché/masqué d'un joueur distingué. */
export async function setOgBadgeVisible(userId: string, visible: boolean): Promise<void> {
  const res = await fetch('/api/og', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, visible }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Erreur');
  await refreshOg();
}
