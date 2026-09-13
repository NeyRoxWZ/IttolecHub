'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { User } from '@/hooks/useAuth';

/**
 * The account's last button. Asks for proof (the six words, or the Discord
 * session) and for the word SUPPRIMER typed out, then wipes everything.
 */
export default function DeleteAccount({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const wordList = words.trim().split(/\s+/).filter(Boolean);
  const ready = confirm.trim().toUpperCase() === 'SUPPRIMER' && (user.is_discord || wordList.length === 6);

  const remove = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          confirm: 'SUPPRIMER',
          words: user.is_discord ? undefined : wordList,
          access_token: user.is_discord ? session?.access_token : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? 'Suppression impossible'); return; }
      try { localStorage.removeItem('itollec_user_id'); } catch {}
      if (user.is_discord) await supabase.auth.signOut();
      toast.success('Ton compte et toutes tes données ont été supprimés.');
      window.location.assign('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mt-10 rounded-[24px] border-4 border-red-500/40 bg-brand-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="font-display font-black tracking-wider uppercase text-red-400">Supprimer mon compte</div>
          <p className="text-sm text-tx-secondary mt-1">
            Efface ton compte et toutes tes données : sauvegardes, casino, Krash, messages, cadeaux. C&apos;est définitif.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-12 px-4 rounded-lg border-2 border-red-500/60 bg-brand-inner text-red-400 font-display font-black tracking-wider uppercase hover:bg-red-500/10 hover:border-red-400 flex items-center justify-center gap-2"
        >
          <Trash2 className="h-4 w-4" /> Supprimer
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-brand-card border-4 border-red-500/60 rounded-[28px] p-6 shadow-brutal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="font-display text-xl font-black uppercase tracking-wider text-red-400">Supprimer le compte {user.pseudo} ?</h2>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-tx-secondary leading-relaxed">
              Tout disparaît tout de suite et ne pourra pas être récupéré : progression, FrenlyCoins du casino et de Krash, cosmétiques, pass, classements, messages.
            </p>

            {!user.is_discord && (
              <label className="block mt-4">
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Tes 6 mots, dans l&apos;ordre</span>
                <input
                  value={words}
                  onChange={(e) => setWords(e.target.value)}
                  placeholder="pomme chat voiture arbre ..."
                  autoComplete="off"
                  className="mt-1 w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base"
                />
              </label>
            )}

            <label className="block mt-4">
              <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary">Écris SUPPRIMER pour confirmer</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                autoComplete="off"
                className="mt-1 w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-red-400"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-12 rounded-lg border-2 border-brand-border bg-brand-inner font-display font-black tracking-wider uppercase"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={!ready || busy}
                className={cn(
                  'h-12 rounded-lg border-2 border-red-500 bg-red-500 text-white font-display font-black tracking-wider uppercase',
                  (!ready || busy) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {busy ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
