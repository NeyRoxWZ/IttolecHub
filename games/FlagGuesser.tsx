'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, XCircle, Zap, Check } from 'lucide-react';
import Image from 'next/image';

interface CountryData {
  name: { 
    common: string; 
    official: string; 
    nativeName?: Record<string, { common: string; official: string }>;
  };
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
  const [selectedRegion, setSelectedRegion] = useState<string>('all'); 

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
          // Simple check to avoid loops, though useGameSync might handle it or we rely on useEffect deps
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
              updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, selectedRegion, isHost]);

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
        queue: queue, 
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
           // Fallback random
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

  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    submitAnswer(userAnswer.trim());
    setUserAnswer(''); // Clear input after submit if desired, or keep it? PokeGuessr keeps it but disabled maybe?
    // Actually PokeGuessr clears it on next round.
    // If I clear it here, user can't see what they typed.
    // I'll keep it but maybe disable input?
  };

  const endRound = async () => {
    if (!isHost || !country || !gameState) return;

    // Check answers
    // Valid names: common, official, translations.fra.common, translations.fra.official
    const validNames = [
        country.name.common,
        country.name.official,
        country.translations?.fra?.common,
        country.translations?.fra?.official
    ].filter(Boolean).map(n => normalizeString(n || ''));

    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        let isCorrect = false;
        
        if (pAnswer) {
             const normalizedAnswer = normalizeString(pAnswer);
             isCorrect = validNames.includes(normalizedAnswer);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleAnswer();
    }
  };

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
                        min={5} 
                        max={60} 
                        value={roundTime} 
                        onChange={(e) => setRoundTime(Number(e.target.value))}
                        className="bg-black/20 border-white/10" 
                      />
                   </div>
                   <div className="col-span-2 flex flex-col gap-2">
                      <label className="text-sm text-gray-300">Région</label>
                      <select 
                        value={selectedRegion} 
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="w-full p-2 rounded bg-black/20 border border-white/10 text-white"
                      >
                        <option value="all">Monde entier</option>
                        <option value="europe">Europe</option>
                        <option value="africa">Afrique</option>
                        <option value="americas">Amériques</option>
                        <option value="asia">Asie</option>
                        <option value="oceania">Océanie</option>
                      </select>
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
                      <li>Région: {selectedRegion === 'all' ? 'Monde' : selectedRegion}</li>
                  </ul>
                  <p className="mt-4 text-gray-400 animate-pulse">L'hôte configure la partie...</p>
               </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            {country && (
               <div className="relative w-full max-w-md aspect-video bg-black/20 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                  <Image 
                    src={country.flags.svg} 
                    alt="Flag" 
                    fill 
                    className="object-contain p-4"
                    priority
                  />
               </div>
            )}
            
            {!roundEnded ? (
               <div className="w-full max-w-md flex gap-2">
                 <Input
                   value={userAnswer}
                   onChange={(e) => {
                       setUserAnswer(e.target.value);
                       broadcast({ type: 'typing', data: { player: playerName, isTyping: e.target.value.length > 0 } });
                   }}
                   onKeyDown={handleKeyDown}
                   placeholder="Quel est ce pays ?"
                   className="flex-1 bg-white/10 border-white/20 text-lg h-12"
                   autoFocus
                 />
                 <Button onClick={handleAnswer} className="h-12 px-6 bg-green-600 hover:bg-green-500">
                   <Check className="w-6 h-6" />
                 </Button>
               </div>
            ) : (
               <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white/10 rounded-xl p-6 backdrop-blur-md border border-white/10 text-center mb-6">
                     <h3 className="text-xl font-bold mb-2 text-yellow-400">Réponse correcte</h3>
                     <p className="text-3xl font-bold mb-1">{country?.translations?.fra?.common || country?.name?.common}</p>
                     <p className="text-sm text-gray-400">{country?.name?.official}</p>
                  </div>

                  <div className="space-y-3">
                     <h4 className="text-lg font-semibold mb-2">Résultats du round</h4>
                     {gameState?.round_data?.results?.map((res: PlayerAnswer, idx: number) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${res.isCorrect ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                           <div className="flex items-center gap-3">
                              {res.isCorrect ? <CheckCircle className="text-green-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
                              <span className="font-medium">{res.player}</span>
                           </div>
                           <div className="flex items-center gap-4">
                              <span className={`text-sm ${res.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                                 {res.answer || 'Aucune réponse'}
                              </span>
                              {res.isCorrect && <span className="text-yellow-400 font-bold">+10</span>}
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
