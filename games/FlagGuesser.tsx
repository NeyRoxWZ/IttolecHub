'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, XCircle, Zap, Check, Flag } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

interface CountryData {
  name: { 
    common: string; 
    official: string; 
    nativeName?: Record<string, { common: string; official: string }>;
  };
  flags: { png: string; svg: string };
  region: string;
  translations: { [key: string]: { common: string; official: string } };
  cca2: string;
}

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
  score: number;
  timeBonus: number;
}

interface FlagGuesserProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function FlagGuesser({ roomCode, settings }: FlagGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(20);
  const [maxRounds, setMaxRounds] = useState(8);
  const [roundTime, setRoundTime] = useState(20);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Settings
  const [selectedRegion, setSelectedRegion] = useState<string>('all'); 
  
  // Cache all countries for validation
  const allCountriesRef = useRef<CountryData[]>([]);

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
    if (gameState?.settings) {
      if (gameState.settings.rounds) setMaxRounds(Number(gameState.settings.rounds));
      if (gameState.settings.time) setRoundTime(Number(gameState.settings.time));
      if (gameState.settings.region && gameState.settings.region !== selectedRegion) {
          setSelectedRegion(gameState.settings.region);
      }
    }
  }, [gameState?.settings]);

  // Host updates DB when local state changes
  useEffect(() => {
      if (isHost) {
          const newSettings = { rounds: maxRounds, time: roundTime, region: selectedRegion };
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
              updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, selectedRegion, isHost, gameState?.settings, updateSettings]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [gameState?.round_data?.endTime]);

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
      const res = await fetch(`/api/games/flag?region=${region}`);
      if (!res.ok) return [];
      const data = await res.json();
      allCountriesRef.current = data; // Cache
      return data;
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
        queue: queue, 
        endTime,
        startTime: Date.now()
      });
      
      setHasAnswered(false);
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
           await setGameStatus('game_over');
           return;
      }

      const nextCountry = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         country: nextCountry,
         queue: nextQueue,
         endTime,
         startTime: Date.now()
      });
      setHasAnswered(false);
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswerSubmit = () => {
    if (!userAnswer.trim() || roundEnded || hasAnswered) return;
    
    submitAnswer({
        answer: userAnswer.trim(),
        timestamp: Date.now()
    });
    setHasAnswered(true);
    toast.success('Réponse envoyée !');
  };

  const normalize = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  };

  const checkAnswer = (input: string, country: CountryData) => {
      const normInput = normalize(input);
      const candidates = [
          country.name.common,
          country.name.official,
          country.translations?.fra?.common,
          country.translations?.fra?.official,
          ...(Object.values(country.translations || {}).map(t => t.common))
      ].map(s => s ? normalize(s) : '');
      
      return candidates.includes(normInput);
  };

  const endRound = async () => {
    if (!isHost || !country || !gameState) return;

    const startTime = gameState.round_data.startTime || (gameState.round_data.endTime - roundTime * 1000);
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    const updates: { playerId: string, score: number }[] = [];

    for (const p of players) {
        const pData = answers[p.id];
        let score = 0;
        let isCorrect = false;
        let timeBonus = 0;
        let answer = '-';

        if (pData) {
             answer = pData.answer;
             const timeTaken = (pData.timestamp - startTime) / 1000;
             
             if (checkAnswer(answer, country)) {
                 isCorrect = true;
                 
                 // Scoring
                 if (timeTaken < 5) {
                     score = 1000;
                 } else {
                     // Decrease from 1000 to 100
                     const maxTime = roundTime;
                     const factor = (timeTaken - 5) / (maxTime - 5);
                     score = Math.max(100, Math.round(1000 - (factor * 900)));
                 }
             }
        }

        results.push({
            player: p.name,
            answer,
            isCorrect,
            score,
            timeBonus // Not explicitly separated in spec, but handled in total score
        });

        if (score > 0) {
            updates.push({ playerId: p.id, score: p.score + score });
        }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);

    for (const update of updates) {
        await updatePlayerScore(update.playerId, update.score);
    }
    
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing indicator
  useEffect(() => {
    if (!userAnswer) return;
    broadcast({ type: 'typing', data: { player: playerName, isTyping: true } });
    const timeout = setTimeout(() => {
        broadcast({ type: 'typing', data: { player: playerName, isTyping: false } });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [userAnswer, broadcast, playerName]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameCode={roomCode ?? ''}
      gameTitle="Flag Guessr"
      isHost={isHost}
      gameStarted={gameStarted}
      onStartGame={startRound}
      timeLeft={timeLeft}
      typingPlayer={typingPlayer}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!gameStarted ? (
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-bold">Flag Guessr</h2>
            {isHost ? (
              <div className="p-6 bg-white/10 rounded-lg backdrop-blur-sm space-y-4">
                <p className="mb-4">Configurez la partie :</p>
                
                <div className="space-y-4 text-left">
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Nombre de manches ({maxRounds})</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={maxRounds} 
                        onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Temps par manche ({roundTime}s)</label>
                      <input 
                        type="range" 
                        min="10" 
                        max="60" 
                        value={roundTime} 
                        onChange={(e) => setRoundTime(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>

                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Région</label>
                      <select 
                        value={selectedRegion} 
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="w-full bg-black/20 border border-white/20 rounded p-2"
                      >
                        <option value="all">Monde entier</option>
                        <option value="Europe">Europe</option>
                        <option value="Americas">Amérique</option>
                        <option value="Africa">Afrique</option>
                        <option value="Asia">Asie</option>
                        <option value="Oceania">Océanie</option>
                      </select>
                   </div>
                </div>

                <Button size="lg" className="w-full mt-4" onClick={startRound}>
                  Lancer la partie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p>En attente de l'hôte...</p>
              </div>
            )}
          </div>
        ) : !roundEnded && country ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in fade-in duration-500">
             <div className="relative w-full h-64 bg-white/5 rounded-xl overflow-hidden shadow-2xl p-4 flex items-center justify-center">
                <div className="relative w-full h-full">
                    <Image 
                        src={country.flags.svg} 
                        alt="Drapeau" 
                        fill 
                        className="object-contain"
                        priority
                    />
                </div>
             </div>
             
             <div className="w-full max-w-md space-y-4">
                <Input 
                    type="text" 
                    placeholder="Quel est ce pays ?" 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="text-center text-xl py-6"
                    disabled={hasAnswered}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAnswerSubmit();
                    }}
                    autoFocus
                />
                
                <Button 
                    size="lg" 
                    className="w-full" 
                    onClick={handleAnswerSubmit}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : roundEnded && country ? (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <h2 className="text-3xl font-bold text-green-400">Résultats</h2>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                 <div className="relative w-40 h-24 bg-white/5 rounded overflow-hidden shadow-lg mb-2">
                    <Image 
                       src={country.flags.svg} 
                       alt="Drapeau" 
                       fill 
                       className="object-cover"
                    />
                 </div>
                 <h3 className="text-2xl font-bold">{country.translations?.fra?.common || country.name.common}</h3>
                 <p className="text-gray-400">{country.region}</p>
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                            idx === 0 ? 'bg-green-500/20 border-green-500' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg w-6">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold">{res.player}</span>
                                <span className="text-xs text-gray-400">
                                    {res.answer} 
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {res.isCorrect ? (
                                <CheckCircle className="text-green-400 w-6 h-6" />
                            ) : (
                                <XCircle className="text-red-400 w-6 h-6" />
                            )}
                            <span className="font-bold text-xl">+{res.score} pts</span>
                        </div>
                    </div>
                 ))}
              </div>

              {isHost && (
                  <Button size="lg" className="mt-6" onClick={handleNextRound}>
                      {currentRound < maxRounds ? 'Manche suivante' : 'Terminer la partie'}
                  </Button>
              )}
           </div>
        ) : null}
      </div>
    </GameLayout>
  );
}
