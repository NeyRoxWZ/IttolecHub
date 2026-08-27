'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Check, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { MISSION_SCOPES, SCOPE_LABEL, SCOPE_HINT, type MissionScope } from '@/lib/casino/missions';
import { celebrate } from '@/lib/casino/celebrate';

export interface MissionView {
  scope: MissionScope;
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
  const [busy, setBusy] = useState<string | null>(null);

  const claim = async (mission: MissionView) => {
    if (!user || busy !== null) return;
    const key = `${mission.scope}:${mission.slot}`;
    setBusy(key);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, slot: mission.slot, scope: mission.scope }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      sfx.coin();
      toast.success(`+${data.reward.toLocaleString('en-US')} ₶`, { description: `+${data.xp} XP` });
      if (data.pass?.unlocked?.length) celebrate({ kind: 'pass_tier', tiers: data.pass.unlocked });
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
              <Target className="h-5 w-5 text-accent-primary" /> Missions
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">
              Trois horloges : le jour, la semaine, et celles qui ne se remettent jamais à zéro.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {missions.length === 0 && (
          <p className="text-sm text-tx-secondary">Connecte-toi pour recevoir tes missions.</p>
        )}

        <div className="space-y-5">
          {MISSION_SCOPES.map((scope) => {
            const group = missions.filter((m) => m.scope === scope);
            if (group.length === 0) return null;
            const done = group.filter((m) => m.claimed).length;

            return (
              <div key={scope}>
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary">
                    {SCOPE_LABEL[scope]}
                  </span>
                  <span className="text-[10px] font-bold text-tx-muted">
                    {done}/{group.length} · {SCOPE_HINT[scope]}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {group.map((m) => {
                    const pct = Math.min(100, (m.value / m.target) * 100);
                    const key = `${m.scope}:${m.slot}`;
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-xl border-2 p-3',
                          m.claimed ? 'border-brand-border opacity-50'
                            : m.complete ? 'border-accent-success bg-accent-success/10'
                            : 'border-brand-border bg-brand-inner'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-bold text-sm">{m.label}</span>
                          <span className="text-[11px] font-black text-accent-primary shrink-0 tabular-nums">
                            +{m.reward.toLocaleString('en-US')} ₶
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden mb-2">
                          <div
                            className={cn('h-full transition-[width] duration-500', m.complete ? 'bg-accent-success' : 'bg-accent-primary')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-tx-muted tabular-nums">
                            {Math.min(m.value, m.target).toLocaleString('en-US')} / {m.target.toLocaleString('en-US')} · +{m.xp} XP
                          </span>
                          {m.claimed ? (
                            <span className="text-[11px] font-black text-tx-muted flex items-center gap-1">
                              <Check className="h-3 w-3" /> Réclamée
                            </span>
                          ) : m.complete ? (
                            <button
                              onClick={() => claim(m)}
                              disabled={busy !== null}
                              className="h-8 px-3 rounded-lg border-2 border-accent-success bg-accent-success text-brand-bg font-black text-[11px] hover:brightness-110 disabled:opacity-50 focus:outline-none active:scale-95 transition-transform"
                            >
                              {busy === key ? '···' : 'RÉCLAMER'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
