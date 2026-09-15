'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { COSMETICS, COSMETIC_SLOTS, RARITIES, VARIANTS, getSpecies, type CosmeticSlot } from '@/lib/peche/data';
import type { PecheState } from '@/lib/peche/server';
import AquariumView, { type AquariumFish } from './AquariumView';
import CosmeticIcon from './CosmeticIcon';
import FishIcon from './FishIcon';

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

export const AQUARIUM_SLOTS = 8;
const AQUA_SLOTS: CosmeticSlot[] = ['aquafond', 'aquasol', 'aquadeco'];

/**
 * Your aquarium, as everyone will see it on your card: pick up to eight fish
 * from your Poissodex (with a variant you have caught) and dress the tank
 * with the aquarium cosmetics you own.
 */
export default function AquariumPanel({ state, api }: { state: PecheState; api: Api }) {
  const [picks, setPicks] = useState<AquariumFish[]>(state.aquarium || []);
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPicks(state.aquarium || []); }, [state.aquarium]);

  const dirty = JSON.stringify(picks) !== JSON.stringify(state.aquarium || []);
  const owned = new Set(state.cosmetics);

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.dex
      .map((d) => ({ d, sp: getSpecies(d.speciesId) }))
      .filter((x) => x.sp && (!q || x.sp.name.toLowerCase().includes(q)))
      .sort((a, b) => b.sp!.rarity - a.sp!.rarity || a.sp!.name.localeCompare(b.sp!.name));
  }, [state.dex, query]);

  const place = (slot: number, fish: AquariumFish | null) => {
    sfx.select();
    setPicks((prev) => {
      const next = [...prev];
      if (fish) next[slot] = fish; else next.splice(slot, 1);
      return next.filter(Boolean).slice(0, AQUARIUM_SLOTS);
    });
    setEditing(null);
  };

  const save = async () => {
    setSaving(true);
    const r = await api('aquarium', { fish: picks });
    setSaving(false);
    if (r) { sfx.cashout(); toast.success('Aquarium enregistré, visible sur ta fiche'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-2xl">Mon aquarium</div>
        <button onClick={save} disabled={!dirty || saving} className={cn(BRAWL.green, 'h-10 px-4 text-base')}>
          {saving ? '···' : dirty ? 'Enregistrer' : 'Enregistré'}
        </button>
      </div>
      <p className="text-xs font-bold text-tx-secondary">Choisis les poissons de ton Poissodex à mettre en avant. Tout le monde le voit en ouvrant ta fiche.</p>

      <AquariumView fish={picks} equipped={state.equipped} />

      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: AQUARIUM_SLOTS }, (_, i) => {
          const f = picks[i];
          const sp = f ? getSpecies(f.speciesId) : undefined;
          return (
            <button key={i} onClick={() => setEditing(editing === i ? null : Math.min(i, picks.length))}
              className={cn('relative h-20 rounded-xl border-[3px] border-brand-border flex flex-col items-center justify-center gap-0.5', editing === i ? 'bg-accent-primary/30' : 'bg-brand-inner hover:bg-[#2B3170]')}>
              {sp ? (
                <>
                  <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={40} variant={f!.variant} />
                  <span className="text-[10px] font-black leading-tight line-clamp-1 px-1" style={{ color: RARITIES[sp.rarity].color }}>{sp.name}</span>
                  <span role="button" aria-label="Retirer" onClick={(e) => { e.stopPropagation(); place(i, null); }} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-accent-secondary border-2 border-brand-border flex items-center justify-center">
                    <X className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                </>
              ) : <Plus className="h-6 w-6 text-tx-secondary" />}
            </button>
          );
        })}
      </div>

      {editing !== null && (
        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-2.5">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-tx-secondary" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher dans ton Poissodex…" className="flex-1 h-10 rounded-xl border-[3px] border-brand-border bg-brand-bg px-2 font-bold outline-none" />
          </div>
          {choices.length === 0 ? <p className="text-sm font-bold text-tx-secondary">Aucun poisson. Va pêcher !</p> : (
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
              {choices.map(({ d, sp }) => {
                // One of each species: a fish already in another slot can't be picked again.
                const usedElsewhere = picks.some((p, i) => p.speciesId === d.speciesId && i !== editing);
                return (
                <div key={d.speciesId} className={cn('flex flex-wrap items-center gap-1.5 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1', usedElsewhere && 'opacity-50')}>
                  <FishIcon speciesId={sp!.id} color={sp!.color} rarity={sp!.rarity} size={36} />
                  <span className="flex-1 min-w-[40%] truncate font-display text-sm" style={{ color: RARITIES[sp!.rarity].color }}>{sp!.name}</span>
                  {usedElsewhere ? <span className="text-[11px] font-black text-tx-secondary">Déjà dedans</span> : (['', ...d.variants] as string[]).map((v) => (
                    <button key={v || 'normal'} onClick={() => place(editing, { speciesId: d.speciesId, variant: v })}
                      className={cn(BRAWL.dark, 'h-8 px-2 text-xs')}>
                      {v ? VARIANTS[v as keyof typeof VARIANTS].label : 'Normal'}
                    </button>
                  ))}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="font-display text-xl mb-1">Décoration</div>
        <p className="text-xs font-bold text-tx-secondary mb-2">Les cosmétiques d’aquarium s’obtiennent dans les coffres au trésor.</p>
        {AQUA_SLOTS.map((slot) => (
          <div key={slot} className="mb-2 last:mb-0">
            <div className="font-display text-base mb-1">{COSMETIC_SLOTS[slot]}</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
              {COSMETICS.filter((c) => c.slot === slot).map((c) => {
                const has = owned.has(c.id);
                const on = state.equipped[slot] === c.id;
                return (
                  <button key={c.id} disabled={!has} title={has ? c.name : '???'}
                    onClick={async () => { await api('equip', { slot, cosmetic_id: on ? null : c.id }); sfx.select(); }}
                    className={cn('rounded-xl border-[3px] p-0.5', on ? 'border-accent-primary bg-[#3A3A20]' : 'border-brand-border bg-brand-card', !has && 'opacity-50')}>
                    <CosmeticIcon cosmetic={c} size={44} hidden={!has} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
