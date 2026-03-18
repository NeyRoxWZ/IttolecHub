'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Gamepad2, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const STEPS = [
  {
    title: 'Creer ou Rejoindre',
    description: 'Cree une salle et partage le code a tes amis. Ou rejoins une partie avec un code.',
    icon: Users,
  },
  {
    title: 'Choisir un jeu',
    description: "L'hote selectionne le mini-jeu et configure les manches. Les joueurs voient la selection en temps reel.",
    icon: Gamepad2,
  },
  {
    title: 'Jouer ensemble',
    description: 'Affrontez-vous en temps reel. Le classement se met a jour apres chaque manche.',
    icon: Trophy,
  },
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoSlide = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
  };

  useEffect(() => {
    startAutoSlide();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  const previousSlide = () => {
    setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
    startAutoSlide();
  };

  const nextSlide = () => {
    setCurrentStep((prev) => (prev + 1) % STEPS.length);
    startAutoSlide();
  };

  const goToSlide = (index: number) => {
    setCurrentStep(index);
    startAutoSlide();
  };

  const slide = STEPS[currentStep];
  const SlideIcon = slide.icon;
  const isCreateDisabled = !name.trim();
  const isJoinDisabled = !name.trim() || !code.trim();

  return (
    <main className="bg-brand-bg min-h-screen flex flex-col justify-between">
      <header className="flex flex-col items-center pt-8 pb-6">
        <h1 className="font-display font-black text-4xl bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          IttolecHub
        </h1>
        <p className="text-tx-secondary text-sm font-body mt-1 text-center">
          Mini-jeux multijoueurs entre amis
        </p>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-5xl w-full mx-auto">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-stretch">
            <div className="bg-brand-card border border-brand-border rounded-xl shadow-card p-6 w-full flex flex-col gap-5">
              <div className="bg-brand-inner rounded-lg p-1 flex w-full">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className={activeTab === 'create'
                    ? 'flex-1 text-center bg-accent-primary text-tx-primary rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200'
                    : 'flex-1 text-center text-tx-secondary hover:text-tx-primary px-4 py-2 text-sm transition-colors duration-200 cursor-pointer'}
                >
                  Creer
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('join')}
                  className={activeTab === 'join'
                    ? 'flex-1 text-center bg-accent-primary text-tx-primary rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200'
                    : 'flex-1 text-center text-tx-secondary hover:text-tx-primary px-4 py-2 text-sm transition-colors duration-200 cursor-pointer'}
                >
                  Rejoindre
                </button>
              </div>

              {activeTab === 'create' ? (
                <form onSubmit={handleAction} className="flex flex-col gap-4">
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">
                      Ton pseudo
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200"
                      placeholder="Choisis ton pseudo"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreateDisabled}
                    className="w-full mt-2 bg-accent-primary hover:bg-accent-primary-h text-tx-primary font-display font-bold rounded-md py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    Demarrer
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAction} className="flex flex-col gap-4">
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">
                      Ton pseudo
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200"
                      placeholder="Ton pseudo"
                    />
                  </div>
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">
                      Code de la salle
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200"
                      placeholder="Code de la salle (ex: ABC123)"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isJoinDisabled}
                    className="w-full mt-2 bg-accent-secondary hover:opacity-90 text-tx-primary font-display font-bold rounded-md py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-cyan active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    Rejoindre
                  </button>
                </form>
              )}
            </div>

            <div className="bg-brand-card border border-brand-border rounded-xl shadow-card p-6 w-full flex flex-col">
              <div className="flex-1 flex flex-col items-center text-center gap-3 justify-center py-4">
                <SlideIcon size={44} className="text-accent-primary" />
                <h2 className="font-display text-xl text-tx-primary">{slide.title}</h2>
                <p className="text-tx-secondary text-sm leading-relaxed max-w-xs mx-auto">{slide.description}</p>
                <div className="h-20 w-full mt-2 flex items-center justify-center">
                  {currentStep === 0 && (
                    <div className="bg-brand-inner rounded-lg px-6 py-3 flex items-center justify-center">
                      {'#ABC123'.split('').map((char, index) => (
                        <span
                          key={`${char}-${index}`}
                          className="font-mono text-accent-primary text-2xl font-bold"
                          style={{
                            opacity: 0,
                            animation: 'fadeInChar 0.3s ease forwards',
                            animationDelay: `${index * 0.1}s`,
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  )}
                  {currentStep === 1 && (
                    <div className="flex gap-2 justify-center items-center h-20">
                      {[0, 1, 2].map((idx) => (
                        <div
                          key={idx}
                          className={idx === 1 ? 'bg-brand-inner rounded-md w-16 h-14 border-2 border-accent-primary' : 'bg-brand-inner rounded-md w-16 h-14'}
                          style={{
                            opacity: 0,
                            animation: 'slideUp 0.4s ease forwards',
                            animationDelay: `${idx * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {currentStep === 2 && (
                    <div className="flex gap-2 justify-center items-end h-20">
                      <div
                        className="w-10 h-10 bg-tx-muted rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0.1s',
                        }}
                      />
                      <div
                        className="w-10 h-14 bg-accent-primary rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0s',
                        }}
                      />
                      <div
                        className="w-10 h-8 bg-brand-inner border border-brand-border rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0.2s',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={previousSlide}
                  className="bg-brand-inner rounded-md p-1.5 text-tx-secondary hover:text-tx-primary hover:bg-accent-primary transition-all duration-200"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex gap-1.5 items-center">
                  {STEPS.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goToSlide(index)}
                      className={index === currentStep ? 'w-5 h-2 bg-accent-primary rounded-full transition-all duration-300' : 'w-2 h-2 bg-brand-inner border border-brand-border rounded-full transition-all duration-300'}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={nextSlide}
                  className="bg-brand-inner rounded-md p-1.5 text-tx-secondary hover:text-tx-primary hover:bg-accent-primary transition-all duration-200"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex gap-6 justify-center flex-wrap py-5">
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Conditions</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Confidentialite</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Contact</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Patch Notes</a>
      </footer>
    </main>
  );
}
