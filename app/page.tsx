'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Play, Users, ArrowRight, Zap, Globe, Flag, Home as HomeIcon, Shield, EyeOff, PenTool, DollarSign, Image as ImageIcon, MapPin, HelpCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isJoinMode, setIsJoinMode] = useState(false);

  const handleCreateRoom = () => {
    if (!name.trim()) {
      toast.error('Veuillez entrer un pseudo');
      return;
    }
    sessionStorage.setItem('playerName', name);
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/room/${newCode}?host=true`);
  };

  const handleJoinRoom = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    sessionStorage.setItem('playerName', name);
    router.push(`/room/${code.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col items-center justify-center relative">
      
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[150px] animate-pulse-slow delay-1000" />
      </div>

      <main className="relative z-10 w-full max-w-md p-6 flex flex-col gap-8 animate-in fade-in zoom-in duration-500">
        
        {/* Title / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl mb-6 transform rotate-3 hover:rotate-6 transition-transform duration-500">
            <Gamepad2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            IttolecHub
          </h1>
          <p className="text-slate-400 font-medium text-lg">
            La plateforme de jeux multijoueurs ultime.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Input 
            placeholder="Votre Pseudo" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 text-lg bg-slate-900/50 border-slate-800 text-center font-bold placeholder:font-normal focus:ring-indigo-500/50 transition-all hover:bg-slate-900"
          />

          {!isJoinMode ? (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={handleCreateRoom}
                className="h-32 flex flex-col gap-3 bg-indigo-600 hover:bg-indigo-500 border-t border-white/10 shadow-xl group transition-all hover:-translate-y-1"
              >
                <div className="p-3 bg-white/10 rounded-full group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6" />
                </div>
                <span className="font-bold text-lg">Créer</span>
              </Button>

              <Button 
                onClick={() => setIsJoinMode(true)}
                className="h-32 flex flex-col gap-3 bg-slate-800 hover:bg-slate-700 border-t border-white/5 shadow-xl group transition-all hover:-translate-y-1"
              >
                <div className="p-3 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <span className="font-bold text-lg">Rejoindre</span>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleJoinRoom} className="space-y-4 animate-in slide-in-from-right duration-300">
              <div className="relative">
                <Input 
                  placeholder="Code de la salle" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="h-14 text-lg bg-slate-900/50 border-slate-800 text-center font-mono font-bold tracking-widest uppercase focus:ring-purple-500/50"
                  autoFocus
                />
                <button 
                  type="button"
                  onClick={() => setIsJoinMode(false)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20"
              >
                Entrer <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          )}
        </div>

        {/* Footer Links */}
        <div className="flex justify-center gap-6 pt-8">
            <Dialog>
                <DialogTrigger asChild>
                    <button className="text-slate-500 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                        <HelpCircle className="w-4 h-4" /> Comment jouer ?
                    </button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
                    <div className="space-y-8 py-4">
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl shrink-0">1</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Créez ou Rejoignez</h3>
                                <p className="text-slate-400">Lancez une partie et partagez le code (ou le QR Code) à vos amis sur mobile ou PC.</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xl shrink-0">2</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Choisissez un Jeu</h3>
                                <p className="text-slate-400">L'hôte sélectionne parmi +10 mini-jeux (Quiz, Dessin, Bluff, Estimation...).</p>
                            </div>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-xl shrink-0">3</div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Jouez en Temps Réel</h3>
                                <p className="text-slate-400">Affrontez-vous, réagissez avec des emojis et grimpez dans le classement !</p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>

      </main>
    </div>
  );
}
