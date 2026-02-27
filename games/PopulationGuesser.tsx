import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Users, Globe, Trophy, ArrowRight, Home, LogOut } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Cache
  const allCountriesRef = useRef<CountryPopulationData[]>([]);

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
  const gameFinished = gameState?.status === 'game_over';
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
      allCountriesRef.current = data;
      return data;
    } catch (e) {
      console.error('Error fetching countries', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      let countries = allCountriesRef.current;
      if (countries.length === 0) {
          countries = await fetchCountries();
      }
      
      if (countries.length === 0) {
          toast.error('Erreur chargement pays');
          return;
      }

      // Shuffle
      const shuffled = [...countries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const selection = shuffled.slice(0, maxRounds);
      const firstCountry = selection[0];
      const queue = selection.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        country: firstCountry,
        queue,
        endTime
      });
      
      setHasAnswered(false);
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
           await setGameStatus('game_over');
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
      setHasAnswered(false);
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded || hasAnswered) return;
    // Remove spaces/commas for parsing
    const cleanAnswer = userAnswer.replace(/[\s,]/g, '');
    if (!cleanAnswer || isNaN(Number(cleanAnswer))) {
        toast.error('Veuillez entrer un nombre valide');
        return;
    }
    
    submitAnswer(cleanAnswer);
    setHasAnswered(true);
    toast.success('Réponse envoyée !');
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

  // C1: Auto next round
  useEffect(() => {
    if (isHost && !roundEnded && !gameFinished && gameState?.answers) {
        const answerCount = Object.keys(gameState.answers).length;
        const totalPlayers = players.length;
        if (totalPlayers > 0 && answerCount >= totalPlayers) {
            endRound();
        }
    }
  }, [gameState?.answers, isHost, roundEnded, gameFinished, players.length]);

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

  if (gameFinished) {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    return (
        <GameLayout
            gameTitle="PopulationGuessr"
            roundCount={currentRound}
            maxRounds={maxRounds}
            timer="Terminé"
            players={playersMap}
            timeLeft={0}
            gameStarted={true}
        >
            <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto animate-in zoom-in duration-500">
                <Trophy className="w-24 h-24 text-yellow-400 animate-bounce" />
                <h2 className="text-4xl font-bold text-white">Fin de la partie !</h2>
                
                <div className="w-full bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 ${i === 0 ? 'bg-yellow-500/20' : ''}`}>
                            <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                                    i === 0 ? 'bg-yellow-500 text-black' : 
                                    i === 1 ? 'bg-slate-300 text-black' : 
                                    i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                                }`}>
                                    {i + 1}
                                </span>
                                <span className="font-bold text-lg">{p.name}</span>
                            </div>
                            <span className="font-mono text-xl font-bold text-blue-400">{p.score} pts</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 w-full">
                    <Button variant="outline" className="flex-1 h-14" onClick={() => router.push(`/room/${roomCode}`)}>
                        <Home className="w-5 h-5 mr-2" /> Retour au lobby
                    </Button>
                    <Button className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push('/')}>
                        <LogOut className="w-5 h-5 mr-2" /> Quitter
                    </Button>
                </div>
            </div>
        </GameLayout>
    );
  }

  return (
    <GameLayout
      gameTitle="PopulationGuessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!country ? (
            <div className="flex flex-col items-center gap-4">
               <Globe className="w-12 h-12 animate-spin text-blue-400" />
               <p className="text-xl font-medium animate-pulse text-blue-200">Chargement du pays...</p>
            </div>
        ) : !roundEnded ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in fade-in duration-500">
             <div className="relative w-full aspect-video bg-white rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.3)] border border-blue-500/20">
                <Image 
                   src={country.flags.svg || country.flags.png} 
                   alt={country.name.common} 
                   fill 
                   className="object-contain p-4"
                />
             </div>
             
             <div className="text-center">
                <h3 className="text-3xl font-bold mb-2 text-white">{country.translations?.fra?.common || country.name.common}</h3>
                <p className="text-lg text-blue-200 bg-blue-500/10 px-4 py-1 rounded-full inline-block border border-blue-500/20">
                    {country.region}
                </p>
             </div>

             <div className="w-full max-w-md space-y-4">
                <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 w-6 h-6" />
                    <Input 
                        type="number" 
                        placeholder="Population ?" 
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="pl-12 text-center text-2xl py-8 font-bold bg-slate-800/50 border-blue-500/30 focus:border-blue-500 rounded-xl transition-all"
                        disabled={hasAnswered}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnswer();
                        }}
                        autoFocus
                    />
                </div>
                
                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 rounded-xl transition-all"
                    onClick={handleAnswer}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
                    Résultats
                </h2>
                <div className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    {formatNumber(country.population)} <span className="text-2xl text-blue-400">habitants</span>
                </div>
              </div>
              
              <div className="relative w-48 h-32 bg-white rounded-xl overflow-hidden shadow-lg mb-4 border border-blue-500/20">
                <Image 
                   src={country.flags.svg || country.flags.png} 
                   alt={country.name.common} 
                   fill 
                   className="object-cover"
                />
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: any, idx: number) => (
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
                                    {res.answer !== '-' ? (
                                        <>
                                            <span className="font-mono font-bold text-white">{formatNumber(Number(res.answer))}</span>
                                            {/* <span className="text-xs text-slate-400 ml-2">
                                                (Diff: {formatNumber(res.diff)})
                                            </span> */}
                                        </>
                                    ) : 'Pas de réponse'} 
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-black text-xl text-blue-400">+{res.score} pts</span>
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
