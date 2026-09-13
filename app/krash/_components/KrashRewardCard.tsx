'use client';

import { Coins, Package, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RARITY_COLOR, krashCosmeticById } from '@/lib/krash/cosmetics';
import { krashCrateById } from '@/lib/krash/crates';
import { krashItemById } from '@/lib/krash/shop';
import { krashRewardLabel, type KrashPassReward } from '@/lib/krash/pass';
import KrashCosmeticPreview from './KrashCosmeticPreview';

/** A pass reward, drawn the same wherever it appears. */
export default function KrashRewardCard({ reward, size = 56, className }: { reward: KrashPassReward; size?: number; className?: string }) {
  const cosmetic = reward.kind === 'cosmetic' && reward.cosmeticId ? krashCosmeticById(reward.cosmeticId) : undefined;
  const crate = reward.kind === 'item' && reward.itemId ? krashCrateById(reward.itemId) : undefined;
  const item = reward.kind === 'item' && reward.itemId ? krashItemById(reward.itemId) : undefined;

  return (
    <div className={cn('flex flex-col items-center gap-1 text-center', className)}>
      {cosmetic ? (
        <KrashCosmeticPreview cosmetic={cosmetic} size={size} />
      ) : (
        <div
          className="rounded-xl border-2 border-brand-border bg-brand-card flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {reward.kind === 'coins' ? <Coins className="h-1/2 w-1/2 text-accent-primary" />
            : crate ? <Package className="h-1/2 w-1/2 text-fuchsia-300" />
              : <Sparkles className="h-1/2 w-1/2 text-sky-300" />}
        </div>
      )}
      <span
        className="text-[10px] font-black leading-tight line-clamp-2"
        style={cosmetic ? { color: RARITY_COLOR[cosmetic.rarity] } : undefined}
        title={item?.description ?? crate?.description}
      >
        {krashRewardLabel(reward)}
      </span>
    </div>
  );
}
