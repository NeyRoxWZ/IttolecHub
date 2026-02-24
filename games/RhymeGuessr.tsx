'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Check, MessageSquare } from 'lucide-react';

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

export default function RhymeGuessr({ roomCode, settings }: RhymeGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(45);
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
  } = useGameSync(roomCode ?? '', 'rhymeguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'rhymeguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const roundData: RhymeRoundData | null = gameState?.round_data?.rhyme || null;
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

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      // Fetch N prompts? API returns one.
      // We can fetch one by one or fetch N in loop.
      // Let's fetch one for now and store in round_data.
      // But we should try to pre-fetch if possible.
      // For now, simpler: fetch one.
      
      const prompt = await fetchPrompt();
      if (!prompt) return;

      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
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
             // 1. Extract last word
             const clean = pAnswer.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
             lastWord = clean.split(' ').pop() || '';
             
             if (lastWord) {
                 // 2. Check API
                 try {
                     const checkRes = await fetch(`/api/games/rhyme/check?word=${encodeURIComponent(lastWord)}&target=${encodeURIComponent(roundData.rhymeWith)}`);
                     const checkData = await checkRes.json();
                     isCorrect = checkData.matches;
                 } catch (e) {
                     console.error('Rhyme check failed', e);
                     // Fallback suffix check
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
      gameTitle="RimeGuessr"
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
            {roundData && (
              <div className="w-full max-w-3xl mx-auto mb-8">
                 <div className="bg-white/5 p-8 rounded-xl backdrop-blur-md border border-white/10 text-center relative overflow-hidden">
                    <MessageSquare className="w-24 h-24 text-white/5 absolute -top-4 -right-4 -rotate-12" />
                    <p className="text-2xl md:text-3xl font-bold text-white mb-2">
                      "{roundData.prompt}"
                    </p>
                    <div className="text-sm text-gray-400 uppercase tracking-widest mt-4">
                       Rime avec : <span className="text-yellow-400 font-bold">{roundData.rhymeWith}</span>
                    </div>
                 </div>
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    className="h-14 text-lg pr-12 text-center font-medium"
                    autoFocus
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-gray-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all"
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
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600">
                    Résultats
                  </h3>
                </div>

                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex flex-col p-4 rounded-xl transition-all ${
                        p.isCorrect
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-lg">{p.player}</span>
                            {p.isCorrect ? <CheckCircle className="text-green-400 w-4 h-4" /> : <XCircle className="text-red-400 w-4 h-4" />}
                        </div>
                        {p.isCorrect && <span className="text-green-400 font-bold">+10 pts</span>}
                      </div>
                      <div className="text-white/90 italic">
                        "{p.answer}"
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Mot fin: {p.lastWord}
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
