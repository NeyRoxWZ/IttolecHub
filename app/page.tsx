'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Gamepad2, Play, Users, ChevronRight, ChevronLeft, Crown, TrendingUp, LogOut, Menu, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { vibrate, HAPTIC } from '@/lib/haptic';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const STEPS = [
  {
    title: 'Crée ta salle',
    description: 'Génère un code court et laisse tes amis rejoindre en un clic.',
    icon: Users
  },
  {
    title: 'Choisis un jeu',
    description: 'L’hôte sélectionne un mini-jeu et règle les manches + le temps.',
    icon: Gamepad2
  },
  {
    title: 'Jouez ensemble',
    description: 'Tout le monde joue en temps réel. Le podium tombe à la fin.',
    icon: Play
  }
];

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'multiplayer' | 'solo'>('multiplayer');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [logoVisible, setLogoVisible] = useState(true);
  const [demoGameIndex, setDemoGameIndex] = useState(1);
  const [easterEggActive, setEasterEggActive] = useState(false);
  const [keyBuffer, setKeyBuffer] = useState('');
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
    if (savedMode === 'solo' || savedMode === 'multiplayer') {
      setMode(savedMode);
    }
  }, [searchParams]);

  // Load state on mount
  useEffect(() => {
    if (user) {
      setName(user.pseudo);
    } else {
      const savedName = sessionStorage.getItem('playerName');
      if (savedName) setName(savedName);
    }
  }, [user]);

  // Easter Egg Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      setKeyBuffer((prev) => {
        const newBuffer = (prev + e.key).slice(-5).toLowerCase();
        if (newBuffer === 'arsac') {
          setEasterEggActive(true);
        }
        return newBuffer;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-slide effect (resets when currentStep changes via arrows)
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearTimeout(timer);
  }, [currentStep]);

  // Demo 2: Games cycling effect
  useEffect(() => {
    if (currentStep !== 1) return;
    const timer = setInterval(() => {
      setDemoGameIndex((prev) => (prev + 1) % 3);
    }, 1200);
    return () => clearInterval(timer);
  }, [currentStep]);

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

  const canSubmit =
    name.trim().length > 0 && (activeTab === 'create' || code.trim().length > 0);

  const goPrev = () => setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
  const goNext = () => setCurrentStep((prev) => (prev + 1) % STEPS.length);

  const handleSetMode = (nextMode: 'multiplayer' | 'solo') => {
    vibrate(HAPTIC.SOFT);
    setMode(nextMode);
    sessionStorage.setItem('itollec_home_mode', nextMode);
    router.replace(`/?mode=${nextMode}`);
  };

  const goConnexion = () => {
    const next = `/?mode=${mode}`;
    try {
      sessionStorage.setItem('itollec_next_path', next);
    } catch {}
    router.push(`/connexion?next=${encodeURIComponent(next)}`);
  };

  const goCreerCompte = () => {
    const next = `/?mode=${mode}`;
    try {
      sessionStorage.setItem('itollec_next_path', next);
    } catch {}
    router.push('/creer-compte');
  };

  return (
    <main className="bg-transparent min-h-screen md:h-screen flex flex-col justify-between md:overflow-hidden relative">
      {easterEggActive && (
        <div 
          className="fixed inset-0 z-[9999] pointer-events-none"
        >
          <div 
            className="absolute bottom-4 left-4 animate-in slide-in-from-bottom-full duration-500 fade-in pointer-events-auto cursor-pointer"
            onClick={() => setEasterEggActive(false)}
          >
            <Image src="/easteregg.png" alt="Easter Egg" width={192} height={192} className="w-48 h-auto drop-shadow-2xl" draggable={false} priority />
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ih-rise {
          0% { transform: scaleY(0); opacity: 0; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .ih-anim-rise {
          transform-origin: bottom;
          transform: scaleY(0);
          animation: ih-rise 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes ih-type {
          0% { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .ih-anim-type {
          opacity: 0;
          animation: ih-type 150ms ease-out forwards;
        }
      `}</style>

      <header className="pt-3 md:pt-5 text-center px-6">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 mb-3">
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="h-11 w-11 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 hidden md:block" />

          <div className="hidden md:flex rounded-2xl border-2 border-brand-border bg-brand-inner p-2 gap-2">
            <button
              type="button"
              onClick={() => handleSetMode('multiplayer')}
              className={cn(
                'px-4 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                mode === 'multiplayer'
                  ? 'bg-brand-card text-tx-base border-brand-border'
                  : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
              )}
            >
              Multiplayer
            </button>
            <button
              type="button"
              onClick={() => handleSetMode('solo')}
              className={cn(
                'px-4 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                mode === 'solo'
                  ? 'bg-brand-card text-tx-base border-brand-border'
                  : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
              )}
            >
              Solo
            </button>
          </div>

          <div className="flex-1 hidden md:flex justify-end">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/profil')}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  {user.pseudo}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="h-11 w-11 rounded-lg border-2 border-red-500/40 bg-brand-inner text-red-400 hover:text-red-300 hover:border-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                  title="Se déconnecter"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goConnexion}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={goCreerCompte}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  Créer un compte
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          {logoVisible && (
            <Image
              src="/logo-site.png"
              alt="ItollecHub"
              width={560}
              height={240}
              className="h-32 md:h-48 w-auto select-none"
              priority
              onError={() => setLogoVisible(false)}
            />
          )}
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/60"
            aria-label="Fermer"
          />
          <div className="absolute top-3 left-3 right-3 bg-brand-card border-4 border-brand-border rounded-[32px] p-5 shadow-brutal max-h-[calc(100vh-24px)] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-2xl font-black tracking-wider uppercase text-tx-base">Menu</div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="h-11 w-11 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-brand-border bg-brand-inner p-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleSetMode('multiplayer')}
                className={cn(
                  'flex-1 px-3 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                  mode === 'multiplayer'
                    ? 'bg-brand-card text-tx-base border-brand-border'
                    : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                )}
              >
                Multiplayer
              </button>
              <button
                type="button"
                onClick={() => handleSetMode('solo')}
                className={cn(
                  'flex-1 px-3 h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                  mode === 'solo'
                    ? 'bg-brand-card text-tx-base border-brand-border'
                    : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                )}
              >
                Solo
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push('/profil');
                    }}
                    className="w-full h-12 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  >
                    Profil
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full h-12 rounded-lg border-2 border-red-500/40 bg-brand-inner text-red-400 hover:text-red-300 hover:border-red-400 hover:bg-red-500/10 transition-colors font-display font-black tracking-wider uppercase flex items-center justify-center gap-2"
                  >
                    <LogOut className="h-5 w-5" />
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      goConnexion();
                    }}
                    className="w-full h-12 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      goCreerCompte();
                    }}
                    className="w-full h-12 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  >
                    Créer un compte
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="flex-1 flex items-start md:items-center pb-8 md:pb-10 pt-1">
        <div className="w-full max-w-5xl mx-auto px-6">
          {resumeRoom && mode === 'multiplayer' && (
            <button
              type="button"
              onClick={resumeLastGame}
              className="mb-6 w-full flex items-center justify-center gap-3 h-14 rounded-2xl border-4 border-brand-border bg-brand-card text-tx-base font-display font-black tracking-wider shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors animate-in fade-in slide-in-from-top-2"
            >
              <RotateCcw className="h-5 w-5" />
              Reprendre la partie {resumeRoom.code}
            </button>
          )}
          {mode === 'multiplayer' ? (
            <div className="flex flex-col md:flex-row gap-8 items-stretch justify-center">
              <div className="flex-1 md:h-[520px] bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
                <div className="flex items-center justify-between h-12">
                  <h2 className="font-display text-2xl md:text-3xl leading-none">
                    {activeTab === 'create' ? 'Créer une room' : 'Rejoindre une room'}
                  </h2>
                  <div className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                    <Users className="h-6 w-6 text-tx-secondary" />
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border-2 border-brand-border bg-brand-inner p-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { vibrate(HAPTIC.SOFT); setActiveTab('create'); }}
                      className={cn(
                        'flex-1 h-11 rounded-lg font-display font-bold transition-colors border-2',
                        activeTab === 'create'
                          ? 'bg-brand-card text-tx-base border-brand-border'
                          : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                      )}
                    >
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => { vibrate(HAPTIC.SOFT); setActiveTab('join'); }}
                      className={cn(
                        'flex-1 h-11 rounded-lg font-display font-bold transition-colors border-2',
                        activeTab === 'join'
                          ? 'bg-brand-card text-tx-base border-brand-border'
                          : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border/50'
                      )}
                    >
                      Rejoindre
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAction} className="mt-6 flex-1 flex flex-col relative">
                  <div className="space-y-2 relative z-10">
                    <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                      Ton pseudo
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="PseudoCool"
                      disabled={!!user}
                      className="w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors disabled:opacity-50"
                    />
                  </div>

                  <div
                    className={cn(
                      'space-y-2 w-full',
                      activeTab === 'join' ? 'block mt-4' : 'hidden',
                      'md:block md:mt-0 md:absolute md:top-[84px] md:left-0 md:w-full md:transition-all md:duration-300',
                      activeTab === 'join'
                        ? 'md:opacity-100 md:translate-y-0'
                        : 'md:opacity-0 md:-translate-y-4 md:pointer-events-none'
                    )}
                  >
                    <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                      Code de salle
                    </label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      className="w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 font-mono tracking-widest text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors"
                      maxLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                      'mt-6 md:mt-auto w-full h-14 rounded-lg font-display font-black tracking-wider transition-colors border-2 relative z-10',
                      'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base',
                      !canSubmit && 'opacity-50 cursor-not-allowed hover:bg-brand-inner hover:text-tx-base hover:border-brand-border'
                    )}
                  >
                    {activeTab === 'create' ? 'Démarrer' : 'Rejoindre'}
                  </button>
                </form>
              </div>

              <div className="flex-1 md:h-[520px] bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
                <div className="flex items-center h-12">
                  <h2 className="font-display text-2xl md:text-3xl leading-none">Comment jouer</h2>
                </div>

                <div className="mt-6">
                  <h3 className="font-display font-bold text-xl">{STEPS[currentStep].title}</h3>
                  <p className="text-sm text-tx-secondary mt-1">{STEPS[currentStep].description}</p>
                </div>

                <div className="flex-1 flex items-center justify-center min-h-[160px] w-full mt-4">
                  {currentStep === 0 && (
                    <div className="font-mono text-6xl md:text-7xl tracking-[0.15em] font-black text-tx-base flex">
                      {['A', 'B', 'C', '1', '2', '3'].map((char, i) => (
                        <span key={i} className="ih-anim-type" style={{ animationDelay: `${i * 100}ms` }}>
                          {char}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="flex flex-col gap-3 w-full max-w-[220px]">
                      {['PokéGuessr', 'RentGuessr', 'Undercover'].map((game, i) => (
                        <div
                          key={game}
                          className={cn(
                            'px-4 py-3 rounded-lg border-2 font-bold text-center transition-all duration-300',
                            i === demoGameIndex
                              ? 'border-accent-primary bg-brand-inner text-accent-primary scale-105 shadow-brutal'
                              : 'border-brand-border bg-brand-inner text-tx-muted'
                          )}
                        >
                          {game}
                        </div>
                      ))}
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="flex items-end justify-center gap-6 h-full pb-2">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-10 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center font-bold text-tx-base">
                          N
                        </div>
                        <div
                          className="w-12 bg-brand-inner border-2 border-brand-border border-b-0 rounded-t-lg ih-anim-rise"
                          style={{ height: '64px', animationDelay: '0ms' }}
                        />
                        <span className="font-bold text-sm text-tx-secondary">2000</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-10 rounded-lg border-2 border-accent-primary bg-brand-inner flex items-center justify-center font-bold text-accent-primary">
                          M
                        </div>
                        <div
                          className="w-12 bg-accent-primary border-2 border-brand-border border-b-0 rounded-t-lg ih-anim-rise"
                          style={{ height: '112px', animationDelay: '200ms' }}
                        />
                        <span className="font-bold text-sm text-tx-base">2500</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-10 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center font-bold text-tx-base">
                          L
                        </div>
                        <div
                          className="w-12 bg-brand-inner border-2 border-brand-border border-b-0 rounded-t-lg ih-anim-rise"
                          style={{ height: '96px', animationDelay: '400ms' }}
                        />
                        <span className="font-bold text-sm text-tx-secondary">2300</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="h-10 w-10 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-3">
                    {STEPS.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentStep(i)}
                        className={cn(
                          'h-2.5 rounded-full transition-all border-2 border-brand-border',
                          i === currentStep ? 'w-10 bg-tx-base border-tx-base' : 'w-2.5 bg-brand-inner hover:bg-brand-border'
                        )}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={goNext}
                    className="h-10 w-10 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors flex items-center justify-center"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8 items-stretch justify-center">
              <div className="flex-1 md:h-[520px] bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
                <div className="flex items-center justify-between h-12">
                  <h2 className="font-display text-2xl md:text-3xl leading-none">ItollecClicker</h2>
                  <div className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                    <Crown className="h-6 w-6 text-accent-secondary" />
                  </div>
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2">Description</div>
                    <p className="text-sm text-tx-secondary font-bold leading-relaxed">
                      Un clicker façon Cookie Clicker : clique pour gagner des ₶, achète des bâtiments, et empile des bonus pour produire toujours plus.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push('/itollec-clicker')}
                  className={cn(
                    'mt-auto w-full h-14 rounded-lg font-display font-black tracking-wider transition-colors border-2 relative z-10',
                    'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Jouer
                </button>
              </div>

              <div className="flex-1 md:h-[520px] bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal flex flex-col">
                <div className="flex items-center justify-between h-12">
                  <h2 className="font-display text-2xl md:text-3xl leading-none">Apex</h2>
                  <div className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner p-2">
                    <TrendingUp className="h-6 w-6 text-accent-primary" />
                  </div>
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                    <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2">Description</div>
                    <p className="text-sm text-tx-secondary font-bold leading-relaxed">
                      Un business-idle: négocie, produis, monte ta hype et empile des revenus passifs (₶/min).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push('/apex')}
                  className={cn(
                    'mt-auto w-full h-14 rounded-lg font-display font-black tracking-wider transition-colors border-2 relative z-10',
                    'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Jouer
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="pb-2 md:pb-3 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold tracking-widest uppercase text-tx-muted">
          <a href="#" className="hover:text-tx-secondary transition-colors">Conditions</a>
          <a href="#" className="hover:text-tx-secondary transition-colors">Confidentialité</a>
          <a href="#" className="hover:text-tx-secondary transition-colors">Contact</a>
          <a href="#" className="hover:text-tx-secondary transition-colors">Patch Notes</a>
        </div>
      </footer>
    </main>
  );
}
