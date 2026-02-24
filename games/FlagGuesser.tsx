'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Check } from 'lucide-react';
import Image from 'next/image';

interface CountryData {
  name: { common: string; official: string; [key: string]: string };
  flags: { png: string; svg: string };
  region: string;
  translations: { [key: string]: { common: string; official: string } };
}

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
}

interface FlagGuesserProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function FlagGuesser({ roomCode, settings }: FlagGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(15);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  
  // Settings
  const [selectedRegion, setSelectedRegion] = useState<string>('all'); // 'all', 'africa', 'americas', 'asia', 'europe', 'oceania'

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
  } = useGameSync(roomCode ?? '', 'flagguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'flagguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const country: CountryData | null = gameState?.round_data?.country || null;
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
      if (gameState.settings.region) setSelectedRegion(gameState.settings.region);
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

  const fetchCountries = async (region: string): Promise<CountryData[]> => {
    try {
      const url = region === 'all' 
        ? 'https://restcountries.com/v3.1/all?fields=name,flags,region,translations'
        : `https://restcountries.com/v3.1/region/${region}?fields=name,flags,region,translations`;
      
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Error fetching countries', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      const countries = await fetchCountries(selectedRegion);
      
      if (countries.length === 0) return;

      // Shuffle
      for (let i = countries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [countries[i], countries[j]] = [countries[j], countries[i]];
      }
      
      const selection = countries.slice(0, maxRounds);
      const firstCountry = selection[0];
      const queue = selection.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        country: firstCountry,
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
           // End game or fetch more? Usually end game.
           // But let's fetch one more just in case
           const countries = await fetchCountries(selectedRegion);
           const random = countries[Math.floor(Math.random() * countries.length)];
           const endTime = Date.now() + roundTime * 1000;
           await nextRound({ country: random, queue: [], endTime });
           return;
      }

      const nextCountry = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         country: nextCountry,
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
    submitAnswer(userAnswer.trim());
  };

  const endRound = async () => {
    if (!isHost || !country || !gameState) return;

    const correctNames = [
        country.name.common.toLowerCase(),
        country.name.official.toLowerCase(),
        country.translations?.fra?.common?.toLowerCase(),
        country.translations?.fra?.official?.toLowerCase()
    ].filter(Boolean);
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        let isCorrect = false;
        
        if (pAnswer) {
             isCorrect = correctNames.some(n => n === pAnswer.toLowerCase());
        }
        
        results.push({
            player: p.name,
            answer: pAnswer || '-',
            isCorrect
        });

        if (isCorrect) {
            await updatePlayerScore(p.id, p.score + 10);
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

  // Settings sync
  useEffect(() => {
      if (isHost) {
          updateSettings({ ...gameState?.settings, region: selectedRegion });
      }
  }, [selectedRegion, isHost]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameCode={roomCode ?? ''}
      gameTitle="FlagGuessr"
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
                
                <div className="mb-6">
                    <span className="text-sm text-gray-400 block mb-2">Région</span>
                    <div className="grid grid-cols-3 gap-2">
                        {['all', 'africa', 'americas', 'asia', 'europe', 'oceania'].map(r => (
                            <button
                                key={r}
                                onClick={() => setSelectedRegion(r)}
                                className={`p-2 rounded text-xs font-bold transition-colors capitalize ${
                                    selectedRegion === r
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                {r === 'all' ? 'Monde' : r}
                            </button>
                        ))}
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
                      <span className="text-sm text-gray-400">Région</span>
                      <span className="font-bold capitalize">{selectedRegion}</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {country && (
              <div className="relative w-full max-w-2xl h-64 sm:h-80 mx-auto mb-4">
                 <Image
                    src={country.flags.svg || country.flags.png}
                    alt="Flag"
                    fill
                    className="object-contain"
                    priority
                 />
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Quel est ce pays ?"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-14 text-lg pr-12 text-center font-bold"
                    autoFocus
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-gray-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
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
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                    C'était...
                  </h3>
                  <div className="text-5xl font-black text-white mb-2 capitalize">
                    {country?.translations?.fra?.common || country?.name?.common}
                  </div>
                </div>

                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        p.isCorrect
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-lg">{p.player}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg uppercase">{p.answer}</span>
                        {p.isCorrect ? <CheckCircle className="text-green-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
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
