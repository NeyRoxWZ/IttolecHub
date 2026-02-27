'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, XCircle, Zap, Check, Flag, Loader2 } from 'lucide-react';
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

export default function FlagGuesser({ roomCode }: FlagGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(20);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Cache all countries for validation
  const allCountriesRef = useRef<CountryData[]>([]);

  // Sync with DB
  const {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
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
  const settings = gameState?.settings || {};
  const maxRounds = Number(settings.rounds || 8);
  const roundTime = Number(settings.time || 20);
  const selectedRegion = settings.region || 'all';

  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const country: CountryData | null = gameState?.round_data?.country || null;
  const currentRound = gameState?.current_round || 0;
  
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

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
    if (timeLeft > 0 && !roundEnded) {
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
  }, [timeLeft, roundEnded, isHost]);

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
    if (gameState?.round_data?.phase === 'active' && gameState?.round_data?.country) return;

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
        phase: 'active',
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

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup') {
          startRound();
      }
  }, [isHost, gameState?.round_data?.phase]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameTitle="Flag Guessr"
      gameStarted={true}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!country ? (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
                <p className="text-xl font-medium animate-pulse text-blue-200">Chargement du drapeau...</p>
            </div>
        ) : !roundEnded ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in fade-in duration-500">
             <div className="relative w-full aspect-[3/2] bg-white/5 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.3)] border border-blue-500/20 p-4 flex items-center justify-center">
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
                    className="text-center text-2xl py-8 font-bold bg-slate-800/50 border-blue-500/30 focus:border-blue-500 rounded-xl transition-all"
                    disabled={hasAnswered}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAnswerSubmit();
                    }}
                    autoFocus
                />
                
                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 rounded-xl transition-all"
                    onClick={handleAnswerSubmit}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500 mb-2">
                    Résultats
                </h2>
                <div className="text-3xl font-black text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    {country.translations?.fra?.common || country.name.common}
                </div>
                <div className="text-sm text-blue-300 font-medium uppercase tracking-wider mt-1">
                    {country.region}
                </div>
              </div>
              
              <div className="relative w-40 h-28 bg-white/5 rounded-lg overflow-hidden shadow-lg mb-2 border border-blue-500/20">
                <Image 
                    src={country.flags.svg} 
                    alt="Drapeau" 
                    fill 
                    className="object-cover"
                />
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            idx === 0 ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl w-6 text-slate-400">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-white">{res.player}</span>
                                <span className="text-sm text-slate-300">
                                    {res.answer} 
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {res.isCorrect ? (
                                <span className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase">
                                    <CheckCircle className="w-3 h-3" /> Valide
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">
                                    <XCircle className="w-3 h-3" /> Raté
                                </span>
                            )}
                            <span className="font-black text-xl text-blue-400">+{res.score}</span>
                        </div>
                    </div>
                 ))}
              </div>

              {isHost && (
                  <Button size="lg" className="mt-6 w-full max-w-sm h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl" onClick={handleNextRound}>
                      {currentRound < maxRounds ? 'Manche suivante' : 'Terminer la partie'}
                  </Button>
              )}
           </div>
        )}
      </div>
    </GameLayout>
  );
}
