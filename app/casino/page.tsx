'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins, Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5,
  ArrowLeft, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';

interface CasinoGameEntry {
  slug: string;
  name: string;
  description: string;
  icon: any;
  rtp: string;
  enabled: boolean;
}

const CASINO_GAMES: CasinoGameEntry[] = [
  { slug: 'slots', name: 'Frenly Slots', description: 'Machine à sous à rouleaux.', icon: Dices, rtp: '~94%', enabled: false },
  { slug: 'blackjack', name: 'Frenly 21', description: 'Blackjack contre le croupier.', icon: Spade, rtp: '~98%', enabled: false },
  { slug: 'wheel', name: 'Frenly Wheel', description: 'Roulette simplifiée.', icon: CircleDot, rtp: '~97.3%', enabled: true },
  { slug: 'rocket', name: 'Frenly Rocket', description: 'Encaisse avant le crash.', icon: Rocket, rtp: '~95%', enabled: false },
  { slug: 'mines', name: 'Frenly Mines', description: 'Évite les mines cachées.', icon: Bomb, rtp: '~96%', enabled: false },
  { slug: 'plinko', name: 'Frenly Plinko', description: 'La bille tombe, le gain varie.', icon: Circle, rtp: '~96%', enabled: false },
  { slug: 'hilo', name: 'Frenly HiLo', description: 'Plus haut ou plus bas ?', icon: ArrowUpDown, rtp: '~96%', enabled: false },
  { slug: 'grattage', name: 'Frenly Grattage', description: 'Ticket pas cher, petit gain.', icon: Ticket, rtp: '~90%', enabled: false },
  { slug: 'poulet', name: 'Frenly Poulet', description: 'Traverse la route sans te faire écraser.', icon: Egg, rtp: '~96%', enabled: false },
  { slug: 'tower', name: 'Frenly Tower', description: 'Grimpe les étages sans piège.', icon: Building2, rtp: '~96%', enabled: false },
  { slug: 'keno', name: 'Frenly Keno', description: 'Choisis tes numéros chanceux.', icon: Grid3x3, rtp: '~95%', enabled: false },
  { slug: 'caisses', name: 'Frenly Caisses', description: 'Trouve le gros lot.', icon: Gift, rtp: '~93%', enabled: false },
  { slug: 'coinflip', name: 'Frenly Coinflip', description: 'Pile ou face, x2.', icon: Coins, rtp: '~97%', enabled: true },
  { slug: 'dino', name: 'Frenly Dino', description: 'Esquive, encaisse avant impact.', icon: Zap, rtp: '~95%', enabled: false },
  { slug: 'chevaux', name: 'Frenly Chevaux', description: 'Course de chevaux fictifs.', icon: Flag, rtp: '~94%', enabled: false },
  { slug: 'bonneteau', name: 'Frenly Bonneteau', description: 'Suis le bon gobelet.', icon: GlassWater, rtp: '~93%', enabled: true },
  { slug: 'stade', name: 'Frenly Stade', description: 'Domicile, Extérieur ou Nul.', icon: LayoutGrid, rtp: '~96%', enabled: false },
  { slug: 'baccarat', name: 'Frenly Baccarat', description: 'Joueur, Banque, ou Égalité.', icon: Layers, rtp: '~98.5%', enabled: false },
  { slug: 'rps', name: 'Frenly Pierre-Feuille-Ciseaux', description: 'Contre la maison, coup unique.', icon: Hand, rtp: '~96%', enabled: true },
  { slug: 'craps', name: 'Frenly Craps Express', description: 'Ça passe ou ça casse.', icon: Dice5, rtp: '~98.6%', enabled: false },
];

const DISCLAIMER_KEY = 'itollec_casino_disclaimer_seen';

export default function CasinoHub() {
  const router = useRouter();
  const { balance, isLoaded, isLocal } = useCasinoWallet();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISCLAIMER_KEY)) setShowDisclaimer(true);
    } catch {}
  }, []);

  const dismissDisclaimer = () => {
    try { localStorage.setItem(DISCLAIMER_KEY, '1'); } catch {}
    setShowDisclaimer(false);
  };

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      {showDisclaimer && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal animate-in zoom-in fade-in duration-300">
            <div className="flex justify-center mb-4">
              <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl">
                <Info className="w-10 h-10 text-accent-primary" />
              </div>
            </div>
            <h2 className="font-display text-2xl font-black text-center mb-3">FrenlyCoins ne valent rien</h2>
            <p className="text-tx-secondary text-sm text-center leading-relaxed mb-6">
              Les FrenlyCoins (₶) sont une monnaie 100% fictive. Impossible de les acheter avec de l&apos;argent réel,
              impossible de les retirer ou de les convertir, dans un sens comme dans l&apos;autre. C&apos;est juste pour le fun.
            </p>
            <button
              onClick={dismissDisclaimer}
              className="w-full h-14 rounded-lg font-display font-black tracking-wider border-2 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary transition-colors"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/?mode=solo')}
              className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Casino</h1>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">
              {isLoaded ? balance.toLocaleString('fr-FR') : '...'}
            </span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && (
              <span className="ml-1 text-[9px] font-black uppercase tracking-wider bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted" title="Connecte-toi pour sauvegarder ton solde">
                Local
              </span>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CASINO_GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.slug}
                disabled={!game.enabled}
                onClick={() => game.enabled && router.push(`/casino/${game.slug}`)}
                className={cn(
                  'text-left rounded-2xl border-4 border-brand-border bg-brand-card p-4 flex flex-col gap-3 transition-all shadow-brutal',
                  game.enabled ? 'hover:border-accent-primary hover:-translate-y-0.5 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                    <Icon className="h-6 w-6 text-accent-primary" />
                  </div>
                  {!game.enabled && (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-brand-inner border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">
                      Bientôt
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm leading-tight">{game.name}</h3>
                  <p className="text-xs text-tx-secondary mt-1 leading-snug">{game.description}</p>
                </div>
                <span className="text-[10px] font-bold text-tx-muted uppercase tracking-widest mt-auto">RTP {game.rtp}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
