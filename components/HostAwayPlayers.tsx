'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserX, X, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { roomDb } from '@/lib/supabase/roomClient';
import { isAway, recallSeat } from '@/lib/roomSeat';

interface Seat { id: string; name: string; last_seen_at?: string | null }

/**
 * The host's tool during a game: players who stopped sending presence show up
 * here, and the host can exclude them so the game doesn't wait on someone who
 * left. Hidden for everyone else, and hidden while nobody is away — it takes
 * no room on the game screen until it is needed.
 */
export default function HostAwayPlayers({ roomCode }: { roomCode: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: room } = await supabase.from('rooms').select('id, host_id').eq('code', roomCode).maybeSingle();
      if (!alive || !room) return;
      setRoomId(room.id);
      setHostId(room.host_id);
      const load = async () => {
        const { data } = await supabase.from('players').select('id, name, last_seen_at').eq('room_id', room.id);
        if (alive && data) setSeats(data as Seat[]);
      };
      await load();
      channel = supabase.channel(`host_away:${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, () => { void load(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p) => {
          if (alive) setHostId((p.new as { host_id?: string }).host_id ?? null);
        })
        .subscribe();
    })();
    // "Away" is a matter of time passing, not only of database changes.
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => { alive = false; clearInterval(t); if (channel) supabase.removeChannel(channel); };
  }, [roomCode]);

  const me = typeof window === 'undefined' ? null : (sessionStorage.getItem('playerId') || recallSeat(roomCode)?.playerId || null);
  const away = useMemo(() => seats.filter((s) => s.id !== me && isAway(s.last_seen_at)), [seats, me]);

  if (!roomId || !me || hostId !== me || away.length === 0) return null;

  const exclude = async (seat: Seat) => {
    const { error } = await roomDb.from('players').delete().eq('id', seat.id);
    if (error) { toast.error('Impossible d’exclure ce joueur.'); return; }
    toast.success(`${seat.name} a été retiré de la partie.`);
    setSeats((prev) => prev.filter((s) => s.id !== seat.id));
  };

  const since = (at?: string | null) => {
    if (!at) return 'absent';
    const min = Math.floor((Date.now() - new Date(at).getTime()) / 60000);
    return min < 1 ? 'absent depuis moins d’une minute' : `absent depuis ${min} min`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[240] right-2 top-[calc(env(safe-area-inset-top)+8px)] h-10 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-[#FF8A1F] px-2.5 font-display text-sm text-brand-bg shadow-[inset_0_-3px_0_#CC6508,0_3px_0_#05061A] active:translate-y-[2px]"
        aria-label={`${away.length} joueur${away.length > 1 ? 's' : ''} absent${away.length > 1 ? 's' : ''}`}
      >
        <WifiOff className="h-4 w-4" /> {away.length} absent{away.length > 1 ? 's' : ''}
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] bg-[#05061A]/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="away-title"
            className="w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[22px] border-4 border-b-0 sm:border-b-4 border-brand-border bg-brand-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 shadow-[0_8px_0_#05061A]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="away-title" className="font-display text-2xl leading-none">Joueurs absents</h2>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="h-10 w-10 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm font-bold text-tx-secondary">
              Ils ne répondent plus. S’ils reviennent avec le même pseudo, ils retrouvent leur place. Tu peux aussi les retirer de la partie.
            </p>
            <ul className="mt-3 space-y-2">
              {away.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg leading-tight truncate">{s.name}</div>
                    <div className="text-xs font-bold text-tx-muted">{since(s.last_seen_at)}</div>
                  </div>
                  <button
                    onClick={() => exclude(s)}
                    className="shrink-0 h-10 px-3 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-sm shadow-[inset_0_-3px_0_#C92D63,0_3px_0_#05061A] active:translate-y-[2px]"
                  >
                    <UserX className="h-4 w-4" /> Exclure
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
