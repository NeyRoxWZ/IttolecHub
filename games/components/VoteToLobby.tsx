'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';

interface VoteToLobbyProps {
  roomId: string;
  playerId: string;
  players: { id: string; name: string }[];
  roomCode: string;
  gameType?: string;
  onAllVoted?: () => Promise<void>;
}

interface Vote {
  player_id: string;
  player_name: string;
  timestamp: number;
}

/** "Back to the room" by majority vote, in the game header on every screen size. */
export default function VoteToLobby({ roomId, playerId, players, roomCode, onAllVoted }: VoteToLobbyProps) {
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const voteChannel = supabase.channel(`room_${roomId}_votes`);
    setChannel(voteChannel);

    voteChannel
      .on('broadcast', { event: 'vote_lobby' }, (payload) => {
        const newVote = payload.payload as Vote;
        setVotes((prev) => (prev.find((v) => v.player_id === newVote.player_id) ? prev : [...prev, newVote]));
      })
      .on('broadcast', { event: 'return_to_lobby' }, () => {
        router.push(`/room/${roomCode}?return=true`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(voteChannel);
    };
  }, [roomId, roomCode, router]);

  const handleVote = async () => {
    if (hasVoted || !roomId || !playerId || !channel) return;
    vibrate(HAPTIC.SOFT);
    const vote: Vote = { player_id: playerId, player_name: players.find((p) => p.id === playerId)?.name || 'Joueur', timestamp: Date.now() };
    setHasVoted(true);
    setVotes((prev) => [...prev, vote]);
    await channel.send({ type: 'broadcast', event: 'vote_lobby', payload: vote });
  };

  // Majority, not unanimity: one player who left can't hold the table hostage.
  const requiredVotes = Math.floor(players.length / 2) + 1;

  useEffect(() => {
    if (votes.length >= requiredVotes && requiredVotes > 0 && channel) {
      (async () => {
        if (onAllVoted) await onAllVoted();
        channel.send({ type: 'broadcast', event: 'return_to_lobby', payload: {} });
        router.push(`/room/${roomCode}?return=true`);
      })();
    }
  }, [votes.length, requiredVotes, roomId, roomCode, router, channel, onAllVoted]);

  if (votes.length >= requiredVotes) return null;

  return (
    <button
      onClick={handleVote}
      disabled={hasVoted}
      title="Voter pour retourner au salon"
      aria-label={`Voter pour retourner au salon (${votes.length} sur ${requiredVotes})`}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-2 font-display text-sm tabular-nums transition-transform sm:text-base',
        hasVoted
          ? 'cursor-default bg-accent-success text-brand-bg shadow-[inset_0_-3px_0_#1E9A55]'
          : 'bg-[#2B3170] text-white shadow-[inset_0_-3px_0_#1A1F52] hover:bg-[#333A80] active:translate-y-[2px]',
      )}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Salon</span>
      {votes.length}/{requiredVotes}
    </button>
  );
}
