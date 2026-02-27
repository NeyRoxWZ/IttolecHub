'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Users, Globe, Trophy, ArrowRight } from 'lucide-react';
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
}

export default function PopulationGuesser({ roomCode }: PopulationGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

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
  
  // Settings from DB (Lobby)
  const maxRounds = Number(gameState?.settings?.rounds || 5);
  const roundTime = Number(gameState?.settings?.time || 30);

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

  // Auto-start if phase is setup
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup') {
          startRound();
      }
  }, [isHost, gameState?.round_data?.phase]);

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
      gameTitle="PopulationGuessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
      gameStarted={gameStarted}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8 animate-in fade-in duration-700">
        {!gameStarted ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <Globe className="w-24 h-24 text-blue-400 animate-pulse" />
            <h2 className="text-3xl font-bold text-white">Prêt à deviner ?</h2>
            <p className="text-slate-400 max-w-md">
               Estimez la population de différents pays. Plus vous êtes proche, plus vous gagnez de points !
            </p>
            {isHost ? (
               <Button onClick={startRound} size="lg" className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-lg px-8 py-6 rounded-xl shadow-lg shadow-indigo-500/20">
                  Lancer la partie
               </Button>
            ) : (
               <div className="flex items-center gap-2 text-indigo-400 bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/30 animate-pulse">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                  En attente de l'hôte...
               </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8">
            {country && (
               <div className="flex flex-col items-center gap-6 w-full animate-in slide-in-from-bottom-8 duration-700">
                   <div className="relative w-full max-w-md aspect-video bg-black/40 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                      <Image 
                        src={country.flags.svg} 
                        alt="Flag" 
                        fill 
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        priority
                      />
                      <div className="absolute bottom-4 left-4 z-20">
                          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mb-1 inline-block">
                             {country.region}
                          </span>
                      </div>
                   </div>
                   <h2 className="text-4xl md:text-5xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 drop-shadow-sm">
                      {country.translations?.fra?.common || country.name.common}
                   </h2>
               </div>
            )}
            
            {!roundEnded ? (
               <div className="w-full max-w-md flex flex-col gap-6 animate-in fade-in delay-300 duration-700">
                 <div className="text-center space-y-2">
                    <p className="text-lg text-slate-300 font-medium">Quelle est la population ?</p>
                    {typingPlayer && (
                        <p className="text-xs text-indigo-400 animate-pulse font-mono">
                            {typingPlayer} est en train d'écrire...
                        </p>
                    )}
                 </div>
                 
                 <div className="flex gap-3 relative">
                    <Input
                        type="text" 
                        inputMode="numeric"
                        value={userAnswer}
                        onChange={(e) => {
                            const val = e.target.value;
                            // Allow numbers and spaces only
                            if (/^[\d\s]*$/.test(val)) {
                                setUserAnswer(val);
                                broadcast({ type: 'typing', data: { player: playerName, isTyping: val.length > 0 } });
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ex: 67 000 000"
                        className="flex-1 bg-slate-800/50 border-white/10 text-2xl h-16 text-center tracking-widest font-mono shadow-inner focus:ring-2 focus:ring-indigo-500 transition-all rounded-xl"
                        autoFocus
                    />
                    <Button 
                        onClick={handleAnswer} 
                        className="h-16 px-8 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <ArrowRight className="w-8 h-8" />
                    </Button>
                 </div>
                 <p className="text-center text-xs text-slate-500">
                    Appuyez sur Entrée pour valider
                 </p>
               </div>
            ) : (
               <div className="w-full max-w-2xl animate-in zoom-in-95 duration-500 flex flex-col gap-6">
                  {/* Result Card */}
                  <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
                     
                     <h3 className="text-xl font-bold mb-2 text-yellow-400 uppercase tracking-widest text-sm">Population réelle</h3>
                     <p className="text-5xl md:text-6xl font-black mb-2 text-white tabular-nums tracking-tight">
                        {country ? formatNumber(country.population) : '-'}
                     </p>
                     <p className="text-sm text-slate-400">habitants</p>
                  </div>

                  {/* Leaderboard for Round */}
                  <div className="space-y-3 bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                     <h4 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-300">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Résultats du round
                     </h4>
                     
                     <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {gameState?.round_data?.results?.map((res: PlayerAnswer, idx: number) => (
                            <div 
                                key={idx} 
                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                    res.score > 0 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' 
                                    : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                        idx === 0 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 
                                        idx === 1 ? 'bg-slate-400 text-black' :
                                        idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="font-bold text-lg">{res.player}</span>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <span className="text-xl font-mono font-bold tabular-nums">
                                        {res.answer !== '-' ? formatNumber(Number(res.answer)) : '-'}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        {res.score > 0 ? (
                                            <span className="text-emerald-400">+{res.score} pts</span>
                                        ) : (
                                            <span className="text-rose-400">0 pts</span>
                                        )}
                                        {res.answer !== '-' && (
                                            <span className="text-slate-500">
                                                (Diff: {formatNumber(Math.abs((country?.population || 0) - Number(res.answer)))})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                     </div>
                  </div>

                  {isHost && (
                     <div className="mt-4 flex justify-center">
                        <Button 
                            onClick={handleNextRound} 
                            size="lg"
                            className="bg-white text-black hover:bg-slate-200 text-lg px-10 py-6 rounded-full shadow-lg shadow-white/10 transition-all hover:scale-105 font-bold"
                        >
                           {gameState.current_round >= maxRounds ? 'Terminer la partie' : 'Round suivant'}
                           <ArrowRight className="w-5 h-5 ml-2" />
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
