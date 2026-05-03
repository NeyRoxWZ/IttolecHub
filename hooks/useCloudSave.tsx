'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type SaveData = Record<string, any>;

type CloudSaveOptions = {
  silent?: boolean;
};

function mergeWithDefaults<T>(defaults: T, loaded: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(loaded) ? (loaded as any) : defaults) as T;
  if (typeof defaults !== 'object' || defaults === null) return (loaded === undefined ? defaults : (loaded as any)) as T;

  const out: any = { ...(defaults as any) };
  if (typeof loaded !== 'object' || loaded === null) return out as T;

  for (const key of Object.keys(out)) {
    out[key] = mergeWithDefaults(out[key], (loaded as any)[key]);
  }
  for (const key of Object.keys(loaded as any)) {
    if (!(key in out)) out[key] = (loaded as any)[key];
  }
  return out as T;
}

export function useCloudSave<T extends SaveData>(gameSlug: string, initialData: T, options?: CloudSaveOptions) {
  const { user } = useAuth();
  const [data, setData] = useState<T>(initialData);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'local'>('idle');
  const dataRef = useRef(data);
  const [isLoaded, setIsLoaded] = useState(false);
  const syncInFlightRef = useRef(false);
  const lastSyncAttemptAtRef = useRef<number | null>(null);

  // Mettre à jour la ref à chaque changement de data pour le setInterval
  useEffect(() => {
    dataRef.current = data;
    if (isLoaded) {
      // Toujours sauvegarder en local
      localStorage.setItem(`itollec_${gameSlug}_save`, JSON.stringify({
        data,
        updated_at: new Date().toISOString()
      }));
    }
  }, [data, gameSlug, isLoaded]);

  const loadData = useCallback(async () => {
    let cloudSave = null;
    let localSave = null;

    // Charger local
    const localRaw = localStorage.getItem(`itollec_${gameSlug}_save`);
    if (localRaw) {
      try {
        localSave = JSON.parse(localRaw);
      } catch (e) {}
    }

    // Charger cloud si connecté
    if (user) {
      try {
        const { data: cloudData, error } = await supabase
          .from('game_saves')
          .select('save_data, updated_at')
          .eq('user_id', user.id)
          .eq('game_slug', gameSlug)
          .maybeSingle();

        if (!error && cloudData) {
          cloudSave = {
            data: cloudData.save_data,
            updated_at: cloudData.updated_at
          };
        }
      } catch (e) {
      }
    }

    // Résolution de conflit : le plus récent gagne
    let finalData = initialData;
    let finalTime = new Date(0);

    if (cloudSave && cloudSave.updated_at) {
      const cloudTime = new Date(cloudSave.updated_at);
      if (cloudTime > finalTime) {
        finalData = cloudSave.data as T;
        finalTime = cloudTime;
      }
    }

    if (localSave && localSave.updated_at) {
      const localTime = new Date(localSave.updated_at);
      if (localTime > finalTime) {
        finalData = localSave.data as T;
        finalTime = localTime;
      }
    }

    // Fusionner avec les valeurs par défaut pour éviter les clés manquantes
    setData(mergeWithDefaults(initialData, finalData));
    setLastSync(finalTime.getTime() > 0 ? finalTime : new Date());
    setIsLoaded(true);
    
    if (!user) {
      setSyncStatus('local');
      if (!options?.silent) {
        toast('Mode local. Connecte-toi pour sauvegarder dans le cloud.', {
          icon: '⚠️',
          duration: 4000
        });
      }
    } else {
      setSyncStatus('idle');
    }
  }, [user, gameSlug, initialData, options?.silent]);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, [loadData]);

  const syncOnce = useCallback(async () => {
    if (!user || !isLoaded) return;
    if (syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setSyncStatus('syncing');

    try {
      const currentData = dataRef.current;
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('game_saves')
        .upsert(
          {
            user_id: user.id,
            game_slug: gameSlug,
            save_data: currentData,
            updated_at: now,
          },
          {
            onConflict: 'user_id, game_slug',
          }
        );

      if (error) throw error;

      setLastSync(new Date(now));
      setSyncStatus('idle');
    } catch (error) {
      setSyncStatus('error');
    } finally {
      syncInFlightRef.current = false;
    }
  }, [user, isLoaded, gameSlug]);

  // Synchronisation toutes les 30s (sans setInterval)
  useEffect(() => {
    if (!user || !isLoaded) return;

    let rafId = 0;
    let cancelled = false;

    const loop = (ts: number) => {
      if (cancelled) return;
      if (lastSyncAttemptAtRef.current === null) lastSyncAttemptAtRef.current = ts;

      const elapsed = ts - (lastSyncAttemptAtRef.current ?? ts);
      if (elapsed >= 30000) {
        lastSyncAttemptAtRef.current = ts;
        void syncOnce();
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [user, isLoaded, syncOnce]);

  const forceSync = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('game_saves')
        .upsert({
          user_id: user.id,
          game_slug: gameSlug,
          save_data: dataRef.current,
          updated_at: now
        }, {
          onConflict: 'user_id, game_slug'
        });

      if (error) throw error;
      setLastSync(new Date(now));
      setSyncStatus('idle');
      if (!options?.silent) toast.success('Sauvegarde synchronisée');
    } catch (error) {
      setSyncStatus('error');
      if (!options?.silent) toast.error('Erreur de synchronisation');
    }
  };

  return {
    data,
    setData,
    lastSync,
    syncStatus,
    forceSync,
    isLoaded
  };
}
