'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, Play, Users, LogOut, Menu, X, RotateCcw, Sparkles, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { vibrate, HAPTIC } from '@/lib/haptic';
import GameCover, { type CoverGame } from '@/components/GameCover';
import releases from '@/patch-notes/releases.json';

const STEPS = [
  { title: 'Crée ta salle', description: 'Un code court, tes amis rejoignent en un clic.', icon: Users },
  { title: 'Choisis un jeu', description: 'L’hôte règle le mini-jeu, les manches et le temps.', icon: Gamepad2 },
  { title: 'Jouez ensemble', description: 'Tout le monde en temps réel, podium à la fin.', icon: Play },
];

const MULTI_GAMES = ['PokéGuessr', 'RentGuessr', 'FlagGuessr', 'LogoGuessr', 'BudgetGuessr', 'JaugeGuessr', 'DrawGuessr', 'Undercover', 'Infiltré', 'WikiRacing'];

const SOLO_GAMES: { id: CoverGame; name: string; tag: string; tagClass: string; description: string; href: string }[] = [
  {
    id: 'clicker', name: 'ItollecClicker', tag: 'Idle', tagClass: 'bg-accent-success text-brand-bg',
    description: 'Clique pour gagner des ₶, achète des bâtiments et empile les bonus pour produire toujours plus.',
    href: '/itollec-clicker',
  },
  {
    id: 'casino', name: 'Casino', tag: '20 jeux', tagClass: 'bg-accent-primary text-brand-bg',
    description: 'Mise tes FrenlyCoins sur 20 mini-jeux, avec pass, coffre, missions et cagnotte. Monnaie fictive.',
    href: '/casino',
  },
  {
    id: 'krash', name: 'Krash', tag: 'Nouveau', tagClass: 'bg-accent-secondary text-white',
    description: 'La bourse en accéléré : parie à la hausse ou à la baisse avec un portefeuille séparé du casino.',
    href: '/krash',
  },
];

const latestRelease = (releases as { releases: { version: string; title?: string }[] }).releases[0];

/** The shared chunky button: bright fill, black outline, pressed-in bottom edge. */
const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-brand-border font-display tracking-wide transition-transform active:translate-y-[3px] disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_YELLOW = `${BTN} bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]`;
const BTN_DARK = `${BTN} bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]`;
const BTN_PINK = `${BTN} bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A]`;

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'multiplayer' | 'solo'>('multiplayer');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [logoVisible, setLogoVisible] = useState(true);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resumeRoom, setResumeRoom] = useState<{ code: string; name: string } | null>(null);
  const { user, logout } = useAuth();

  // Offer to resume the last room this browser was in, if it's still alive.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem('itollec_last_room');
      if (!raw) return;
      const saved = JSON.parse(raw) as { code: string; name: string };
      if (!saved?.code || !saved?.name) return;

      supabase
        .from('rooms')
        .select('code,status')
        .eq('code', saved.code)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          if (data && data.status !== 'closed' && data.status !== 'finished') {
            setResumeRoom(saved);
          } else {
            localStorage.removeItem('itollec_last_room');
          }
        });
    } catch {}
    return () => { cancelled = true; };
  }, []);

  const resumeLastGame = () => {
    if (!resumeRoom) return;
    sessionStorage.setItem('playerName', resumeRoom.name);
    // No ?return=true here on purpose: if the room is mid-game, the room
    // page's own logic should redirect straight into the running game.
    router.push(`/room/${resumeRoom.code}`);
  };

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'solo' || urlMode === 'multiplayer') {
      setMode(urlMode);
      sessionStorage.setItem('itollec_home_mode', urlMode);
      return;
    }
    const savedMode = sessionStorage.getItem('itollec_home_mode');
    if (savedMode === 'solo' || savedMode === 'multiplayer') setMode(savedMode);
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      setName(user.pseudo);
    } else {
      const savedName = sessionStorage.getItem('playerName');
      if (savedName) setName(savedName);
    }
  }, [user]);

  // Easter egg: type "arsac" anywhere outside a field.
  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      buffer = (buffer + e.key).slice(-5).toLowerCase();
      if (buffer === 'arsac') setEasterEggActive(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAction = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Choisis un pseudo !');
      return;
    }
    sessionStorage.setItem('playerName', name);
    vibrate(HAPTIC.MEDIUM);

    if (activeTab === 'create') {
      const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      router.push(`/room/${newCode}?host=true`);
    } else {
      if (!code.trim()) {
        toast.error('Entre un code de salle !');
        return;
      }
      router.push(`/room/${code.toUpperCase()}`);
    }
  };

  const canSubmit = name.trim().length > 0 && (activeTab === 'create' || code.trim().length > 0);

  const handleSetMode = (nextMode: 'multiplayer' | 'solo') => {
    vibrate(HAPTIC.SOFT);
    setMode(nextMode);
    sessionStorage.setItem('itollec_home_mode', nextMode);
    router.replace(`/?mode=${nextMode}`);
  };

  const rememberNext = () => {
    try { sessionStorage.setItem('itollec_next_path', `/?mode=${mode}`); } catch {}
  };
  const goConnexion = () => { rememberNext(); router.push(`/connexion?next=${encodeURIComponent(`/?mode=${mode}`)}`); };
  const goCreerCompte = () => { rememberNext(); router.push('/creer-compte'); };

  const modeSwitch = (
    <nav className="flex gap-1 p-1.5 rounded-2xl bg-brand-bg border-[3px] border-brand-border" aria-label="Mode de jeu">
      {(['multiplayer', 'solo'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => handleSetMode(m)}
          aria-pressed={mode === m}
          className={cn(
            'h-10 px-5 rounded-xl font-display text-lg transition-colors',
            mode === m
              ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]'
              : 'text-tx-secondary hover:text-white'
          )}
        >
          {m === 'multiplayer' ? 'Multijoueur' : 'Solo'}
        </button>
      ))}
    </nav>
  );

  return (
    // Locked to one screen only when the window is big enough to hold it all;
    // a narrow or short window (split screen) scrolls normally.
    <main className="bg-transparent min-h-screen flex flex-col relative">
      {easterEggActive && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div
            className="absolute bottom-4 left-4 animate-in slide-in-from-bottom-full duration-500 fade-in pointer-events-auto cursor-pointer"
            onClick={() => setEasterEggActive(false)}
          >
            <Image src="/easteregg.png" alt="Easter Egg" width={192} height={192} className="w-48 h-auto drop-shadow-2xl" draggable={false} priority />
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <header className="px-4 sm:px-6 pt-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={cn(BTN_DARK, 'md:hidden h-12 w-12 shrink-0')}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {logoVisible && (
            <Image
              src="/logo-site.png"
              alt="ItollecHub"
              width={1219}
              height={635}
              className="h-12 md:h-16 w-auto object-contain select-none"
              priority
              onError={() => setLogoVisible(false)}
            />
          )}

          <div className="hidden md:flex flex-1 justify-center">{modeSwitch}</div>

          <div className="hidden md:flex items-center gap-2 ml-auto">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push('/profil')}
                  className="h-12 flex items-center gap-2 pl-1.5 pr-4 rounded-2xl bg-brand-card border-[3px] border-brand-border shadow-brutal font-black hover:bg-[#252B66] transition-colors"
                >
                  <span className="h-8 w-8 rounded-xl bg-accent-secondary text-white font-display text-lg flex items-center justify-center shadow-[inset_0_-3px_0_#C92D63]">
                    {user.pseudo[0]?.toUpperCase()}
                  </span>
                  {user.pseudo}
                </button>
                <button type="button" onClick={logout} className={cn(BTN_PINK, 'h-12 w-12')} title="Se déconnecter" aria-label="Se déconnecter">
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={goConnexion} className={cn(BTN_DARK, 'h-12 px-4 text-lg')}>Connexion</button>
                <button type="button" onClick={goCreerCompte} className={cn(BTN_YELLOW, 'h-12 px-4 text-lg')}>Créer un compte</button>
              </>
            )}
          </div>
        </div>

        <div className="md:hidden mt-4 flex justify-center">{modeSwitch}</div>
      </header>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          <button type="button" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/70" aria-label="Fermer" />
          <div className="absolute top-3 left-3 right-3 bg-brand-card border-4 border-brand-border rounded-[28px] p-5 shadow-brutal max-h-[calc(100vh-24px)] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-3xl text-stroke">Menu</div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className={cn(BTN_DARK, 'h-11 w-11')} aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            {user ? (
              <>
                <button type="button" onClick={() => { setMobileMenuOpen(false); router.push('/profil'); }} className={cn(BTN_DARK, 'w-full h-12 text-lg')}>
                  Profil · {user.pseudo}
                </button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); logout(); }} className={cn(BTN_PINK, 'w-full h-12 text-lg')}>
                  <LogOut className="h-5 w-5" /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMobileMenuOpen(false); goConnexion(); }} className={cn(BTN_DARK, 'w-full h-12 text-lg')}>Connexion</button>
                <button type="button" onClick={() => { setMobileMenuOpen(false); goCreerCompte(); }} className={cn(BTN_YELLOW, 'w-full h-12 text-lg')}>Créer un compte</button>
              </>
            )}
            <Link href="/patch-notes" className={cn(BTN_DARK, 'w-full h-12 text-lg')}>Patch notes</Link>
          </div>
        </div>
      )}

      <section className="flex-1 px-4 sm:px-6 py-6 md:py-8">
        <div className="max-w-6xl mx-auto">
          {resumeRoom && mode === 'multiplayer' && (
            <button
              type="button"
              onClick={resumeLastGame}
              className={cn(BTN_YELLOW, 'mb-6 w-full h-14 text-xl animate-in fade-in slide-in-from-top-2')}
            >
              <RotateCcw className="h-5 w-5" />
              Reprendre la partie {resumeRoom.code}
            </button>
          )}

          {mode === 'solo' ? (
            <>
              <div className="mb-6">
                <h1 className="font-display text-5xl md:text-6xl leading-none">Jeux solo</h1>
                <p className="mt-2 font-black text-tx-secondary">Joue à ton rythme. Ta progression est sauvegardée sur ton compte.</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {SOLO_GAMES.map((g) => (
                    <article
                      key={g.id}
                      className="relative flex flex-col bg-brand-card border-4 border-brand-border rounded-[24px] overflow-hidden shadow-[0_8px_0_#05061A]"
                    >
                      <span className={cn('absolute top-3 left-[-4px] z-10 px-3 py-1 font-display text-base border-[3px] border-brand-border rounded-r-xl', g.tagClass)}>
                        {g.tag}
                      </span>
                      <GameCover game={g.id} className="block w-full aspect-[4/3] border-b-4 border-brand-border" />
                      <div className="flex-1 flex flex-col gap-3 p-4">
                        <h2 className="font-display text-3xl leading-none text-stroke">{g.name}</h2>
                        <p className="text-sm font-bold text-tx-secondary leading-relaxed">{g.description}</p>
                        <button
                          type="button"
                          onClick={() => window.location.assign(g.href)}
                          className={cn(BTN_YELLOW, 'mt-auto w-full h-14 text-2xl')}
                        >
                          Jouer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <aside className="grid gap-5">
                  <div className="bg-brand-card border-4 border-brand-border rounded-[22px] p-4 shadow-brutal">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-accent-primary" />
                      <div className="font-display text-2xl">Nouveautés</div>
                    </div>
                    <p className="mt-2 text-sm font-bold text-tx-secondary">
                      {latestRelease ? `Version ${latestRelease.version}${latestRelease.title ? ` · ${latestRelease.title}` : ''}` : 'Toutes les mises à jour du site.'}
                    </p>
                    <Link href="/patch-notes" className={cn(BTN_DARK, 'mt-3 w-full h-11 text-lg')}>
                      Voir les patch notes <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="bg-accent-secondary border-4 border-brand-border rounded-[22px] p-4 shadow-[inset_0_-6px_0_#C92D63,0_5px_0_#05061A]">
                    <div className="font-display text-2xl text-stroke-sm">Entre potes ?</div>
                    <p className="mt-1 text-sm font-black text-white">10 mini-jeux multijoueurs, une salle, un code.</p>
                    <button type="button" onClick={() => handleSetMode('multiplayer')} className={cn(BTN_YELLOW, 'mt-3 w-full h-11 text-lg')}>
                      Multijoueur
                    </button>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-5xl md:text-6xl leading-none">Multijoueur</h1>
                <p className="mt-2 font-black text-tx-secondary">Crée une salle, envoie le code, jouez tous ensemble.</p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
                <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 md:p-6 shadow-[0_8px_0_#05061A]">
                  <div className="flex gap-1 p-1.5 rounded-2xl bg-brand-bg border-[3px] border-brand-border">
                    {(['create', 'join'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { vibrate(HAPTIC.SOFT); setActiveTab(t); }}
                        aria-pressed={activeTab === t}
                        className={cn(
                          'flex-1 h-11 rounded-xl font-display text-lg transition-colors',
                          activeTab === t ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]' : 'text-tx-secondary hover:text-white'
                        )}
                      >
                        {t === 'create' ? 'Créer une salle' : 'Rejoindre'}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAction} className="mt-5 space-y-4">
                    <label className="block space-y-2">
                      <span className="text-xs font-black tracking-widest uppercase text-tx-secondary">Ton pseudo</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="PseudoCool"
                        disabled={!!user}
                        className="w-full h-14 rounded-xl bg-brand-inner border-[3px] border-brand-border px-4 text-lg font-black text-white placeholder:text-tx-muted focus:outline-none focus:ring-4 focus:ring-accent-primary disabled:opacity-60"
                      />
                    </label>

                    {activeTab === 'join' && (
                      <label className="block space-y-2 animate-in fade-in slide-in-from-top-1">
                        <span className="text-xs font-black tracking-widest uppercase text-tx-secondary">Code de salle</span>
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="ABC123"
                          maxLength={6}
                          className="w-full h-14 rounded-xl bg-brand-inner border-[3px] border-brand-border px-4 font-display text-2xl tracking-[0.3em] text-white placeholder:text-tx-muted focus:outline-none focus:ring-4 focus:ring-accent-primary"
                        />
                      </label>
                    )}

                    <button type="submit" disabled={!canSubmit} className={cn(BTN_YELLOW, 'w-full h-16 text-2xl')}>
                      {activeTab === 'create' ? 'Démarrer' : 'Rejoindre'}
                    </button>
                  </form>
                </div>

                <div className="grid gap-5">
                  <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
                    <div className="font-display text-2xl">Comment jouer</div>
                    <ol className="mt-4 grid gap-3">
                      {STEPS.map((step, i) => {
                        const Icon = step.icon;
                        return (
                          <li key={step.title} className="flex items-center gap-3 rounded-2xl bg-brand-inner border-[3px] border-brand-border p-3">
                            <span className="h-12 w-12 shrink-0 rounded-xl bg-accent-info border-[3px] border-brand-border flex items-center justify-center shadow-[inset_0_-4px_0_#2F5BD0]">
                              <Icon className="h-6 w-6 text-white" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-display text-lg leading-tight">
                                <span className="text-accent-primary">{i + 1}.</span> {step.title}
                              </div>
                              <div className="text-sm font-bold text-tx-secondary">{step.description}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
                    <div className="font-display text-2xl">10 jeux au choix</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {MULTI_GAMES.map((game, i) => (
                        <span
                          key={game}
                          className={cn(
                            'px-3 py-1.5 rounded-xl border-[3px] border-brand-border font-display text-base',
                            ['bg-accent-primary text-brand-bg', 'bg-accent-secondary text-white', 'bg-accent-success text-brand-bg', 'bg-accent-info text-white'][i % 4]
                          )}
                        >
                          {game}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="pb-4 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-black tracking-widest uppercase text-tx-secondary">
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <Link href="/conditions" className="hover:text-white">Conditions</Link>
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/patch-notes" className="hover:text-white">Patch notes</Link>
        </div>
      </footer>
    </main>
  );
}
