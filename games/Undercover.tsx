'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Crown, Skull, Loader2, Send, Home, LogOut } from 'lucide-react';
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
    setGameStatus
  } = useGameSync(roomCode, 'undercover');

  // Local UI State
  const [userClue, setUserClue] = useState('');
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Derived State from GameState
  const settings = gameState?.settings || {};
  const rounds = Number(settings.rounds || 1);
  const mrWhiteEnabled = settings.mrWhiteEnabled === 'true' || settings.mrWhiteEnabled === true; // Handle string or bool
  const discussionTime = Number(settings.discussionTime || 60);
  const voteTime = Number(settings.voteTime || 30);

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
  const winner = roundData.winner as string | null; // 'CIVILS', 'IMPOSTORS', 'MR_WHITE'
  const currentRoundNumber = gameState?.current_round || 0;
  
  // Players Map
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  const isMyTurn = currentPhase === 'clues' && currentSpeakerId === playerId;
  const isAlive = playerId && alivePlayers.includes(playerId);

  // Timer Sync
  useEffect(() => {
    if (roundData.endTime) {
        const diff = Math.ceil((roundData.endTime - Date.now()) / 1000);
        setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [roundData.endTime]);

  // Timer Tick
  useEffect(() => {
    if (timeLeft > 0) {
        const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(timer);
    }
  }, [timeLeft]);

  // --- HOST LOGIC ---

  // Phase Management
  useEffect(() => {
    if (!isHost) return;

    const managePhases = async () => {
        // 1. Roles Phase -> Clues Phase (after 5s)
        if (currentPhase === 'roles' && timeLeft === 0) {
            await updateRoundData({
                ...roundData,
                phase: 'clues',
                currentSpeaker: alivePlayers[0], // Start with first alive player
                endTime: null // No timer for clues (or per-turn timer?)
            });
        }

        // 3. Discussion Phase -> Vote Phase (after time)
        if (currentPhase === 'discussion' && timeLeft === 0) {
             await updateRoundData({
                 ...roundData,
                 phase: 'vote',
                 endTime: Date.now() + voteTime * 1000
             });
        }

        // 4. Vote Phase -> Results/Elimination (after time)
        if (currentPhase === 'vote' && timeLeft === 0) {
             await processVotes();
        }
    };

    managePhases();
  }, [isHost, currentPhase, timeLeft, roundData, alivePlayers, voteTime]);


  const startNewGame = async () => {
    if (!isHost) return;
    if (players.length < 3) { // Should be 4 per spec, but 3 for testing
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
            queue: remainingQueue,
            endTime: Date.now() + 5000 // 5s to see roles
        });
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
            queue: remaining,
            endTime: Date.now() + 5000
      });
  };

  // --- CLIENT ACTIONS ---

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
        
        // Check for Clues
        if (currentPhase === 'clues' && currentSpeakerId) {
            const speakerAnswer = answers[currentSpeakerId];
            if (speakerAnswer && speakerAnswer.type === 'clue') {
                // Check if this clue is new (compare timestamp or text)
                const lastClue = clues.find(c => c.playerId === currentSpeakerId && c.text === speakerAnswer.text);
                if (!lastClue) {
                    // New clue!
                    const newClues = [...clues, {
                        playerId: currentSpeakerId,
                        text: speakerAnswer.text,
                        timestamp: speakerAnswer.timestamp
                    }];
                    
                    // Next speaker
                    const currentIndex = alivePlayers.indexOf(currentSpeakerId);
                    const nextIndex = (currentIndex + 1) % alivePlayers.length;
                    const nextSpeaker = alivePlayers[nextIndex];
                    
                    // If we looped back to first speaker of this round?
                    // We need to know who started. 
                    // Let's assume `alivePlayers` order is fixed.
                    // If nextIndex === 0, everyone has spoken.
                    
                    if (nextIndex === 0) {
                        // All spoken -> Discussion
                        await updateRoundData({
                            ...roundData,
                            clues: newClues,
                            currentSpeaker: null,
                            phase: 'discussion',
                            endTime: Date.now() + discussionTime * 1000
                        });
                    } else {
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
             <div className="flex flex-col items-center animate-in zoom-in duration-500">
                <div className="bg-slate-900/80 p-8 rounded-2xl border border-white/10 text-center max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                    <h3 className="text-2xl font-bold text-gray-400 mb-6">Votre rôle est</h3>
                    
                    <div className="mb-8 flex justify-center">
                        <div className={`p-6 rounded-full bg-white/5 border-2 ${myRole === 'CIVIL' ? 'border-blue-500' : 'border-red-500'}`}>
                             {getRoleIcon(myRole)}
                        </div>
                    </div>
                    
                    <h2 className={`text-4xl font-black mb-4 ${getRoleColor(myRole)}`}>
                        {myRole === 'CIVIL' ? 'CIVIL' : myRole === 'UNDERCOVER' ? 'UNDERCOVER' : 'MR. WHITE'}
                    </h2>

                    <div className="bg-white/5 p-4 rounded-xl">
                        <p className="text-sm text-gray-400 mb-1">Votre mot secret :</p>
                        <p className="text-2xl font-bold text-white tracking-widest uppercase">
                            {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                        </p>
                    </div>
                </div>
                <p className="mt-8 text-red-400 animate-pulse">Début de la partie dans {timeLeft}s...</p>
             </div>
        )}

        {/* GAMEPLAY: CLUES & DISCUSSION */}
        {(currentPhase === 'clues' || currentPhase === 'discussion') && (
            <div className="w-full max-w-3xl space-y-6">
                 {/* Clues History */}
                 <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/10 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
                     <h3 className="text-lg font-bold text-gray-400 mb-4 sticky top-0 bg-slate-900/90 py-2 z-10 border-b border-white/5">
                         Indices
                     </h3>
                     <div className="space-y-3">
                         {clues.map((c, idx) => {
                             const pName = players.find(p => p.id === c.playerId)?.name || 'Inconnu';
                             return (
                                 <div key={idx} className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                     <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                                         {pName.charAt(0)}
                                     </div>
                                     <div className="bg-white/5 px-4 py-2 rounded-r-xl rounded-bl-xl text-white">
                                         <span className="text-xs text-gray-500 block mb-0.5">{pName}</span>
                                         "{c.text}"
                                     </div>
                                 </div>
                             );
                         })}
                         {clues.length === 0 && (
                             <div className="text-center text-gray-600 italic py-10">Aucun indice pour le moment...</div>
                         )}
                     </div>
                 </div>

                 {/* Input Area (Only for Clues phase & Current Speaker) */}
                 {currentPhase === 'clues' && (
                     <div className="bg-slate-900/80 p-4 rounded-xl border border-red-500/30">
                         {isMyTurn ? (
                             <div className="flex gap-2">
                                 <Input 
                                    placeholder="Donnez votre indice (1 mot)..." 
                                    value={userClue}
                                    onChange={e => setUserClue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendClue()}
                                    className="bg-slate-800 border-white/10"
                                    autoFocus
                                 />
                                 <Button onClick={sendClue} className="bg-red-600 hover:bg-red-500">
                                     <Send className="w-4 h-4" />
                                 </Button>
                             </div>
                         ) : (
                             <div className="text-center text-gray-400 flex items-center justify-center gap-2">
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 En attente de {players.find(p => p.id === currentSpeakerId)?.name || '...'}
                             </div>
                         )}
                     </div>
                 )}
                 
                 {currentPhase === 'discussion' && (
                     <div className="text-center bg-red-500/10 p-4 rounded-xl border border-red-500/30 text-red-200 animate-pulse">
                         🗣️ Discussion libre ! Débattez pour trouver l'intrus.
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