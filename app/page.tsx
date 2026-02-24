'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, Search, Music, Flame, Flag, Users, Mic2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { RoomActions } from '@/components/RoomActions';
import { SearchBar } from '@/components/SearchBar';

const games = [
  {
    id: 'pokeguessr',
    name: 'PokeGuessr',
    description: 'Devine le Pokémon avec des images floues',
    icon: Gamepad2,
    color: 'bg-red-500',
    features: ['Multi-langue', 'Générations'],
  },
  {
    id: 'completeguessr',
    name: 'ComplèteGuessr',
    description: 'Trouve les suggestions Google les plus bizarres',
    icon: Search,
    color: 'bg-blue-500',
    features: ['Français/Anglais', 'Types de requêtes'],
  },
  {
    id: 'rhymeguessr',
    name: 'RhymeGuessr',
    description: 'Invente la meilleure punchline qui rime',
    icon: Music,
    color: 'bg-purple-500',
    features: ['Créatif', 'Rapide'],
  },
  {
    id: 'caloriesguessr',
    name: 'CaloriesGuessr',
    description: 'Devine les calories des aliments',
    icon: Flame,
    color: 'bg-orange-500',
    features: ['Catégories', 'Pays'],
  },
  {
    id: 'flagguessr',
    name: 'FlagGuessr',
    description: 'Devine le pays au drapeau',
    icon: Flag,
    color: 'bg-green-500',
    features: ['Drapeaux', 'Multijoueur'],
  },
  {
    id: 'populationguessr',
    name: 'PopulationGuessr',
    description: 'Devine la population du pays',
    icon: Users,
    color: 'bg-teal-500',
    features: ['Slider', 'Multijoueur'],
  },
  {
    id: 'lyricsguessr',
    name: 'LyricsGuessr',
    description: 'Devine la chanson depuis une phrase',
    icon: Mic2,
    color: 'bg-pink-500',
    features: ['Artistes', 'Karaoké'],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [filteredGames, setFilteredGames] = useState(games);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredGames(games);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredGames(
        games.filter(
          (game) =>
            game.name.toLowerCase().includes(query) ||
            game.description.toLowerCase().includes(query) ||
            game.features.some((feature) => feature.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery]);

  const handleCreateRoom = async (playerName: string) => {
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
    }
  };

  const handleJoinRoom = async (playerName: string, roomCode: string) => {
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, roomCode }),
      });
      
      if (response.ok) {
        sessionStorage.setItem('playerName', playerName);
        router.push(`/room/${roomCode}`);
      }
    } catch (error) {
      console.error('Erreur rejoindre room:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 pr-14 sm:pr-16">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                ItollecHub
              </h1>
            </div>

            <RoomActions 
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-slate-800 dark:text-slate-200">
            Bienvenue sur ItollecHub
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Plateforme de mini-jeux multijoueurs. Défie tes amis et montre qui est le meilleur !
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex justify-center mb-12">
          <SearchBar 
            onSearch={setSearchQuery}
            placeholder="Rechercher un jeu..."
          />
        </div>

        {/* Games Grid */}
        <div className="max-w-6xl mx-auto">
          {filteredGames.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">
                Aucun jeu trouvé pour "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGames.map((game) => {
                const Icon = game.icon;
                return (
                  <Card
                    key={game.id}
                    className="p-6 rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`${game.color} p-3 rounded-2xl text-white shrink-0`}>
                        <Icon className="h-7 w-7" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-slate-100">
                          {game.name}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                          {game.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {game.features.map((f) => (
                            <span
                              key={f}
                              className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}