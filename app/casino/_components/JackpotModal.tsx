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
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="font-display text-xl font-black flex items-center gap-2">
            <Gem className="h-5 w-5 text-accent-primary" /> Jackpot commun
          </h2>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl border-2 border-accent-primary bg-accent-primary/10 p-4 text-center mb-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-1">Cagnotte actuelle</div>
          <div className="font-display text-3xl font-black text-accent-primary tabular-nums">
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
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent-primary text-brand-bg font-black text-xs flex items-center justify-center">{i + 1}</span>
              <span className="text-tx-secondary leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Dernier gagnant</div>
        <div className="rounded-xl border-2 border-brand-border bg-brand-inner px-3 py-2.5 text-sm">
          {last ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-black truncate">{last.pseudo || 'Un joueur'}</span>
              <span className="font-black text-accent-success tabular-nums shrink-0">
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
