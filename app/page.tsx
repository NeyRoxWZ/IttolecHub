'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Play, Users, ArrowRight, X, ChevronRight, ChevronLeft } from 'lucide-react';
import AnimatedNumber from './components/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const STEPS = [
  {
    title: "CRÉEZ OU REJOIGNEZ",
    description: "Lancez une partie et partagez le code à vos amis sur mobile ou PC.",
    icon: Users
  },
  {
    title: "CHOISISSEZ UN JEU",
    description: "L'hôte sélectionne parmi +10 mini-jeux (Quiz, Dessin, Bluff...).",
    icon: Gamepad2
  },
  {
    title: "JOUEZ ENSEMBLE",
    description: "Affrontez-vous en temps réel et grimpez dans le classement !",
    icon: Play
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
    }, 5000);
    return () => clearInterval(interval);
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

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] font-sans selection:bg-indigo-500/30 flex flex-col items-center justify-center relative p-4 py-8">
      
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 z-0"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 z-0"></div>
      
      {/* Animated Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      <main className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        
        {/* LOGO IMAGE - medium size */}
        <div className="text-center">
          <img 
            src="/logosite.png"
            alt="IttolecHub" 
            className="h-32 md:h-44 w-auto mx-auto logo-flottant"
            style={{ animation: 'float 4s ease-in-out infinite' }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            
            {/* LEFT PANEL: PLAYER CARD - Fond #1E293B */}
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 shadow-[4px_4px_0px_0px_#020617] flex flex-col h-full min-h-[440px]">
                
                {/* TABS */}
                <div className="flex bg-[#0F172A] p-1.5 rounded-xl mb-4 border border-[#334155]">
                    <button 
                        onClick={() => setActiveTab('create')}
                        className={`flex-1 py-2.5 text-lg font-bold uppercase tracking-wider rounded-lg transition-all duration-100 ${
                            activeTab === 'create' 
                            ? 'bg-[#3B82F6] text-white shadow-[2px_2px_0px_0px_#020617] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none' 
                            : 'bg-transparent text-[#94A3B8] hover:text-white'
                        }`}
                    >
                        Créer
                    </button>
                    <button 
                        onClick={() => setActiveTab('join')}
                        className={`flex-1 py-2.5 text-lg font-bold uppercase tracking-wider rounded-lg transition-all duration-100 ${
                            activeTab === 'join' 
                            ? 'bg-[#3B82F6] text-white shadow-[2px_2px_0px_0px_#020617] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none' 
                            : 'bg-transparent text-[#94A3B8] hover:text-white'
                        }`}
                    >
                        Rejoindre
                    </button>
                </div>

                {/* AVATAR + INPUTS */}
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    {/* Avatar Placeholder */}
                    <div className="w-28 h-28 rounded-full bg-[#0F172A] border-4 border-[#334155] flex items-center justify-center mb-2">
                        <Users className="w-12 h-12 text-[#94A3B8]" />
                    </div>

                    <div className="w-full space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest ml-4">Ton Pseudo</label>
                            <Input 
                                placeholder="PseudoCool7074" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-14 text-xl text-center font-bold rounded-2xl"
                            />
                        </div>

                        {activeTab === 'join' && (
                            <div className="space-y-2 animate-in slide-in-from-right">
                                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest ml-4">Code de la salle</label>
                                <Input 
                                    placeholder="CODE" 
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="h-14 text-xl text-center font-bold rounded-2xl uppercase font-mono tracking-widest"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* MAIN BUTTON - Fond #6366F1 */}
                <Button 
                    onClick={handleAction}
                    variant="purple"
                    className={`w-full h-16 mt-6 text-xl font-bold uppercase tracking-widest rounded-2xl`}
                >
                    {activeTab === 'create' ? 'DÉMARRER' : 'ENTRER'}
                </Button>
            </div>

            {/* RIGHT PANEL: HOW TO PLAY - Cartes avec fond #1E293B */}
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-6 shadow-[4px_4px_0px_0px_#020617] flex flex-col h-full min-h-[440px] relative overflow-hidden">
                { /* decorative line removed to clean UI as requested */ }
                
                <h2 className="text-xl font-bold text-center text-[#F8FAFC] uppercase tracking-widest mb-4">
                    COMMENT JOUER
                </h2>

                <div className="flex-1 flex flex-col items-center justify-center text-center relative">
                    {/* Animated Scene */}
                    <div className="z-10 w-full max-w-sm">
                        <div className="mb-4 h-28 w-full flex items-center justify-center">
                            <div className="w-full h-full bg-[#0F172A] border-4 border-[#334155] rounded-2xl flex items-center justify-center relative overflow-hidden transition-all duration-500">
                                
                                {/* Step 1: Create/Join */}
                                {currentStep === 0 && (
                                    <div className="relative w-full h-full flex items-center justify-center gap-3">
                                        <div className="absolute inset-0 bg-indigo-500/10 animate-pulse-slow"></div>
                                        <div className="w-14 h-14 bg-[#3B82F6] rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0s' }}>
                                            <Users className="w-7 h-7 text-white" />
                                        </div>
                                        <div className="w-14 h-14 bg-[#6366F1] rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0.2s' }}>
                                            <Users className="w-7 h-7 text-white" />
                                        </div>
                                        <div className="w-14 h-14 bg-green-500 rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0.4s' }}>
                                            <Users className="w-7 h-7 text-white" />
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Choose Game */}
                                {currentStep === 1 && (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <div className="absolute inset-0 bg-purple-500/10 animate-pulse-slow"></div>
                                        <div className="w-24 h-32 bg-white rounded-xl border-4 border-slate-200 shadow-[4px_4px_0px_0px_#020617] transform -rotate-12 absolute left-1/4 top-8 animate-float-up" style={{ animationDuration: '3s' }}></div>
                                        <div className="w-24 h-32 bg-[#6366F1] rounded-xl border-4 border-indigo-300 shadow-[4px_4px_0px_0px_#020617] transform rotate-6 z-10 flex items-center justify-center animate-pulse">
                                            <Gamepad2 className="w-12 h-12 text-white" />
                                        </div>
                                        <div className="w-24 h-32 bg-[#334155] rounded-xl border-4 border-slate-600 shadow-[4px_4px_0px_0px_#020617] transform rotate-12 absolute right-1/4 top-8 animate-float-up" style={{ animationDuration: '4s' }}></div>
                                    </div>
                                )}

                                {/* Step 3: Play - Leaderboard Animé */}
                                {currentStep === 2 && (
                                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-2">
                                        <div className="absolute inset-0 bg-[#6366F1]/10 animate-pulse-slow"></div>
                                        
                                
                                        {/* Leaderboard replaces placeholder, occupying available space (no background) */}
                                        <div className="w-full max-w-2xl rounded-xl p-4 overflow-hidden">
                                            <div className="font-bold text-[#F8FAFC] mb-2">Leaderboard</div>
                                            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '28vh' }}>
                                                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-yellow-500/20 border border-yellow-500/30">
                                                    <span className="text-yellow-400 font-bold">P1</span>
                                                    <AnimatedNumber value={2500} className="text-yellow-400 font-bold" />
                                                </div>
                                                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-slate-500/20 border border-slate-500/30">
                                                    <span className="text-slate-300 font-bold">P2</span>
                                                    <AnimatedNumber value={1800} className="text-[#93A3B8] font-bold" />
                                                </div>
                                                <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-amber-700/20 border border-amber-700/30">
                                                    <span className="text-amber-400 font-bold">P3</span>
                                                    <AnimatedNumber value={1200} className="text-amber-300 font-bold" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-[#F8FAFC] mb-2 uppercase tracking-wide min-h-[30px]">
                            {STEPS[currentStep].title}
                        </h3>
                        <p className="text-sm text-[#94A3B8] font-medium leading-relaxed min-h-[40px]">
                            {STEPS[currentStep].description}
                        </p>
                    </div>
                </div>

                {/* Carousel Dots */}
                <div className="flex items-center justify-center gap-4 mt-4">
                    <button onClick={() => setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length)} className="p-1 text-[#94A3B8] hover:text-white transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex gap-2">
                        {STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                    i === currentStep 
                                    ? 'bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.5)]' 
                                    : 'bg-[#334155] hover:bg-[#475569]'
                                }`}
                            />
                        ))}
                    </div>
                    <button onClick={() => setCurrentStep((prev) => (prev + 1) % STEPS.length)} className="p-1 text-[#94A3B8] hover:text-white transition-colors">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="flex gap-6 text-sm font-bold text-[#94A3B8] uppercase tracking-widest mt-6">
            <a href="#" className="hover:text-white transition-colors">Conditions</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">PatchNote</a>
        </div>

      </main>
    </div>
  );
}
