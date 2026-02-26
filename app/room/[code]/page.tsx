'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Users, Gamepad2, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface Player {
  id: string;
  name: string;
  isHost: boolean; // mapped from is_host
  score: number;
  last_seen_at?: string;
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
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // Refs for interval access
  const playersRef = useRef(players);
  const isHostRef = useRef(isHost);

  useEffect(() => {
    playersRef.current = players;
    isHostRef.current = isHost;
  }, [players, isHost]);

  const selectedGame = useMemo(() => selectedGameId && selectedGameId !== '__placeholder__' ? gamesList.find(g => g.id === selectedGameId) : undefined, [selectedGameId]);

  // Initialisation et gestion de la room/joueur via Supabase
  useEffect(() => {
    const storedName = sessionStorage.getItem('playerName');
    if (!storedName) {
      router.push('/');
      return;
    }
    setPlayerName(storedName);

    const initRoom = async () => {
      try {
        // 1. Récupérer la room
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', params.code)
          .maybeSingle();

        if (roomError || !room) {
          setIsRoomDeleted(true);
          return;
        }

        setRoomId(room.id);
        
        // Mettre à jour les paramètres si déjà définis
        if (room.game_type && room.game_type !== '__placeholder__') {
          setSelectedGameId(room.game_type);
        }
        if (room.settings) {
          setGameSettings(room.settings);
        }

        // 2. Vérifier/Créer le joueur dans la BDD
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id)
          .eq('name', storedName)
          .maybeSingle();

        let currentPlayerId = existingPlayer?.id;
        let isCurrentHost = existingPlayer?.is_host || false;

        if (!existingPlayer) {
          // Créer le joueur
          // Si la room n'a pas de host ou si le host_id correspond au nom (legacy), ce joueur devient host
          const shouldBeHost = !room.host_id || room.host_id === storedName; 
          
          const { data: newPlayer, error: createError } = await supabase
            .from('players')
            .insert({
              room_id: room.id,
              name: storedName,
              is_host: shouldBeHost,
              score: 0
            })
            .select()
            .single();

          if (newPlayer) {
            currentPlayerId = newPlayer.id;
            isCurrentHost = newPlayer.is_host;
            
            // Si c'est le host, on met à jour la room pour lier le host_id au player UUID si ce n'est pas déjà fait
            if (shouldBeHost && room.host_id !== newPlayer.id) {
               await supabase.from('rooms').update({ host_id: newPlayer.id }).eq('id', room.id);
            }
          }
        } else {
           // Si le joueur existe, on vérifie s'il est host selon la room
           // Par sécurité, si room.host_id correspond à ce joueur, on s'assure que is_host est true
           if (room.host_id === existingPlayer.id || room.host_id === existingPlayer.name) {
               isCurrentHost = true;
               if (!existingPlayer.is_host) {
                   await supabase.from('players').update({ is_host: true }).eq('id', existingPlayer.id);
               }
           }
        }

        setIsHost(isCurrentHost);
        sessionStorage.setItem('isHost', String(isCurrentHost));
        if (currentPlayerId) sessionStorage.setItem('playerId', currentPlayerId);

        // 3. Charger la liste initiale des joueurs
        const { data: currentPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id);

        if (currentPlayers) {
          setPlayers(currentPlayers.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.is_host,
            score: p.score || 0,
            last_seen_at: p.last_seen_at
          })));
        }

        setIsLoading(false);

      } catch (error) {
        console.error("Erreur init room:", error);
      }
    };

    initRoom();
  }, [params.code, router]);

  // Presence System (Heartbeat & Inactivity)
  useEffect(() => {
    if (!roomId) return;
    const currentPayloadId = sessionStorage.getItem('playerId');

    // 1. Heartbeat (every 30s)
    const sendHeartbeat = async () => {
        if (currentPayloadId) {
            await supabase.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', currentPayloadId);
        }
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 30000);

    // 2. Inactivity Check (every 60s)
    const checkActivity = async () => {
        if (isHostRef.current) {
            // Host cleans up inactive players (> 2 min)
            const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
            await supabase.from('players').delete().eq('room_id', roomId).lt('last_seen_at', twoMinAgo);
        } else {
            // Clients check if Host is inactive
            const host = playersRef.current.find(p => p.isHost);
            if (host && host.last_seen_at) {
                const lastSeen = new Date(host.last_seen_at).getTime();
                // If host inactive > 2m30s
                if (Date.now() - lastSeen > 150000) {
                     console.log("Host inactive, closing room...");
                     // Check current status first to avoid spam
                     const { data: currentRoom } = await supabase.from('rooms').select('status').eq('id', roomId).maybeSingle();
                     if (currentRoom && currentRoom.status !== 'closed') {
                         await supabase.from('rooms').update({ status: 'closed' }).eq('id', roomId);
                     }
                }
            }
        }
    };
    const checkInterval = setInterval(checkActivity, 60000);

    return () => {
        clearInterval(hbInterval);
        clearInterval(checkInterval);
    };
  }, [roomId]);

  // Souscription Realtime
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Recharger la liste des joueurs
          const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId);

          if (currentPlayers) {
            setPlayers(currentPlayers.map(p => ({
              id: p.id,
              name: p.name,
              isHost: p.is_host,
              score: p.score || 0,
              last_seen_at: p.last_seen_at
            })));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const newRoom = payload.new as any;
          // Synchronisation des settings pour les non-hosts
          if (newRoom.game_type) setSelectedGameId(newRoom.game_type);
          if (newRoom.settings) setGameSettings(newRoom.settings);

          // Room fermée
          if (newRoom.status === 'closed') {
              setIsRoomDeleted(true);
              setTimeout(() => router.push('/'), 3000);
              return;
          }

          // Redirection si la partie commence
          if (newRoom.status === 'in_game' || newRoom.status === 'started') {
            const paramsUrl = new URLSearchParams();
            if (newRoom.settings) {
                Object.entries(newRoom.settings).forEach(([k, v]) => {
                if (v !== '' && v !== undefined) paramsUrl.set(k, String(v));
                });
            }
            const q = paramsUrl.toString();
            router.push(`/games/${newRoom.game_type}/${params.code}${q ? `?${q}` : ''}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, params.code, router]);

  // Synchroniser les changements de config (Host uniquement)
  const isUpdatingSettingsRef = useRef(false);
  
  useEffect(() => {
      if (!isHost || !roomId || !selectedGameId || selectedGameId === '__placeholder__') return;
      
      const updateRoomSettings = async () => {
          if (isUpdatingSettingsRef.current) return;
          
          // Verify we have valid data before sending
          if (typeof selectedGameId !== 'string') {
              console.error('Invalid game_type:', selectedGameId);
              return;
          }
          
          isUpdatingSettingsRef.current = true;
          
          console.log('Updating room settings:', { game_type: selectedGameId, settings: gameSettings });
          const { error } = await supabase.from('rooms').update({
              game_type: selectedGameId,
              settings: gameSettings || {} // Ensure not undefined
          }).eq('id', roomId);

          if (error) {
             console.error('Error updating room settings:', error);
          }
          
          isUpdatingSettingsRef.current = false;
      };
      
      const timer = setTimeout(updateRoomSettings, 500);
      return () => clearTimeout(timer);
  }, [selectedGameId, gameSettings, isHost, roomId]);

  useEffect(() => {
    if (selectedGame) {
      // Si on vient de changer de jeu et qu'on est host, on reset les settings
      // (sauf si c'est une synchro realtime qui vient d'arriver, mais ici on gère l'init locale)
      // La logique est un peu complexe avec le realtime.
      // Simplification: on ne reset que si gameSettings est vide ou ne correspond pas
      const defaults: Record<string, string | number> = {};
      selectedGame.settings.forEach(s => {
        if (gameSettings[s.id] === undefined) {
             defaults[s.id] = s.default;
        }
      });
      if (Object.keys(defaults).length > 0) {
          setGameSettings(prev => ({ ...prev, ...defaults }));
      }
    }
  }, [selectedGame]);

  const handleSettingChange = (settingId: string, value: string | number) => {
    setGameSettings(prev => ({ ...prev, [settingId]: value }));
  };

  const startGame = async () => {
    if (!selectedGameId || selectedGameId === '__placeholder__' || !roomId) return;
    
    // Update status to 'in_game'
    await supabase.from('rooms').update({
        status: 'in_game',
        game_type: selectedGameId,
        settings: gameSettings
    }).eq('id', roomId);
    
    // La redirection se fera via le listener Realtime
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(params.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = async () => {
    // Supprimer le joueur de la DB
    if (roomId && playerName) {
        await supabase.from('players').delete().match({ room_id: roomId, name: playerName });
    }
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isHost');
    sessionStorage.removeItem('playerId');
    router.push('/');
  };

  const getHostName = () => {
    const host = players.find(p => p.isHost);
    return host ? host.name : 'l\'hôte';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-6 game-layout">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
          <Button onClick={leaveRoom} variant="outline" className="rounded-xl">
            ← Quitter
          </Button>
          {/* Code display removed as requested */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration / Game Info - Left Column for Players as requested */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card className="p-4 sm:p-6 rounded-2xl h-full">
              <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                {isHost ? 'Configuration de la partie' : 'Informations de la partie'}
              </h2>
              
              <div className="space-y-6">
                {/* Game Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Jeu sélectionné
                  </label>
                  {isHost ? (
                    <Select 
                        onValueChange={setSelectedGameId} 
                        value={selectedGameId}
                    >
                        <SelectTrigger className="w-full rounded-xl text-slate-800 dark:text-slate-100 h-12">
                        <SelectValue placeholder="Sélectionner un jeu..." />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="__placeholder__">Sélectionner un jeu...</SelectItem>
                        {gamesList.map((game) => (
                            <SelectItem key={game.id} value={game.id}>{game.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        {selectedGame ? (
                            <>
                                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <selectedGame.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{selectedGame.name}</div>
                                    <div className="text-xs text-slate-500">{selectedGame.description}</div>
                                </div>
                            </>
                        ) : (
                            <span className="text-slate-500 italic">En attente de sélection...</span>
                        )}
                    </div>
                  )}
                </div>

                {selectedGame && (
                  <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 transition-all duration-300">
                    {isHost && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                            {selectedGame.description}
                        </p>
                    )}
                    
                    <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>Paramètres</span>
                        {!isHost && <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">Synchronisé</span>}
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedGame.settings.map((setting) => (
                        <div key={setting.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                            {setting.label}
                          </label>
                          
                          {isHost ? (
                            <>
                                {setting.type === 'number' && (
                                    <Input
                                    type="number"
                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                    onChange={(e) => handleSettingChange(setting.id, e.target.value === '' ? setting.default : Number(e.target.value))}
                                    className="rounded-lg h-9"
                                    />
                                )}
                                {setting.type === 'text' && (
                                    <Input
                                    type="text"
                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                    onChange={(e) => handleSettingChange(setting.id, e.target.value)}
                                    className="rounded-lg h-9"
                                    placeholder={setting.label}
                                    />
                                )}
                                {setting.type === 'select' && setting.options && (
                                    <Select
                                    value={String(gameSettings[setting.id] ?? setting.default)}
                                    onValueChange={(v) => handleSettingChange(setting.id, v)}
                                    >
                                    <SelectTrigger className="rounded-lg h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {setting.options.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                )}
                            </>
                          ) : (
                            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                {setting.type === 'select' && setting.options 
                                    ? setting.options.find(o => o.value === String(gameSettings[setting.id] ?? setting.default))?.label 
                                    : (gameSettings[setting.id] ?? setting.default)
                                }
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                    {isHost ? (
                    <Button
                        onClick={startGame}
                        disabled={!selectedGameId || selectedGameId === '__placeholder__'}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-12 text-lg font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        Lancer la partie
                    </Button>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 animate-pulse">
                            <div className="text-indigo-500 font-medium">En attente de {getHostName()}...</div>
                            <div className="text-sm text-slate-500">La partie va bientôt commencer !</div>
                        </div>
                    )}
                </div>
              </div>
            </Card>
          </div>

          {/* Player List - Right Column */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <Card className="p-4 sm:p-6 rounded-2xl h-full border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Users className="h-5 w-5" />
                Joueurs ({players.length})
              </h2>
              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                {players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-transform hover:scale-[1.02]">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            player.isHost 
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' 
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col truncate">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                                {player.name}
                            </span>
                            {player.isHost && (
                                <span className="text-[10px] uppercase tracking-wider text-blue-500 font-bold">Host</span>
                            )}
                        </div>
                    </div>
                    {/* Score (optional in lobby) */}
                    {/* <span className="text-sm text-slate-600 dark:text-slate-400">{player.score} pts</span> */}
                  </div>
                ))}
              </div>
              
              {/* Share invite link */}
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-center text-slate-500 mb-2">Invite tes amis avec ce code</p>
                  <div 
                    className="bg-slate-100 dark:bg-slate-900 p-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group"
                    onClick={copyRoomCode}
                  >
                      <span className="font-mono text-xl font-bold tracking-widest">{params.code}</span>
                      <Copy className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                  </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
