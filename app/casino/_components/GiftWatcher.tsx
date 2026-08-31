'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';

const SEEN_KEY = 'itollec_casino_last_gift';

/**
 * Tells you when somebody sends you coins.
 *
 * A push notification only reaches the people who turned them on, and the
 * money simply appeared in the balance with nothing to say where it came
 * from. This covers both cases: the table pushes gifts that arrive while the
 * page is open, and anything received since the last visit is announced on
 * arrival.
 */
export default function GiftWatcher() {
  const { user } = useAuth();
  const { refresh } = useCasinoWallet();
  const router = useRouter();
  const announced = useRef<Set<string>>(new Set());

  const announce = useCallback((pseudo: string, amount: number, message: string | null, key: string) => {
    if (announced.current.has(key)) return;
    announced.current.add(key);

    sfx.bigWin();
    toast.success(`${pseudo} t’a offert ${Math.round(amount).toLocaleString('en-US')} ₶`, {
      description: message ? `« ${message} »` : undefined,
      duration: 8000,
      action: { label: 'Voir', onClick: () => router.push('/casino/potes') },
    });
    void refresh();
  }, [refresh, router]);

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
      // Newest first from the API, so announce in the order they happened.
      for (const g of fresh.slice(0, 3).reverse()) {
        announce(g.pseudo, g.amount, g.message, g.at);
      }

      const newest = data.received?.[0]?.at;
      if (newest) { try { localStorage.setItem(SEEN_KEY, newest); } catch {} }
    })();

    return () => { cancelled = true; };
  }, [user, announce]);

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
          announce(data?.pseudo || 'Quelqu’un', Number(row.amount), row.message, row.created_at);
          try { localStorage.setItem(SEEN_KEY, row.created_at); } catch {}
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, announce]);

  return null;
}
