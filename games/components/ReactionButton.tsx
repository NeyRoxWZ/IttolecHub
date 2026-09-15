'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { vibrate, HAPTIC } from '@/lib/haptic';

const REACTIONS = ['❤️', '😂', '🔥', '😮', '😭', '😡', '👏', '💩'];

interface Reaction { id: string; emoji: string; x: number }

/** Emoji reactions everyone in the room sees float up. Sits in the game header. */
export default function ReactionButton({ roomId }: { roomId: string }) {
  const [floating, setFloating] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  const show = (emoji: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setFloating((prev) => [...prev, { id, emoji, x: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloating((prev) => prev.filter((r) => r.id !== id)), 2500);
  };

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`room_${roomId}_reactions`).on('broadcast', { event: 'reaction' }, (p) => show(p.payload.emoji)).subscribe();
    setChannel(ch);
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const send = async (emoji: string) => {
    vibrate(HAPTIC.SOFT);
    show(emoji);
    setOpen(false);
    if (channel) await channel.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
        {floating.map((r) => (
          <div key={r.id} className="absolute bottom-24 select-none text-5xl opacity-0 drop-shadow-lg animate-float-up" style={{ left: `${r.x}%`, willChange: 'transform, opacity' }}>{r.emoji}</div>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Réagir"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-3px_0_#D98E00] active:translate-y-[2px]"
          >
            <Smile className="h-5 w-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl border-4 border-brand-border bg-brand-card p-2 shadow-brutal" side="bottom" align="end" onInteractOutside={() => setOpen(false)}>
          <div className="grid grid-cols-4 gap-1.5">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => send(e)} aria-label={`Réaction ${e}`} className="rounded-xl border-[3px] border-brand-border bg-[#2B3170] p-2 text-2xl shadow-[inset_0_-3px_0_#1A1F52] active:translate-y-[2px]">
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
