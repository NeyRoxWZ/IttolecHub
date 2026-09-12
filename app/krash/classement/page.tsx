'use client';

import { useEffect, useState } from 'react';
import { Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import KrashShell from '../_components/KrashShell';

type Tab = 'realized_pnl' | 'best_trade' | 'volume';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'realized_pnl', label: 'Profit total', hint: 'Tout ce que tes trades fermés ont rapporté, frais compris.' },
  { id: 'best_trade', label: 'Meilleur coup', hint: 'Le plus gros gain sur un seul trade.' },
  { id: 'volume', label: 'Volume', hint: 'Le montant total engagé, levier compris.' },
];

interface Row {
  user_id: string;
  pseudo: string;
  value: number;
  trades: number;
  wins: number;
}

const MEDAL = ['text-accent-primary', 'text-tx-base', 'text-accent-secondary'];

export default function KrashLeaderboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('realized_pnl');
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setRows(null);
    supabase
      .from('krash_stats')
      .select(`user_id, trades, wins, ${tab}, users(pseudo)`)
      .gt('trades', 0)
      .order(tab, { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRows((data || []).map((r: any) => ({
          user_id: r.user_id,
          pseudo: r.users?.pseudo ?? '???',
          value: Number(r[tab]),
          trades: r.trades,
          wins: r.wins,
        })));
      });
  }, [tab]);

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <KrashShell title="Classement">
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-3 gap-2 mb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'h-11 rounded-xl border-2 font-display font-black text-[11px] tracking-wider uppercase transition-colors',
                tab === t.id ? 'border-rose-400 text-rose-300 bg-brand-inner' : 'border-brand-border text-tx-muted hover:text-tx-base'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-tx-muted mb-5">{current.hint}</p>

        {rows === null ? (
          <p className="text-tx-muted text-center py-10">Chargement…</p>
        ) : rows.length === 0 ? (
          <div className="bg-brand-card border-4 border-brand-border rounded-[28px] p-8 shadow-brutal text-center">
            <p className="font-display font-black text-lg">Personne n’a encore tradé.</p>
            <p className="text-tx-muted text-sm mt-1">Le premier trade fermé t’y place.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => {
              const me = r.user_id === user?.id;
              const signed = tab === 'realized_pnl';
              return (
                <div
                  key={r.user_id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 shadow-brutal',
                    me ? 'border-rose-400 bg-rose-400/10' : i < 3 ? 'border-accent-primary/60 bg-brand-card' : 'border-brand-border bg-brand-card'
                  )}
                >
                  <div className="w-8 flex justify-center shrink-0">
                    {i < 3 ? <Medal className={cn('h-5 w-5', MEDAL[i])} /> : <span className="font-display font-black text-tx-secondary">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.pseudo}{me && <span className="text-rose-300"> · toi</span>}</div>
                    <div className="text-[11px] text-tx-muted">
                      {r.trades} trade{r.trades > 1 ? 's' : ''} · {Math.round((r.wins / Math.max(1, r.trades)) * 100)} % gagnants
                    </div>
                  </div>
                  <div className={cn(
                    'font-display font-black tabular-nums shrink-0',
                    signed ? (r.value >= 0 ? 'text-accent-success' : 'text-accent-secondary') : 'text-tx-base'
                  )}>
                    {signed && r.value > 0 ? '+' : ''}{r.value.toLocaleString('fr-FR')} ₶
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </KrashShell>
  );
}
