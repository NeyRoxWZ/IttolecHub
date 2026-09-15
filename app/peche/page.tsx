'use client';

import Link from 'next/link';
import { ArrowLeft, Fish, BookOpen, Anchor, Crown, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import PecheGame from './_components/PecheGame';

const PERKS = [
  { icon: Fish, text: 'Des centaines d’espèces à pêcher' },
  { icon: BookOpen, text: 'Ton Poissodex et ton aquarium' },
  { icon: Anchor, text: 'Matériel, bateau et Marées' },
  { icon: Crown, text: 'Pass, succès et classements' },
];

/**
 * Pêche (beta). The whole game is drawn and saved on the server, on the
 * player's account, so it starts once signed in; a guest gets a card that
 * says what's waiting and the two ways in.
 */
export default function PechePage() {
  const { user, loading } = useAuth();

  const remember = () => { try { sessionStorage.setItem('itollec_next_path', '/peche'); } catch {} };

  return (
    <main className="min-h-[100dvh] bg-transparent text-tx-base px-3 sm:px-6 pt-0 lg:pt-5 pb-4 lg:pb-10">
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="mt-3 lg:mt-0 h-[520px] rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />
        ) : user ? (
          <PecheGame userId={user.id} pseudo={user.pseudo} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 pt-3 lg:pt-0">
              <Link
                href="/?mode=solo"
                aria-label="Retour"
                className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Link>
              <h1 className="font-display text-3xl sm:text-4xl leading-none">Pêche</h1>
            </div>

            <div className="max-w-lg mx-auto sm:mt-6 overflow-hidden rounded-[22px] border-4 border-brand-border bg-brand-card shadow-[0_8px_0_#05061A]">
              {/* A little sea: sky, waves and a float, like the game's scene. */}
              <div className="relative h-36 sm:h-44 border-b-4 border-brand-border bg-[linear-gradient(#7FD3F7_0%,#BDEBFF_48%,#1FA3D6_48%,#0E6FA8_100%)]">
                <svg aria-hidden viewBox="0 0 400 176" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  <path d="M0 84 Q 25 74 50 84 T 100 84 T 150 84 T 200 84 T 250 84 T 300 84 T 350 84 T 400 84" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="4" />
                  <path d="M0 118 Q 25 110 50 118 T 100 118 T 150 118 T 200 118 T 250 118 T 300 118 T 350 118 T 400 118" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="4" />
                  <line x1="120" y1="0" x2="222" y2="74" stroke="#05061A" strokeWidth="3" />
                </svg>
                <span className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border-4 border-brand-border bg-[linear-gradient(#FF4F8B_50%,#FFFFFF_50%)] animate-bounce" />
                <span className="absolute right-6 bottom-4 h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-5px_0_#2F5BD0,0_4px_0_#05061A]">
                  <Fish className="h-8 w-8 text-white" />
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <h2 className="font-display text-3xl leading-tight">Connecte-toi pour pêcher</h2>
                <p className="mt-1 text-sm font-bold text-tx-secondary">
                  Chaque prise, ton matériel et ta collection sont sauvegardés sur ton compte. C’est gratuit, et ça prend une minute.
                </p>

                <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERKS.map((p) => (
                    <li key={p.text} className="flex items-center gap-2.5 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
                      <span className="h-8 w-8 shrink-0 rounded-lg border-2 border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-3px_0_#2F5BD0]">
                        <p.icon className="h-4 w-4 text-white" strokeWidth={2.5} />
                      </span>
                      <span className="text-[13px] font-bold leading-tight">{p.text}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 grid gap-2">
                  <Link href="/creer-compte" onClick={remember} className="h-14 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-xl shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform">
                    <UserPlus className="h-5 w-5" /> Créer un compte gratuit
                  </Link>
                  <Link href="/connexion?next=%2Fpeche" onClick={remember} className="h-12 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display text-lg shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] active:translate-y-[3px] transition-transform">
                    <LogIn className="h-5 w-5" /> J’ai déjà un compte
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
