'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Play, Users, ArrowRight, X, ChevronRight, ChevronLeft } from 'lucide-react';
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
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col items-center justify-center relative p-4">
      
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 z-0"></div>
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 z-0"></div>
      
      {/* Animated Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      <main className="relative z-10 w-full max-w-6xl flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
        
        {/* LOGO IMAGE */}
        <div className="text-center mb-4">
          <img 
            src="https://cdn.discordapp.com/attachments/1360997269364670650/1478894408655966339/Gemini_Generated_Image_8zjaq58zjaq58zja-removebg-preview.png?ex=69aa0f3f&is=69a8bdbf&hm=5e455bc6372f30b06b2331eb15ad94d222ffd077df1ad42b299206953c509850&" 
            alt="IttolecHub" 
            className="h-24 md:h-32 w-auto mx-auto drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]"
          />
          <div className="h-2 w-32 bg-indigo-500 mx-auto mt-4 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.8)]"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
            
            {/* LEFT PANEL: PLAYER CARD - Fond #1E293B */}
            <div className="bg-[#1E293B] border border-[#334155] rounded-[2.5rem] p-8 shadow-[4px_4px_0px_0px_#020617] flex flex-col h-full min-h-[450px]">
                
                {/* TABS */}
                <div className="flex bg-[#0F172A] p-1.5 rounded-2xl mb-8 border border-[#334155]">
                    <button 
                        onClick={() => setActiveTab('create')}
                        className={`flex-1 py-3 text-lg font-bold uppercase tracking-wider rounded-xl transition-all duration-100 ${
                            activeTab === 'create' 
                            ? 'bg-[#3B82F6] text-white shadow-[4px_4px_0px_0px_#020617] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none' 
                            : 'bg-transparent text-[#94A3B8] hover:text-white'
                        }`}
                    >
                        Créer
                    </button>
                    <button 
                        onClick={() => setActiveTab('join')}
                        className={`flex-1 py-3 text-lg font-bold uppercase tracking-wider rounded-xl transition-all duration-100 ${
                            activeTab === 'join' 
                            ? 'bg-[#6366F1] text-white shadow-[4px_4px_0px_0px_#020617] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none' 
                            : 'bg-transparent text-[#94A3B8] hover:text-white'
                        }`}
                    >
                        Rejoindre
                    </button>
                </div>

                {/* AVATAR + INPUTS */}
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    {/* Avatar Placeholder - Icône #94A3B8, bordure #334155, pas de hover, pas de point vert */}
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
                                className="h-16 text-2xl text-center font-bold rounded-2xl"
                            />
                        </div>

                        {activeTab === 'join' && (
                            <div className="space-y-2 animate-in slide-in-from-right">
                                <label className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest ml-4">Code de la salle</label>
                                <Input 
                                    placeholder="CODE" 
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="h-16 text-2xl text-center font-bold rounded-2xl uppercase font-mono tracking-widest"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* MAIN BUTTON - Fond #6366F1 */}
                <Button 
                    onClick={handleAction}
                    variant="purple"
                    className={`w-full h-20 mt-8 text-2xl font-bold uppercase tracking-widest rounded-2xl`}
                >
                    {activeTab === 'create' ? 'DÉMARRER' : 'ENTRER'}
                </Button>
            </div>

            {/* RIGHT PANEL: HOW TO PLAY - Cartes avec fond #1E293B */}
            <div className="bg-[#1E293B] border border-[#334155] rounded-[2.5rem] p-8 shadow-[4px_4px_0px_0px_#020617] flex flex-col h-full min-h-[450px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-pink-500"></div>
                
                <h2 className="text-2xl font-bold text-center text-[#F8FAFC] uppercase tracking-widest mb-8">
                    COMMENT JOUER
                </h2>

                <div className="flex-1 flex flex-col items-center justify-center text-center relative">
                    {/* Animated Scene */}
                    <div className="z-10 w-full max-w-sm">
                        <div className="mb-8 h-48 w-full flex items-center justify-center">
                            <div className="w-full h-full bg-[#0F172A] border-4 border-[#334155] rounded-3xl flex items-center justify-center relative overflow-hidden transition-all duration-500">
                                
                                {/* Step 1: Create/Join */}
                                {currentStep === 0 && (
                                    <div className="relative w-full h-full flex items-center justify-center gap-4">
                                        <div className="absolute inset-0 bg-indigo-500/10 animate-pulse-slow"></div>
                                        <div className="w-16 h-16 bg-[#3B82F6] rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0s' }}>
                                            <Users className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="w-16 h-16 bg-[#6366F1] rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0.2s' }}>
                                            <Users className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="w-16 h-16 bg-green-500 rounded-full border-4 border-white flex items-center justify-center animate-bounce shadow-[4px_4px_0px_0px_#020617]" style={{ animationDelay: '0.4s' }}>
                                            <Users className="w-8 h-8 text-white" />
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
                                        
                                        {/* Leaderboard compact */}
                                        <div className="w-40 bg-[#1E293B] border-2 border-[#334155] rounded-xl p-2 shadow-[0_4px_0_0px_#020617]">
                                            {/* Podium compact */}
                                            <div className="flex items-end justify-center gap-1 mb-2">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-6 h-6 bg-[#475569] rounded-full flex items-center justify-center text-[#F8FAFC] font-bold text-xs">2</div>
                                                    <div className="w-8 h-5 bg-[#475569] rounded-t-lg mt-0.5"></div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-xs animate-bounce">1</div>
                                                    <div className="w-10 h-7 bg-yellow-500 rounded-t-lg mt-0.5"></div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <div className="w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-[#F8FAFC] font-bold text-xs">3</div>
                                                    <div className="w-8 h-4 bg-amber-600 rounded-t-lg mt-0.5"></div>
                                                </div>
                                            </div>
                                            {/* Classement compact */}
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between bg-[#3B82F6]/20 px-2 py-1 rounded text-xs">
                                                    <span className="text-[#F8FAFC] font-bold">P1</span>
                                                    <span className="text-yellow-400 font-bold">2500</span>
                                                </div>
                                                <div className="flex items-center justify-between bg-[#6366F1]/20 px-2 py-1 rounded text-xs">
                                                    <span className="text-[#F8FAFC] font-bold">P2</span>
                                                    <span className="text-[#94A3B8] font-bold">1800</span>
                                                </div>
                                                <div className="flex items-center justify-between bg-[#334155]/50 px-2 py-1 rounded text-xs">
                                                    <span className="text-[#94A3B8] font-bold">P3</span>
                                                    <span className="text-amber-600 font-bold">1200</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                        
                        <h3 className="text-3xl font-bold text-[#F8FAFC] mb-4 uppercase tracking-wide min-h-[40px]">
                            {STEPS[currentStep].title}
                        </h3>
                        <p className="text-lg text-[#94A3B8] font-medium leading-relaxed min-h-[60px]">
                            {STEPS[currentStep].description}
                        </p>
                    </div>
                </div>

                {/* Carousel Dots */}
                <div className="flex items-center justify-center gap-6 mt-8">
                    <button onClick={() => setCurrentStep((prev) => (prev - 1 + STEPS.length) % STEPS.length)} className="p-2 text-[#94A3B8] hover:text-white transition-colors">
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    <div className="flex gap-3">
                        {STEPS.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                                    i === currentStep 
                                    ? 'bg-white scale-125 shadow-[0_0_10px_rgba(255,255,255,0.5)]' 
                                    : 'bg-[#334155] hover:bg-[#475569]'
                                }`}
                            />
                        ))}
                    </div>
                    <button onClick={() => setCurrentStep((prev) => (prev + 1) % STEPS.length)} className="p-2 text-[#94A3B8] hover:text-white transition-colors">
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="flex gap-6 text-sm font-bold text-[#94A3B8] uppercase tracking-widest mt-8">
            <a href="#" className="hover:text-white transition-colors">Conditions</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
            <span>•</span>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>

      </main>
    </div>
  );
}
