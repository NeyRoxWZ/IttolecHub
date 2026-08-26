'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Award, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { ACHIEVEMENTS } from '@/lib/casino/meta';

export default function AchievementsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    supabase.from('casino_achievements_unlocked').select('achievement_id').eq('user_id', user.id).then(({ data }) => {
      setUnlockedIds(new Set((data || []).map((d) => d.achievement_id)));
      setLoaded(true);
    });
  }, [user]);

  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-black">Succès</h1>
            <p className="text-sm text-tx-secondary font-bold">{unlockedCount}/{ACHIEVEMENTS.length} débloqués</p>
          </div>
        </header>

        {!user && (
          <p className="text-tx-secondary mb-4">Connecte-toi pour suivre tes succès.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedIds.has(a.id);
            return (
              <div
                key={a.id}
                className={cn(
                  'rounded-2xl border-4 p-4 flex items-center gap-3 shadow-brutal transition-colors',
                  unlocked ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-card opacity-60'
                )}
              >
                <div className={cn('rounded-lg border-2 p-2 shrink-0', unlocked ? 'border-accent-primary bg-brand-inner' : 'border-brand-border bg-brand-inner')}>
                  {unlocked ? <Award className="h-5 w-5 text-accent-primary" /> : <Lock className="h-5 w-5 text-tx-muted" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-sm truncate">{a.name}</h3>
                  <p className="text-xs text-tx-secondary truncate">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
