'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Backpack, Clock, Lock, Package, Palette, Search, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import {
  KRASH_SLOTS, KRASH_SLOT_HINT, KRASH_SLOT_LABEL, KRASH_SOURCE_LABEL, RARITY_COLOR, RARITY_LABEL,
  krashCosmeticById, visibleKrashCosmetics, type KrashSlot,
} from '@/lib/krash/cosmetics';
import { krashCrateById, type CrateOpening } from '@/lib/krash/crates';
import { KRASH_SHOP_ITEMS, krashItemById } from '@/lib/krash/shop';
import KrashShell from '../_components/KrashShell';
import KrashCosmeticPreview, { krashCosmeticEffect } from '../_components/KrashCosmeticPreview';
import KrashEquipButton from '../_components/KrashEquipButton';
import KrashCrateModal from '../_components/KrashCrateModal';
import { refreshKrashLoadout, useKrashLoadout } from '../_lib/useKrashLoadout';
import { setKrashBalance } from '../_lib/useKrashWallet';

interface Inventory {
  items: { id: string; quantity: number }[];
  crates: { id: string; quantity: number }[];
  cosmetics: string[];
  effects: Record<string, { effect: string; magnitude: number; uses_left: number | null; expires_at: string | null }>;
}

const EFFECT_NAME: Record<string, string> = Object.fromEntries(KRASH_SHOP_ITEMS.map((i) => [i.effect, i.name]));

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Items, crates and the Krash cosmetic collection — the casino inventory, for Krash. */
export default function KrashInventoryPage() {
  const { user } = useAuth();
  const loadout = useKrashLoadout();
  const [tab, setTab] = useState<'objets' | 'cosmetiques'>('objets');
  const [inv, setInv] = useState<Inventory>({ items: [], crates: [], cosmetics: [], effects: {} });
  const [busy, setBusy] = useState<string | null>(null);
  const [openings, setOpenings] = useState<CrateOpening[] | null>(null);
  const [slot, setSlot] = useState<KrashSlot | 'tous'>('tous');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/krash/inventory?user_id=${user.id}`, { cache: 'no-store' });
    if (res.ok) setInv(await res.json());
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const use = async (itemId: string, name: string, quantity = 1) => {
    if (!user || busy) return;
    setBusy(itemId);
    try {
      const res = await fetch('/api/krash/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: itemId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Impossible'); sfx.lose(); return; }
      if (typeof data.balance === 'number') setKrashBalance(data.balance);
      if (data.openings?.length) {
        setOpenings(data.openings);
      } else {
        sfx.select();
        toast.success(name, { description: data.message });
      }
      void load();
      void refreshKrashLoadout(user.id);
    } finally { setBusy(null); }
  };

  const catalogue = useMemo(() => visibleKrashCosmetics(), []);
  const owned = new Set(loadout.owned.length ? loadout.owned : inv.cosmetics);
  const shown = catalogue.filter((c) => {
    if (slot !== 'tous' && c.slot !== slot) return false;
    if (ownedOnly && !owned.has(c.id)) return false;
    if (query.trim() && !fold(`${c.name} ${c.themeName} ${KRASH_SLOT_LABEL[c.slot]} ${RARITY_LABEL[c.rarity]}`).includes(fold(query.trim()))) return false;
    return true;
  }).sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));

  const activeEffects = Object.values(inv.effects);

  return (
    <KrashShell title="Inventaire">
      {openings && <KrashCrateModal openings={openings} onClose={() => { setOpenings(null); void load(); }} />}

      <div className="grid grid-cols-2 gap-2 mb-4 max-w-md">
        {([['objets', 'Objets', Backpack], ['cosmetiques', 'Cosmétiques', Palette]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => { sfx.click(); setTab(id); }}
            className={cn('h-11 rounded-xl border-2 font-display font-black text-xs tracking-wider uppercase flex items-center justify-center gap-1.5',
              tab === id ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-inner text-tx-secondary')}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'objets' ? (
        <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
              <h2 className="font-display font-black tracking-wider uppercase mb-3">Objets</h2>
              {inv.items.length === 0 ? (
                <p className="text-[13px] text-tx-muted">Aucun objet. La boutique en propose cinq nouveaux chaque jour.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {inv.items.map(({ id, quantity }) => {
                    const item = krashItemById(id);
                    if (!item) return null;
                    return (
                      <div key={id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-black flex-1">{item.name}</span>
                          <span className="text-[11px] font-black text-accent-primary">×{quantity}</span>
                        </div>
                        <p className="text-[12px] text-tx-secondary leading-snug mt-1 flex-1">{item.description}</p>
                        <button
                          onClick={() => use(id, item.name)}
                          disabled={busy === id}
                          className="mt-2 h-9 rounded-lg bg-accent-primary text-brand-bg border-2 border-brand-border font-display font-black text-[11px] tracking-wider disabled:opacity-50"
                        >
                          UTILISER
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
              <h2 className="font-display font-black tracking-wider uppercase mb-3">Caisses</h2>
              {inv.crates.length === 0 ? (
                <p className="text-[13px] text-tx-muted">Aucune caisse. Tu en gagnes dans le pass ou tu en achètes à la boutique.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {inv.crates.map(({ id, quantity }) => {
                    const crate = krashCrateById(id);
                    if (!crate) return null;
                    return (
                      <div key={id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center gap-3">
                        <Package className="h-8 w-8 text-fuchsia-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-black truncate">{crate.name}</div>
                          <div className="text-[11px] text-tx-muted">×{quantity}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => use(id, crate.name, 1)} disabled={!!busy} className="h-8 px-3 rounded-lg bg-fuchsia-500 text-white font-display font-black text-[10px] tracking-wider disabled:opacity-50">OUVRIR</button>
                          {quantity > 1 && (
                            <button onClick={() => use(id, crate.name, Math.min(10, quantity))} disabled={!!busy} className="h-7 px-3 rounded-lg border-2 border-brand-border text-[10px] font-black disabled:opacity-50">×{Math.min(10, quantity)}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal h-fit">
            <h2 className="font-display font-black tracking-wider uppercase mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent-primary" /> Effets actifs</h2>
            {activeEffects.length === 0 ? (
              <p className="text-[13px] text-tx-muted">Rien d’actif. Utilise un objet pour qu’il agisse sur tes prochains trades.</p>
            ) : (
              <ul className="space-y-2">
                {activeEffects.map((e) => (
                  <li key={e.effect} className="rounded-xl border-2 border-accent-primary/40 bg-accent-primary/5 p-2.5">
                    <div className="font-bold text-[13px]">{EFFECT_NAME[e.effect] ?? e.effect}</div>
                    <div className="text-[11px] text-tx-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {e.uses_left !== null ? `${e.uses_left} utilisation${e.uses_left > 1 ? 's' : ''} restante${e.uses_left > 1 ? 's' : ''}` : ''}
                      {e.expires_at ? `jusqu’à ${new Date(e.expires_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : (
        <>
          <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal mb-4">
            <h2 className="font-display font-black tracking-wider uppercase mb-3">Équipé</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {KRASH_SLOTS.map((s) => {
                const c = loadout.cosmetics[s];
                return (
                  <div key={s} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2 flex flex-col items-center gap-1 text-center" title={KRASH_SLOT_HINT[s]}>
                    <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{KRASH_SLOT_LABEL[s]}</div>
                    {c ? <KrashCosmeticPreview cosmetic={c} size={56} /> : <div className="h-14 w-14 rounded-xl border-2 border-dashed border-brand-border" />}
                    <div className="text-[10px] font-bold leading-tight line-clamp-2 min-h-[26px]">{c ? c.themeName : 'Aucun'}</div>
                    {c && (
                      <button onClick={() => loadout.equip(s, null)} className="h-6 px-2 rounded-md border border-brand-border text-[9px] font-black text-tx-muted hover:text-tx-base flex items-center gap-1">
                        <X className="h-3 w-3" /> RETIRER
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-tx-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un thème, une rareté…"
                className="w-full h-10 rounded-xl border-2 border-brand-border bg-brand-inner pl-8 pr-3 text-[13px] font-bold focus:outline-none focus:border-accent-primary"
              />
            </div>
            <button
              onClick={() => setOwnedOnly((v) => !v)}
              className={cn('h-10 px-3 rounded-xl border-2 text-[11px] font-black', ownedOnly ? 'border-accent-primary text-accent-primary' : 'border-brand-border text-tx-muted')}
            >
              MES PIÈCES
            </button>
            <span className="text-[11px] font-black text-tx-muted">{owned.size}/{catalogue.length} possédées</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(['tous', ...KRASH_SLOTS] as const).map((s) => (
              <button
                key={s}
                onClick={() => { sfx.click(); setSlot(s); }}
                className={cn('h-8 px-3 rounded-lg border-2 text-[11px] font-black', slot === s ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-brand-border text-tx-secondary')}
              >
                {s === 'tous' ? 'Tout' : KRASH_SLOT_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {shown.map((c) => {
              const has = owned.has(c.id);
              return (
                <div
                  key={c.id}
                  className={cn('rounded-xl border-2 p-2.5 flex flex-col items-center gap-1.5 text-center', !has && 'opacity-50')}
                  style={{ borderColor: has ? RARITY_COLOR[c.rarity] : undefined, background: has ? `${RARITY_COLOR[c.rarity]}10` : undefined }}
                  title={krashCosmeticEffect(c)}
                >
                  <div className="relative">
                    <KrashCosmeticPreview cosmetic={c} size={80} />
                    {!has && <Lock className="absolute top-1 right-1 h-3.5 w-3.5 text-tx-muted" />}
                  </div>
                  <div className="font-display font-black text-[11px] leading-tight line-clamp-2 min-h-[28px]">{c.name}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</div>
                  <div className="text-[9px] text-tx-muted">{c.source === 'pass' ? `${KRASH_SOURCE_LABEL.pass} · saison ${c.season}` : KRASH_SOURCE_LABEL.caisse}</div>
                  <KrashEquipButton cosmetic={c} size="sm" className="w-full" />
                </div>
              );
            })}
          </div>
          {shown.length === 0 && <p className="text-tx-muted text-center py-8">Rien ne correspond.</p>}
        </>
      )}
    </KrashShell>
  );
}
