'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Users } from 'lucide-react';
import Image from 'next/image';

interface CountryPopulationData {
  name: { 
    common: string; 
    official: string; 
    nativeName?: Record<string, { common: string; official: string }>;
  };
  population: number;
  flags: { png: string; svg: string };
  region: string;
  translations: { [key: string]: { common: string; official: string } };
}

interface PlayerAnswer {
  player: string;
  answer: string; // stored as string
  diff: number;
  score: number;
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
  const country: CountryPopulationData | null = gameState?.round_data?.country || null;
  const currentRound = gameState?.current_round || 0;
  
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync settings
  useEffect(() => {
    if (gameState?.settings) {
      if (gameState.settings.rounds) setMaxRounds(Number(gameState.settings.rounds));
      if (gameState.settings.time) setRoundTime(Number(gameState.settings.time));
    }
  }, [gameState?.settings]);

  // Host updates DB when local state changes
  useEffect(() => {
      if (isHost) {
          const newSettings = { rounds: maxRounds, time: roundTime };
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
              updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, isHost]);

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

  const fetchCountries = async (): Promise<CountryPopulationData[]> => {
    try {
      const res = await fetch('/api/games/population');
      if (!res.ok) return [];
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Error fetching countries', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      const countries = await fetchCountries();
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
           const countries = await fetchCountries();
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
    // Remove spaces/commas for parsing
    const cleanAnswer = userAnswer.replace(/[\s,]/g, '');
    if (!cleanAnswer || isNaN(Number(cleanAnswer))) return;
    
    submitAnswer(cleanAnswer);
    // Keep user answer in input but maybe disable via UI logic (not implemented here but logic exists)
  };

  const calculateScore = (actual: number, guess: number): number => {
      const diff = Math.abs(actual - guess);
      const percentDiff = (diff / actual) * 100;
      
      if (percentDiff <= 5) return 1000;
      if (percentDiff <= 10) return 500;
      if (percentDiff <= 25) return 250;
      if (percentDiff <= 50) return 100;
      return 0;
  };

  const endRound = async () => {
    if (!isHost || !country || !gameState) return;

    const actualPop = country.population;
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswerStr = answers[p.id]?.answer;
        let pScore = 0;
        let pDiff = 0;
        
        if (pAnswerStr) {
             const pAnswer = Number(pAnswerStr);
             if (!isNaN(pAnswer)) {
                 pScore = calculateScore(actualPop, pAnswer);
                 pDiff = Math.abs(actualPop - pAnswer);
             }
        }
        
        results.push({
            player: p.name,
            answer: pAnswerStr || '-',
            diff: pDiff,
            score: pScore
        });

        if (pScore > 0) {
            await updatePlayerScore(p.id, p.score + pScore);
        }
    }
    
    // Sort results by score desc, then diff asc
    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.diff - b.diff;
    });

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleAnswer();
    }
  };

  const formatNumber = (num: number) => {
      return new Intl.NumberFormat('fr-FR').format(num);
  };

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
              <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm w-full max-w-lg mx-auto">
                <p className="mb-4 font-semibold">Paramètres de la partie :</p>
                <div className="grid grid-cols-2 gap-4 text-left mb-6">
                   <div className="flex flex-col gap-2">
                      <label className="text-sm text-gray-300">Rounds</label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={20} 
                        value={maxRounds} 
                        onChange={(e) => setMaxRounds(Number(e.target.value))} 
                        className="bg-black/20 border-white/10"
                      />
                   </div>
                   <div className="flex flex-col gap-2">
                      <label className="text-sm text-gray-300">Temps (sec)</label>
                      <Input 
                        type="number" 
                        min={10} 
                        max={120} 
                        value={roundTime} 
                        onChange={(e) => setRoundTime(Number(e.target.value))}
                        className="bg-black/20 border-white/10" 
                      />
                   </div>
                </div>
                <Button onClick={startRound} className="w-full bg-blue-600 hover:bg-blue-500">
                  Lancer la partie
                </Button>
              </div>
            ) : (
               <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm w-full max-w-lg mx-auto">
                  <p className="mb-2">Paramètres (Lecture seule) :</p>
                  <ul className="text-left text-sm space-y-1 text-gray-300">
                      <li>Rounds: {maxRounds}</li>
                      <li>Temps: {roundTime}s</li>
                  </ul>
                  <p className="mt-4 text-gray-400 animate-pulse">L'hôte configure la partie...</p>
               </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            {country && (
               <div className="flex flex-col items-center gap-4">
                   <div className="relative w-full max-w-xs aspect-video bg-black/20 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                      <Image 
                        src={country.flags.svg} 
                        alt="Flag" 
                        fill 
                        className="object-contain p-2"
                        priority
                      />
                   </div>
                   <h2 className="text-3xl font-bold text-center">{country.translations?.fra?.common || country.name.common}</h2>
               </div>
            )}
            
            {!roundEnded ? (
               <div className="w-full max-w-md flex flex-col gap-4">
                 <p className="text-center text-lg">Quelle est la population ?</p>
                 <div className="flex gap-2">
                    <Input
                        type="text" 
                        inputMode="numeric"
                        value={userAnswer}
                        onChange={(e) => {
                            // Allow only numbers and spaces
                            const val = e.target.value;
                            if (/^[\d\s]*$/.test(val)) {
                                setUserAnswer(val);
                                broadcast({ type: 'typing', data: { player: playerName, isTyping: val.length > 0 } });
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ex: 67 000 000"
                        className="flex-1 bg-white/10 border-white/20 text-lg h-12 text-center tracking-widest"
                        autoFocus
                    />
                    <Button onClick={handleAnswer} className="h-12 px-6 bg-green-600 hover:bg-green-500">
                        <Users className="w-6 h-6" />
                    </Button>
                 </div>
               </div>
            ) : (
               <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white/10 rounded-xl p-6 backdrop-blur-md border border-white/10 text-center mb-6">
                     <h3 className="text-xl font-bold mb-2 text-yellow-400">Population réelle</h3>
                     <p className="text-4xl font-black mb-1 text-white">{country ? formatNumber(country.population) : '-'}</p>
                     <p className="text-sm text-gray-400">habitants</p>
                  </div>

                  <div className="space-y-3">
                     <h4 className="text-lg font-semibold mb-2">Résultats du round</h4>
                     {gameState?.round_data?.results?.map((res: PlayerAnswer, idx: number) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${res.score > 0 ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                           <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-300 w-6">{idx + 1}.</span>
                              <span className="font-medium">{res.player}</span>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="text-lg font-bold">{res.answer !== '-' ? formatNumber(Number(res.answer)) : '-'}</span>
                              <div className="flex items-center gap-2 text-xs">
                                  {res.score > 0 ? (
                                      <span className="text-yellow-400 font-bold">+{res.score} pts</span>
                                  ) : (
                                      <span className="text-gray-400">0 pts</span>
                                  )}
                                  {res.answer !== '-' && (
                                      <span className="text-gray-400">
                                          (Diff: {formatNumber(Math.abs((country?.population || 0) - Number(res.answer)))})
                                      </span>
                                  )}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  {isHost && (
                     <div className="mt-8 flex justify-center">
                        <Button onClick={handleNextRound} className="bg-blue-600 hover:bg-blue-500 text-lg px-8 py-6 rounded-full shadow-lg shadow-blue-900/20 transition-all hover:scale-105">
                           {gameState.current_round >= maxRounds ? 'Terminer la partie' : 'Round suivant'}
                        </Button>
                     </div>
                  )}
               </div>
            )}
          </div>
        )}
      </div>
    </GameLayout>
  );
}
