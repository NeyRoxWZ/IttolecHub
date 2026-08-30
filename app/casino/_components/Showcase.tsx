'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { cosmeticById, RARITY_LABEL, type Cosmetic } from '@/lib/casino/cosmetics';
import { SHOWCASE_SLOTS } from '@/lib/casino/social';

const RARITY_RING: Record<string, string> = {
  commun: 'border-tx-muted',
  rare: 'border-sky-400',
  epique: 'border-fuchsia-400',
  legendaire: 'border-accent-primary',
};

/**
 * The display case.
 *
 * A player with 800 pieces has nothing to say about them; six chosen ones are
 * a statement. The order is theirs, and only what they still own is shown —
 * the server filters on save and on read, so a reset cannot leave a frame
 * pointing at nothing.
 */
export default function Showcase() {
  const { user } = useAuth();
  const [showcase, setShowcase] = useState<Cosmetic[]>([]);
  const [owned, setOwned] = useState<Cosmetic[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [p, c] = await Promise.all([
      fetch(`/api/casino/profile?user_id=${user.id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/casino/cosmetics?user_id=${user.id}`).then((r) => (r.ok ? r.json() : null)),
    ]);

    const chosen: Cosmetic[] = (p?.showcase || [])
      .map((s: any) => cosmeticById(s.id))
      .filter(Boolean);
    setShowcase(chosen);
    setDraft(chosen.map((c2) => c2.id));

    setOwned(
      (c?.owned || [])
        .map((id: string) => cosmeticById(id))
        .filter(Boolean)
    );
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/casino/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, showcase: draft }),
      });
      if (!res.ok) { toast.error('Enregistrement impossible'); return; }
      sfx.click();
      toast.success('Vitrine enregistrée');
      setEditing(false);
      void load();
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => {
    setDraft((d) => {
      if (d.includes(id)) return d.filter((x) => x !== id);
      if (d.length >= SHOWCASE_SLOTS) {
        toast.info(`${SHOWCASE_SLOTS} pièces maximum.`);
        return d;
      }
      return [...d, id];
    });
  };

  return (
    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-display text-2xl leading-none flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-primary" /> Vitrine
        </h3>
        <button
          onClick={() => { sfx.click(); setEditing(true); }}
          disabled={owned.length === 0}
          className="h-9 px-3 rounded-lg border-2 border-brand-border bg-brand-inner font-display font-black text-[11px] tracking-wider text-tx-secondary hover:border-accent-primary disabled:opacity-40 focus:outline-none"
        >
          CHOISIR
        </button>
      </div>

      {showcase.length === 0 ? (
        <p className="text-sm text-tx-secondary">
          {owned.length === 0
            ? 'Ouvre des caisses ou monte le pass pour avoir quelque chose à exposer.'
            : `Rien d’exposé. Choisis jusqu’à ${SHOWCASE_SLOTS} pièces.`}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {showcase.map((c) => <Frame key={c.id} cosmetic={c} />)}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[230] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setEditing(false)}
        >
          <div
            className="w-full max-w-lg max-h-[88dvh] flex flex-col bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="font-display text-xl font-black">Ta vitrine</h2>
                <p className="text-[11px] text-tx-muted mt-1">
                  {draft.length}/{SHOWCASE_SLOTS} choisies · l&apos;ordre est celui des clics.
                </p>
              </div>
              <button
                onClick={() => setEditing(false)}
                className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2 pr-1">
              {owned.map((c) => {
                const rank = draft.indexOf(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'relative rounded-xl border-2 p-2 text-left focus:outline-none transition-all',
                      rank >= 0 ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-inner hover:border-tx-base'
                    )}
                  >
                    <div className={cn('h-8 rounded-lg border-2 mb-1.5', RARITY_RING[c.rarity] || 'border-brand-border')} />
                    <div className="font-display font-black text-[10px] leading-tight truncate">{c.name}</div>
                    <div className="text-[9px] font-bold text-tx-muted truncate">{RARITY_LABEL[c.rarity]}</div>
                    {rank >= 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-accent-primary text-brand-bg text-[10px] font-black flex items-center justify-center">
                        {rank + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDraft([])}
                className="h-12 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-[11px] tracking-wider text-tx-muted focus:outline-none"
              >
                TOUT ENLEVER
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 h-12 rounded-xl bg-accent-primary text-brand-bg font-display font-black text-xs tracking-wider border-2 border-brand-border disabled:opacity-40 focus:outline-none"
              >
                ENREGISTRER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Frame({ cosmetic }: { cosmetic: Cosmetic }) {
  return (
    <div
      title={`${cosmetic.name} · ${RARITY_LABEL[cosmetic.rarity]}`}
      className={cn('rounded-xl border-2 bg-brand-inner p-2', RARITY_RING[cosmetic.rarity] || 'border-brand-border')}
    >
      <div className={cn('h-10 rounded-lg border-2 mb-1.5', RARITY_RING[cosmetic.rarity] || 'border-brand-border')} />
      <div className="font-display font-black text-[10px] leading-tight truncate">{cosmetic.name}</div>
      <div className="text-[9px] font-bold text-tx-muted truncate">{RARITY_LABEL[cosmetic.rarity]}</div>
    </div>
  );
}
