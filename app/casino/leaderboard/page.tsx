'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { seasonKey, getPrestigeTitle } from '@/lib/casino/meta';
import { sfx } from '@/lib/casino/sfx';
import PlayerCard from '../_components/PlayerCard';
import CasinoControls from '../_components/CasinoControls';

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
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === 'alltime') {
      supabase
        .from('casino_wallets')
        .select('balance, prestige_count, users!casino_wallets_user_id_fkey(pseudo)')
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
    <main className="min-h-screen bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10">
      {opened && <PlayerCard pseudo={opened} onClose={() => setOpened(null)} />}

      <div className="max-w-7xl mx-auto [&>*]:max-w-3xl">
        <header className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/casino')} className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none">
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </button>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Classement</h1>
            <p className="text-[11px] text-tx-muted mt-1">Clique sur un joueur pour voir sa courbe.</p>
          </div>
          <CasinoControls className="ml-auto" />
        </header>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setTab('alltime')}
            className={cn('h-11 rounded-lg font-bold text-sm border-[3px] transition-colors focus:outline-none', tab === 'alltime' ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary')}
          >
            All-time (solde)
          </button>
          <button
            onClick={() => setTab('season')}
            className={cn('h-11 rounded-lg font-bold text-sm border-[3px] transition-colors focus:outline-none', tab === 'season' ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary')}
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
                <button
                  key={i}
                  onClick={() => { sfx.click(); setOpened(r.pseudo); }}
                  className={cn(
                    'w-full text-left flex items-center gap-3 p-3 rounded-xl border-[3px] shadow-brutal transition-all',
                    'hover:-translate-y-0.5 hover:border-accent-primary focus:outline-none',
                    i < 3 ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-card'
                  )}
                >
                  <div className="w-8 flex items-center justify-center shrink-0">
                    {i < 3 ? <Medal className={cn('w-5 h-5', RANK_COLOR[i])} /> : <span className="font-display text-tx-secondary">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.pseudo}</div>
                    {prestigeTitle && <div className="text-[10px] font-black uppercase tracking-widest text-accent-primary">{prestigeTitle}</div>}
                  </div>
                  <div className="font-display tabular-nums shrink-0">{r.value.toLocaleString('en-US')} ₶</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
