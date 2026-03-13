'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Smile, Heart, ThumbsUp, PartyPopper, Flame, Frown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';

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
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_${roomId}_reactions`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
        addFloatingReaction(payload.payload.emoji);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
        const timer = setTimeout(() => setCooldown(c => Math.max(0, c - 0.5)), 500);
        return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const addFloatingReaction = (emoji: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    // Random position horizontally (10% to 90%)
    const x = 10 + Math.random() * 80;
    
    setFloatingReactions(prev => [...prev, { id, emoji, x, y: 100 }]);

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const sendReaction = async (emoji: string) => {
    if (cooldown > 0) return;
    
    setIsOpen(false); // Close popover immediately
    setCooldown(3); // 3 seconds cooldown

    // Optimistic local show
    addFloatingReaction(emoji);
    
    // Broadcast to others
    await supabase.channel(`room_${roomId}_reactions`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji }
    });
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
          <Button 
            variant="outline" 
            size="icon" 
            disabled={cooldown > 0}
            className={`rounded-full w-12 h-12 backdrop-blur-md shadow-lg transition-all ${
                cooldown > 0 
                ? 'bg-[#334155]/50 border-[#475569] text-[#94A3B8] cursor-not-allowed' 
                : 'bg-[#1E293B]/80 border-[#334155] text-[#F8FAFC] hover:bg-[#334155]'
            }`}
          >
            {cooldown > 0 ? (
                <span className="text-xs font-bold">{Math.ceil(cooldown)}s</span>
            ) : (
                <Smile className="w-6 h-6" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-[#1E293B] border-[#334155] rounded-2xl" side="top" align="center">
          <div className="grid grid-cols-4 gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.label}
                onClick={() => sendReaction(r.emoji)}
                className="text-2xl p-2 hover:bg-[#334155] rounded-xl transition-transform active:scale-90"
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
