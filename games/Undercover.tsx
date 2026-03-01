'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Crown, Skull, Loader2, Send, Home, LogOut, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Phase = 'setup' | 'roles' | 'clues' | 'discussion' | 'vote' | 'mrwhite_guess' | 'results' | 'game_over';

interface UndercoverProps {
  roomCode: string;
  settings?: { [key: string]: string };
}

interface Clue {
  playerId: string;
  text: string;
  timestamp: number;
}

export default function Undercover({ roomCode }: UndercoverProps) {
  const router = useRouter();
  // Sync with DB
  const {
    gameState,
    isHost,
    players,
    playerId,
    startGame,
    updateRoundData,
    nextRound,
    submitAnswer,
    setGameStatus,
    getTimeLeft // New helper
  } = useGameSync(roomCode, 'undercover');

  // Local UI State
  const [userClue, setUserClue] = useState('');
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Derived State from GameState
  const settings = gameState?.settings || {};
  const rounds = Number(settings.rounds || 1);
  const mrWhiteEnabled = settings.mrWhiteEnabled === 'true' || settings.mrWhiteEnabled === true;
  const discussionTime = Number(settings.discussionTime || 60);
  const voteTime = Number(settings.voteTime || 30);
  const playersKnowRole = settings.playersKnowRole === 'true' || settings.playersKnowRole === true;
  const clueRoundsBeforeVote = Number(settings.clueRounds || 3);

  const roundData = gameState?.round_data || {};
  const currentPhase = (roundData.phase as Phase) || 'setup';
  const roles = roundData.roles as Record<string, Role> || {};
  const myRole = playerId ? roles[playerId] : null;
  const civilWord = roundData.civilWord as string;
  const undercoverWord = roundData.undercoverWord as string;
  const currentSpeakerId = roundData.currentSpeaker as string | null;
  const clues = (roundData.clues as Clue[]) || [];
  const alivePlayers = (roundData.alivePlayers as string[]) || [];
  const eliminatedPlayerId = roundData.eliminated as string | null;
  const winner = roundData.winner as string | null;
  const currentRoundNumber = gameState?.current_round || 0;
  const readyPlayers = (roundData.readyPlayers as string[]) || [];
  const currentClueRound = roundData.currentClueRound || 1;

  // Players Map
  const playersMap = useMemo(() => {
    // Undercover doesn't use scores, but we keep the map for compatibility
    return players.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {} as Record<string, number>);
  }, [players]);

  const isMyTurn = currentPhase === 'clues' && currentSpeakerId === playerId;
  const isAlive = playerId && alivePlayers.includes(playerId);
  const amIReady = playerId && readyPlayers.includes(playerId);

  // Timer Sync using Server Time
  useEffect(() => {
    if (roundData.endTime) {
        // Update immediately
        setTimeLeft(getTimeLeft(roundData.endTime));
        
        // Interval for visual countdown
        const interval = setInterval(() => {
            const tl = getTimeLeft(roundData.endTime);
            setTimeLeft(tl);
            if (tl <= 0) clearInterval(interval);
        }, 250); // 4Hz refresh for smooth feeling
        return () => clearInterval(interval);
    } else {
        setTimeLeft(0);
    }
  }, [roundData.endTime, getTimeLeft]);


  // --- HOST LOGIC ---

  // Phase Management
  useEffect(() => {
    if (!isHost) return;

    const managePhases = async () => {
        // 1. Roles Phase -> Clues Phase (Wait for ALL Ready - NO TIMER)
        if (currentPhase === 'roles') {
             const allReady = alivePlayers.every(id => readyPlayers.includes(id));
             if (allReady && alivePlayers.length > 0) { // Ensure players exist
                 await updateRoundData({
                     ...roundData,
                     phase: 'clues',
                     currentSpeaker: alivePlayers[0],
                     endTime: null,
                     currentClueRound: 1
                 });
             }
        }

        // 3. Discussion Phase -> Vote Phase (after time)
        if (currentPhase === 'discussion' && timeLeft === 0 && roundData.endTime) {
             await updateRoundData({
                 ...roundData,
                 phase: 'vote',
                 endTime: Date.now() + voteTime * 1000
             });
        }

        // 4. Vote Phase -> Results/Elimination (after time)
        if (currentPhase === 'vote' && timeLeft === 0 && roundData.endTime) {
             await processVotes();
        }
    };

    managePhases();
  }, [isHost, currentPhase, timeLeft, roundData, alivePlayers, voteTime, readyPlayers]);


  const startNewGame = async () => {
    if (!isHost) return;
    if (players.length < 3) {
        toast.error("Il faut au moins 3 joueurs !");
        return;
    }

    try {
        const res = await fetch(`/api/games/undercover?count=${rounds}`);
        const words = await res.json();
        
        if (!words || words.length === 0) return;

        // Init Game
        const firstPair = Array.isArray(words) ? words[0] : words;
        const remainingQueue = Array.isArray(words) ? words.slice(1) : [];

        // Assign Roles
        const { newRoles, alive } = assignRoles(players, mrWhiteEnabled);

        await startGame({
            civilWord: firstPair.civilWord,
            undercoverWord: firstPair.undercoverWord,
            roles: newRoles,
            alivePlayers: alive,
            phase: 'roles',
            clues: [],
            readyPlayers: [], // Reset ready
            currentClueRound: 1,
            queue: remainingQueue,
            endTime: null // Manual ready (no timer)
        });
        toast.success("Partie lancée !");
    } catch (e) {
        console.error(e);
        toast.error("Erreur au démarrage");
    }
  };

  const assignRoles = (allPlayers: any[], includeMrWhite: boolean) => {
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const newRoles: Record<string, Role> = {};
    const alive: string[] = [];

    let available = [...shuffled];
    
    // Undercover
    const undercover = available.pop();
    if (undercover) newRoles[undercover.id] = 'UNDERCOVER';

    // Mr White
    if (includeMrWhite && available.length > 0) {
        const mrWhite = available.pop();
        if (mrWhite) newRoles[mrWhite.id] = 'MR_WHITE';
    }

    // Civils
    available.forEach(p => newRoles[p.id] = 'CIVIL');
    
    shuffled.forEach(p => alive.push(p.id));

    return { newRoles, alive };
  };

  const processVotes = async () => {
    const votes = gameState?.answers || {};
    const voteCounts: Record<string, number> = {};
    
    // Count votes
    Object.values(votes).forEach((v: any) => {
        if (v.type === 'vote' && v.targetId) {
            voteCounts[v.targetId] = (voteCounts[v.targetId] || 0) + 1;
        }
    });

    // Find max
    let maxVotes = 0;
    let eliminatedId: string | null = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([pid, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            eliminatedId = pid;
            isTie = false;
        } else if (count === maxVotes) {
            isTie = true;
        }
    });

    if (isTie || !eliminatedId) {
        // No elimination, back to clues? Or discussion?
        // Let's go back to clues for another round
        toast('Égalité ! Personne n\'est éliminé.');
        await updateRoundData({
            ...roundData,
            phase: 'clues',
            currentSpeaker: alivePlayers[0],
            // clues: [] // Keep history
        });
        return;
    }

    // Elimination
    const eliminatedRole = roles[eliminatedId];
    
    if (eliminatedRole === 'MR_WHITE') {
        // Mr White chance to guess
        await updateRoundData({
            ...roundData,
            eliminated: eliminatedId,
            phase: 'mrwhite_guess',
            endTime: Date.now() + 30000 // 30s to guess
        });
        return;
    }

    // Standard Elimination
    handleElimination(eliminatedId);
  };

  const handleElimination = async (eliminatedId: string) => {
    const newAlive = alivePlayers.filter(id => id !== eliminatedId);
    
    // Check Win Conditions
    const remainingRoles = newAlive.map(id => roles[id]);
    const hasUndercover = remainingRoles.includes('UNDERCOVER');
    const hasMrWhite = remainingRoles.includes('MR_WHITE');
    const civilsCount = remainingRoles.filter(r => r === 'CIVIL').length;
    const impostorsCount = (hasUndercover ? 1 : 0) + (hasMrWhite ? 1 : 0);

    if (!hasUndercover && !hasMrWhite) {
        // Civils Win
        await finishGame('CIVILS', newAlive);
    } else if (impostorsCount >= civilsCount) {
        // Impostors Win
        await finishGame('IMPOSTORS', newAlive);
    } else {
        // Continue
        await updateRoundData({
            ...roundData,
            eliminated: eliminatedId,
            alivePlayers: newAlive,
            phase: 'clues',
            currentSpeaker: newAlive[0],
            endTime: null
        });
    }
  };

  const finishGame = async (winner: string, alive: string[]) => {
      await updateRoundData({
          ...roundData,
          winner,
          phase: 'results',
          alivePlayers: alive
      });
  };

  const nextGameRound = async () => {
      if (!isHost) return;
      const queue = roundData.queue || [];
      if (queue.length === 0) {
          await setGameStatus('game_over');
          return;
      }
      
      const nextPair = queue[0];
      const remaining = queue.slice(1);
      const { newRoles, alive } = assignRoles(players, settings.mrWhiteEnabled);

      await nextRound({
            civilWord: nextPair.civilWord,
            undercoverWord: nextPair.undercoverWord,
            roles: newRoles,
            alivePlayers: alive,
            phase: 'roles',
            clues: [],
            readyPlayers: [],
            currentClueRound: 1,
            queue: remaining,
            endTime: null
      });
      toast.success("Manche suivante !");
  };

  // --- CLIENT ACTIONS ---

  const sendReady = async () => {
    if (amIReady) return;
    await submitAnswer({
        type: 'ready'
    });
  };

  const sendClue = async () => {
    if (!userClue.trim()) return;
    await submitAnswer({
        type: 'clue',
        text: userClue,
        timestamp: Date.now()
    });
    setUserClue('');
  };

  const sendVote = async (targetId: string) => {
    await submitAnswer({
        type: 'vote',
        targetId
    });
    toast.success('Vote enregistré');
  };

  const sendMrWhiteGuess = async () => {
    if (!mrWhiteGuess.trim()) return;
    await submitAnswer({
        type: 'guess',
        text: mrWhiteGuess
    });
  };

  // Host listening for answers/clues
  useEffect(() => {
    if (!isHost || !gameState?.answers) return;

    const processAnswers = async () => {
        const answers = gameState.answers;
        
        // Check for Ready Status
        if (currentPhase === 'roles') {
            const newReady = [...readyPlayers];
            let changed = false;
            
            Object.entries(answers).forEach(([pid, val]: [string, any]) => {
                if (val.type === 'ready' && !newReady.includes(pid)) {
                    newReady.push(pid);
                    changed = true;
                }
            });

            if (changed) {
                await updateRoundData({ ...roundData, readyPlayers: newReady });
            }
        }
        
        // Check for Clues
        if (currentPhase === 'clues' && currentSpeakerId) {
            const speakerAnswer = answers[currentSpeakerId];
            if (speakerAnswer && speakerAnswer.type === 'clue') {
                const lastClue = clues.find(c => c.playerId === currentSpeakerId && c.text === speakerAnswer.text);
                if (!lastClue) {
                    const newClues = [...clues, {
                        playerId: currentSpeakerId,
                        text: speakerAnswer.text,
                        timestamp: speakerAnswer.timestamp
                    }];
                    
                    const currentIndex = alivePlayers.indexOf(currentSpeakerId);
                    const nextIndex = (currentIndex + 1) % alivePlayers.length;
                    const nextSpeaker = alivePlayers[nextIndex];
                    
                    if (nextIndex === 0) {
                        // End of Clue Round
                        const nextRoundNum = currentClueRound + 1;
                        
                        if (nextRoundNum > clueRoundsBeforeVote) {
                             // Go to Vote
                             await updateRoundData({
                                 ...roundData,
                                 clues: newClues,
                                 currentSpeaker: null,
                                 phase: 'vote',
                                 endTime: Date.now() + voteTime * 1000,
                                 currentClueRound: nextRoundNum
                             });
                        } else {
                             // Next Clue Round
                             await updateRoundData({
                                 ...roundData,
                                 clues: newClues,
                                 currentSpeaker: nextSpeaker,
                                 currentClueRound: nextRoundNum
                             });
                        }
                    } else {
                        // Next Player in same round
                        await updateRoundData({
                            ...roundData,
                            clues: newClues,
                            currentSpeaker: nextSpeaker
                        });
                    }
                }
            }
        }

        // Check for Mr White Guess
        if (currentPhase === 'mrwhite_guess' && eliminatedPlayerId) {
             const mwAnswer = answers[eliminatedPlayerId];
             if (mwAnswer && mwAnswer.type === 'guess') {
                 const guess = mwAnswer.text;
                 const isCorrect = guess.trim().toLowerCase() === (civilWord || '').toLowerCase();
                 
                 if (isCorrect) {
                     await finishGame('MR_WHITE', alivePlayers);
                 } else {
                     await handleElimination(eliminatedPlayerId);
                 }
             }
        }
    };

    processAnswers();
  }, [isHost, gameState?.answers, currentPhase, currentSpeakerId, clues, alivePlayers, discussionTime, eliminatedPlayerId, civilWord]);

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 3) {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length]);


  // --- RENDER ---
  const getRoleIcon = (role: Role) => {
      switch(role) {
          case 'CIVIL': return <User className="w-6 h-6" />;
          case 'UNDERCOVER': return <Skull className="w-6 h-6" />;
          case 'MR_WHITE': return <AlertTriangle className="w-6 h-6" />;
          default: return <User className="w-6 h-6" />;
      }
  };

  const getRoleColor = (role: Role) => {
      switch(role) {
          case 'CIVIL': return 'text-blue-400';
          case 'UNDERCOVER': return 'text-red-500';
          case 'MR_WHITE': return 'text-white';
          default: return 'text-gray-400';
      }
  };

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRoundNumber}
      maxRounds={rounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="Undercover"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto min-h-[400px]">
        
        {/* SETUP PHASE / LOADING */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center gap-4">
               {players.length < 3 ? (
                 <>
                    <User className="w-12 h-12 text-gray-500 animate-pulse" />
                    <p className="text-xl font-medium text-gray-400">En attente de joueurs ({players.length}/3)...</p>
                 </>
               ) : (
                 <>
                    <Loader2 className="w-12 h-12 animate-spin text-red-500" />
                    <p className="text-xl font-medium animate-pulse text-red-200">Démarrage de la mission...</p>
                 </>
               )}
            </div>
        )}

        {/* ROLES REVEAL */}
        {currentPhase === 'roles' && myRole && (
             <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-lg">
                <div className="bg-slate-900/80 p-8 rounded-2xl border border-white/10 text-center w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] relative overflow-hidden">
                    
                    {amIReady && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10 animate-in fade-in">
                            <div className="text-center">
                                <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-white">Vous êtes prêt !</h3>
                                <p className="text-gray-400 mt-2">En attente des autres joueurs ({readyPlayers.length}/{alivePlayers.length})</p>
                            </div>
                        </div>
                    )}

                    <h3 className="text-2xl font-bold text-gray-400 mb-6">Votre rôle est</h3>
                    
                    {playersKnowRole ? (
                        <>
                            <div className="mb-8 flex justify-center">
                                <div className={`p-6 rounded-full bg-white/5 border-2 ${myRole === 'CIVIL' ? 'border-blue-500' : 'border-red-500'}`}>
                                     {getRoleIcon(myRole)}
                                </div>
                            </div>
                            
                            <h2 className={`text-4xl font-black mb-4 ${getRoleColor(myRole)}`}>
                                {myRole === 'CIVIL' ? 'CIVIL' : myRole === 'UNDERCOVER' ? 'UNDERCOVER' : 'MR. WHITE'}
                            </h2>
                        </>
                    ) : (
                        <div className="mb-8 flex justify-center">
                            <div className="p-6 rounded-full bg-white/5 border-2 border-gray-500">
                                <User className="w-12 h-12 text-gray-300" />
                            </div>
                            <h2 className="text-4xl font-black mb-4 text-gray-300 sr-only">Rôle Caché</h2>
                        </div>
                    )}

                    <div className="bg-white/5 p-4 rounded-xl mb-8">
                        <p className="text-sm text-gray-400 mb-1">Votre mot secret :</p>
                        <p className="text-3xl font-bold text-white tracking-widest uppercase">
                            {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                        </p>
                    </div>

                    <Button 
                        size="lg" 
                        onClick={sendReady} 
                        disabled={!!amIReady}
                        className="w-full h-16 text-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                    >
                        JE SUIS PRÊT
                    </Button>
                </div>
             </div>
        )}

        {/* GAMEPLAY: CLUES & DISCUSSION */}
        {(currentPhase === 'clues' || currentPhase === 'discussion') && (
            <div className="w-full max-w-6xl space-y-6 flex flex-col items-center">
                 
                 {/* GRID OF CLUES */}
                 <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                     <div className="flex justify-center gap-4 min-w-max px-4">
                        {alivePlayers.map(pid => {
                            const p = players.find(pl => pl.id === pid);
                            const pClues = clues.filter(c => c.playerId === pid);
                            const isSpeaking = currentPhase === 'clues' && currentSpeakerId === pid;

                            return (
                                <div key={pid} className={`w-48 flex flex-col transition-all duration-300 ${isSpeaking ? 'scale-105' : 'opacity-90'}`}>
                                    <div className={`p-3 rounded-t-xl text-center border-b-4 ${isSpeaking ? 'bg-slate-700 border-yellow-500' : 'bg-slate-800 border-slate-600'}`}>
                                        <div className="font-bold text-white truncate text-lg">{p?.name}</div>
                                        {isSpeaking && <div className="text-xs text-yellow-400 font-bold animate-pulse mt-1">À TOI DE JOUER</div>}
                                    </div>
                                    <div className="bg-slate-900/60 p-2 rounded-b-xl min-h-[300px] flex flex-col gap-2 border border-white/5">
                                        {pClues.map((c, idx) => (
                                            <div key={idx} className="bg-white/10 p-3 rounded-lg text-white font-medium break-words animate-in slide-in-from-bottom-2 fade-in shadow-sm relative group">
                                                <span className="absolute -left-2 -top-2 w-5 h-5 bg-slate-700 rounded-full text-[10px] flex items-center justify-center text-gray-400 border border-white/10">
                                                    {idx + 1}
                                                </span>
                                                {c.text}
                                            </div>
                                        ))}
                                        {isSpeaking && (
                                            <div className="bg-yellow-400/5 p-3 rounded-lg border border-yellow-400/20 animate-pulse flex justify-center">
                                                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                     </div>
                 </div>

                 {/* Input Area (Only for Clues phase & Current Speaker) */}
                 {currentPhase === 'clues' && isMyTurn && (
                     <div className="bg-slate-900/90 p-6 rounded-2xl border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] w-full max-w-xl animate-in slide-in-from-bottom-10 fixed bottom-8 z-50">
                         <p className="text-yellow-400 font-bold mb-2 text-sm uppercase tracking-wider">C'est à votre tour !</p>
                         <div className="flex gap-3">
                             <Input 
                                placeholder="Donnez votre indice (1 mot)..." 
                                value={userClue}
                                onChange={e => setUserClue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendClue()}
                                className="bg-slate-800 border-white/20 text-lg h-12"
                                autoFocus
                             />
                             <Button onClick={sendClue} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 px-6">
                                 <Send className="w-5 h-5" />
                             </Button>
                         </div>
                     </div>
                 )}
                 
                 {currentPhase === 'discussion' && (
                     <div className="fixed bottom-8 z-50 bg-red-600 text-white px-8 py-4 rounded-full font-bold text-xl shadow-lg animate-bounce flex items-center gap-3">
                         <MessageSquare className="w-6 h-6" />
                         Débattez ! Qui est l'intrus ?
                     </div>
                 )}
            </div>
        )}

        {/* VOTE PHASE */}
        {currentPhase === 'vote' && (
            <div className="w-full max-w-2xl text-center">
                <h2 className="text-3xl font-bold text-red-500 mb-8">Votez pour éliminer !</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {alivePlayers.filter(pid => pid !== playerId).map(pid => {
                        const pName = players.find(p => p.id === pid)?.name || 'Inconnu';
                        return (
                            <button 
                                key={pid}
                                onClick={() => sendVote(pid)}
                                className="bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500 p-6 rounded-xl transition-all group"
                            >
                                <Skull className="w-8 h-8 mx-auto mb-2 text-gray-500 group-hover:text-red-500 transition-colors" />
                                <span className="font-bold text-lg text-white group-hover:text-red-200">{pName}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
        
        {/* MR WHITE GUESS */}
        {currentPhase === 'mrwhite_guess' && (
             <div className="w-full max-w-md text-center bg-white/10 p-8 rounded-2xl backdrop-blur-md">
                 <h2 className="text-2xl font-bold text-white mb-4">Mr. White a été démasqué !</h2>
                 <p className="text-gray-300 mb-6">Il a une chance de gagner s'il trouve le mot des Civils.</p>
                 
                 {myRole === 'MR_WHITE' && eliminatedPlayerId === playerId ? (
                     <div className="space-y-4">
                         <Input 
                            placeholder="Quel est le mot des Civils ?" 
                            value={mrWhiteGuess}
                            onChange={e => setMrWhiteGuess(e.target.value)}
                         />
                         <Button onClick={sendMrWhiteGuess} className="w-full bg-white text-black hover:bg-gray-200">
                             Tenter ma chance
                         </Button>
                     </div>
                 ) : (
                     <div className="flex items-center justify-center gap-2 text-gray-400">
                         <Loader2 className="w-4 h-4 animate-spin" />
                         Mr. White réfléchit...
                     </div>
                 )}
             </div>
        )}

        {/* GAME OVER / RESULTS */}
        {(currentPhase === 'results' || currentPhase === 'game_over') && (
            <div className="text-center space-y-8 animate-in zoom-in duration-500">
                <div className="relative inline-block">
                    <Crown className={`w-24 h-24 mx-auto mb-4 ${winner === 'CIVILS' ? 'text-blue-500' : 'text-red-500'}`} />
                </div>
                
                <h2 className="text-5xl font-black text-white uppercase tracking-tighter">
                    {winner === 'CIVILS' ? 'Victoire des Civils' : winner === 'MR_WHITE' ? 'Victoire de Mr. White' : 'Victoire des Imposteurs'}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                    <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30">
                        <span className="text-xs text-blue-300 uppercase font-bold">Mot Civil</span>
                        <p className="text-2xl font-bold text-white">{civilWord}</p>
                    </div>
                    <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30">
                        <span className="text-xs text-red-300 uppercase font-bold">Mot Undercover</span>
                        <p className="text-2xl font-bold text-white">{undercoverWord}</p>
                    </div>
                </div>

                <div className="bg-white/5 rounded-xl p-6 max-w-2xl mx-auto">
                    <h3 className="text-lg font-bold text-gray-400 mb-4 text-left">Rôles dévoilés</h3>
                    <div className="grid gap-2">
                        {players.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                <span className="font-bold text-white">{p.name}</span>
                                <span className={`font-mono text-sm font-bold ${getRoleColor(roles[p.id])}`}>
                                    {roles[p.id]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 w-full max-w-2xl mx-auto">
                    <Button variant="outline" className="flex-1 h-14" onClick={() => router.push(`/room/${roomCode}`)}>
                        <Home className="w-5 h-5 mr-2" /> Retour au lobby
                    </Button>
                    {isHost && currentPhase !== 'game_over' && (
                        <Button size="lg" onClick={nextGameRound} className="bg-white text-black hover:bg-gray-200 h-14 px-8 text-lg font-bold rounded-xl flex-1">
                            Manche suivante
                        </Button>
                    )}
                    {(!isHost || currentPhase === 'game_over') && (
                        <Button className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push('/')}>
                            <LogOut className="w-5 h-5 mr-2" /> Quitter
                        </Button>
                    )}
                </div>
            </div>
        )}

      </div>
    </GameLayout>
  );
}