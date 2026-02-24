'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface RealtimeMessage {
  type: string;
  player?: string;
  data?: any;
}

export function useRealtime(roomCode: string, gameType: string) {
  const [presence, setPresence] = useState<any[]>([]);
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);

  // Broadcast un message
  const broadcast = (message: RealtimeMessage) => {
    const channel = supabase.channel(`room:${roomCode}`);
    channel.send({
      type: 'broadcast',
      event: gameType,
      payload: message,
    });
  };

  useEffect(() => {
    const channel = supabase.channel(`room:${roomCode}`);

    // S'abonner aux présences
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresence(Object.values(state).flat());
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Nouveau joueur:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Joueur parti:', leftPresences);
      })
      .on('broadcast', { event: gameType }, ({ payload }) => {
        setMessages(prev => [...prev, payload]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            playerName: sessionStorage.getItem('playerName') || 'Anonyme',
            gameType,
            joinedAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [roomCode, gameType]);

  return { broadcast, presence, messages };
}