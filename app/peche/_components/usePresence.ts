'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface PortPlayer { userId: string; pseudo: string; zone: number; maree: number }

/**
 * Who is at the port right now: every open fishing page joins one realtime
 * presence channel and says where it fishes. Nothing is stored; closing the
 * tab removes the player from everyone's list.
 */
export function usePresence(me: PortPlayer | null): PortPlayer[] {
  const [players, setPlayers] = useState<PortPlayer[]>([]);
  const key = me ? `${me.userId}:${me.zone}:${me.maree}:${me.pseudo}` : '';

  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel('peche-port', { config: { presence: { key: me.userId } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PortPlayer>();
        const list = Object.values(state).map((entries) => entries[entries.length - 1]).filter(Boolean) as PortPlayer[];
        setPlayers(list.sort((a, b) => b.maree - a.maree || a.pseudo.localeCompare(b.pseudo)));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track(me);
      });
    return () => { void supabase.removeChannel(channel); };
    // Re-join when the player moves spot or changes Marée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return players;
}
