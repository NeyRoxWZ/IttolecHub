'use client';

import { useEffect, useState } from 'react';
import { X, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { COSMETIC_BY_ID, COSMETIC_SLOTS, RARITIES, getSpecies, mareeBadge, mareeTitle, zoneInfo, type CosmeticSlot } from '@/lib/peche/data';
import { fmtBig, fmtKg } from '@/lib/peche/format';
import FishIcon from './FishIcon';
import OgName from '@/components/OgName';
import CosmeticIcon from './CosmeticIcon';
import AquariumView from './AquariumView';

interface Card {
  pseudo: string; maree: number; level: number; totalCaught: number; earned: number; bestZone: number;
  species: number; speciesTotal: number; weekPoints: number; achievements: number;
  equipped: Partial<Record<CosmeticSlot, string>>;
  aquarium: { speciesId: string; bestWeight: number; variant: string }[];
}

/** A fisher's card: their Marée, their look and the aquarium of their best catches. */
export default function PlayerCardModal({ viewerId, targetId, onClose }: { viewerId: string; targetId: string; onClose: () => void }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/peche?user_id=${viewerId}&card=${targetId}`)
      .then((r) => r.json())
      .then((d) => (d.card ? setCard(d.card) : setError(d.error || 'Erreur')));
  }, [viewerId, targetId]);

  const badge = card ? mareeBadge(card.maree) : null;

  return (
    <div className="fixed inset-0 z-[280] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-lg h-[min(620px,92dvh)] flex flex-col bg-brand-card border-4 border-brand-border rounded-[22px] shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="min-w-0">
            <div className="font-display text-3xl leading-none truncate">{card?.pseudo ? <OgName name={card.pseudo} /> : '···'}</div>
            {card && badge && (
              <span className="mt-2 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border-[3px] border-brand-border font-display" style={{ background: badge.fill, color: badge.text }}>
                <Waves className="h-4 w-4" /> Marée {card.maree} · {mareeTitle(card.maree)}
              </span>
            )}
          </div>
          <button onClick={onClose} aria-label="Fermer" className={cn(BRAWL.dark, 'h-11 w-11 shrink-0')}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-3">
          {error && <p className="text-sm font-bold text-tx-secondary">{error}</p>}
          {card && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Niveau', String(card.level)],
                  ['Poissons', fmtBig(card.totalCaught)],
                  ['Espèces', `${card.species}/${card.speciesTotal}`],
                  ['Plus loin', zoneInfo(card.bestZone).name],
                  ['Points semaine', fmtBig(card.weekPoints)],
                  ['Succès', String(card.achievements)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1.5">
                    <div className="text-[11px] font-black text-tx-secondary">{label}</div>
                    <div className="font-display text-lg leading-tight truncate">{value}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="font-display text-xl mb-1.5">Équipement</div>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(COSMETIC_SLOTS) as CosmeticSlot[]).filter((slot) => !slot.startsWith('aqua')).map((slot) => {
                    const c = card.equipped[slot] ? COSMETIC_BY_ID.get(card.equipped[slot]!) : undefined;
                    return (
                      <div key={slot} className="rounded-xl border-2 border-brand-border bg-brand-inner p-1 flex flex-col items-center text-center">
                        {c ? <CosmeticIcon cosmetic={c} size={52} /> : <div className="h-[52px] w-[52px] rounded-xl bg-brand-bg" />}
                        <span className="text-[10px] font-black text-tx-secondary leading-tight">{c?.name || COSMETIC_SLOTS[slot]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="font-display text-xl mb-1.5">Aquarium</div>
                {card.aquarium.length === 0 ? (
                  <p className="text-sm font-bold text-tx-secondary">Encore vide.</p>
                ) : (
                  <>
                  <AquariumView fish={card.aquarium} equipped={card.equipped} className="mb-2" />
                  <div className="grid grid-cols-4 gap-2">
                    {card.aquarium.map((f) => {
                      const sp = getSpecies(f.speciesId);
                      if (!sp) return null;
                      const variant = f.variant;
                      return (
                        <div key={f.speciesId} className="flex flex-col items-center text-center" title={`${sp.name} · record ${fmtKg(f.bestWeight)}`}>
                          <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={56} variant={variant} />
                          <span className="text-[10px] font-black leading-tight" style={{ color: RARITIES[sp.rarity].color }}>{sp.name}</span>
                          <span className="text-[10px] font-bold text-tx-secondary">{fmtKg(f.bestWeight)}</span>
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
