'use client';

import { User } from 'lucide-react';

interface PlayerStatusProps {
  answeredPlayers: string[];
}

export default function PlayerStatus({ answeredPlayers }: PlayerStatusProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {answeredPlayers.map((player) => (
        <div
          key={player}
          className="flex items-center gap-1 px-3 py-1 bg-[#334155] rounded-full text-sm text-[#F8FAFC]"
        >
          <User className="h-4 w-4" />
          <span>{player} a répondu ✅</span>
        </div>
      ))}
    </div>
  );
}
