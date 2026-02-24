'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Users, Gamepad2, Copy } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
}

interface GameSetting {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select';
  default: string | number;
  options?: { value: string; label: string }[];
}

const gamesList: { id: string; name: string; description: string; icon: typeof Gamepad2; settings: GameSetting[] }[] = [
  {
    id: 'pokeguessr',
    name: 'PokeGuessr',
    description: 'Devinez le Pokémon à partir de son ombre.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 30 },
    ],
  },
  {
    id: 'rhymeguessr',
    name: 'RhymeGuessr',
    description: 'Trouvez le mot qui rime.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 7 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 15 },
    ],
  },
  {
    id: 'caloriesguessr',
    name: 'CaloriesGuessr',
    description: 'Estimez les calories des aliments.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 25 },
    ],
  },
  {
    id: 'flagguessr',
    name: 'FlagGuessr',
    description: 'Identifiez le pays au drapeau.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 10 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 15 },
    ],
  },
  {
    id: 'populationguessr',
    name: 'PopulationGuessr',
    description: 'Devinez la population du pays.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 10 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 20 },
    ],
  },
  {
    id: 'lyricsguessr',
    name: 'LyricsGuessr',
    description: 'Devinez la chanson à partir des paroles.',
    icon: Gamepad2,
    settings: [
      { id: 'rounds', label: 'Manches', type: 'number', default: 5 },
      { id: 'time', label: 'Temps par manche (s)', type: 'number', default: 45 },
      { id: 'artist', label: 'Artiste (ex: Daft Punk)', type: 'text', default: '' },
    ],
  },
  {
    id: 'infiltre',
    name: "L'Infiltré",
    description: "Déduction sociale avec Maître du jeu, Infiltré et Citoyens.",
    icon: Gamepad2,
    settings: [
      { id: 'time', label: 'Temps de questions (s)', type: 'number', default: 180 },
    ],
  },
  {
    id: 'undercover',
    name: 'Undercover',
    description: 'Civils, Undercover et Mr. White avec mots proches.',
    icon: Gamepad2,
    settings: [],
  },
];

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string>('__placeholder__');
  const [gameSettings, setGameSettings] = useState<Record<string, string | number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRoomDeleted, setIsRoomDeleted] = useState(false);

  const selectedGame = useMemo(() => selectedGameId && selectedGameId !== '__placeholder__' ? gamesList.find(g => g.id === selectedGameId) : undefined, [selectedGameId]);

  useEffect(() => {
    let cancelled = false;
    const checkRoomCleanup = async () => {
      try {
        const response = await fetch('/api/rooms/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: params.code }),
        });
        if (cancelled) return;
        const data = await response.json().catch(() => ({}));
        if (data.shouldDelete) {
          setIsRoomDeleted(true);
          setTimeout(() => {
            sessionStorage.removeItem('playerName');
            sessionStorage.removeItem('isHost');
            router.push('/');
          }, 3000);
        }
      } catch (_) {
        // Ignorer les erreurs réseau / 404 pour ne pas casser l'UI
      }
    };
    checkRoomCleanup();
    const interval = setInterval(checkRoomCleanup, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [params.code, router]);

  useEffect(() => {
    const storedName = sessionStorage.getItem('playerName');
    const storedHost = sessionStorage.getItem('isHost');
    if (!storedName) {
      router.push('/');
      return;
    }
    setPlayerName(storedName);
    setIsHost(storedHost === 'true');
    setPlayers([{ id: '1', name: storedName, isHost: storedHost === 'true', score: 0 }]);
    setIsLoading(false);

    const handleBeforeUnload = () => {
      if (storedHost === 'true') {
        fetch('/api/rooms/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: params.code, hostId: storedName }),
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [params.code, router]);

  useEffect(() => {
    if (selectedGame) {
      const defaults: Record<string, string | number> = {};
      selectedGame.settings.forEach(s => {
        defaults[s.id] = s.default;
      });
      setGameSettings(defaults);
    } else {
      setGameSettings({});
    }
  }, [selectedGame]);

  const handleSettingChange = (settingId: string, value: string | number) => {
    setGameSettings(prev => ({ ...prev, [settingId]: value }));
  };

  const startGame = () => {
    if (!selectedGameId || selectedGameId === '__placeholder__') return;
    const paramsUrl = new URLSearchParams();
    Object.entries(gameSettings).forEach(([k, v]) => {
      if (v !== '' && v !== undefined) paramsUrl.set(k, String(v));
    });
    const q = paramsUrl.toString();
    router.push(`/games/${selectedGameId}/${params.code}${q ? `?${q}` : ''}`);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = () => {
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isHost');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (isRoomDeleted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Room supprimée</h1>
          <p className="text-slate-600 dark:text-slate-400">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-6 game-layout">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
          <Button onClick={leaveRoom} variant="outline" className="rounded-xl">
            ← Quitter
          </Button>
          <div
            className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-xl"
            onMouseEnter={() => setIsCodeVisible(true)}
            onMouseLeave={() => setIsCodeVisible(false)}
          >
            <span className="font-semibold text-slate-700 dark:text-slate-300">Code :</span>
            <span className={`font-mono text-lg ${isCodeVisible ? 'blur-0' : 'blur-sm'} transition-all text-slate-800 dark:text-slate-100`}>
              {params.code}
            </span>
            <Button onClick={copyRoomCode} variant="outline" size="sm" className="rounded-lg p-1">
              {copied ? <span className="text-xs text-green-500">Copié!</span> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="p-4 sm:p-6 rounded-2xl">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Users className="h-5 w-5" />
                Joueurs ({players.length})
              </h2>
              <div className="space-y-3">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                      {player.name}
                      {player.isHost && (
                        <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">Host</span>
                      )}
                    </p>
                    <span className="text-sm text-slate-600 dark:text-slate-400">{player.score} pts</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="p-4 sm:p-6 rounded-2xl">
              <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
                Configuration de la partie
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Choisis un jeu
                  </label>
                  <Select onValueChange={setSelectedGameId} value={selectedGameId}>
                    <SelectTrigger className="w-full rounded-xl text-slate-800 dark:text-slate-100">
                      <SelectValue placeholder="Sélectionner un jeu..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__placeholder__">Sélectionner un jeu...</SelectItem>
                      {gamesList.map((game) => (
                        <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedGame && (
                  <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{selectedGame.description}</p>
                    <h3 className="font-semibold mb-3 text-slate-800 dark:text-slate-100">Paramètres</h3>
                    <div className="space-y-4">
                      {selectedGame.settings.map((setting) => (
                        <div key={setting.id}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {setting.label}
                          </label>
                          {setting.type === 'number' && (
                            <Input
                              type="number"
                              value={String(gameSettings[setting.id] ?? setting.default)}
                              onChange={(e) => handleSettingChange(setting.id, e.target.value === '' ? setting.default : Number(e.target.value))}
                              className="rounded-lg"
                              disabled={!isHost}
                            />
                          )}
                          {setting.type === 'text' && (
                            <Input
                              type="text"
                              value={String(gameSettings[setting.id] ?? setting.default)}
                              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                              className="rounded-lg"
                              disabled={!isHost}
                              placeholder={setting.label}
                            />
                          )}
                          {setting.type === 'select' && setting.options && (
                            <Select
                              value={String(gameSettings[setting.id] ?? setting.default)}
                              onValueChange={(v) => handleSettingChange(setting.id, v)}
                              disabled={!isHost}
                            >
                              <SelectTrigger className="rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {setting.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isHost && (
                  <Button
                    onClick={startGame}
                    disabled={!selectedGameId || selectedGameId === '__placeholder__'}
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white mt-4"
                  >
                    Lancer le jeu
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
