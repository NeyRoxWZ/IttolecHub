'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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

export default function VoteToLobby({ roomId, playerId, players, roomCode, gameType, onAllVoted }: VoteToLobbyProps) {
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
        setVotes(prev => {
          if (prev.find(v => v.player_id === newVote.player_id)) return prev;
          return [...prev, newVote];
        });
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

    const playerName = players.find(p => p.id === playerId)?.name || 'Joueur';
    
    const vote: Vote = {
      player_id: playerId,
      player_name: playerName,
      timestamp: Date.now()
    };

    setHasVoted(true);
    setVotes(prev => [...prev, vote]);

    await channel.send({
      type: 'broadcast',
      event: 'vote_lobby',
      payload: vote
    });
  };

  const requiredVotes = players.length;

  useEffect(() => {
    if (votes.length >= requiredVotes && requiredVotes > 0 && channel) {
      const handleAllVoted = async () => {
        if (onAllVoted) {
          await onAllVoted();
        }
        
        channel.send({
          type: 'broadcast',
          event: 'return_to_lobby',
          payload: {}
        });
        
        router.push(`/room/${roomCode}?return=true`);
      };
      
      handleAllVoted();
    }
  }, [votes.length, requiredVotes, roomId, roomCode, router, channel, onAllVoted]);

  if (votes.length >= requiredVotes) {
    return null;
  }

  return (
    <>
      {/* Desktop: Inside header, right side */}
      <div className="hidden md:block">
        <button
          onClick={handleVote}
          disabled={hasVoted}
          className={cn(
              "h-10 flex items-center gap-2 px-4 rounded-xl border-2 transition-all font-bold uppercase tracking-widest",
              hasVoted 
              ? "bg-brand-inner text-tx-muted border-brand-border cursor-not-allowed" 
              : "bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base shadow-sm active:translate-y-0.5 active:shadow-none"
          )}
        >
          {hasVoted ? (
            <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          <span className="text-sm">
            {votes.length}/{requiredVotes}
          </span>
        </button>
      </div>

      {/* Mobile: Bottom left floating - same style as ReactionButton */}
      <div className="md:hidden fixed bottom-6 left-6 z-[90]">
        <button
          onClick={handleVote}
          disabled={hasVoted}
          className={cn(
              "h-14 w-14 flex items-center justify-center rounded-2xl border-4 transition-all shadow-brutal",
              hasVoted 
              ? "bg-brand-inner text-tx-muted border-brand-border" 
              : "bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg active:translate-y-1 active:shadow-none"
          )}
        >
          {hasVoted ? (
            <div className="w-3 h-3 rounded-full bg-accent-success animate-pulse" />
          ) : (
            <LogOut className="w-6 h-6" />
          )}
        </button>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-black text-tx-base bg-brand-inner px-2 py-0.5 rounded-md border-2 border-brand-border whitespace-nowrap shadow-sm">
          {votes.length}/{requiredVotes}
        </div>
      </div>
    </>
  );
}
