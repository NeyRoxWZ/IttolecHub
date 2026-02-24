'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Check } from 'lucide-react';
import Image from 'next/image';

interface CityData {
  name: string;
  country: string;
  population: number;
  image: string;
}

interface PlayerAnswer {
  player: string;
  answer: number;
  difference: number;
}

interface PopulationGuesserProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function PopulationGuesser({ roomCode, settings }: PopulationGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

  // Sync with DB
  const {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
    updateSettings,
    startGame,
    submitAnswer,
    nextRound,
    updateRoundData,
    setGameStatus,
    updatePlayerScore
  } = useGameSync(roomCode ?? '', 'populationguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'populationguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const city: CityData | null = gameState?.round_data?.city || null;
  const currentRound = gameState?.current_round || 0;
  
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync settings
  useEffect(() => {
    if (isHost && settings && Object.keys(settings).length > 0) {
      updateSettings(settings);
    }
  }, [isHost, settings]);

  useEffect(() => {
    if (gameState?.settings) {
      if (gameState.settings.rounds) setMaxRounds(parseInt(gameState.settings.rounds, 10));
      if (gameState.settings.time) setRoundTime(parseInt(gameState.settings.time, 10));
    }
  }, [gameState?.settings]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [gameState?.round_data?.endTime, gameStarted, roundEnded]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (gameStarted && !roundEnded && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
             if (isHost && !roundEnded) {
               endRound();
             }
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, roundEnded, timeLeft, isHost]);

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const fetchCities = async (): Promise<CityData[]> => {
    try {
      // Random offset to vary cities
      const offset = Math.floor(Math.random() * 500); 
      const query = `
        SELECT ?city ?cityLabel ?countryLabel ?population ?image WHERE {
          ?city wdt:P31/wdt:P279* wd:Q515;
                wdt:P1082 ?population;
                wdt:P18 ?image;
                wdt:P17 ?country.
          FILTER(?population > 100000)
          SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
        }
        LIMIT 50
        OFFSET ${offset}
      `;
      
      const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      
      return data.results.bindings.map((b: any) => ({
        name: b.cityLabel.value,
        country: b.countryLabel.value,
        population: parseInt(b.population.value, 10),
        image: b.image.value
      }));
    } catch (e) {
      console.error('Error fetching cities', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      const cities = await fetchCities();
      
      if (cities.length === 0) return;

      // Shuffle
      for (let i = cities.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cities[i], cities[j]] = [cities[j], cities[i]];
      }
      
      const selection = cities.slice(0, maxRounds);
      const firstCity = selection[0];
      const queue = selection.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        city: firstCity,
        queue,
        endTime
      });
      
      setUserAnswer('');
    } catch (e) {
      console.error('Erreur lancement:', e);
    }
  };

  const handleNextRound = async () => {
    if (!isHost || !gameState?.round_data) return;
    
    try {
      const queue = gameState.round_data.queue || [];
      
      if (queue.length === 0) {
           const cities = await fetchCities();
           const random = cities[Math.floor(Math.random() * cities.length)];
           const endTime = Date.now() + roundTime * 1000;
           await nextRound({ city: random, queue: [], endTime });
           return;
      }

      const nextCity = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         city: nextCity,
         queue: nextQueue,
         endTime
      });
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    const answer = parseInt(userAnswer.replace(/\s/g, ''), 10);
    if (Number.isNaN(answer)) return;
    submitAnswer(answer);
  };

  const endRound = async () => {
    if (!isHost || !city || !gameState) return;

    const exact = city.population;
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        
        results.push({
            player: p.name,
            answer: pAnswer !== undefined ? pAnswer : 0,
            difference: pAnswer !== undefined ? Math.abs(pAnswer - exact) : 9999999999
        });
    }
    
    // Sort by difference
    results.sort((a, b) => a.difference - b.difference);

    // Update scores
    // Winner gets 10 points
    if (results[0] && results[0].difference < 9999999999) {
       const winnerName = results[0].player;
       const winner = players.find(p => p.name === winnerName);
       if (winner) {
           await updatePlayerScore(winner.id, winner.score + 10);
       }
    }
    
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing logic
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.type === 'typing') {
         if (lastMessage.data.player !== playerName && lastMessage.data.isTyping) {
          setTypingPlayer(lastMessage.data.player);
        } else if (lastMessage.data.player !== playerName && !lastMessage.data.isTyping) {
          setTypingPlayer((current) =>
            current === lastMessage.data.player ? null : current,
          );
        }
    }
  }, [messages, playerName]);
  
  useEffect(() => {
    if (!typingPlayer) return;
    const timeout = setTimeout(() => setTypingPlayer(null), 3000);
    return () => clearTimeout(timeout);
  }, [typingPlayer]);
  
  const playerResults = useMemo(() => {
      if (gameState?.round_data?.results) {
          return gameState.round_data.results as PlayerAnswer[];
      }
      return [];
  }, [gameState?.round_data?.results]);

  const answeredPlayers = useMemo(() => {
      if (gameState?.answers) {
          return Object.keys(gameState.answers).map(pid => {
              const p = players.find(pl => pl.id === pid);
              return p ? p.name : 'Unknown';
          });
      }
      return [];
  }, [gameState?.answers, players]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameCode={roomCode ?? ''}
      gameTitle="PopulationGuessr"
      isHost={isHost}
      gameStarted={gameStarted}
      onStartGame={startRound}
      timeLeft={timeLeft}
      typingPlayer={typingPlayer}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!gameStarted ? (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">En attente du lancement...</h2>
            {isHost ? (
              <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm w-full max-w-lg">
                <p className="mb-4">Configurez la partie :</p>
                <div className="grid grid-cols-2 gap-4 text-left mb-6">
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <Input 
                        type="number" 
                        value={maxRounds} 
                        onChange={e => setMaxRounds(parseInt(e.target.value))} 
                        className="bg-white/5 border-white/10"
                      />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Temps (s)</span>
                      <Input 
                        type="number" 
                        value={roundTime} 
                        onChange={e => setRoundTime(parseInt(e.target.value))} 
                        className="bg-white/5 border-white/10"
                      />
                   </div>
                </div>
                
                <Button size="lg" onClick={startRound} className="w-full">
                  Lancer la partie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p>L'hôte configure la partie...</p>
                 <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mt-4 opacity-75">
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <span className="font-bold">{maxRounds}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Temps</span>
                      <span className="font-bold">{roundTime}s</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {city && (
              <div className="relative w-full max-w-4xl h-64 sm:h-96 mx-auto mb-4 rounded-xl overflow-hidden shadow-2xl">
                 <Image
                    src={city.image}
                    alt="City"
                    fill
                    className="object-cover"
                    priority
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                 <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-center">
                    <h2 className="text-3xl font-bold mb-1">{city.name}</h2>
                    <p className="text-xl text-gray-300">{city.country}</p>
                 </div>
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Population ?"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-14 text-lg pr-12 text-center font-mono"
                    autoFocus
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-gray-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
                  onClick={handleAnswer}
                >
                  Valider
                </Button>
                
                {answeredPlayers.length > 0 && (
                   <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {answeredPlayers.map(p => (
                         <div key={p} className="flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
                           <Check className="w-3 h-3" /> {p}
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-white/5 rounded-2xl p-8 backdrop-blur-sm border border-white/10 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    Résultats
                  </h3>
                  <div className="text-5xl font-black text-white mb-2">
                    {city?.population.toLocaleString()}
                    <span className="text-2xl font-normal text-gray-400 ml-2">
                      habitants
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        i === 0
                          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                            i === 0
                              ? 'bg-yellow-500 text-black'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span className="font-medium text-lg">{p.player}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xl">
                          {p.answer.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {p.difference === 0 ? 'Exact !' : `Diff: ${p.difference.toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isHost && (
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200"
                    onClick={handleNextRound}
                  >
                    Manche suivante
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </GameLayout>
  );
}
