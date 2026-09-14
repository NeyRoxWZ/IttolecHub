'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  OgProfile,
  OgRegistry,
  ensureOgLoaded,
  getOgRegistry,
  getOgRegistryServer,
  ogProfileIn,
  subscribeOg,
  watchOgFreshness,
} from '@/lib/og';

/** La liste des OG, chargée au premier composant qui la demande. */
export function useOgRegistry(): OgRegistry {
  const registry = useSyncExternalStore(subscribeOg, getOgRegistry, getOgRegistryServer);

  useEffect(() => {
    ensureOgLoaded();
    watchOgFreshness();
  }, []);

  return registry;
}

/** Le profil OG derrière un pseudo, ou null si ce joueur n'en est pas un. */
export function useOgProfile(name?: string | null): OgProfile | null {
  return ogProfileIn(useOgRegistry(), name);
}
