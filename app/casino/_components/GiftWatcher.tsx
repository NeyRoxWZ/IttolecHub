'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift } from 'lucide-react';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';

const SEEN_KEY = 'itollec_casino_last_gift';

interface IncomingGift {
  key: string;
  pseudo: string;
  amount: number;
  message: string | null;
}

/**
 * Tells you when somebody sends you coins.
 *
 * It started as a toast, and a toast is easy to miss: it slides away while you
 * are mid-spin, and the only lasting trace was a balance that had quietly gone
 * up. A gift is now a window you have to close, one per gift, so it is seen.
 *
 * Two ways in: the table pushes gifts that land while the page is open, and
 * anything received since the last visit is shown on arrival.
 */
export default function GiftWatcher() {
  const { user } = useAuth();
  const { refresh } = useCasinoWallet();
  const router = useRouter();
  const [queue, setQueue] = useState<IncomingGift[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const enqueue = useCallback((gift: IncomingGift) => {
    if (seen.current.has(gift.key)) return;
    seen.current.add(gift.key);
    setQueue((q) => [...q, gift]);
    void refresh();
  }, [refresh]);

  // Sound once per gift as it reaches the front of the queue.
  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    sfx.bigWin();
    vibrate(HAPTIC.SUCCESS);
  }, [current?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // What landed while we were away.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const res = await fetch(`/api/casino/gifts?user_id=${user.id}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();

      let since = '';
      try { since = localStorage.getItem(SEEN_KEY) || ''; } catch {}

      const fresh = (data.received || []).filter((g: any) => !since || g.at > since);
      // Newest first from the API; show them in the order they happened.
      for (const g of fresh.slice(0, 5).reverse()) {
        enqueue({ key: g.at, pseudo: g.pseudo, amount: Number(g.amount), message: g.message });
      }

      const newest = data.received?.[0]?.at;
      if (newest) { try { localStorage.setItem(SEEN_KEY, newest); } catch {} }
    })();

    return () => { cancelled = true; };
  }, [user, enqueue]);

  // And what lands while we are here.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`casino_gifts:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'casino_gifts', filter: `to_user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as any;
          const { data } = await supabase.from('users').select('pseudo').eq('id', row.from_user_id).maybeSingle();
          enqueue({
            key: row.created_at,
            pseudo: data?.pseudo || 'Quelqu’un',
            amount: Number(row.amount),
            message: row.message,
          });
          try { localStorage.setItem(SEEN_KEY, row.created_at); } catch {}
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, enqueue]);

  if (!current) return null;

  const close = () => {
    sfx.click();
    setQueue((q) => q.slice(1));
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-brand-card border-4 border-accent-success rounded-[28px] p-6 shadow-brutal text-center animate-in zoom-in-95 duration-200">
        <div className="mx-auto h-16 w-16 rounded-2xl border-4 border-accent-success bg-accent-success/15 flex items-center justify-center mb-3">
          <Gift className="h-8 w-8 text-accent-success" />
        </div>

        <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">Cadeau reçu</div>
        <div className="font-display text-lg font-black mt-1">
          {current.pseudo} t&apos;a envoyé
        </div>
        <div className="font-display text-4xl font-black text-accent-success tabular-nums mt-1">
          +{Math.round(current.amount).toLocaleString('en-US')} ₶
        </div>

        {current.message && (
          <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-inner p-3 text-sm text-tx-secondary italic break-words">
            « {current.message} »
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => { close(); router.push('/casino/potes'); }}
            className="h-12 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary focus:outline-none"
          >
            VOIR
          </button>
          <button
            onClick={close}
            className="flex-1 h-12 rounded-xl bg-accent-success text-brand-bg font-display font-black tracking-wider border-2 border-brand-border focus:outline-none"
          >
            {queue.length > 1 ? `MERCI · ${queue.length - 1} DE PLUS` : 'MERCI !'}
          </button>
        </div>
      </div>
    </div>
  );
}
