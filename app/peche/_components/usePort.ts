'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export interface PortPlayer { userId: string; pseudo: string; zone: number; maree: number; mode: 'solo' | 'public' }
export interface PortCatch { key: number; userId: string; pseudo: string; speciesId: string; rarity: number; variant: string }

/**
 * The port, live: every open fishing page joins one realtime channel. Presence
 * says who is here, where and in which mode; broadcasts carry the catches of
 * people fishing at the public port, so everyone sees them pop above their
 * boat. Nothing is stored — closing the tab leaves the port.
 */
export function usePort(me: PortPlayer | null) {
  const [players, setPlayers] = useState<PortPlayer[]>([]);
  const [events, setEvents] = useState<PortCatch[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const key = me ? `${me.userId}:${me.zone}:${me.maree}:${me.mode}:${me.pseudo}` : '';

  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel('peche-port', { config: { presence: { key: me.userId }, broadcast: { self: false } } });
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PortPlayer>();
        const list = Object.values(state).map((entries) => entries[entries.length - 1]).filter(Boolean) as PortPlayer[];
        setPlayers(list.sort((a, b) => b.maree - a.maree || a.pseudo.localeCompare(b.pseudo)));
      })
      .on('broadcast', { event: 'catch' }, ({ payload }) => {
        const ev = { ...(payload as Omit<PortCatch, 'key'>), key: Date.now() + Math.random() };
        setEvents((prev) => [...prev, ev].slice(-12));
        setTimeout(() => setEvents((prev) => prev.filter((e) => e.key !== ev.key)), 3500);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track(me);
      });
    return () => { channelRef.current = null; void supabase.removeChannel(channel); };
    // Re-join when the player moves spot, mode or Marée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const send = useCallback((c: { speciesId: string; rarity: number; variant: string }) => {
    const m = meRef.current;
    if (!channelRef.current || !m || m.mode !== 'public') return;
    void channelRef.current.send({ type: 'broadcast', event: 'catch', payload: { userId: m.userId, pseudo: m.pseudo, ...c } });
  }, []);

  return { players, events, send };
}
