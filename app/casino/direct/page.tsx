'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Radio, TrendingUp, TrendingDown, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { supabase } from '@/lib/supabase/client';
import { GAME_LABELS } from '@/lib/casino/cosmetics';
import PlayerCard from '../_components/PlayerCard';
import CasinoControls from '../_components/CasinoControls';

interface LiveRow {
  id: number;
  pseudo: string;
  game_slug: string;
  amount: number;
  multiplier: number;
  created_at: string;
}

const MAX_ROWS = 200;

function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} j`;
}

/**
 * Everything everyone wins and loses, as it happens. New rows arrive over the
 * realtime channel and slide in at the top; pausing freezes the list so a line
 * can actually be read instead of scrolling away mid-sentence.
 */
export default function LivePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [paused, setPaused] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<number, { counts: Record<string, number>; mine: string | null }>>({});
  const [emoji, setEmoji] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const bufferRef = useRef<LiveRow[]>([]);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const load = useCallback(async () => {
    const res = await fetch(`/api/casino/live?limit=120${user ? `&user_id=${user.id}` : ''}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.live || []);
      setReactions(data.reactions || {});
      setEmoji(data.emoji || []);
    }
  }, [user]);

  const react = async (liveId: number, e: string) => {
    if (!user) { toast.error('Connecte-toi pour réagir.'); return; }
    sfx.click();
    // Optimistic: the tape moves fast and a round trip before the emoji
    // appears makes it feel like the tap missed.
    setReactions((r) => {
      const cur = r[liveId] || { counts: {}, mine: null };
      const counts = { ...cur.counts };
      if (cur.mine) counts[cur.mine] = Math.max(0, (counts[cur.mine] || 1) - 1);
      const mine = cur.mine === e ? null : e;
      if (mine) counts[mine] = (counts[mine] || 0) + 1;
      return { ...r, [liveId]: { counts, mine } };
    });
    await fetch('/api/casino/live', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, live_id: liveId, emoji: e }),
    });
  };

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel('casino_live_page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'casino_live' }, (p) => {
        const row = p.new as LiveRow;
        // While paused, new rows pile up rather than being dropped.
        if (pausedRef.current) {
          bufferRef.current = [row, ...bufferRef.current].slice(0, MAX_ROWS);
          return;
        }
        setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Flush what came in while paused.
  useEffect(() => {
    if (paused || bufferRef.current.length === 0) return;
    setRows((prev) => [...bufferRef.current, ...prev].slice(0, MAX_ROWS));
    bufferRef.current = [];
  }, [paused]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const totals = useMemo(() => {
    const won = rows.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
    const lost = rows.filter((r) => r.amount < 0).reduce((s, r) => s - Number(r.amount), 0);
    return { won, lost, net: won - lost };
  }, [rows]);

  return (
    <main className="min-h-[100dvh] bg-transparent text-tx-base p-3 sm:p-4">
      {opened && <PlayerCard pseudo={opened} onClose={() => setOpened(null)} />}

      <div className="max-w-3xl mx-auto">
        <header className="flex items-center gap-3 mb-3 flex-wrap">
          <Link
            href="/casino"
            prefetch
            className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-black leading-none flex items-center gap-2">
              En direct
              <Radio className={cn('h-4 w-4 text-accent-secondary', !paused && 'animate-pulse')} />
            </h1>
            <p className="text-[11px] text-tx-muted">Tout ce que tout le monde gagne et perd, en temps réel.</p>
          </div>

          <button
            onClick={() => { sfx.click(); setPaused((p) => !p); }}
            className={cn(
              'ml-auto h-11 px-3 rounded-xl border-2 flex items-center gap-2 font-display font-black text-xs tracking-wider focus:outline-none transition-colors',
              paused ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
            )}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? `REPRENDRE${bufferRef.current.length ? ` (${bufferRef.current.length})` : ''}` : 'PAUSE'}
          </button>
          <CasinoControls />
        </header>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Gagné', value: totals.won, tone: 'text-accent-success', icon: TrendingUp },
            { label: 'Perdu', value: totals.lost, tone: 'text-accent-secondary', icon: TrendingDown },
            { label: 'Solde net', value: totals.net, tone: totals.net >= 0 ? 'text-accent-success' : 'text-accent-secondary', icon: Radio },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-card p-3">
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-tx-muted">
                <s.icon className="h-3 w-3" /> {s.label}
              </div>
              <div className={cn('font-display font-black text-lg tabular-nums', s.tone)}>
                {s.value > 0 && s.label === 'Solde net' ? '+' : ''}{s.value.toLocaleString('en-US')} ₶
              </div>
            </div>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-tx-secondary text-center py-10">
            Rien pour l&apos;instant. La première mise apparaîtra ici.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => {
              const win = r.amount > 0;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all',
                    'animate-in slide-in-from-top-2 fade-in duration-300',
                    win ? 'border-accent-success/40 bg-accent-success/5' : 'border-brand-border bg-brand-card'
                  )}
                >
                  <div className="flex items-center gap-3">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', win ? 'bg-accent-success' : 'bg-accent-secondary')} />

                  <button
                    onClick={() => { sfx.click(); setOpened(r.pseudo); }}
                    className="font-black text-sm truncate max-w-[120px] hover:text-accent-primary focus:outline-none"
                  >
                    {r.pseudo}
                  </button>
                  <span className="text-[11px] text-tx-muted shrink-0">sur</span>
                  <span className="text-[11px] font-bold text-tx-secondary truncate">
                    {GAME_LABELS[r.game_slug] || r.game_slug}
                  </span>

                  {Number(r.multiplier) > 1 && (
                    <span className="text-[11px] font-black text-accent-primary tabular-nums shrink-0">
                      ×{Number(r.multiplier)}
                    </span>
                  )}

                  <span className={cn(
                    'ml-auto font-display font-black text-sm tabular-nums shrink-0',
                    win ? 'text-accent-success' : 'text-accent-secondary'
                  )}>
                    {win ? '+' : ''}{Number(r.amount).toLocaleString('en-US')} ₶
                  </span>

                  <span className="text-[10px] font-bold text-tx-muted tabular-nums w-12 text-right shrink-0">
                    {relativeTime(r.created_at, now)}
                  </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1.5 pl-5">
                    {emoji.map((e) => {
                      const n = reactions[r.id]?.counts?.[e] || 0;
                      const mine = reactions[r.id]?.mine === e;
                      // A reaction nobody has used stays faint until hovered:
                      // five bright buttons on every line would drown the tape.
                      return (
                        <button
                          key={e}
                          onClick={() => void react(r.id, e)}
                          className={cn(
                            'h-6 px-1.5 rounded-md border text-[11px] leading-none flex items-center gap-1 transition-all focus:outline-none',
                            mine ? 'border-accent-primary bg-accent-primary/15'
                                 : n > 0 ? 'border-brand-border bg-brand-inner'
                                 : 'border-transparent opacity-35 hover:opacity-100 hover:border-brand-border'
                          )}
                        >
                          <span>{e}</span>
                          {n > 0 && <span className="font-bold tabular-nums text-[10px]">{n}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
