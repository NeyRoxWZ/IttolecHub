'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { seasonKey, getPrestigeTitle } from '@/lib/casino/meta';

type Tab = 'alltime' | 'season';

interface Row {
  pseudo: string;
  value: number;
  prestigeCount?: number;
}

const RANK_COLOR = ['text-accent-primary', 'text-tx-base', 'text-accent-secondary'];

export default function LeaderboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('alltime');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === 'alltime') {
      supabase
        .from('casino_wallets')
        .select('balance, prestige_count, users(pseudo)')
        .order('balance', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setRows((data || []).map((r: any) => ({ pseudo: r.users?.pseudo || '???', value: r.balance, prestigeCount: r.prestige_count })));
          setLoading(false);
        });
    } else {
      const key = seasonKey();
      supabase
        .from('casino_season_stats')
        .select('won, users(pseudo)')
        .eq('season_key', key)
        .order('won', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setRows((data || []).map((r: any) => ({ pseudo: r.users?.pseudo || '???', value: r.won })));
          setLoading(false);
        });
    }
  }, [tab]);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-2xl md:text-3xl font-black">Classement</h1>
        </header>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setTab('alltime')}
            className={cn('h-11 rounded-lg font-bold text-sm border-2 transition-colors focus:outline-none', tab === 'alltime' ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary')}
          >
            All-time (solde)
          </button>
          <button
            onClick={() => setTab('season')}
            className={cn('h-11 rounded-lg font-bold text-sm border-2 transition-colors focus:outline-none', tab === 'season' ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary')}
          >
            Cette saison (gains)
          </button>
        </div>

        {loading ? (
          <p className="text-tx-secondary text-center">Chargement...</p>
        ) : rows.length === 0 ? (
          <p className="text-tx-secondary text-center">Personne pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const prestigeTitle = r.prestigeCount ? getPrestigeTitle(r.prestigeCount) : null;
              return (
                <div key={i} className={cn('flex items-center gap-3 p-3 rounded-xl border-2 shadow-brutal', i < 3 ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-card')}>
                  <div className="w-8 flex items-center justify-center shrink-0">
                    {i < 3 ? <Medal className={cn('w-5 h-5', RANK_COLOR[i])} /> : <span className="font-display font-black text-tx-secondary">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.pseudo}</div>
                    {prestigeTitle && <div className="text-[10px] font-black uppercase tracking-widest text-accent-primary">{prestigeTitle}</div>}
                  </div>
                  <div className="font-display font-black tabular-nums shrink-0">{r.value.toLocaleString('fr-FR')} ₶</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
