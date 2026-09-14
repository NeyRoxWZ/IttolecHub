import { supabase } from '@/lib/supabase/client';

/**
 * Le badge OG.
 *
 * La distinction est posée sur le compte (colonne `users.is_og`), jamais sur le
 * pseudo : un OG qui change de pseudo garde son badge. Chaque OG choisit de
 * l'afficher ou de le masquer (`users.og_badge_visible`).
 *
 * Le site affiche des pseudos un peu partout — classements, salons, parties
 * multijoueurs — et souvent sans identifiant de compte sous la main. On charge
 * donc une fois la (très courte) liste des OG et on la garde en mémoire,
 * indexée par pseudo normalisé.
 */

export type OgProfile = {
  id: string;
  pseudo: string;
  /** Le joueur a choisi d'afficher sa distinction. */
  visible: boolean;
};

export type OgRegistry = Record<string, OgProfile>;

export const OG_BADGE_LABEL = 'OG';
export const OG_BADGE_TITLE = 'OG — membre de la première heure';

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
    .select('id, pseudo, og_badge_visible')
    .eq('is_og', true);

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

/** Met à jour le choix affiché/masqué d'un OG. */
export async function setOgBadgeVisible(userId: string, visible: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ og_badge_visible: visible }).eq('id', userId);
  if (error) throw error;
  await refreshOg();
}
