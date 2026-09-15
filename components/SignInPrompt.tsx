'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Package, Crown, Wallet, X, UserPlus, LogIn, Lock } from 'lucide-react';
import { SIGN_IN_EVENT } from '@/lib/askToSignIn';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';

const PERKS = [
  { icon: Gift, text: 'Bonus du jour, roue et coffre 7 jours' },
  { icon: Package, text: 'Coffres, caisses et cosmétiques' },
  { icon: Crown, text: 'Pass, missions et succès' },
  { icon: Wallet, text: 'Ton solde sauvegardé partout' },
];

/**
 * The one "you need an account for that" prompt: a card in the middle of the
 * screen on a computer, a sheet from the bottom on a phone. Guests can close it
 * and keep playing; the two buttons lead to sign-up and sign-in and bring the
 * player back here afterwards.
 */
export default function SignInPrompt() {
  const { user } = useAuth();
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const close = useCallback(() => setReason(null), []);

  useEffect(() => {
    const onAsk = (e: Event) => {
      sfx.click(); vibrate(HAPTIC.SOFT);
      setReason((e as CustomEvent<string>).detail || 'Cette fonction');
    };
    window.addEventListener(SIGN_IN_EVENT, onAsk);
    return () => window.removeEventListener(SIGN_IN_EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reason, close]);

  if (!reason || user) return null;

  const go = (path: string) => {
    try { sessionStorage.setItem('itollec_next_path', window.location.pathname); } catch {}
    close();
    router.push(path === '/connexion' ? `/connexion?next=${encodeURIComponent(window.location.pathname)}` : path);
  };

  return (
    <div className="fixed inset-0 z-[320] bg-[#05061A]/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-150" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-title"
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[22px] border-4 border-b-0 sm:border-b-4 border-brand-border bg-brand-card shadow-[0_8px_0_#05061A] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-[env(safe-area-inset-bottom)] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4 border-b-4 border-brand-border bg-[linear-gradient(135deg,#FFC61A_0%,#FF8A1F_55%,#FF4F8B_100%)] rounded-t-[24px] sm:rounded-t-[18px]">
          <div className="sm:hidden mx-auto -mt-2 mb-3 h-1.5 w-12 rounded-full bg-brand-border/40" />
          <button onClick={close} aria-label="Fermer" className="absolute top-3 right-3 h-10 w-10 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
          <span className="h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-white flex items-center justify-center shadow-[inset_0_-4px_0_#E8DCC0,0_4px_0_#05061A]">
            <Lock className="h-7 w-7 text-brand-bg" strokeWidth={2.5} />
          </span>
          <h2 id="sign-in-title" className="mt-3 font-display text-3xl leading-none text-white text-stroke-sm">Connecte-toi pour en profiter</h2>
          <p className="mt-1.5 text-sm font-black text-brand-bg/85">{reason} demande un compte gratuit.</p>
        </div>

        <div className="p-5">
          <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted mb-2">Avec un compte</div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-2.5 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
                <span className="h-8 w-8 shrink-0 rounded-lg border-2 border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">
                  <p.icon className="h-4 w-4 text-brand-bg" strokeWidth={2.5} />
                </span>
                <span className="text-[13px] font-bold leading-tight text-tx-base">{p.text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-2">
            <button onClick={() => go('/creer-compte')} className="h-14 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-xl shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform">
              <UserPlus className="h-5 w-5" /> Créer un compte gratuit
            </button>
            <button onClick={() => go('/connexion')} className="h-12 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] active:translate-y-[3px] transition-transform">
              <LogIn className="h-5 w-5" /> J’ai déjà un compte
            </button>
          </div>
          <p className="mt-3 text-center text-xs font-bold text-tx-muted">Sans compte, tu peux continuer à jouer avec un solde gardé sur cet appareil.</p>
        </div>
      </div>
    </div>
  );
}
