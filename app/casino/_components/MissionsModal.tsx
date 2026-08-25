'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Check, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';

export interface MissionView {
  slot: number;
  id: string;
  label: string;
  target: number;
  reward: number;
  xp: number;
  value: number;
  complete: boolean;
  claimed: boolean;
}

/** Poll-free fetch of today's missions; the hub refreshes it on open. */
export function useMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<MissionView[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setMissions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/casino/missions?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const claimable = missions.filter((m) => m.complete && !m.claimed).length;
  return { missions, loading, reload: load, claimable };
}

export default function MissionsModal({
  missions, onClose, onClaimed,
}: {
  missions: MissionView[];
  onClose: () => void;
  onClaimed: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<number | null>(null);

  const claim = async (slot: number) => {
    if (!user || busy !== null) return;
    setBusy(slot);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, slot }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      sfx.coin();
      toast.success(`+${data.reward.toLocaleString('fr-FR')} ₶`, { description: `+${data.xp} XP` });
      onClaimed();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <Target className="h-5 w-5 text-accent-primary" /> Missions du jour
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">Nouvelles missions chaque jour à minuit.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {missions.length === 0 && (
          <p className="text-sm text-tx-secondary">Connecte-toi pour recevoir tes missions quotidiennes.</p>
        )}

        <div className="space-y-3">
          {missions.map((m) => {
            const pct = Math.min(100, (m.value / m.target) * 100);
            return (
              <div key={m.slot} className={cn('rounded-xl border-2 p-3', m.claimed ? 'border-brand-border opacity-50' : m.complete ? 'border-accent-success bg-accent-success/10' : 'border-brand-border bg-brand-inner')}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-bold text-sm">{m.label}</span>
                  <span className="text-[11px] font-black text-accent-primary shrink-0 tabular-nums">
                    +{m.reward.toLocaleString('fr-FR')} ₶
                  </span>
                </div>
                <div className="h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden mb-2">
                  <div className={cn('h-full transition-[width] duration-500', m.complete ? 'bg-accent-success' : 'bg-accent-primary')} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-tx-muted tabular-nums">
                    {Math.min(m.value, m.target).toLocaleString('fr-FR')} / {m.target.toLocaleString('fr-FR')} · +{m.xp} XP
                  </span>
                  {m.claimed ? (
                    <span className="text-[11px] font-black text-tx-muted flex items-center gap-1"><Check className="h-3 w-3" /> Réclamée</span>
                  ) : m.complete ? (
                    <button
                      onClick={() => claim(m.slot)}
                      disabled={busy !== null}
                      className="h-8 px-3 rounded-lg border-2 border-accent-success bg-accent-success text-brand-bg font-black text-[11px] hover:brightness-110 disabled:opacity-50 focus:outline-none active:scale-95 transition-transform"
                    >
                      {busy === m.slot ? '···' : 'RÉCLAMER'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
