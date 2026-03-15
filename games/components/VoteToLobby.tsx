'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
        router.push(`/room/${roomCode}`);
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
        
        router.push(`/room/${roomCode}`);
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
          className="h-9 flex items-center gap-2 bg-[#1E293B] border border-[#334155] px-3 rounded-lg cursor-pointer hover:bg-[#334155] hover:border-[#475569] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasVoted ? (
            <div className="w-2 h-2 rounded-full bg-green-400" />
          ) : (
            <LogOut className="w-4 h-4 text-[#94A3B8]" />
          )}
          <span className="text-sm font-medium text-[#F8FAFC]">
            {votes.length}/{requiredVotes}
          </span>
        </button>
      </div>

      {/* Mobile: Bottom left floating - same style as ReactionButton */}
      <div className="md:hidden fixed bottom-20 left-6 z-[90]">
        <button
          onClick={handleVote}
          disabled={hasVoted}
          className="h-12 w-12 flex items-center justify-center bg-[#1E293B] border-2 border-[#334155] rounded-full cursor-pointer hover:bg-[#334155] hover:border-[#475569] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {hasVoted ? (
            <div className="w-3 h-3 rounded-full bg-green-400" />
          ) : (
            <LogOut className="w-5 h-5 text-[#94A3B8]" />
          )}
        </button>
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold text-[#F8FAFC] whitespace-nowrap">
          {votes.length}/{requiredVotes}
        </div>
      </div>
    </>
  );
}
