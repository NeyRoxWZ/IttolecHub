'use client';

import { useEffect, useState } from 'react';
import { X, Gem } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
  JACKPOT_CONTRIBUTION_RATE, JACKPOT_HIT_CHANCE, JACKPOT_SEED,
} from '@/lib/casino/meta';

interface LastWin { pseudo: string | null; amount: number; at: string }

/**
 * The shared jackpot was the one mechanic on the hub with no explanation —
 * players saw a number climbing and no way to know how to win it. This spells
 * out the odds, the funding, and who took it last.
 */
export default function JackpotModal({ amount, onClose }: { amount: number | null; onClose: () => void }) {
  const [last, setLast] = useState<LastWin | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('casino_jackpot')
        .select('last_winner_user_id, last_won_amount, last_won_at')
        .eq('id', 1).maybeSingle();
      if (cancelled || !data?.last_won_at || !data.last_won_amount) return;

      let pseudo: string | null = null;
      if (data.last_winner_user_id) {
        const { data: u } = await supabase.from('users').select('pseudo').eq('id', data.last_winner_user_id).maybeSingle();
        pseudo = u?.pseudo ?? null;
      }
      if (!cancelled) setLast({ pseudo, amount: Number(data.last_won_amount), at: data.last_won_at });
    })();
    return () => { cancelled = true; };
  }, []);

  const oneIn = Math.round(1 / JACKPOT_HIT_CHANCE);

  return (
    <div className="fixed inset-0 z-[200] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="font-display text-3xl leading-none flex items-center gap-2">
            <Gem className="h-5 w-5 text-accent-primary" /> Jackpot commun
          </h2>
          <button onClick={onClose} aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl border-[3px] border-brand-border bg-accent-info p-4 text-center mb-5 shadow-[inset_0_-6px_0_#2F5BD0,0_5px_0_#05061A]">
          <div className="text-xs font-black uppercase tracking-widest text-white mb-1">Cagnotte actuelle</div>
          <div className="font-display text-5xl leading-none text-accent-primary tabular-nums [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]">
            {amount !== null ? `${amount.toLocaleString('en-US')} ₶` : '···'}
          </div>
        </div>

        <ol className="space-y-2.5 mb-5">
          {[
            `Chaque mise perdue, dans n'importe quel jeu, verse ${Math.round(JACKPOT_CONTRIBUTION_RATE * 100)}% de son montant dans la cagnotte commune.`,
            `À chaque mise réglée — gagnée ou perdue, quel que soit le jeu ou le montant — un tirage indépendant a 1 chance sur ${oneIn.toLocaleString('en-US')} de te donner toute la cagnotte.`,
            'Rien à activer, rien à miser en plus : jouer suffit. Une mise de 5 ₶ a exactement les mêmes chances qu\'une mise de 5 000 ₶.',
            `Une fois raflée, la cagnotte redescend à ${JACKPOT_SEED.toLocaleString('en-US')} ₶ et repart à zéro pour tout le monde.`,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-8 h-8 rounded-xl border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-base flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">{i + 1}</span>
              <span className="text-tx-secondary font-bold leading-relaxed pt-1">{step}</span>
            </li>
          ))}
        </ol>

        <div className="font-display text-lg leading-none mb-2">Dernier gagnant</div>
        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner px-3 py-2.5 text-sm">
          {last ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-black truncate">{last.pseudo || 'Un joueur'}</span>
              <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-success text-brand-bg font-display tabular-nums shrink-0">
                +{last.amount.toLocaleString('en-US')} ₶
              </span>
            </div>
          ) : (
            <span className="text-tx-muted">Personne ne l&apos;a encore décroché.</span>
          )}
          {last && (
            <div className="text-[11px] text-tx-muted mt-1">
              {new Date(last.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
