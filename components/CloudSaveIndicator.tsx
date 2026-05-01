'use client';

import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'local';

interface CloudSaveIndicatorProps {
  status: SyncStatus;
  lastSync: Date | null;
  onForceSync?: () => void;
}

export function CloudSaveIndicator({ status, lastSync, onForceSync }: CloudSaveIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!lastSync) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - lastSync.getTime()) / 1000);
      if (diff < 60) setTimeAgo(`${diff}s`);
      else setTimeAgo(`${Math.floor(diff / 60)}m`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSync]);

  return (
    <div 
      className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-brand-surface/80 border border-white/10 shadow-sm backdrop-blur cursor-pointer hover:bg-brand-surface transition-colors"
      onClick={onForceSync}
      title={status === 'local' ? "Connecte-toi pour le cloud" : "Forcer la synchronisation"}
    >
      {status === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-primary" />}
      {status === 'idle' && <Cloud className="w-3.5 h-3.5 text-green-400" />}
      {status === 'error' && <CloudOff className="w-3.5 h-3.5 text-red-400" />}
      {status === 'local' && <CloudOff className="w-3.5 h-3.5 text-yellow-400" />}
      
      <span className="opacity-80">
        {status === 'syncing' ? 'Sync...' :
         status === 'local' ? 'Local' :
         status === 'error' ? 'Erreur' :
         lastSync ? `Il y a ${timeAgo}` : 'Non sauvé'}
      </span>
    </div>
  );
}
