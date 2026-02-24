'use client';

import { useState, useMemo } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Smile } from 'lucide-react';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '🤔', '😎', '🙌', '💯', '⭐', '🚀', '😱', '🤣'];

interface ReactionButtonProps {
  roomCode: string;
  gameType: string;
  className?: string;
}

export default function ReactionButton({ roomCode, gameType, className = '' }: ReactionButtonProps) {
  const [open, setOpen] = useState(false);
  const { broadcast, messages } = useRealtime(roomCode, gameType);
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || 'Anonyme' : 'Anonyme';

  const reactions = useMemo(() => {
    return messages
      .filter((m: { type: string }) => m.type === 'reaction')
      .slice(-8)
      .map((m: { data?: { player?: string; emoji?: string } }) => ({ player: m.data?.player, emoji: m.data?.emoji }));
  }, [messages]);

  const sendReaction = (emoji: string) => {
    broadcast({ type: 'reaction', data: { player: playerName, emoji } });
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 justify-center">
          {reactions.map((r, i) => (
            <span key={i} className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-800 dark:text-slate-100">
              {r.emoji} {r.player}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          aria-label="Réagir"
        >
          <Smile className="h-4 w-4" />
          Réagir
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg z-50 grid grid-cols-4 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="text-2xl p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
