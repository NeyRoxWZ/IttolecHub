'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Smile, Heart, ThumbsUp, PartyPopper, Flame, Frown } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { vibrate, HAPTIC } from '@/lib/haptic';

const REACTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Haha' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😭', label: 'Cry' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '💩', label: 'Poop' },
];

interface Reaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
}

export default function ReactionButton({ roomId }: { roomId: string }) {
  const [floatingReactions, setFloatingReactions] = useState<Reaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const newChannel = supabase.channel(`room_${roomId}_reactions`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
        addFloatingReaction(payload.payload.emoji);
      })
      .subscribe();

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [roomId]);

  const addFloatingReaction = (emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Random position horizontally (10% to 90%)
    const x = 10 + Math.random() * 80;
    
    setFloatingReactions(prev => [...prev, { id, emoji, x, y: 100 }]);

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  };

  const sendReaction = async (emoji: string) => {
    vibrate(HAPTIC.SOFT);
    // Optimistic local show
    addFloatingReaction(emoji);
    
    // Broadcast to others
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji }
      });
    }
  };

  return (
    <>
      {/* Floating Container (Fixed Overlay) */}
      <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
        {floatingReactions.map(r => (
          <div
            key={r.id}
            className="absolute text-5xl select-none animate-float-up opacity-0 drop-shadow-lg"
            style={{ 
              left: `${r.x}%`, 
              bottom: '100px',
              willChange: 'transform, opacity'
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Trigger Button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button 
            aria-label="Réagir"
            className="flex items-center justify-center rounded-2xl w-14 h-14 transition-transform bg-accent-primary border-4 border-brand-border text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px]"
          >
            <Smile className="w-8 h-8" />
          </button>
        </PopoverTrigger>
        <PopoverContent 
            className="w-auto p-3 bg-brand-card border-4 border-brand-border rounded-3xl shadow-brutal mb-2" 
            side="top" 
            align="end"
            onInteractOutside={() => setIsOpen(false)}
        >
          <div className="grid grid-cols-4 gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => sendReaction(r.emoji)}
                aria-label={r.label}
                className="text-3xl p-3 bg-[#2B3170] border-[3px] border-brand-border hover:bg-[#333A80] rounded-2xl transition-transform active:translate-y-[3px] shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
