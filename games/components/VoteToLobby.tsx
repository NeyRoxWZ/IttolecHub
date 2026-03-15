'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Vote } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface VoteToLobbyProps {
  roomId: string;
  playerId: string;
  players: { id: string; name: string }[];
}

interface Vote {
  player_id: string;
  player_name: string;
  timestamp: number;
}

export default function VoteToLobby({ roomId, playerId, players }: VoteToLobbyProps) {
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
        window.location.reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

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
  const votePercentage = Math.round((votes.length / requiredVotes) * 100);

  if (votes.length >= requiredVotes) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Vote className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-bold text-[#F8FAFC]">Retour au salon</span>
        </div>
        
        {!hasVoted ? (
          <Button
            onClick={handleVote}
            size="sm"
            variant="outline"
            className="w-full border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
          >
            Voter pour quitter
          </Button>
        ) : (
          <div className="text-xs text-[#94A3B8]">
            Vote enregistré
          </div>
        )}
        
        <div className="mt-2">
          <div className="flex justify-between text-xs text-[#94A3B8] mb-1">
            <span>{votes.length}/{requiredVotes} votes</span>
            <span>{votePercentage}%</span>
          </div>
          <div className="h-2 bg-[#334155] rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${votePercentage}%` }}
            />
          </div>
        </div>
        
        {votes.length > 0 && (
          <div className="mt-2 text-xs text-[#94A3B8]">
            {votes.map(v => v.player_name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
