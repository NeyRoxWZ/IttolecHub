'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Gamepad2, Play, Users, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const STEPS = [
  {
    title: "Créer ou Rejoindre",
    description: "Crée une salle et partage le code à tes amis. Ou rejoins une partie avec un code.",
    icon: Users
  },
  {
    title: "Choisir un jeu",
    description: "L'hôte sélectionne le mini-jeu et configure les manches. Les joueurs voient la sélection en temps réel.",
    icon: Gamepad2
  },
  {
    title: "Jouer ensemble",
    description: "Affrontez-vous en temps réel. Le classement se met à jour après chaque manche.",
    icon: Trophy
  }
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleStepChange = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentStep((prev) => (prev + 1) % STEPS.length);
    } else {
      setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
    }
  };

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

  const isCreateDisabled = !name.trim();
  const isJoinDisabled = !name.trim() || !code.trim();

  return (
    <main className="bg-brand-bg min-h-screen flex flex-col justify-between font-body text-tx-primary antialiased">
      
      {/* HEADER */}
      <header className="flex flex-col items-center pt-8 pb-6">
        <h1 className="font-display font-black text-4xl bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          ITTOLECHUB
        </h1>
        <p className="text-tx-secondary text-sm font-body mt-1 text-center">
          Mini-jeux multijoueurs entre amis
        </p>
      </header>

      {/* CONTENT */}
      <section className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-5xl w-full mx-auto">
          <div className="flex flex-col md:flex-row gap-6 items-stretch">
            
            {/* CARTE GAUCHE : Créer / Rejoindre */}
            <div className="bg-brand-card border border-brand-border rounded-xl shadow-card p-6 w-full flex flex-col gap-5">
              
              {/* Tabs */}
              <div className="bg-brand-inner rounded-lg p-1 flex w-full">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 text-center rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'create'
                      ? 'bg-accent-primary text-tx-primary'
                      : 'text-tx-secondary hover:text-tx-primary'
                  }`}
                >
                  Créer
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 text-center rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'join'
                      ? 'bg-accent-primary text-tx-primary'
                      : 'text-tx-secondary hover:text-tx-primary'
                  }`}
                >
                  Rejoindre
                </button>
              </div>

              {/* Formulaire CREER */}
              {activeTab === 'create' && (
                <form onSubmit={handleAction} className="flex flex-col gap-4 animate-fadeIn">
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">Ton pseudo</label>
                    <input
                      type="text"
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200"
                      placeholder="Choisis ton pseudo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreateDisabled}
                    className="w-full mt-2 bg-accent-primary hover:bg-accent-primary-h text-tx-primary font-display font-bold rounded-md py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    DÉMARRER
                  </button>
                </form>
              )}

              {/* Formulaire REJOINDRE */}
              {activeTab === 'join' && (
                <form onSubmit={handleAction} className="flex flex-col gap-4 animate-fadeIn">
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">Ton pseudo</label>
                    <input
                      type="text"
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200"
                      placeholder="Ton pseudo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-tx-secondary text-sm font-medium mb-1 block">Code de la salle</label>
                    <input
                      type="text"
                      className="w-full bg-brand-inner border border-brand-border rounded-md px-4 py-2.5 text-tx-primary placeholder:text-tx-muted focus:outline-none focus:border-accent-primary transition-colors duration-200 uppercase"
                      placeholder="Code de la salle (ex: ABC123)"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isJoinDisabled}
                    className="w-full mt-2 bg-accent-secondary hover:opacity-90 text-tx-primary font-display font-bold rounded-md py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-cyan active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    REJOINDRE
                  </button>
                </form>
              )}
            </div>

            {/* CARTE DROITE : Comment jouer */}
            <div className="bg-brand-card border border-brand-border rounded-xl shadow-card p-6 w-full flex flex-col">
              
              <div className="flex-1 flex flex-col items-center text-center gap-3 justify-center py-4">
                {/* Icone */}
                {(() => {
                  const Icon = STEPS[currentStep].icon;
                  return <Icon size={44} className="text-accent-primary" />;
                })()}

                {/* Titre */}
                <h2 className="font-display text-xl text-tx-primary">
                  {STEPS[currentStep].title}
                </h2>

                {/* Description */}
                <p className="text-tx-secondary text-sm leading-relaxed max-w-xs mx-auto">
                  {STEPS[currentStep].description}
                </p>

                {/* Illustration animée */}
                <div className="h-20 w-full mt-2 flex items-center justify-center">
                  
                  {/* SLIDE 1 : Créer ou Rejoindre */}
                  {currentStep === 0 && (
                    <div className="bg-brand-inner rounded-lg px-6 py-3 flex items-center justify-center">
                      <div className="font-mono text-accent-primary text-2xl font-bold flex">
                        {'#ABC123'.split('').map((char, index) => (
                          <span
                            key={index}
                            style={{
                              opacity: 0,
                              animation: `fadeInChar 0.3s ease forwards ${index * 0.1}s`
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SLIDE 2 : Choisir un jeu */}
                  {currentStep === 1 && (
                    <div className="flex gap-2 justify-center items-center h-20">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`bg-brand-inner rounded-md w-16 h-14 ${i === 1 ? 'border-2 border-accent-primary' : ''}`}
                          style={{
                            opacity: 0,
                            animation: `slideUp 0.4s ease forwards ${i * 0.15}s`
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* SLIDE 3 : Jouer ensemble */}
                  {currentStep === 2 && (
                    <div className="flex gap-2 justify-center items-end h-20">
                      {/* Gauche 2ème */}
                      <div
                        className="w-10 h-10 bg-tx-muted rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0.1s'
                        }}
                      />
                      {/* Centre 1er */}
                      <div
                        className="w-10 h-14 bg-accent-primary rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0s'
                        }}
                      />
                      {/* Droite 3ème */}
                      <div
                        className="w-10 h-8 bg-brand-inner border border-brand-border rounded-t-md"
                        style={{
                          transform: 'scaleY(0)',
                          transformOrigin: 'bottom',
                          animation: 'growUp 0.5s ease forwards 0.2s'
                        }}
                      />
                    </div>
                  )}

                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-border">
                <button
                  onClick={() => handleStepChange('prev')}
                  className="bg-brand-inner rounded-md p-1.5 text-tx-secondary hover:text-tx-primary hover:bg-accent-primary transition-all duration-200"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex gap-1.5 items-center">
                  {STEPS.map((_, index) => (
                    <div
                      key={index}
                      className={`transition-all duration-300 ${
                        index === currentStep
                          ? 'w-5 h-2 bg-accent-primary rounded-full'
                          : 'w-2 h-2 bg-brand-inner border border-brand-border rounded-full'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => handleStepChange('next')}
                  className="bg-brand-inner rounded-md p-1.5 text-tx-secondary hover:text-tx-primary hover:bg-accent-primary transition-all duration-200"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex gap-6 justify-center flex-wrap py-5">
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Conditions</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Confidentialité</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Contact</a>
        <a href="#" className="text-tx-muted text-xs hover:text-tx-secondary transition-colors duration-200">Patch Notes</a>
      </footer>

    </main>
  );
}
