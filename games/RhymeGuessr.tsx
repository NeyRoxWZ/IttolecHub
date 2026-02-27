'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Check, MessageSquare, Loader2 } from 'lucide-react';

interface RhymeRoundData {
  prompt: string;
  rhymeWith: string;
}

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
  lastWord: string;
}

interface RhymeGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function RhymeGuessr({ roomCode }: RhymeGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

  // Sync with DB
  const {
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
  } = useGameSync(roomCode ?? '', 'rhymeguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'rhymeguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const settings = gameState?.settings || {};
  const maxRounds = Number(settings.rounds || 7);
  const roundTime = Number(settings.time || 45);

  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const roundData: RhymeRoundData | null = gameState?.round_data?.rhyme || null;
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

  const fetchPrompt = async (): Promise<RhymeRoundData | null> => {
    try {
      const res = await fetch(`/api/games/rhyme`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Error fetching prompt', e);
      return null;
    }
  };

  // Game Logic
  const startRound = async () => {
    if (!isHost || !roomCode) return;
    if (gameState?.round_data?.phase === 'active' && gameState?.round_data?.rhyme) return;

    try {
      const prompt = await fetchPrompt();
      if (!prompt) return;

      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        phase: 'active',
        rhyme: prompt,
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
      const prompt = await fetchPrompt();
      if (!prompt) return;

      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         rhyme: prompt,
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
    if (!isHost || !roundData || !gameState) return;

    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        let isCorrect = false;
        let lastWord = '';
        
        if (pAnswer) {
             // Validate rhyme
             const clean = pAnswer.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
             lastWord = clean.split(' ').pop() || '';
             
             if (lastWord) {
                 try {
                     const checkRes = await fetch(`/api/games/rhyme/check?word=${encodeURIComponent(lastWord)}&target=${encodeURIComponent(roundData.rhymeWith)}`);
                     const checkData = await checkRes.json();
                     isCorrect = checkData.matches;
                 } catch (e) {
                     console.error('Rhyme check failed', e);
                     isCorrect = lastWord.slice(-3).toLowerCase() === roundData.rhymeWith.slice(-3).toLowerCase();
                 }
             }
        }
        
        results.push({
            player: p.name,
            answer: pAnswer || '-',
            isCorrect,
            lastWord
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

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup') {
          startRound();
      }
  }, [isHost, gameState?.round_data?.phase]);
  
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
      gameTitle="RimeGuessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!roundData ? (
            <div className="flex flex-col items-center gap-4">
               <Loader2 className="w-12 h-12 animate-spin text-violet-400" />
               <p className="text-xl font-medium animate-pulse text-violet-200">Chargement du mot...</p>
            </div>
        ) : (
          <>
            <div className="w-full max-w-3xl mx-auto mb-4">
                 <div className="bg-white/5 p-10 rounded-2xl backdrop-blur-md border border-violet-500/30 text-center relative overflow-hidden shadow-[0_0_30px_rgba(139,92,246,0.15)] animate-in fade-in zoom-in-95 duration-500">
                    <MessageSquare className="w-32 h-32 text-violet-500/10 absolute -top-6 -right-6 -rotate-12" />
                    <p className="text-2xl md:text-4xl font-bold text-white mb-6">
                      "{roundData.prompt}"
                    </p>
                    <div className="text-lg text-violet-200 uppercase tracking-widest mt-4 bg-violet-500/10 inline-block px-4 py-2 rounded-lg">
                       Rime avec : <span className="text-violet-400 font-black text-2xl ml-2">{roundData.rhymeWith}</span>
                    </div>
                 </div>
            </div>

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Écrivez une phrase qui rime..."
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-16 text-xl pr-14 text-center font-medium bg-slate-800/50 border-violet-500/30 focus:border-violet-500 transition-all rounded-xl"
                    autoFocus
                  />
                  <div className="absolute right-3 top-3 bottom-3 w-10 flex items-center justify-center text-violet-400">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>
                
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/20 hover:shadow-violet-600/40 transition-all rounded-xl"
                  onClick={handleAnswer}
                >
                  Valider ma rime
                </Button>
                
                {answeredPlayers.length > 0 && (
                   <div className="flex flex-wrap gap-2 justify-center mt-6">
                      {answeredPlayers.map(p => (
                         <div key={p} className="flex items-center gap-1.5 bg-violet-500/20 border border-violet-500/30 text-violet-200 px-3 py-1.5 rounded-full text-xs font-medium animate-in zoom-in">
                           <Check className="w-3 h-3" /> {p} a répondu
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-slate-900/60 rounded-2xl p-8 backdrop-blur-md border border-white/10 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                    Résultats
                  </h3>
                </div>

                <div className="grid gap-3 mb-8 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex flex-col p-4 rounded-xl transition-all border ${
                        p.isCorrect
                          ? 'bg-violet-500/10 border-violet-500/40'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg text-white">{p.player}</span>
                            {p.isCorrect ? (
                                <span className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase">
                                    <CheckCircle className="w-3 h-3" /> Valide
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded uppercase">
                                    <XCircle className="w-3 h-3" /> Raté
                                </span>
                            )}
                        </div>
                        {p.isCorrect && <span className="text-violet-400 font-black text-lg">+10 pts</span>}
                      </div>
                      <div className="text-white/90 italic text-lg font-serif">
                        "{p.answer}"
                      </div>
                      {p.lastWord && (
                          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            Mot fin: <span className="text-slate-300 font-mono bg-white/5 px-1 rounded">{p.lastWord}</span>
                          </div>
                      )}
                    </div>
                  ))}
                </div>

                {isHost && (
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl"
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
