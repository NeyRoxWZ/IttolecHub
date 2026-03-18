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
  }, []);

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
        @keyframes ih-scanUp {
          0% { transform: translateY(40%); opacity: 0; }
          15% { opacity: 0.45; }
          85% { opacity: 0.45; }
          100% { transform: translateY(-40%); opacity: 0; }
        }
        .ih-anim { will-change: transform, opacity; }
      `}</style>

      <header className="pt-10 md:pt-12 text-center px-6">
        <div className="flex items-center justify-center">
          {logoVisible && (
            <Image
              src="/logo-site.png"
              alt="ItollecHub"
              width={560}
              height={240}
              className="h-24 md:h-32 w-auto select-none"
              priority
              onError={() => setLogoVisible(false)}
            />
          )}
        </div>
      </header>

      <section className="flex-1 flex items-center py-8 md:py-10">
        <div className="w-full max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="md:flex-1 bg-brand-card border-2 border-brand-border rounded-xl shadow-card p-6 md:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl md:text-3xl">
                    {activeTab === 'create' ? 'Créer une room' : 'Rejoindre une room'}
                  </h2>
                  <p className="mt-2 text-sm text-tx-secondary min-h-[2.5rem]">
                    {activeTab === 'create'
                      ? 'Choisis un pseudo, on te génère un code à partager.'
                      : 'Entre ton pseudo et le code de la salle.'}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="rounded-full border-2 border-brand-border bg-brand-inner p-3">
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
                      'h-11 rounded-xl font-display font-extrabold tracking-wide transition-colors border-2',
                      activeTab === 'create'
                        ? 'bg-brand-card text-tx-base border-accent-primary shadow-brutal'
                        : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border'
                    )}
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className={cn(
                      'h-11 rounded-xl font-display font-extrabold tracking-wide transition-colors border-2',
                      activeTab === 'join'
                        ? 'bg-brand-card text-tx-base border-accent-secondary shadow-brutal-cyan'
                        : 'bg-transparent text-tx-secondary border-transparent hover:text-tx-base hover:border-brand-border'
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
                    className="w-full h-12 rounded-xl bg-brand-inner border-2 border-brand-border px-4 text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-secondary focus:ring-2 focus:ring-accent-secondary/20 transition-colors"
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
                      className="w-full h-12 rounded-xl bg-brand-inner border-2 border-brand-border px-4 font-mono tracking-widest text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-accent-secondary focus:ring-2 focus:ring-accent-secondary/20 transition-colors"
                      inputMode="text"
                      autoCapitalize="characters"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'w-full h-14 rounded-xl font-display font-black tracking-wider transition-colors border-2',
                    activeTab === 'create'
                      ? 'bg-brand-inner text-tx-base border-accent-primary shadow-brutal hover:bg-brand-card'
                      : 'bg-brand-inner text-tx-base border-accent-secondary shadow-brutal-cyan hover:bg-brand-card',
                    !canSubmit && 'opacity-50 cursor-not-allowed shadow-none'
                  )}
                >
                  {activeTab === 'create' ? 'Démarrer' : 'Rejoindre'}
                </button>
              </form>
            </div>

            <div className="md:flex-1 bg-brand-card border-2 border-brand-border rounded-xl shadow-card p-6 md:p-7 overflow-hidden">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl md:text-3xl">Comment jouer</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="h-10 w-10 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors"
                    aria-label="Slide précédent"
                  >
                    <ChevronLeft className="h-5 w-5 mx-auto" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="h-10 w-10 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors"
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

                      <div className="h-44 md:h-52 flex flex-col items-center justify-center gap-6">
                        <div className="flex items-center justify-center">
                          <div className="rounded-xl border-2 border-brand-border bg-brand-card px-7 py-5">
                            <div className="font-mono text-4xl md:text-5xl tracking-[0.28em] text-tx-base">
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
                                'ih-anim h-12 w-12 rounded-full border-2 border-brand-border text-brand-bg flex items-center justify-center font-display font-black',
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

                      <div className="h-44 md:h-52 grid grid-cols-2 gap-3 content-center">
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
                                  ? 'border-accent-primary'
                                  : 'border-brand-border opacity-70'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'h-11 w-11 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center',
                                    selected ? 'scale-[1.02]' : ''
                                  )}
                                >
                                  <Icon className={cn('h-6 w-6', g.tint)} />
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
                          Leaderboard
                        </div>
                        <div className="text-xs text-tx-muted">Fin de partie</div>
                      </div>

                      <div className="relative h-44 md:h-52 rounded-xl border-2 border-brand-border bg-brand-card px-4 pb-4 pt-6 overflow-hidden">
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            background:
                              'linear-gradient(0deg, rgba(124,58,237,0) 0%, rgba(124,58,237,0.10) 45%, rgba(124,58,237,0) 100%)',
                            animation: 'ih-scanUp 1800ms linear infinite',
                          }}
                        />

                        <div className="relative h-full flex items-end justify-between gap-3">
                          {[
                            { initial: 'N', score: 2000, height: 0.72, accent: 'border-accent-primary' },
                            { initial: 'M', score: 2500, height: 0.92, accent: 'border-accent-secondary' },
                            { initial: 'L', score: 2300, height: 0.84, accent: 'border-accent-success' },
                          ].map((p, idx) => (
                            <div key={p.initial} className="flex-1 flex flex-col items-center justify-end gap-3">
                              <div className="relative flex items-center justify-center h-9">
                                {idx === 1 && (
                                  <div className="absolute -top-5 text-accent-primary">
                                    <Crown className="h-7 w-7" />
                                  </div>
                                )}
                                <div className="h-10 w-10 rounded-full border-2 border-brand-border bg-brand-inner text-tx-base flex items-center justify-center font-display font-black">
                                  {p.initial}
                                </div>
                              </div>

                              <div className="w-full flex flex-col items-center justify-end gap-2">
                                <div
                                  className={cn('ih-anim w-full rounded-xl border-2 bg-brand-inner', p.accent)}
                                  style={{
                                    height: `${Math.round(120 * p.height)}px`,
                                    transform: 'scaleY(0)',
                                    transformOrigin: 'bottom',
                                    animation: 'ih-rise 1200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
                                    animationDelay: `${120 + idx * 80}ms`,
                                  }}
                                />
                                <div
                                  className="ih-anim text-xs text-tx-secondary font-display font-extrabold"
                                  style={{
                                    opacity: 0,
                                    animation: 'ih-fadeUp 520ms ease-out forwards',
                                    animationDelay: `${980 + idx * 90}ms`,
                                  }}
                                >
                                  <AnimatedNumber value={p.score} className="font-display font-extrabold" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="font-display font-extrabold text-xl md:text-2xl leading-none min-h-[2.5rem]">
                      {STEPS[currentStep].title}
                    </div>
                    <div className="text-sm text-tx-secondary mt-2 min-h-[2.5rem]">
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
