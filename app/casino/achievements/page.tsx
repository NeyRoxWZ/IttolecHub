'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Award, Lock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory } from '@/lib/casino/meta';

interface AchievementView {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  points: number;
  reward: number;
}

/** Point weights double as a difficulty badge. */
const TIER: { min: number; label: string; color: string }[] = [
  { min: 250, label: 'Mythique', color: '#FF4DA6' },
  { min: 100, label: 'Platine', color: '#B061FF' },
  { min: 50, label: 'Or', color: '#FFB300' },
  { min: 25, label: 'Argent', color: '#C7CBD6' },
  { min: 0, label: 'Bronze', color: '#A9743F' },
];

function tierOf(points: number) {
  return TIER.find((t) => points >= t.min) || TIER[TIER.length - 1];
}

export default function AchievementsPage() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementView[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState(0);
  const [filter, setFilter] = useState<AchievementCategory | 'tous'>('tous');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/achievements${qs}`);
    if (res.ok) {
      const data = await res.json();
      setAchievements(data.achievements || []);
      setUnlocked(new Set<string>(data.unlocked || []));
      setPoints(data.points || 0);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const totalPoints = useMemo(() => achievements.reduce((s, a) => s + a.points, 0), [achievements]);
  const shown = filter === 'tous' ? achievements : achievements.filter((a) => a.category === filter);
  const unlockedCount = achievements.filter((a) => unlocked.has(a.id)).length;

  return (
    <main className="min-h-[100dvh] bg-transparent text-tx-base p-3 sm:p-4">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center gap-3 mb-4 flex-wrap">
          <Link
            href="/casino"
            prefetch
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Succès</h1>
            <p className="text-[11px] text-tx-muted">
              {unlockedCount}/{achievements.length} débloqués · {points.toLocaleString('en-US')}/{totalPoints.toLocaleString('en-US')} points
            </p>
          </div>

          <div className="ml-auto h-11 min-w-[160px] rounded-xl border-2 border-brand-border bg-brand-card px-3 flex flex-col justify-center">
            <div className="h-2 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
              <div
                className="h-full bg-accent-primary transition-[width] duration-500"
                style={{ width: `${totalPoints > 0 ? (points / totalPoints) * 100 : 0}%` }}
              />
            </div>
          </div>
        </header>

        {!user && <p className="text-tx-secondary mb-4">Connecte-toi pour suivre tes succès.</p>}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          {([{ id: 'tous' as const, label: 'Tous' }, ...ACHIEVEMENT_CATEGORIES]).map((c) => {
            const inCat = c.id === 'tous' ? achievements : achievements.filter((a) => a.category === c.id);
            const got = inCat.filter((a) => unlocked.has(a.id)).length;
            return (
              <button
                key={c.id}
                onClick={() => { sfx.click(); setFilter(c.id as any); }}
                className={cn(
                  'h-9 px-3 rounded-xl border-2 shrink-0 font-display font-black text-[11px] focus:outline-none transition-colors',
                  filter === c.id ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                    : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
                )}
              >
                {c.label} <span className="text-[10px] text-tx-muted">{got}/{inCat.length}</span>
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[76px] rounded-xl border-2 border-brand-border bg-brand-card animate-pulse" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {shown.map((a) => {
            const got = unlocked.has(a.id);
            const tier = tierOf(a.points);
            return (
              <div
                key={a.id}
                className={cn(
                  'rounded-xl border-2 p-3 flex items-center gap-3 transition-colors',
                  got ? 'bg-brand-card' : 'bg-brand-card opacity-55'
                )}
                style={{ borderColor: got ? tier.color : undefined }}
              >
                <div
                  className="rounded-lg border-2 p-2 shrink-0"
                  style={{ borderColor: got ? tier.color : '#2A2A38', background: got ? `${tier.color}1A` : '#1A1A24' }}
                >
                  {got ? <Award className="h-5 w-5" style={{ color: tier.color }} /> : <Lock className="h-5 w-5 text-tx-muted" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-black text-[13px] truncate">{a.name}</h3>
                    {got && <Check className="h-3 w-3 shrink-0" style={{ color: tier.color }} />}
                  </div>
                  <p className="text-[11px] text-tx-secondary leading-tight line-clamp-2">{a.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: tier.color }}>
                    {tier.label}
                  </div>
                  <div className="text-[11px] font-black text-tx-muted tabular-nums">
                    +{a.reward.toLocaleString('en-US')} ₶
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
