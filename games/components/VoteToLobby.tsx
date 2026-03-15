'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, CheckCircle, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VoteToLobbyProps {
  roomId: string;
  playerId: string;
  players: { id: string; name: string }[];
  roomCode: string;
}

interface Vote {
  player_id: string;
  player_name: string;
  timestamp: number;
}

export default function VoteToLobby({ roomId, playerId, players, roomCode }: VoteToLobbyProps) {
  const router = useRouter();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_${roomId}_votes`)
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
      supabase.removeChannel(channel);
    };
  }, [roomId, roomCode, router]);

  const handleVote = async () => {
    if (hasVoted || !roomId || !playerId) return;

    const playerName = players.find(p => p.id === playerId)?.name || 'Joueur';
    
    const vote: Vote = {
      player_id: playerId,
      player_name: playerName,
      timestamp: Date.now()
    };

    setHasVoted(true);
    setVotes(prev => [...prev, vote]);

    await supabase.channel(`room_${roomId}_votes`).send({
      type: 'broadcast',
      event: 'vote_lobby',
      payload: vote
    });
  };

  const requiredVotes = players.length;
  const votePercentage = requiredVotes > 0 ? Math.round((votes.length / requiredVotes) * 100) : 0;

  useEffect(() => {
    if (votes.length >= requiredVotes && requiredVotes > 0) {
      supabase.channel(`room_${roomId}_votes`).send({
        type: 'broadcast',
        event: 'return_to_lobby',
        payload: {}
      });
      router.push(`/room/${roomCode}`);
    }
  }, [votes.length, requiredVotes, roomId, roomCode, router]);

  if (votes.length >= requiredVotes) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50">
      <div className="flex items-center gap-2">
        <button
          onClick={handleVote}
          disabled={hasVoted}
          className="h-12 flex items-center gap-2 bg-[#1E293B] border border-[#334155] px-4 rounded-xl cursor-pointer hover:bg-[#334155] hover:border-[#475569] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasVoted ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <LogOut className="w-5 h-5 text-[#94A3B8]" />
          )}
          <span className="text-sm font-medium text-[#F8FAFC]">
            {hasVoted ? 'Vote enviado' : 'Quitter'}
          </span>
        </button>
        
        <div className="h-12 flex items-center gap-2 bg-[#1E293B] border border-[#334155] px-3 rounded-xl">
          <span className="text-sm font-bold text-[#F8FAFC]">{votes.length}/{requiredVotes}</span>
        </div>
      </div>
    </div>
  );
}
