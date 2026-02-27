'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Crown, Skull } from 'lucide-react';
import { toast } from 'sonner';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Phase = 'setup' | 'roles' | 'clues' | 'discussion' | 'vote' | 'mrwhite_guess' | 'results' | 'game_over';

interface UndercoverProps {
  roomCode: string;
}

interface Clue {
  playerId: string;
  text: string;
  timestamp: number;
}

export default function Undercover({ roomCode }: UndercoverProps) {
  // Sync with DB
  const {
    gameState,
    isHost,
    players,
    playerId,
    updateSettings,
    startGame,
    updateRoundData,
    nextRound,
    submitAnswer,
    setGameStatus
  } = useGameSync(roomCode, 'undercover');

  // Local Settings State (for Host)
  const [settings, setSettings] = useState({
    rounds: 1,
    mrWhiteEnabled: true,
    discussionTime: 60,
    voteTime: 30,
    difficulty: 'normal'
  });

  // Local UI State
  const [userClue, setUserClue] = useState('');
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  // Derived State from GameState
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

  // Sync Settings from DB (for clients)
  useEffect(() => {
    if (gameState?.settings) {
       setSettings(prev => ({
           ...prev,
           ...gameState.settings
       }));
    }
  }, [gameState?.settings]);

  // Host updates DB settings
  useEffect(() => {
    if (isHost) {
        if (JSON.stringify(settings) !== JSON.stringify(gameState?.settings)) {
            updateSettings(settings);
        }
    }
  }, [settings, isHost, updateSettings, gameState?.settings]);

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

        // 2. Clues Phase -> Discussion Phase (when all clues given)
        if (currentPhase === 'clues') {
            // Check if all alive players have given a clue IN THIS ROUND of clues
            // We track clues in `roundData.clues`.
            // We need to know how many clues expected.
            // Wait, usually clues are cleared every sub-round? 
            // Or we just append.
            // Let's assume one clue per player per "round of discussion".
            // We can check if `currentSpeaker` became null or looped back?
            // See `handleClueSubmit` logic below.
        }

        // 3. Discussion Phase -> Vote Phase (after time)
        if (currentPhase === 'discussion' && timeLeft === 0) {
             await updateRoundData({
                 ...roundData,
                 phase: 'vote',
                 endTime: Date.now() + settings.voteTime * 1000
             });
        }

        // 4. Vote Phase -> Results/Elimination (after time)
        if (currentPhase === 'vote' && timeLeft === 0) {
             await processVotes();
        }
    };

    managePhases();
  }, [isHost, currentPhase, timeLeft, roundData, alivePlayers, settings.voteTime]);


  const startNewGame = async () => {
    if (!isHost) return;
    if (players.length < 3) { // Should be 4 per spec, but 3 for testing
        toast.error("Il faut au moins 4 joueurs !");
        return;
    }

    try {
        const res = await fetch(`/api/games/undercover?count=${settings.rounds}`);
        const words = await res.json();
        
        if (!words || words.length === 0) return;

        // Init Game
        const firstPair = Array.isArray(words) ? words[0] : words;
        const remainingQueue = Array.isArray(words) ? words.slice(1) : [];

        // Assign Roles
        const { newRoles, alive } = assignRoles(players, settings.mrWhiteEnabled);

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
            clues: [] // Clear clues for new round? Or keep history? Better keep history but separate rounds.
            // For simplicity, we keep adding to clues array.
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
    
    // Optimistic UI? No, wait for server.
    // We send clue to host via submitAnswer (or direct update if we allowed clients to update roundData, but we don't).
    // Actually, for turn-based, we need Host to validate turn.
    // But `useGameSync` logic: Host watches `answers`.
    
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
                            endTime: Date.now() + settings.discussionTime * 1000
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
  }, [isHost, gameState?.answers, currentPhase, currentSpeakerId, clues, alivePlayers, settings.discussionTime, eliminatedPlayerId, civilWord]);


  // --- RENDER ---

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRoundNumber}
      maxRounds={settings.rounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameCode={roomCode}
      gameTitle="Undercover"
      isHost={isHost}
      gameStarted={currentPhase !== 'setup'}
      onStartGame={startNewGame}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto min-h-[400px]">
        
        {/* SETUP PHASE */}
        {currentPhase === 'setup' && (
            <div className="text-center space-y-6 bg-white/10 p-8 rounded-xl backdrop-blur-md">
                <h2 className="text-3xl font-bold">Configuration</h2>
                {isHost ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Manches</label>
                            <Input type="number" min={1} max={5} value={settings.rounds} onChange={e => setSettings({...settings, rounds: parseInt(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Mr. White</label>
                            <div className="flex gap-2">
                                <Button variant={settings.mrWhiteEnabled ? "primary" : "outline"} onClick={() => setSettings({...settings, mrWhiteEnabled: true})}>Oui</Button>
                                <Button variant={!settings.mrWhiteEnabled ? "primary" : "outline"} onClick={() => setSettings({...settings, mrWhiteEnabled: false})}>Non</Button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Discussion (sec)</label>
                            <Input type="number" min={30} max={180} value={settings.discussionTime} onChange={e => setSettings({...settings, discussionTime: parseInt(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-1">Vote (sec)</label>
                            <Input type="number" min={15} max={60} value={settings.voteTime} onChange={e => setSettings({...settings, voteTime: parseInt(e.target.value)})} />
                        </div>
                        <div className="col-span-full">
                             <Button size="lg" className="w-full" onClick={startNewGame}>Lancer la partie</Button>
                        </div>
                    </div>
                ) : (
                    <p>En attente de l'hôte...</p>
                )}
            </div>
        )}

        {/* ROLES PHASE */}
        {currentPhase === 'roles' && (
            <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in">
                <h2 className="text-2xl mb-4">Ton rôle est...</h2>
                <div className="bg-black/40 p-8 rounded-full w-48 h-48 flex items-center justify-center border-4 border-white/20">
                    {myRole === 'CIVIL' && <User className="w-20 h-20 text-blue-400" />}
                    {myRole === 'UNDERCOVER' && <EyeOff className="w-20 h-20 text-red-400" />}
                    {myRole === 'MR_WHITE' && <AlertTriangle className="w-20 h-20 text-yellow-400" />}
                </div>
                <h3 className="text-4xl font-black mt-6 text-white uppercase">{myRole?.replace('_', ' ')}</h3>
                
                {myRole === 'MR_WHITE' ? (
                    <p className="mt-4 text-xl text-yellow-200">Tu n'as pas de mot ! Essaye de deviner.</p>
                ) : (
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-400">Ton mot secret :</p>
                        <p className="text-3xl font-bold text-white bg-white/10 px-6 py-2 rounded-lg mt-2">
                            {myRole === 'CIVIL' ? civilWord : undercoverWord}
                        </p>
                    </div>
                )}
            </div>
        )}

        {/* CLUES PHASE */}
        {currentPhase === 'clues' && (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-center">Phase d'Indices</h2>
                
                {/* Clues List */}
                <div className="bg-black/20 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto space-y-2">
                    {clues.map((c, i) => {
                        const p = players.find(pl => pl.id === c.playerId);
                        return (
                            <div key={i} className="bg-white/5 p-3 rounded-lg flex items-center gap-3">
                                <div className="font-bold text-blue-300">{p?.name || 'Inconnu'}:</div>
                                <div className="text-lg">"{c.text}"</div>
                            </div>
                        );
                    })}
                    {clues.length === 0 && <p className="text-gray-500 text-center italic mt-10">Aucun indice pour le moment...</p>}
                </div>

                {/* Input Area */}
                <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
                    <div className="max-w-4xl mx-auto">
                        {isMyTurn ? (
                            <div className="flex gap-2">
                                <Input 
                                    value={userClue} 
                                    onChange={e => setUserClue(e.target.value)} 
                                    placeholder="Écris ton indice..."
                                    className="text-lg"
                                    autoFocus
                                />
                                <Button size="lg" onClick={sendClue}>Envoyer</Button>
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-black/40 rounded-lg backdrop-blur text-gray-300">
                                {currentSpeakerId ? `C'est au tour de ${players.find(p => p.id === currentSpeakerId)?.name}...` : 'Chargement...'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* DISCUSSION PHASE */}
        {currentPhase === 'discussion' && (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-16 h-16 text-green-400 mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold mb-2">Discussion !</h2>
                <p className="text-xl text-gray-300">Débattez et trouvez l'intrus.</p>
                <div className="mt-8 text-6xl font-black font-mono text-white/80">{timeLeft}s</div>
                
                <div className="mt-8 w-full max-w-2xl bg-black/20 p-4 rounded-xl">
                    <h3 className="text-sm text-gray-400 mb-2">Rappel des indices :</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                        {clues.map((c, i) => {
                             const p = players.find(pl => pl.id === c.playerId);
                             return (
                                 <div key={i} className="text-sm"><span className="font-bold text-blue-300">{p?.name}:</span> {c.text}</div>
                             );
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* VOTE PHASE */}
        {currentPhase === 'vote' && (
            <div className="w-full text-center">
                <h2 className="text-3xl font-bold mb-6 text-red-400">Votez pour éliminer !</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {alivePlayers.map(pid => {
                        const p = players.find(pl => pl.id === pid);
                        if (!p || pid === playerId) return null; // Can't vote for self? Usually yes you can, but let's disable for UX
                        // Actually in Undercover you can vote for anyone.
                        
                        return (
                            <button 
                                key={pid}
                                onClick={() => sendVote(pid)}
                                className="bg-white/10 hover:bg-red-500/20 border-2 border-white/10 hover:border-red-500 p-6 rounded-xl transition-all flex flex-col items-center gap-2 group"
                            >
                                <User className="w-12 h-12 text-gray-400 group-hover:text-red-400" />
                                <span className="font-bold text-lg">{p?.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {/* MR WHITE GUESS */}
        {currentPhase === 'mrwhite_guess' && (
            <div className="flex flex-col items-center justify-center h-full">
                <AlertTriangle className="w-20 h-20 text-yellow-400 mb-4" />
                <h2 className="text-3xl font-bold mb-2">Mr. White a été démasqué !</h2>
                <p className="mb-6">Il a une dernière chance de gagner en devinant le mot des Civils.</p>
                
                {myRole === 'MR_WHITE' && eliminatedPlayerId === playerId ? (
                    <div className="flex gap-2 w-full max-w-md">
                        <Input 
                            value={mrWhiteGuess} 
                            onChange={e => setMrWhiteGuess(e.target.value)} 
                            placeholder="Devine le mot..." 
                        />
                        <Button onClick={sendMrWhiteGuess}>Valider</Button>
                    </div>
                ) : (
                    <p className="animate-pulse">Mr. White réfléchit...</p>
                )}
            </div>
        )}

        {/* RESULTS / GAME OVER */}
        {(currentPhase === 'results' || currentPhase === 'game_over') && (
            <div className="flex flex-col items-center justify-center h-full animate-in zoom-in">
                {winner === 'CIVILS' && <Crown className="w-24 h-24 text-blue-400 mb-4" />}
                {winner === 'IMPOSTORS' && <Skull className="w-24 h-24 text-red-400 mb-4" />}
                {winner === 'MR_WHITE' && <AlertTriangle className="w-24 h-24 text-yellow-400 mb-4" />}
                
                <h2 className="text-4xl font-black mb-2">
                    {winner === 'CIVILS' && 'Les Civils ont gagné !'}
                    {winner === 'IMPOSTORS' && 'Les Imposteurs ont gagné !'}
                    {winner === 'MR_WHITE' && 'Mr. White a gagné !'}
                </h2>
                
                <div className="bg-white/10 p-6 rounded-xl mt-8 w-full max-w-lg">
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                        <span>Mot Civil :</span>
                        <span className="font-bold text-xl">{civilWord}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                        <span>Mot Undercover :</span>
                        <span className="font-bold text-xl">{undercoverWord}</span>
                    </div>
                    
                    <div className="space-y-2 mt-4">
                        <h3 className="text-sm text-gray-400">Rôles :</h3>
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between">
                                <span>{p.name}</span>
                                <span className={`font-bold ${
                                    roles[p.id] === 'CIVIL' ? 'text-blue-400' : 
                                    roles[p.id] === 'UNDERCOVER' ? 'text-red-400' : 'text-yellow-400'
                                }`}>
                                    {roles[p.id]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {isHost && (
                    <Button size="lg" className="mt-8" onClick={nextGameRound}>
                        {currentRoundNumber < settings.rounds ? 'Manche Suivante' : 'Retour au menu'}
                    </Button>
                )}
            </div>
        )}
      </div>
    </GameLayout>
  );
}
