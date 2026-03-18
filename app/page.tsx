'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Crown, Gamepad2, Play, Users, Zap, PenTool, Shield, ChevronRight, ChevronLeft } from 'lucide-react';
import AnimatedNumber from './components/AnimatedNumber';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [demoGameIndex, setDemoGameIndex] = useState(0);
  const [logoVisible, setLogoVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 1) return;
    setDemoGameIndex(0);
    const interval = setInterval(() => {
      setDemoGameIndex((prev) => (prev + 1) % 4);
    }, 1100);
    return () => clearInterval(interval);
  }, [currentStep]);

  const handleAction = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Choisis un pseudo !');
      return;
    }

    sessionStorage.setItem('playerName', name);

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

  return (
    <main className="bg-brand-bg min-h-screen flex flex-col justify-between md:overflow-hidden">
      <style jsx global>{`
        @keyframes ih-pop {
          0% { opacity: 0; transform: translateY(8px) scale(0.85); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ih-type {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes ih-rise {
          0% { transform: scaleY(0) translateY(12px); opacity: 0.9; }
          70% { transform: scaleY(1.03) translateY(-2px); opacity: 1; }
          100% { transform: scaleY(1) translateY(0); opacity: 1; }
        }
        @keyframes ih-fadeUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .ih-anim { will-change: transform, opacity; }
      `}</style>

      <header className="pt-8 md:pt-10 text-center px-6">
        <div className="inline-flex items-center gap-3">
          {logoVisible && (
            <Image
              src="/logo-site.png"
              alt="IttolecHub"
              width={96}
              height={40}
              className="h-10 w-auto select-none"
              priority
              onError={() => setLogoVisible(false)}
            />
          )}
          <span className="font-display font-black tracking-tight text-3xl md:text-4xl bg-gradient-to-r from-accent-primary to-accent-secondary text-transparent bg-clip-text">
            ItollecHub
          </span>
        </div>
        <p className="mt-2 text-tx-secondary text-sm md:text-base">
          Mini-jeux multijoueurs entre amis
        </p>
      </header>

      <section className="flex-1 flex items-center py-8 md:py-10">
        <div className="w-full max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="md:flex-1 bg-brand-card border-2 border-brand-border rounded-xl shadow-card p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-inner px-3 py-1 text-xs text-tx-secondary">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-success" />
                    <span>Multijoueur temps réel</span>
                  </div>
                  <h2 className="mt-4 font-display text-2xl md:text-3xl">
                    {activeTab === 'create' ? 'Créer une room' : 'Rejoindre une room'}
                  </h2>
                  <p className="mt-1 text-sm text-tx-secondary">
                    {activeTab === 'create'
                      ? 'Choisis un pseudo, on te génère un code à partager.'
                      : 'Entre ton pseudo et le code de la salle.'}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="rounded-full border-2 border-brand-border bg-brand-inner p-3 shadow-brutal-dark">
                    <Users className="h-6 w-6 text-tx-secondary" />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border-2 border-brand-border bg-brand-inner p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className={cn(
                      'h-11 rounded-lg font-display font-extrabold tracking-wide transition-transform',
                      activeTab === 'create'
                        ? 'bg-accent-primary text-tx-base shadow-brutal'
                        : 'bg-transparent text-tx-secondary hover:text-tx-base'
                    )}
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className={cn(
                      'h-11 rounded-lg font-display font-extrabold tracking-wide transition-transform',
                      activeTab === 'join'
                        ? 'bg-accent-secondary text-brand-bg shadow-brutal-cyan'
                        : 'bg-transparent text-tx-secondary hover:text-tx-base'
                    )}
                  >
                    Rejoindre
                  </button>
                </div>
              </div>

              <form onSubmit={handleAction} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-widest uppercase text-tx-secondary">
                    Ton pseudo
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="PseudoCool7074"
                    className="w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-secondary focus:ring-2 focus:ring-accent-secondary/20 transition-colors"
                  />
                </div>

                {activeTab === 'join' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold tracking-widest uppercase text-tx-secondary">
                      Code de salle
                    </label>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      className="w-full h-12 rounded-lg bg-brand-inner border-2 border-brand-border px-4 font-mono tracking-widest text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-secondary focus:ring-2 focus:ring-accent-secondary/20 transition-colors"
                      inputMode="text"
                      autoCapitalize="characters"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'w-full h-14 rounded-xl font-display font-black tracking-wider transition-all',
                    activeTab === 'create'
                      ? 'bg-accent-primary text-tx-base shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                      : 'bg-accent-secondary text-brand-bg shadow-brutal-cyan hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
                    !canSubmit && 'opacity-50 shadow-none hover:translate-x-0 hover:translate-y-0 cursor-not-allowed'
                  )}
                >
                  {activeTab === 'create' ? 'Démarrer' : 'Rejoindre'}
                </button>
              </form>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-tx-secondary">
                <div className="rounded-lg border border-brand-border bg-brand-inner px-3 py-2">
                  Code court généré
                </div>
                <div className="rounded-lg border border-brand-border bg-brand-inner px-3 py-2">
                  Partage instantané
                </div>
              </div>
            </div>

            <div className="md:flex-1 bg-brand-card border-2 border-brand-border rounded-xl shadow-card p-6 md:p-7 overflow-hidden">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl md:text-3xl">Comment jouer</h2>
                  <p className="mt-1 text-sm text-tx-secondary">
                    Trois étapes. Une vibe. Zéro prise de tête.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="h-10 w-10 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors"
                    aria-label="Slide précédent"
                  >
                    <ChevronLeft className="h-5 w-5 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="h-10 w-10 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors"
                    aria-label="Slide suivant"
                  >
                    <ChevronRight className="h-5 w-5 mx-auto" />
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <div
                  key={currentStep}
                  className="rounded-xl border-2 border-brand-border bg-brand-inner p-5 md:p-6"
                >
                  {currentStep === 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold tracking-widest uppercase text-tx-secondary">
                          Code de salle
                        </div>
                        <div className="text-xs text-tx-muted">Partage-le à tes amis</div>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="rounded-xl border-2 border-brand-border bg-brand-card px-6 py-4 shadow-brutal-dark">
                          <div className="font-mono text-3xl md:text-4xl tracking-[0.25em] text-tx-base">
                            {['A', 'B', 'C', '1', '2', '3'].map((ch, i) => (
                              <span
                                key={i}
                                className="ih-anim inline-block"
                                style={{
                                  animation: 'ih-type 360ms ease-out forwards',
                                  animationDelay: `${i * 120}ms`,
                                  opacity: 0,
                                }}
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        {[
                          { initial: 'N', bg: 'bg-accent-primary' },
                          { initial: 'L', bg: 'bg-accent-secondary' },
                          { initial: 'M', bg: 'bg-accent-success' },
                          { initial: 'S', bg: 'bg-accent-danger' },
                        ].map((p, i) => (
                          <div
                            key={p.initial}
                            className={cn(
                              'ih-anim h-11 w-11 rounded-full border-2 border-brand-border text-brand-bg flex items-center justify-center font-display font-black shadow-brutal-dark',
                              p.bg
                            )}
                            style={{
                              animation: 'ih-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: `${820 + i * 140}ms`,
                              opacity: 0,
                            }}
                          >
                            {p.initial}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold tracking-widest uppercase text-tx-secondary">
                          Liste des jeux
                        </div>
                        <div className="text-xs text-tx-muted">Sélection automatique</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'PokéGuessr', icon: Zap, tint: 'text-accent-secondary' },
                          { name: 'DrawGuessr', icon: PenTool, tint: 'text-accent-primary' },
                          { name: 'Undercover', icon: Shield, tint: 'text-accent-success' },
                          { name: 'Mini Quiz', icon: Gamepad2, tint: 'text-accent-secondary' },
                        ].map((g, i) => {
                          const selected = i === demoGameIndex;
                          const Icon = g.icon;
                          return (
                            <div
                              key={g.name}
                              className={cn(
                                'rounded-xl border-2 bg-brand-card p-4 transition-all',
                                selected
                                  ? 'border-accent-primary shadow-brutal'
                                  : 'border-brand-border opacity-70'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'h-10 w-10 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center',
                                    selected ? 'scale-[1.02]' : ''
                                  )}
                                >
                                  <Icon className={cn('h-5 w-5', g.tint)} />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-display font-extrabold text-tx-base truncate">
                                    {g.name}
                                  </div>
                                  <div className="text-xs text-tx-secondary truncate">
                                    {selected ? 'Sélectionné' : 'Disponible'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold tracking-widest uppercase text-tx-secondary">
                          Podium
                        </div>
                        <div className="text-xs text-tx-muted">Fin de partie</div>
                      </div>

                      <div className="relative flex items-end justify-center gap-4 h-40 md:h-44">
                        <div className="relative flex flex-col items-center gap-2">
                          <div
                            className="ih-anim origin-bottom w-20 md:w-24 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal-dark"
                            style={{
                              height: '88%',
                              transform: 'scaleY(0)',
                              animation: 'ih-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '80ms',
                            }}
                          />
                          <div
                            className="ih-anim h-10 w-10 rounded-full border-2 border-brand-border bg-accent-secondary text-brand-bg flex items-center justify-center font-display font-black shadow-brutal-dark"
                            style={{
                              opacity: 0,
                              animation: 'ih-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '540ms',
                            }}
                          >
                            L
                          </div>
                          <div
                            className="ih-anim text-xs text-tx-secondary"
                            style={{ opacity: 0, animation: 'ih-fadeUp 320ms ease-out forwards', animationDelay: '720ms' }}
                          >
                            <AnimatedNumber value={1820} className="font-display font-extrabold" />
                          </div>
                        </div>

                        <div className="relative flex flex-col items-center gap-2">
                          <div
                            className="ih-anim absolute -top-6 left-1/2 -translate-x-1/2 text-accent-primary"
                            style={{
                              opacity: 0,
                              animation: 'ih-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '640ms',
                            }}
                          >
                            <Crown className="h-7 w-7" />
                          </div>
                          <div
                            className="ih-anim origin-bottom w-20 md:w-24 rounded-xl border-2 border-accent-primary bg-brand-card shadow-brutal"
                            style={{
                              height: '100%',
                              transform: 'scaleY(0)',
                              animation: 'ih-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '140ms',
                            }}
                          />
                          <div
                            className="ih-anim h-10 w-10 rounded-full border-2 border-brand-border bg-accent-primary text-tx-base flex items-center justify-center font-display font-black shadow-brutal-dark"
                            style={{
                              opacity: 0,
                              animation: 'ih-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '600ms',
                            }}
                          >
                            N
                          </div>
                          <div
                            className="ih-anim text-xs text-tx-secondary"
                            style={{ opacity: 0, animation: 'ih-fadeUp 320ms ease-out forwards', animationDelay: '780ms' }}
                          >
                            <AnimatedNumber value={2500} className="font-display font-extrabold" />
                          </div>
                        </div>

                        <div className="relative flex flex-col items-center gap-2">
                          <div
                            className="ih-anim origin-bottom w-20 md:w-24 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal-dark"
                            style={{
                              height: '70%',
                              transform: 'scaleY(0)',
                              animation: 'ih-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '200ms',
                            }}
                          />
                          <div
                            className="ih-anim h-10 w-10 rounded-full border-2 border-brand-border bg-accent-success text-brand-bg flex items-center justify-center font-display font-black shadow-brutal-dark"
                            style={{
                              opacity: 0,
                              animation: 'ih-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                              animationDelay: '660ms',
                            }}
                          >
                            M
                          </div>
                          <div
                            className="ih-anim text-xs text-tx-secondary"
                            style={{ opacity: 0, animation: 'ih-fadeUp 320ms ease-out forwards', animationDelay: '840ms' }}
                          >
                            <AnimatedNumber value={1210} className="font-display font-extrabold" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-display font-extrabold text-lg">
                      {STEPS[currentStep].title}
                    </div>
                    <div className="text-sm text-tx-secondary mt-1">
                      {STEPS[currentStep].description}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {STEPS.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Aller au slide ${i + 1}`}
                        onClick={() => setCurrentStep(i)}
                        className={cn(
                          'h-2 rounded-full transition-all border border-brand-border',
                          i === currentStep ? 'w-10 bg-accent-primary' : 'w-2 bg-brand-inner hover:bg-brand-card'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-6 md:pb-8 px-6">
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
