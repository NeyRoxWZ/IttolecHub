'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Clock, EyeOff, Shield, User, HelpCircle, AlertTriangle, ArrowRight, Gavel, Check } from 'lucide-react';
import { toast } from 'sonner';

type Role = 'MASTER' | 'INFILTRÉ' | 'CITOYEN';
type Phase = 'roles' | 'question' | 'vote' | 'end';

interface InfiltreProps {
  roomCode: string;
}

export default function Infiltre({ roomCode }: InfiltreProps) {
  const {
    gameState,
    isHost,
    players,
    playerId,
    startGame: hostStartGame,
    updateRoundData,
    nextRound: hostNextRound,
    submitAnswer
  } = useGameSync(roomCode, 'infiltre');

  // Local state for timer
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Derived state from gameState.round_data
  const roundData = gameState?.round_data || {};
  const queue = roundData.queue || [];
  const phase = (roundData.phase as Phase) || 'roles';
  const roles = roundData.roles || {};
  const myRole = playerId ? roles[playerId] : undefined;
  const currentVotes = gameState?.answers || {};
  const myVote = playerId && currentVotes[playerId] ? currentVotes[playerId].answer : null;
  const questionDuration = 180; // 3 minutes default
  const { word: secretWord, category, lastAnswer, winner, voteResult } = roundData;
  const gameStarted = phase !== 'roles';

  const playersMap = useMemo(() => {
      return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Listen for countdown
  useEffect(() => {
      if (gameState?.round_data?.countdown) {
          const end = gameState.round_data.countdown;
          const now = Date.now();
          const diff = Math.ceil((end - now) / 1000);
          if (diff > 0) {
              setCountdown(diff);
              const interval = setInterval(() => {
                  setCountdown(prev => {
                      if (prev && prev > 1) return prev - 1;
                      return 0;
                  });
              }, 1000);
              return () => clearInterval(interval);
          } else {
              setCountdown(null);
          }
      } else {
          setCountdown(null);
      }
  }, [gameState?.round_data?.countdown]);

  // Sync Timer for question phase
  useEffect(() => {
    // We can reuse the same timer logic if we store endTime in roundData during question phase
    // But current implementation seems to rely on local or different logic?
    // Let's add a timer if phase is question
    if (phase === 'question' && roundData.endTime) {
         const end = roundData.endTime;
         const now = Date.now();
         const diff = Math.ceil((end - now) / 1000);
         setTimeLeft(diff > 0 ? diff : 0);
         
         const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
         }, 1000);
         return () => clearInterval(interval);
    }
  }, [phase, roundData.endTime]);

  const handleStartGame = async () => {
    if (!isHost) return;
    
    // Start countdown
    const countdownEnd = Date.now() + 3000;
    await updateRoundData({ ...roundData, countdown: countdownEnd });
    
    setTimeout(async () => {
        try {
          const res = await fetch('/api/games/infiltre?count=20');
          const data = await res.json();
          if (!Array.isArray(data)) {
            toast.error('Erreur chargement mots');
            return;
          }

          const firstWord = data[0];
          const remainingQueue = data.slice(1);

          // Assign roles
          const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
          
          const master = shuffledPlayers[0];
          const infiltre = shuffledPlayers[1]; // Might be undefined if 1 player
          const newRoles: Record<string, Role> = {};
          
          players.forEach(p => {
            if (master && p.id === master.id) newRoles[p.id] = 'MASTER';
            else if (infiltre && p.id === infiltre.id) newRoles[p.id] = 'INFILTRÉ';
            else newRoles[p.id] = 'CITOYEN';
          });
          
          // Clear countdown
          await updateRoundData({ ...roundData, countdown: null });

          await hostStartGame({
            queue: remainingQueue,
            word: firstWord.word,
            category: firstWord.category,
            roles: newRoles,
            phase: 'question',
            lastAnswer: null,
            voteResult: null,
            winner: null,
            endTime: Date.now() + questionDuration * 1000
          });

        } catch (err) {
          console.error(err);
          toast.error('Impossible de démarrer');
        }
    }, 3000);
  };

  const handleNextRound = async () => {
    if (!isHost) return;
    if (queue.length === 0) {
      handleStartGame(); // Restart with new batch
      return;
    }

    const nextWord = queue[0];
    const newQueue = queue.slice(1);

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const master = shuffledPlayers[0];
    const infiltre = shuffledPlayers[1];
    const newRoles: Record<string, Role> = {};
      
    players.forEach(p => {
      if (p.id === master?.id) newRoles[p.id] = 'MASTER';
      else if (p.id === infiltre?.id) newRoles[p.id] = 'INFILTRÉ';
      else newRoles[p.id] = 'CITOYEN';
    });

    await hostNextRound({
      queue: newQueue,
      word: nextWord.word,
      category: nextWord.category,
      roles: newRoles,
      phase: 'question',
      lastAnswer: null,
      voteResult: null,
      winner: null,
      endTime: Date.now() + questionDuration * 1000
    });
  };

  const handleMasterAnswer = (answer: 'yes' | 'no' | 'maybe') => {
    if (myRole !== 'MASTER') return;
    updateRoundData({ ...roundData, lastAnswer: answer });
  };

  const startVote = () => {
    if (!isHost) return;
    updateRoundData({ ...roundData, phase: 'vote' });
  };

  const castVote = async (targetId: string | null) => {
    if (!playerId) return;
    if (targetId) {
        await submitAnswer(targetId);
    }
  };

  const closeVote = async () => {
    if (!isHost) return;
    
    const voteCounts: Record<string, number> = {};
    Object.values(currentVotes).forEach((v: any) => {
        const target = v.answer;
        if (target) voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    let maxVotes = 0;
    let suspect = null;
    Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            suspect = id;
        }
    });

    const infiltreId = Object.keys(roles).find(id => roles[id] === 'INFILTRÉ');
    // If no votes or tie, handle? Assuming suspect is found.
    // If suspect is Infiltré -> Citizens Win.
    const citizensWin = suspect === infiltreId;
    
    updateRoundData({
        ...roundData,
        phase: 'end',
        voteResult: suspect,
        winner: citizensWin ? 'CITOYENS' : 'INFILTRÉ'
    });
  };

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return (
    <GameLayout
      gameTitle="L'Infiltré"
      roundCount={0}
      maxRounds={0}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
      gameStarted={gameStarted}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8 animate-in fade-in duration-700">
        
        {/* Countdown Overlay */}
        {countdown && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="text-9xl font-black text-white animate-pulse">
                    {countdown}
                </div>
            </div>
        )}

        {phase === 'roles' ? (
           <div className="flex flex-col items-center gap-6 text-center">
             <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center animate-pulse">
                <Shield className="w-12 h-12 text-indigo-400" />
             </div>
             <h2 className="text-3xl font-bold text-white">Préparez-vous à enquêter</h2>
             <p className="text-slate-400 max-w-md">
                Un joueur est l'Infiltré. Il ne connaît pas le mot secret. Les Citoyens doivent le démasquer sans trop en révéler !
             </p>
             {isHost ? (
                <Button 
                    onClick={handleStartGame} 
                    size="lg" 
                    className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-lg px-8 py-6 rounded-xl shadow-lg shadow-indigo-500/20"
                    disabled={players.length < 3}
                >
                   {players.length < 3 ? 'En attente de joueurs (min 3)' : 'Distribuer les rôles'}
                </Button>
             ) : (
                <div className="flex items-center gap-2 text-indigo-400 bg-indigo-950/30 px-4 py-2 rounded-full border border-indigo-500/30 animate-pulse">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full" />
                   En attente de l'hôte...
                </div>
             )}
           </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Header Status */}
            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${phase === 'question' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-300">
                        {phase === 'question' ? 'Phase de questions' : phase === 'vote' ? 'Phase de vote' : 'Résultats'}
                    </span>
                </div>
                {phase === 'question' && (
                    <div className="flex items-center gap-2 text-slate-400 font-mono">
                        <Clock className="w-4 h-4" />
                        {formattedTimer}
                    </div>
                )}
            </div>

            {/* Role Card */}
            <div className="w-full bg-slate-800/50 rounded-2xl p-6 border border-white/10 flex flex-col items-center text-center relative overflow-hidden group">
                 <div className={`absolute inset-0 opacity-10 ${
                     myRole === 'MASTER' ? 'bg-blue-600' : 
                     myRole === 'INFILTRÉ' ? 'bg-red-600' : 'bg-emerald-600'
                 }`} />
                 
                 <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 z-10">Votre rôle</p>
                 <h3 className={`text-3xl font-black mb-4 z-10 ${
                     myRole === 'MASTER' ? 'text-blue-400' : 
                     myRole === 'INFILTRÉ' ? 'text-red-400' : 'text-emerald-400'
                 }`}>
                     {myRole === 'MASTER' ? 'MAÎTRE DU JEU' : myRole === 'INFILTRÉ' ? 'INFILTRÉ' : 'CITOYEN'}
                 </h3>
                 
                 <div className="bg-black/40 p-4 rounded-xl w-full max-w-sm backdrop-blur-sm border border-white/5 z-10">
                    {myRole === 'INFILTRÉ' ? (
                        <div className="flex flex-col gap-2">
                             <EyeOff className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                             <p className="font-bold text-lg text-white">Mot Secret Inconnu</p>
                             <p className="text-sm text-slate-400">Essayez de deviner le mot grâce aux questions des autres !</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                             <div className="text-xs text-slate-500 uppercase tracking-widest">Le mot secret est</div>
                             <p className="font-black text-2xl text-white tracking-tight">{secretWord}</p>
                             {category && <p className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full self-center">{category}</p>}
                        </div>
                    )}
                 </div>
            </div>

            {/* Phase: Question */}
            {phase === 'question' && (
                <div className="flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="w-full max-w-2xl bg-slate-900/50 rounded-2xl p-6 border border-white/5 text-center">
                        <HelpCircle className="w-10 h-10 text-indigo-400 mx-auto mb-4" />
                        <p className="text-lg text-slate-300 mb-6">
                            Les joueurs posent des questions au Maître du Jeu qui ne peut répondre que par Oui, Non ou ???
                        </p>
                        
                        {/* Last Answer Display */}
                        {lastAnswer && (
                             <div className="mb-8 animate-in zoom-in duration-300">
                                 <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Dernière réponse du Maître</p>
                                 <div className={`inline-flex items-center justify-center px-8 py-4 rounded-xl text-2xl font-black border ${
                                     lastAnswer === 'yes' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' :
                                     lastAnswer === 'no' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' :
                                     'bg-slate-500/20 text-slate-300 border-slate-500/50'
                                 }`}>
                                     {lastAnswer === 'yes' ? 'OUI' : lastAnswer === 'no' ? 'NON' : '???'}
                                 </div>
                             </div>
                        )}

                        {/* Master Controls */}
                        {myRole === 'MASTER' ? (
                            <div className="flex gap-2 justify-center w-full">
                                <Button onClick={() => handleMasterAnswer('yes')} className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-lg font-bold">OUI</Button>
                                <Button onClick={() => handleMasterAnswer('no')} className="flex-1 h-14 bg-rose-600 hover:bg-rose-500 text-lg font-bold">NON</Button>
                                <Button onClick={() => handleMasterAnswer('maybe')} className="flex-1 h-14 bg-slate-600 hover:bg-slate-500 text-lg font-bold">???</Button>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 animate-pulse">En attente d'une réponse...</p>
                        )}
                    </div>

                    {isHost && (
                        <Button onClick={startVote} variant="primary" className="w-full max-w-sm rounded-xl py-6 bg-red-600 hover:bg-red-700">
                            <Gavel className="w-5 h-5 mr-2" />
                            Lancer le vote maintenant
                        </Button>
                    )}
                </div>
            )}

            {/* Phase: Vote */}
            {phase === 'vote' && (
                <div className="flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-bounce" />
                        <h3 className="text-2xl font-bold text-white mb-2">Qui est l'Infiltré ?</h3>
                        <p className="text-slate-400">Votez pour la personne que vous soupçonnez.</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
                        {players.map(p => (
                            <button
                                key={p.id}
                                onClick={() => castVote(p.id)}
                                disabled={myVote !== null}
                                className={`relative p-4 rounded-xl border-2 transition-all ${
                                    myVote === p.id 
                                    ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/50' 
                                    : 'bg-slate-800 border-white/5 hover:border-white/20 hover:bg-slate-700'
                                }`}
                            >
                                <div className="font-bold text-lg text-white">{p.name}</div>
                                {currentVotes[p.id] && isHost && (
                                    <div className="text-xs text-slate-500 mt-1">A voté</div>
                                )}
                                {myVote === p.id && (
                                    <div className="absolute top-2 right-2 bg-indigo-500 rounded-full p-1">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {isHost && (
                        <Button onClick={closeVote} className="w-full max-w-sm mt-4 bg-indigo-600 hover:bg-indigo-500 py-6 rounded-xl">
                            Clôturer le vote
                        </Button>
                    )}
                </div>
            )}

            {/* Phase: End */}
            {phase === 'end' && (
                <div className="w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
                    <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 text-center shadow-2xl overflow-hidden relative">
                         <div className={`absolute inset-0 opacity-20 ${winner === 'CITOYENS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                         
                         <h2 className="text-4xl font-black text-white mb-2 relative z-10">
                             {winner === 'CITOYENS' ? '🎉 Les Citoyens gagnent !' : '🕵️ L\'Infiltré gagne !'}
                         </h2>
                         
                         <div className="mt-8 space-y-4 relative z-10 text-left bg-black/20 p-6 rounded-2xl">
                             <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                 <span className="text-slate-400">Le mot était</span>
                                 <span className="font-bold text-xl text-white">{secretWord}</span>
                             </div>
                             <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                 <span className="text-slate-400">L'Infiltré était</span>
                                 <span className="font-bold text-xl text-rose-400">
                                     {players.find(p => roles[p.id] === 'INFILTRÉ')?.name || 'Inconnu'}
                                 </span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <span className="text-slate-400">Suspect voté</span>
                                 <span className="font-bold text-xl text-slate-200">
                                     {players.find(p => p.id === voteResult)?.name || 'Aucun'}
                                 </span>
                             </div>
                         </div>

                         {isHost && (
                            <Button 
                                onClick={handleNextRound}
                                className="mt-8 w-full py-6 text-lg font-bold bg-white text-black hover:bg-slate-200 rounded-xl"
                            >
                                Manche suivante <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                         )}
                    </div>
                </div>
            )}

          </div>
        )}
      </div>
    </GameLayout>
  );
}
