'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Gamepad2, 
  Music, 
  Flame, 
  Flag, 
  Users, 
  Mic2, 
  Shield, 
  EyeOff, 
  Zap, 
  Globe, 
  Search,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const games = [
  {
    id: 'pokeguessr',
    name: 'PokéGuessr',
    description: 'Reconnais les Pokémon floutés ou pixelisés. Attrape-les tous !',
    icon: Gamepad2,
    color: 'from-red-500 to-orange-500',
    tags: ['Vitesse', 'Culture G'],
  },
  {
    id: 'caloriesguessr',
    name: 'CaloriesGuessr',
    description: 'Plus ou moins calorique ? Teste tes connaissances nutritionnelles.',
    icon: Flame,
    color: 'from-orange-500 to-amber-500',
    tags: ['Réflexion', 'Nutrition'],
  },
  {
    id: 'flagguessr',
    name: 'FlagGuessr',
    description: 'Voyage à travers le monde en devinant les drapeaux.',
    icon: Flag,
    color: 'from-green-500 to-emerald-500',
    tags: ['Géographie', 'Mémoire'],
  },
  {
    id: 'populationguessr',
    name: 'PopulationGuessr',
    description: 'Quelle ville est la plus peuplée ? Un duel de démographie.',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    tags: ['Stratégie', 'Culture'],
  },
  {
    id: 'lyricsguessr',
    name: 'LyricsGuessr',
    description: 'Complète les paroles ou trouve le titre de la chanson.',
    icon: Mic2,
    color: 'from-pink-500 to-rose-500',
    tags: ['Musique', 'Karaoké'],
  },
  {
    id: 'rhymeguessr',
    name: 'RhymeGuessr',
    description: 'Trouve la rime parfaite avant la fin du temps imparti.',
    icon: Music,
    color: 'from-purple-500 to-violet-500',
    tags: ['Créativité', 'Vocabulaire'],
  },
  {
    id: 'infiltre',
    name: 'L\'Infiltré',
    description: 'Un intrus se cache parmi vous. Posez des questions pour le démasquer.',
    icon: Shield,
    color: 'from-slate-500 to-slate-700',
    tags: ['Bluff', 'Déduction'],
  },
  {
    id: 'undercover',
    name: 'Undercover',
    description: 'Civils, Undercover et Mr. White s\'affrontent dans ce jeu de mots.',
    icon: EyeOff,
    color: 'from-indigo-500 to-blue-600',
    tags: ['Social', 'Enquête'],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast.error('Choisis un pseudo pour commencer !');
      return;
    }
    
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName }),
      });
      
      const data = await response.json();
      if (data.code) {
        sessionStorage.setItem('playerName', playerName);
        sessionStorage.setItem('isHost', 'true');
        router.push(`/room/${data.code}`);
      }
    } catch (error) {
      console.error('Erreur création room:', error);
      toast.error('Erreur lors de la création de la partie.');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      toast.error('Pseudo et code de room requis !');
      return;
    }

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, roomCode }),
      });
      
      if (response.ok) {
        sessionStorage.setItem('playerName', playerName);
        router.push(`/room/${roomCode}`);
      } else {
        toast.error('Room introuvable ou pleine.');
      }
    } catch (error) {
      console.error('Erreur rejoindre room:', error);
      toast.error('Impossible de rejoindre la room.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Gamepad2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                IttolecHub
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4">
               <a href="#games" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Jeux</a>
               <a href="https://github.com/Ittolec" target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-slate-800 text-xs font-medium text-indigo-400 mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Nouvelle mise à jour v2.0 disponible
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="block text-slate-100 mb-2">Le Hub ultime des</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Mini-Jeux Multijoueurs
            </span>
          </h1>
          
          <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Défie tes amis sur des quiz, des jeux de bluff et de rapidité. 
            Aucune inscription requise, crée une room et joue instantanément.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
             <div className="w-full relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800">
                    <Input 
                        placeholder="Ton pseudo..." 
                        className="bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-slate-600"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                    />
                    <Button 
                        onClick={handleCreateRoom}
                        className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 px-6"
                    >
                        Créer une partie
                    </Button>
                </div>
             </div>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>+1000 joueurs actifs</span>
            <span className="mx-2 text-slate-700">•</span>
            <button onClick={() => setIsJoinModalOpen(!isJoinModalOpen)} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4">
                Rejoindre une partie existante
            </button>
          </div>

           {/* Quick Join Input (Collapsible) */}
           {isJoinModalOpen && (
              <div className="mt-4 max-w-xs mx-auto flex gap-2 animate-in fade-in slide-in-from-top-2">
                 <Input 
                    placeholder="Code de la room (ex: A1B2)" 
                    className="bg-slate-900 border-slate-800 text-center uppercase tracking-widest"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={4}
                 />
                 <Button onClick={handleJoinRoom} variant="outline" className="border-slate-700 hover:bg-slate-800">
                    Go
                 </Button>
              </div>
           )}
        </div>
      </div>

      {/* Games Grid */}
      <div id="games" className="relative py-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-12">
                <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                    <Globe className="h-6 w-6 text-indigo-400" />
                    Catalogue de jeux
                </h2>
                <span className="text-sm text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                    {games.length} jeux disponibles
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {games.map((game) => {
                    const Icon = game.icon;
                    return (
                        <div key={game.id} className="group relative bg-slate-900 rounded-3xl p-6 border border-slate-800 hover:border-slate-700 transition-all hover:translate-y-[-4px] overflow-hidden">
                            {/* Hover Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                            
                            <div className="relative z-10">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-4 shadow-lg shadow-black/20`}>
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                                
                                <h3 className="text-xl font-bold text-slate-100 mb-2 group-hover:text-indigo-300 transition-colors">
                                    {game.name}
                                </h3>
                                
                                <p className="text-sm text-slate-400 mb-6 line-clamp-2 h-10">
                                    {game.description}
                                </p>
                                
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {game.tags.map(tag => (
                                        <span key={tag} className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded-md">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                
                                <Button 
                                    onClick={() => {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                        toast.info(`Crée une partie pour jouer à ${game.name} !`);
                                    }}
                                    variant="ghost" 
                                    className="w-full justify-between hover:bg-slate-800 text-slate-300 hover:text-white group-hover:translate-x-1 transition-all"
                                >
                                    Jouer
                                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 bg-slate-950 text-center">
        <p className="text-slate-600 text-sm">
            © 2024 IttolecHub. Fait avec ❤️ pour la communauté.
        </p>
      </footer>
    </div>
  );
}
