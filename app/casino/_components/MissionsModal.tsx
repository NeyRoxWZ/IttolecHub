'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Check, Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { MISSION_SCOPES, SCOPE_LABEL, SCOPE_HINT, type MissionScope } from '@/lib/casino/missions';
import CommunityQuestPanel, { useCommunity } from './CommunityQuest';
import { celebrate } from '@/lib/casino/celebrate';
import { askToSignIn } from '@/lib/askToSignIn';

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
  return (
    <div className="fixed inset-0 z-[200] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-3xl leading-none flex items-center gap-2">
              <Target className="h-5 w-5 text-accent-primary" /> Missions
            </h2>
            <p className="text-xs font-bold text-tx-secondary mt-2">Trois horloges, trois listes.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>
        <MissionsBody missions={missions} onClaimed={onClaimed} />
      </div>
    </div>
  );
}

/** The tabs and lists, shared by the modal (desktop hub) and the Missions page (phones). */
export function MissionsBody({ missions, onClaimed }: { missions: MissionView[]; onClaimed: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<MissionScope | 'commun'>('jour');
  const { state: community } = useCommunity();

  // Open on whichever category has something to collect.
  useEffect(() => {
    const ready = MISSION_SCOPES.find((scope) =>
      missions.some((m) => m.scope === scope && m.complete && !m.claimed));
    if (ready) setTab(ready);
  }, [missions]);

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
    <>
        {missions.length === 0 && (
          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-4 text-center">
            <p className="text-sm font-bold text-tx-secondary">Les missions demandent un compte : elles se remplissent pendant que tu joues et donnent des ₶ et de l’XP.</p>
            <button onClick={() => askToSignIn('Les missions')} className="mt-3 h-11 px-4 rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-base shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A] active:translate-y-[2px]">
              Se connecter
            </button>
          </div>
        )}

        {missions.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {MISSION_SCOPES.map((scope) => {
                const group = missions.filter((m) => m.scope === scope);
                const ready = group.filter((m) => m.complete && !m.claimed).length;
                return (
                  <button
                    key={scope}
                    onClick={() => { sfx.click(); setTab(scope); }}
                    className={cn(
                      'relative h-14 rounded-xl border-[3px] px-1 flex flex-col items-center justify-center focus:outline-none transition-transform active:translate-y-[2px]',
                      tab === scope
                        ? 'border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A]'
                        : 'border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
                    )}
                  >
                    <span className="font-display text-sm leading-none">{SCOPE_LABEL[scope]}</span>
                    <span className="text-[11px] font-black opacity-80 mt-0.5">
                      {group.filter((m) => m.claimed).length}/{group.length}
                    </span>
                    {ready > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-xs flex items-center justify-center">
                        {ready}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* The shared goal sits with the others: it is a goal too. */}
              <button
                onClick={() => { sfx.click(); setTab('commun'); }}
                className={cn(
                  'relative h-14 rounded-xl border-[3px] px-1 flex flex-col items-center justify-center focus:outline-none transition-transform active:translate-y-[2px]',
                  tab === 'commun'
                    ? 'border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A]'
                    : 'border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
                )}
              >
                <span className="font-display text-sm leading-none">Commun</span>
                <span className="text-[11px] font-black opacity-80 mt-0.5">
                  {community ? `${Math.min(100, Math.round((community.progress / community.target) * 100))}%` : '···'}
                </span>
                {community?.completed && community.you && !community.you.claimed && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-xs flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>

            {tab === 'commun' ? (
              <CommunityQuestPanel />
            ) : (
              <>
                <p className="text-xs font-bold text-tx-secondary mb-2">{SCOPE_HINT[tab]}</p>

                <div className="space-y-2.5">
                  {missions.filter((m) => m.scope === tab).map((m) => {
                const pct = Math.min(100, (m.value / m.target) * 100);
                const key = `${m.scope}:${m.slot}`;
                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-2xl border-[3px] border-brand-border p-3',
                      m.claimed ? 'bg-brand-inner opacity-55'
                        : m.complete ? 'bg-[#16503A]'
                        : 'bg-brand-inner'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-black text-sm">{m.label}</span>
                      <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-sm shrink-0 tabular-nums">
                        +{m.reward.toLocaleString('en-US')} ₶
                      </span>
                    </div>

                    <div className="h-3 rounded-full bg-brand-bg border-2 border-brand-border overflow-hidden mb-2">
                      <div
                        className={cn('h-full transition-[width] duration-500', m.complete ? 'bg-accent-success' : 'bg-accent-primary')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-tx-secondary tabular-nums">
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
                          className="h-10 px-4 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display text-base shadow-[inset_0_-4px_0_#1E9A55,0_3px_0_#05061A] active:translate-y-[2px] disabled:opacity-50 focus:outline-none transition-transform"
                        >
                          {busy === key ? '···' : 'Réclamer'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
                  })}
                </div>
              </>
            )}
          </>
        )}
    </>
  );
}
