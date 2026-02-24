'use client';

import type { ReactNode } from 'react';

interface GameLayoutProps {
  /** Zone haute : manche, timer, code de room, etc. */
  header: ReactNode;
  /** Zone centrale : carte principale du jeu (image, question, etc.). */
  main: ReactNode;
  /** Zone basse : inputs, boutons, indicateurs d'état. */
  footer: ReactNode;
  /** Bandeau horizontal d'avatars / scores (facultatif). */
  playersBar?: ReactNode;
}

/**
 * Layout de base réutilisable pour toutes les vues de jeu.
 * Gère uniquement le conteneur global, les espacements et la structure en 3 zones.
 */
export default function GameLayout({ header, main, footer, playersBar }: GameLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-xl mx-auto flex flex-col gap-6">
        {header}

        {main}

        <div className="flex flex-col gap-4">
          {footer}
          {playersBar}
        </div>
      </div>
    </main>
  );
}

