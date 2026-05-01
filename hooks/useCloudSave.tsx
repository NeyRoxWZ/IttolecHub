'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type SaveData = Record<string, any>;

type CloudSaveOptions = {
  silent?: boolean;
};

export function useCloudSave<T extends SaveData>(gameSlug: string, initialData: T, options?: CloudSaveOptions) {
  const { user } = useAuth();
  const [data, setData] = useState<T>(initialData);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'local'>('idle');
  const dataRef = useRef(data);
  const [isLoaded, setIsLoaded] = useState(false);

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
        console.error('Erreur chargement cloud:', e);
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
    setData({ ...initialData, ...finalData });
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

  // Synchronisation toutes les 30s
  useEffect(() => {
    if (!user || !isLoaded) return;

    const interval = setInterval(async () => {
      setSyncStatus('syncing');
      try {
        const currentData = dataRef.current;
        const now = new Date().toISOString();

        const { error } = await supabase
          .from('game_saves')
          .upsert({
            user_id: user.id,
            game_slug: gameSlug,
            save_data: currentData,
            updated_at: now
          }, {
            onConflict: 'user_id, game_slug'
          });

        if (error) throw error;
        
        setLastSync(new Date(now));
        setSyncStatus('idle');
      } catch (error) {
        console.error('Erreur sync:', error);
        setSyncStatus('error');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, gameSlug]);

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
      console.error('Erreur sync forcée:', error);
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
