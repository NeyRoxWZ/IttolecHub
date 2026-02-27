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
  ArrowRight,
  Sun,
  Moon,
  Plus,
  LogIn,
  Menu,
  X,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';

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
    id: 'priceguessr',
    name: 'PriceGuessr',
    description: 'Devine le juste prix ! Attention aux centimes près.',
    icon: DollarSign,
    color: 'from-yellow-500 to-amber-600',
    tags: ['Estimation', 'Shopping'],
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
  const [joinCode, setJoinCode] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

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
    if (!playerName.trim() || !joinCode.trim()) {
      toast.error('Pseudo et code de room requis !');
      return;
    }

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, roomCode: joinCode.toUpperCase() }),
      });
      
      if (response.ok) {
        sessionStorage.setItem('playerName', playerName);
        router.push(`/room/${joinCode.toUpperCase()}`);
      } else {
        toast.error('Room non trouvée ou inexistante. Vérifie le code !');
      }
    } catch (error) {
      console.error('Erreur rejoindre room:', error);
      toast.error('Impossible de rejoindre la room.');
    }
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-500/30 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Navbar */}
      <nav className={`border-b backdrop-blur-md fixed top-0 w-full z-50 transition-colors duration-300 ${isDarkMode ? 'border-slate-800/50 bg-slate-950/50' : 'border-slate-200/50 bg-white/50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Gamepad2 className="h-5 w-5 text-white" />
              </div>
              <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${isDarkMode ? 'from-white to-slate-400' : 'from-slate-900 to-slate-600'}`}>
                IttolecHub
              </span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-4">
               <a href="#games" className={`text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>Jeux</a>
               <button 
                 onClick={toggleTheme}
                 className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
               >
                 {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
               </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 rounded-md ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className={`md:hidden px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
            <a 
              href="#games" 
              className={`block px-3 py-2 rounded-md text-base font-medium ${isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Jeux
            </a>
            <div className="px-3 py-2 flex items-center justify-between">
              <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Thème</span>
              <button 
                 onClick={toggleTheme}
                 className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
               >
                 {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
               </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-[100px] transition-colors duration-500 ${isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-500/5'}`} />
            <div className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-[100px] transition-colors duration-500 ${isDarkMode ? 'bg-purple-500/10' : 'bg-purple-500/5'}`} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium mb-6 animate-fade-in ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-indigo-400' : 'bg-white/50 border-slate-200 text-indigo-600'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Nouvelle mise à jour v2.0 disponible
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className={`block mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Le Hub ultime des</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Mini-Jeux Multijoueurs
            </span>
          </h1>
          
          <p className={`mt-4 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Défie tes amis sur des quiz, des jeux de bluff et de rapidité. 
            Aucune inscription requise, crée une room et joue instantanément.
          </p>

          {/* Action Card */}
          <div className="max-w-md mx-auto">
            <div className={`p-1 rounded-2xl flex mb-4 ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-100'}`}>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                  activeTab === 'create' 
                    ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-slate-900 shadow-sm') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
              >
                Créer une partie
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                  activeTab === 'join' 
                    ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-slate-900 shadow-sm') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
                }`}
              >
                Rejoindre
              </button>
            </div>

            <Card className={`p-6 border transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 text-left ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Ton pseudo
                  </label>
                  <div className="relative">
                    <Users className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <Input 
                      placeholder="Ex: Gamer123" 
                      className={`pl-10 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                    />
                  </div>
                </div>

                {activeTab === 'join' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className={`block text-sm font-medium mb-2 text-left ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Code de la room
                    </label>
                    <div className="relative">
                      <LogIn className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                      <Input 
                        placeholder="Ex: A1B2" 
                        className={`pl-10 uppercase tracking-widest font-mono ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <Button 
                  onClick={activeTab === 'create' ? handleCreateRoom : handleJoinRoom}
                  className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 py-6 text-lg"
                >
                  {activeTab === 'create' ? (
                    <>
                      <Plus className="mr-2 h-5 w-5" /> Créer la room
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" /> Rejoindre
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div id="games" className={`relative py-20 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-12">
                <h2 className={`text-3xl font-bold flex items-center gap-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Globe className="h-6 w-6 text-indigo-400" />
                    Catalogue de jeux
                </h2>
                <span className={`text-sm px-3 py-1 rounded-full border ${isDarkMode ? 'text-slate-500 bg-slate-900 border-slate-800' : 'text-slate-600 bg-white border-slate-200'}`}>
                    {games.length} jeux disponibles
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {games.map((game) => {
                    const Icon = game.icon;
                    return (
                        <div key={game.id} className={`group relative rounded-3xl p-6 border transition-all hover:translate-y-[-4px] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'}`}>
                            {/* Hover Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                            
                            <div className="relative z-10">
                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center mb-4 shadow-lg shadow-black/20`}>
                                    <Icon className="h-6 w-6 text-white" />
                                </div>
                                
                                <h3 className={`text-xl font-bold mb-2 transition-colors ${isDarkMode ? 'text-slate-100 group-hover:text-indigo-300' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                                    {game.name}
                                </h3>
                                
                                <p className={`text-sm mb-6 line-clamp-2 h-10 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {game.description}
                                </p>
                                
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {game.tags.map(tag => (
                                        <span key={tag} className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md border ${isDarkMode ? 'text-slate-500 bg-slate-950 border-slate-800' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>
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
                                    className={`w-full justify-between group-hover:translate-x-1 transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}
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
      <footer className={`border-t py-12 text-center transition-colors duration-300 ${isDarkMode ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
        <p className={`text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-500'}`}>
            © 2026 IttolecHub. Fait avec ❤️ pour la communauté.
        </p>
      </footer>
    </div>
  );
}
