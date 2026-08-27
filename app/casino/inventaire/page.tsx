'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Coins, Search, Backpack, Palette, Lock, X, Wand2, Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { refreshCosmetics } from '@/hooks/useGameCosmetics';
import {
  COSMETIC_GAME_ORDER, SLOT_LABEL, RARITY_COLOR, RARITY_LABEL, SOURCE_LABEL, GLOBAL_SLUG,
  THEMES, cosmeticsForGame, gameLabel, type Cosmetic, type CosmeticSlot,
} from '@/lib/casino/cosmetics';
import type { CrateOpening } from '@/lib/casino/crates';
import { CountUp } from '../_components/CasinoUI';
import CosmeticPreview, { cosmeticEffect } from '../_components/CosmeticPreview';
import CrateOpeningModal from '../_components/CrateOpeningModal';
import InventoryPanel, { type InventoryState } from '../_components/InventoryPanel';
import Confetti from '../_components/Confetti';
import CasinoControls from '../_components/CasinoControls';
import BalanceChip from '../_components/BalanceChip';

export default function InventoryPage() {
  const { user } = useAuth();
  const { balance, isLoaded, setBalance } = useCasinoWallet();

  const [tab, setTab] = useState<'objets' | 'cosmetiques'>('objets');
  const [inventory, setInventory] = useState<InventoryState>({ items: [], crates: [], effects: {} });
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Record<string, Record<string, string>>>({});
  const [game, setGame] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<string>('tous');
  const [busy, setBusy] = useState<string | null>(null);
  const [openings, setOpenings] = useState<CrateOpening[] | null>(null);
  const [confetti, setConfetti] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const [inv, cosm] = await Promise.all([
      fetch(`/api/casino/inventory?user_id=${user.id}`),
      fetch(`/api/casino/cosmetics?user_id=${user.id}`),
    ]);
    if (inv.ok) setInventory(await inv.json());
    if (cosm.ok) {
      const data = await cosm.json();
      setOwned(data.owned || []);
      setEquipped(data.equipped || {});
      setVisible(new Set<string>(data.visible || []));
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const use = async (itemId: string, name: string, quantity = 1) => {
    if (!user || busy) return;
    setBusy(itemId);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: itemId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      setBalance(data.newBalance);
      if (data.openings?.length) {
        setOpenings(data.openings);
        if (data.openings.some((o: CrateOpening) => o.reward.rarity === 'legendaire')) { sfx.jackpot(); setConfetti((c) => c + 1); }
        else sfx.win();
      } else {
        sfx.select();
        toast.success(name, { description: data.message });
      }
      void load();
    } finally {
      setBusy(null);
    }
  };

  const equip = async (gameSlug: string, slot: CosmeticSlot, cosmeticId: string | null) => {
    if (!user) return;
    sfx.click(); vibrate(HAPTIC.SOFT);
    const res = await fetch('/api/casino/cosmetics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, game_slug: gameSlug, slot, cosmetic_id: cosmeticId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

    setEquipped((prev) => {
      const next = { ...prev, [gameSlug]: { ...(prev[gameSlug] || {}) } };
      if (cosmeticId) next[gameSlug][slot] = cosmeticId;
      else delete next[gameSlug][slot];
      return next;
    });
    void refreshCosmetics(user.id);
  };

  const equipAll = async (gameSlug: string, action: 'equip_all' | 'clear_all') => {
    if (!user) return;
    sfx.click(); vibrate(HAPTIC.MEDIUM);
    const res = await fetch('/api/casino/cosmetics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, game_slug: gameSlug, action }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

    setEquipped((prev) => ({ ...prev, [gameSlug]: data.equipped || {} }));
    toast.success(action === 'equip_all' ? `${data.count} cosmétique${data.count > 1 ? 's' : ''} équipé${data.count > 1 ? 's' : ''}` : 'Cosmétiques retirés');
    void refreshCosmetics(user.id);
  };

  /* ---- item search ---- */
  const q = query.trim().toLowerCase();
  const filteredInventory: InventoryState = useMemo(() => {
    if (!q) return inventory;
    const match = (n: string, d: string) => n.toLowerCase().includes(q) || d.toLowerCase().includes(q);
    return {
      effects: inventory.effects,
      items: inventory.items.filter((i) => match(i.name, i.description)),
      crates: inventory.crates.filter((c) => match(c.name, c.description)),
    };
  }, [inventory, q]);

  /* ---- cosmetic search: matching a piece surfaces its game ---- */
  const gameHits = useMemo(() => {
    return COSMETIC_GAME_ORDER.map((slug) => {
      // Pieces from a season that hasn't started aren't counted: the total
      // would otherwise announce a collection nobody can complete yet.
      const all = cosmeticsForGame(slug).filter((c) => visible.has(c.id));
      const got = all.filter((c) => owned.includes(c.id)).length;
      const hits = q ? all.filter((c) => c.name.toLowerCase().includes(q)).length : 0;
      return { slug, total: all.length, got, hits };
    });
  }, [owned, visible, q]);

  const shownGames = q ? gameHits.filter((g) => g.hits > 0 || gameLabel(g.slug).toLowerCase().includes(q)) : gameHits;

  return (
    <main className="bg-transparent text-tx-base p-3 sm:p-4 flex flex-col min-h-[100dvh]">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      {openings && <CrateOpeningModal openings={openings} onClose={() => setOpenings(null)} />}

      <div className="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/casino"
              prefetch
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl font-black leading-none">Inventaire</h1>
              <span className="text-[11px] text-tx-muted">Tes objets et ta collection de cosmétiques.</span>
            </div>
          </div>

          <CasinoControls />

            <BalanceChip balance={balance} isLoaded={isLoaded} />
        </header>

        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
          {([['objets', 'Objets', Backpack], ['cosmetiques', 'Cosmétiques', Palette]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => { sfx.click(); setTab(id); setQuery(''); }}
              className={cn(
                'h-11 px-4 rounded-xl border-2 flex items-center gap-2 font-display font-black text-xs tracking-wide focus:outline-none transition-colors',
                tab === id ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-tx-muted pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'objets' ? 'Chercher un objet…' : 'Chercher un cosmétique ou un jeu…'}
              className="w-full h-11 bg-brand-inner border-2 border-brand-border rounded-xl pl-9 pr-9 text-sm font-bold focus:outline-none focus:border-accent-primary"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center text-tx-muted hover:text-tx-base focus:outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {!user && <p className="text-tx-secondary">Connecte-toi pour voir ton inventaire.</p>}

        {tab === 'objets' && user && (
          <InventoryPanel state={filteredInventory} busy={busy} onUse={use} />
        )}

        {tab === 'cosmetiques' && user && (
          game === null ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {shownGames.map(({ slug, total, got }) => (
                <button
                  key={slug}
                  onClick={() => { sfx.click(); setGame(slug); }}
                  className={cn(
                    'rounded-2xl border-4 bg-brand-card p-4 flex flex-col items-start gap-1 shadow-brutal',
                    'hover:border-accent-primary hover:-translate-y-1 transition-all focus:outline-none',
                    slug === GLOBAL_SLUG ? 'border-accent-primary/60' : 'border-brand-border'
                  )}
                >
                  <span className="font-display font-black text-sm">{gameLabel(slug)}</span>
                  <span className="text-[11px] text-tx-muted leading-tight">
                    {slug === GLOBAL_SLUG ? 'Tous les jeux et écrans' : `${total} pièces`}
                  </span>
                  <div className="w-full mt-3">
                    <div className="flex items-center justify-between text-[10px] font-black mb-1">
                      <span className="text-tx-muted">Collection</span>
                      <span className="text-accent-primary tabular-nums">{got}/{total}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
                      <div className="h-full bg-accent-primary transition-all" style={{ width: `${(got / total) * 100}%` }} />
                    </div>
                  </div>
                </button>
              ))}
              {shownGames.length === 0 && (
                <p className="text-sm text-tx-secondary col-span-full">Aucun cosmétique ne correspond.</p>
              )}
            </div>
          ) : (
            <CosmeticGrid
              game={game}
              owned={owned}
              visible={visible}
              query={q}
              theme={theme}
              onTheme={setTheme}
              equipped={equipped[game] || {}}
              onBack={() => { sfx.click(); setGame(null); }}
              onEquip={equip}
              onEquipAll={equipAll}
            />
          )
        )}
      </div>
    </main>
  );
}

function CosmeticGrid({
  game, owned, visible, query, theme, onTheme, equipped, onBack, onEquip, onEquipAll,
}: {
  game: string;
  owned: string[];
  visible: Set<string>;
  query: string;
  theme: string;
  onTheme: (key: string) => void;
  equipped: Record<string, string>;
  onBack: () => void;
  onEquip: (gameSlug: string, slot: CosmeticSlot, cosmeticId: string | null) => void;
  onEquipAll: (gameSlug: string, action: 'equip_all' | 'clear_all') => void;
}) {
  const all = cosmeticsForGame(game).filter((c) => visible.has(c.id));
  const themesHere = Array.from(new Set(all.map((c) => c.themeKey)));

  const pieces = all.filter((c) => {
    if (theme !== 'tous' && c.themeKey !== theme) return false;
    if (query && !c.name.toLowerCase().includes(query) && !c.themeName.toLowerCase().includes(query)) return false;
    return true;
  });

  const ownedCount = all.filter((c) => owned.includes(c.id)).length;
  const equippedCount = Object.keys(equipped).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="h-9 px-3 rounded-xl border-2 border-brand-border bg-brand-card flex items-center gap-1.5 text-xs font-black hover:border-accent-primary focus:outline-none"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tous les jeux
        </button>
        <span className="font-display font-black text-sm">{gameLabel(game)}</span>
        <span className="text-[11px] text-tx-muted">
          {game === GLOBAL_SLUG ? 'S’applique à tous les jeux et tous les écrans' : 'Ce jeu uniquement'}
          {' · '}{ownedCount}/{all.length} débloqués
        </span>

        <div className="ml-auto flex items-center gap-2">
          {equippedCount > 0 && (
            <button
              onClick={() => onEquipAll(game, 'clear_all')}
              className="h-9 px-3 rounded-xl border-2 border-brand-border bg-brand-card flex items-center gap-1.5 text-xs font-black text-tx-secondary hover:text-tx-base hover:border-tx-base focus:outline-none"
            >
              <Eraser className="h-3.5 w-3.5" /> Tout retirer
            </button>
          )}
          <button
            onClick={() => onEquipAll(game, 'equip_all')}
            disabled={ownedCount === 0}
            className="h-9 px-3 rounded-xl border-2 border-accent-primary bg-accent-primary text-brand-bg flex items-center gap-1.5 text-xs font-black hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
          >
            <Wand2 className="h-3.5 w-3.5" /> Tout équiper
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ key: 'tous', name: 'Tous les thèmes' }, ...THEMES.filter((t) => themesHere.includes(t.key))].map((t) => (
          <button
            key={t.key}
            onClick={() => { sfx.click(); onTheme(t.key); }}
            className={cn(
              'h-8 px-2.5 rounded-lg border-2 shrink-0 text-[11px] font-black focus:outline-none transition-colors',
              theme === t.key ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {pieces.map((piece) => {
          const isOwned = owned.includes(piece.id);
          const isEquipped = equipped[piece.slot] === piece.id;
          const tone = RARITY_COLOR[piece.rarity];

          // A locked piece stays a mystery on purpose: showing the artwork
          // would spend the surprise before the crate is even opened.
          if (!isOwned) {
            return (
              <div key={piece.id} className="rounded-2xl border-4 border-dashed border-brand-border bg-brand-card p-3 flex flex-col items-center gap-2 opacity-70">
                <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{SLOT_LABEL[piece.slot]}</span>
                <div className="h-[86px] w-[86px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center">
                  <Lock className="h-7 w-7 text-tx-muted" />
                </div>
                <span className="font-display font-black text-[11px] text-tx-muted">?????</span>
                <span className="text-[10px] text-tx-muted text-center leading-tight">
                  {piece.prestige ? `Prestige ${piece.prestige}` : SOURCE_LABEL[piece.source]}
                </span>
                <div className="mt-auto h-8" />
              </div>
            );
          }

          return (
            <div
              key={piece.id}
              className={cn(
                'rounded-2xl border-4 p-3 flex flex-col items-center gap-2 transition-colors bg-brand-card',
                isEquipped ? 'bg-accent-primary/10' : ''
              )}
              style={{ borderColor: isEquipped ? tone : undefined }}
            >
              <div className="w-full flex items-center justify-between gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{SLOT_LABEL[piece.slot]}</span>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: tone }}>
                  {RARITY_LABEL[piece.rarity]}
                </span>
              </div>
              <span className="text-[9px] font-bold text-tx-muted">{piece.themeName}</span>

              <CosmeticPreview cosmetic={piece} size={86} />
              <span className="font-display font-black text-[11px] leading-tight text-center">{piece.name}</span>
              <span className="text-[10px] text-tx-muted leading-tight text-center">{cosmeticEffect(piece)}</span>

              <button
                onClick={() => onEquip(game, piece.slot, isEquipped ? null : piece.id)}
                className={cn(
                  'mt-auto w-full h-8 rounded-lg border-2 font-black text-[10px] tracking-widest focus:outline-none transition-colors',
                  isEquipped ? 'border-accent-primary bg-accent-primary text-brand-bg'
                    : 'border-brand-border bg-brand-inner hover:border-accent-primary'
                )}
              >
                {isEquipped ? 'RETIRER' : 'ÉQUIPER'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
