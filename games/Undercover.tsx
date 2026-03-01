'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Crown, Skull, Loader2, Send, Home, LogOut, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client'; // Fixed import

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
    undercover, // SQL Data
    sendMove,
    getTimeLeft,
    updateRoundData, // Need this for legacy sync/notifications
    resetAllPlayersReady, // New function
    startGame,
    nextRound,
    submitAnswer,
    setPlayerReady,
    moves,
    setGameStatus, // Need this for game over
    roomId // UUID from hook
  } = useGameSync(roomCode, 'undercover');

  // SQL State Extraction
   const game = undercover?.game || {};
   const currentPhase = (game.phase as Phase) || 'setup';
   const roles = useMemo(() => {
       const r: Record<string, Role> = {};
       undercover?.roles?.forEach((p: any) => r[p.player_id] = p.role as Role);
       return r;
   }, [undercover?.roles]);
   
   const myRole = playerId ? roles[playerId] : null;
   const civilWord = game.civil_word;
   const undercoverWord = game.undercover_word;
   const currentSpeakerId = game.current_speaker_id;
   const currentClueRound = game.current_clue_round || 1;
   const clues = useMemo(() => {
       return undercover?.clues?.map((c: any) => ({
           playerId: c.player_id,
           text: c.text,
           timestamp: new Date(c.created_at).getTime()
       })) || [];
   }, [undercover?.clues]);
 
   // Alive players logic (from roles table)
   const alivePlayers = useMemo(() => {
       return undercover?.roles?.filter((p: any) => p.is_alive).map((p: any) => p.player_id) || [];
   }, [undercover?.roles]);
 
   const eliminatedPlayerId = game.eliminated_player_id;
   const winner = game.winner;

   // Local UI State
   const [userClue, setUserClue] = useState('');
   const [mrWhiteGuess, setMrWhiteGuess] = useState('');
   const [timeLeft, setTimeLeft] = useState(0);

   // Settings
   const settings = gameState?.settings || {};
   const rounds = Number(settings.rounds || 1);
   const mrWhiteEnabled = settings.mrWhiteEnabled === 'true' || settings.mrWhiteEnabled === true;
   const voteTime = Number(settings.voteTime || 30);
   const playersKnowRole = settings.playersKnowRole === 'true' || settings.playersKnowRole === true;
   const clueRoundsBeforeVote = Number(settings.clueRounds || 3);
   const undercoverCount = Number(settings.undercoverCount || 1);

   const currentRoundNumber = gameState?.current_round || 0;
   
   // Ready Status from `players` table
   const readyPlayersFromTable = useMemo(() => {
       return players.filter((p: any) => p.is_ready).map(p => p.id);
   }, [players]);
   const amIReadyRobust = playerId && readyPlayersFromTable.includes(playerId);
   const [showRole, setShowRole] = useState(false);

   // Notification (Fake Sync for now or use Toast directly on events)
   // We can use `moves` stream to trigger toasts if needed, or rely on phase changes.
   
   // Legacy alias
   const roundData = gameState?.round_data || {};

   // Players Map
   const playersMap = useMemo(() => {
     // Undercover doesn't use scores, but we keep the map for compatibility
     return players.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {} as Record<string, number>);
   }, [players]);
 
   const isMyTurn = currentPhase === 'clues' && currentSpeakerId === playerId;
   const isAlive = playerId && alivePlayers.includes(playerId);
   
   // Ready Status
   const readyPlayers = (gameState?.round_data?.readyPlayers as string[]) || []; // Legacy fallback
   
   // Merge legacy and new
   const allReadyIds = useMemo(() => {
       return Array.from(new Set([...readyPlayers, ...readyPlayersFromTable]));
   }, [readyPlayers, readyPlayersFromTable]);
 
   const isPlayerReady = (pid: string) => allReadyIds.includes(pid);
   // amIReady removed (redundant with amIReadyRobust or can be alias)
   const amIReady = amIReadyRobust; 

   const lastNotificationId = useRef<string>('');
   const notification = (gameState?.round_data?.notification as { id: string, message: string, type: 'success' | 'info' | 'error' } | null) || null;
   const skipVotes = (gameState?.round_data?.skipVotes as string[]) || [];

   // Notification Sync
   useEffect(() => {
     if (notification && notification.id !== lastNotificationId.current) {
         lastNotificationId.current = notification.id;
         if (notification.type === 'success') toast.success(notification.message);
         else if (notification.type === 'error') toast.error(notification.message);
         else toast.info(notification.message);
     }
   }, [notification]);

   // Timer Sync using Server Time
   useEffect(() => {
     // Logic from roundData endTime if needed or use SQL game end time?
     // SQL game table doesn't have endTime yet?
     // We removed discussionTime, but voteTime is still there.
     // We need to add `end_time` to SQL `undercover_games` or rely on `roundData` for timer sync.
     // The user wants SQL for "everything".
     // Let's assume we rely on `roundData` for TIMER SYNC only as it's ephemeral, OR add it to SQL.
     // Given constraints, let's keep timer on roundData for now as it's just visual sync.
     
     const endTime = (gameState?.round_data?.endTime as number) || null;
     
     if (endTime) {
         setTimeLeft(getTimeLeft(endTime));
         const interval = setInterval(() => {
             const tl = getTimeLeft(endTime);
             setTimeLeft(tl);
             if (tl <= 0) clearInterval(interval);
         }, 250);
         return () => clearInterval(interval);
     } else {
         setTimeLeft(0);
     }
   }, [gameState?.round_data?.endTime, getTimeLeft]);
 
 
   // Fix: Force refresh if roles are present but phase is weird
   useEffect(() => {
       if (currentPhase === 'roles' && !myRole && roles && playerId && roles[playerId]) {
           console.log("Forcing role refresh", roles[playerId]);
       }
   }, [currentPhase, myRole, roles, playerId]);
 
   // --- HOST LOGIC ---
 
   // Phase Management
   useEffect(() => {
     if (!isHost) return;
 
     const managePhases = async () => {
         // 1. Roles Phase -> Clues Phase (Wait for ALL Ready - NO TIMER)
         if (currentPhase === 'roles') {
              // Check robust readiness
              const allReady = alivePlayers.every(id => allReadyIds.includes(id));
              
              if (allReady && alivePlayers.length > 0) { 
                  // Also update SQL game state
                  await supabase.from('undercover_games').update({
                      phase: 'clues',
                      current_speaker_id: alivePlayers[0],
                      current_clue_round: 1
                  }).eq('room_id', roomCode);
                  
                  // Legacy sync for notification
                  await updateRoundData({
                      phase: 'clues',
                      notification: { id: Date.now().toString(), message: "Tout le monde est prêt ! Début des indices.", type: 'info' }
                  });
              }
         }
 
         // 3. Discussion Phase -> Vote Phase (after time OR skipped)
         if (currentPhase === 'discussion' && timeLeft === 0 && gameState?.round_data?.endTime) {
              await supabase.from('undercover_games').update({
                  phase: 'vote'
              }).eq('room_id', roomCode);
              
              await updateRoundData({
                  phase: 'vote',
                  endTime: Date.now() + voteTime * 1000,
                  notification: { id: Date.now().toString(), message: "Fin de la discussion ! Place au vote.", type: 'info' }
              });
         }

         // 4. Vote Phase -> Results/Elimination (after time)
         if (currentPhase === 'vote' && timeLeft === 0 && gameState?.round_data?.endTime) {
              await processVotes();
         }
     };
 
     managePhases();
   }, [isHost, currentPhase, timeLeft, alivePlayers, voteTime, allReadyIds, gameState]);


  const notifyAll = async (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      await updateRoundData({
          ...roundData,
          notification: {
              id: Date.now().toString(),
              message,
              type
          }
      });
  };

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

        // Reset player ready status in DB
        if (resetAllPlayersReady) await resetAllPlayersReady();

        // Init Game
        const firstPair = Array.isArray(words) ? words[0] : words;
        const remainingQueue = Array.isArray(words) ? words.slice(1) : [];

        // Assign Roles
        const { newRoles, alive } = assignRoles(players, mrWhiteEnabled, undercoverCount);

        // SQL Initialization
        // 1. Upsert Game State
        const { error: gameError } = await supabase.from('undercover_games').upsert({
            room_id: roomId, // Use UUID from hook
            phase: 'roles',
            civil_word: firstPair.civilWord,
            undercover_word: firstPair.undercoverWord,
            current_speaker_id: null,
            current_clue_round: 1,
            created_at: new Date().toISOString()
        }, { onConflict: 'room_id' });
        
        if (gameError) {
             console.error("Game Init Error", gameError);
             toast.error("Erreur init jeu");
             return;
        }

        // 2. Upsert Players Roles
        const playerInserts = players.map(p => ({
            room_id: roomId, // Use UUID from hook
            player_id: p.id,
            role: newRoles[p.id],
            is_alive: true
        }));
        
        const { error: playersError } = await supabase.from('undercover_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });

        if (playersError) {
             console.error("Players Init Error", playersError);
        }

        // 3. Reset Clues & Votes
        await supabase.from('undercover_clues').delete().eq('room_id', roomId);
        await supabase.from('undercover_votes').delete().eq('room_id', roomId);

        // Legacy support (optional, for notifications)
        await updateRoundData({
            phase: 'roles',
            notification: { id: Date.now().toString(), message: "Partie lancée ! Révélation des rôles...", type: 'success' }
        });
        
    } catch (e) {
        console.error(e);
        toast.error("Erreur au démarrage");
    }
  };

  const assignRoles = (allPlayers: any[], includeMrWhite: boolean, ucCount: number) => {
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const newRoles: Record<string, Role> = {};
    const alive: string[] = [];

    let available = [...shuffled];
    
    // Undercovers
    for (let i = 0; i < ucCount; i++) {
        const undercover = available.pop();
        if (undercover) newRoles[undercover.id] = 'UNDERCOVER';
    }

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
    // We need to fetch votes from SQL `undercover_votes` table now
    const { data: votesData } = await supabase.from('undercover_votes').select('*').eq('room_id', roomCode);
    
    const voteCounts: Record<string, number> = {};
    
    // Count votes
    votesData?.forEach((v: any) => {
        if (v.target_id) {
            voteCounts[v.target_id] = (voteCounts[v.target_id] || 0) + 1;
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
        // Tie logic
        await updateRoundData({
            phase: 'vote',
            endTime: Date.now() + voteTime * 1000,
            notification: { id: Date.now().toString(), message: "Égalité ! Revotez !", type: 'error' }
        });
        
        // Reset SQL votes?
        await supabase.from('undercover_votes').delete().eq('room_id', roomCode);
        return;
    }

    // Elimination
    const eliminatedRole = roles[eliminatedId];
    
    if (eliminatedRole === 'MR_WHITE') {
        // Update SQL game state
        await supabase.from('undercover_games').update({
            phase: 'mrwhite_guess',
            eliminated_player_id: eliminatedId
        }).eq('room_id', roomCode);
        
        await updateRoundData({
            notification: { id: Date.now().toString(), message: "Mr. White trouvé ! Il peut se sauver...", type: 'success' }
        });
        return;
    }

    // Standard Elimination
    await handleElimination(eliminatedId);
  };

  const handleElimination = async (eliminatedId: string) => {
    // Update player status in SQL
    await supabase.from('undercover_players').update({ is_alive: false }).eq('room_id', roomCode).eq('player_id', eliminatedId);

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
        await supabase.from('undercover_games').update({
            phase: 'clues',
            current_speaker_id: newAlive[0],
            eliminated_player_id: eliminatedId
        }).eq('room_id', roomCode);
        
        await updateRoundData({
            phase: 'clues',
            notification: { id: Date.now().toString(), message: "Un joueur a été éliminé. La partie continue !", type: 'info' }
        });
    }
  };

  const finishGame = async (winner: string, alive: string[]) => {
      await supabase.from('undercover_games').update({
          phase: 'results',
          winner: winner
      }).eq('room_id', roomCode);

      await updateRoundData({
          phase: 'results',
          notification: { id: Date.now().toString(), message: "Fin de la partie !", type: 'success' }
      });
  };

  const nextGameRound = async () => {
      if (!isHost) return;
      // We need to fetch queue from somewhere or just fetch new words
      // Since we are SQL based now, we don't store queue in JSON roundData ideally.
      // Let's just fetch new words API again for simplicity
      
      try {
          const res = await fetch(`/api/games/undercover?count=1`);
          const words = await res.json();
          const nextPair = Array.isArray(words) ? words[0] : words;
          
          if (!nextPair) return;

          const { newRoles, alive } = assignRoles(players, settings.mrWhiteEnabled, undercoverCount);

          if (resetAllPlayersReady) await resetAllPlayersReady();

          // SQL Update
          await supabase.from('undercover_games').update({
              phase: 'roles',
              civil_word: nextPair.civilWord,
              undercover_word: nextPair.undercoverWord,
              current_speaker_id: null,
              current_clue_round: 1,
              winner: null,
              eliminated_player_id: null
          }).eq('room_id', roomCode);

          // Reset Tables
          await supabase.from('undercover_clues').delete().eq('room_id', roomCode);
          await supabase.from('undercover_votes').delete().eq('room_id', roomCode);
          
          // Re-insert players with new roles
          const playerInserts = players.map(p => ({
              room_id: roomCode,
              player_id: p.id,
              role: newRoles[p.id],
              is_alive: true
          }));
          await supabase.from('undercover_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });
          
          toast.success("Manche suivante !");
      } catch (e) {
          console.error(e);
      }
  };

  // --- CLIENT ACTIONS ---

  const sendReady = async () => {
    if (amIReadyRobust) return;
    
    // Legacy update (keep for compatibility if needed)
    // await submitAnswer({ type: 'ready' });
    
    // Robust update
    if (setPlayerReady) {
        await setPlayerReady(true);
    }
  };

  const sendClue = async () => {
    if (!userClue.trim()) return;
    await sendMove('clue', {
        text: userClue,
        timestamp: Date.now()
    });
    setUserClue('');
  };

  const sendVote = async (targetId: string) => {
    await sendMove('vote', {
        targetId
    });
    toast.success('Vote enregistré');
  };

  const sendMrWhiteGuess = async () => {
    if (!mrWhiteGuess.trim()) return;
    await sendMove('guess', {
        text: mrWhiteGuess
    });
  };

  const toggleSkipVote = async () => {
    if (!playerId) return;
    
    // We send an intent to toggle
    // Host will process logic
    await sendMove('skip_vote', {
        action: skipVotes.includes(playerId) ? 'remove' : 'add'
    });
  };

  // Host listening for answers/clues via game_moves (Robust)
  useEffect(() => {
    if (!isHost || !moves) return;

    // Filter moves for current round/phase if needed
    // Ideally we track which moves we have processed.
    // But since `moves` is an array that grows, we can re-process or just process new ones.
    // A simple way is to use `useEffect` on `moves.length` and process the last one.
    // BUT, we need to rebuild state from scratch OR process incrementally.
    // Given the previous architecture was snapshot-based, let's keep `roundData` as the snapshot
    // and use `moves` as the input stream.
    
    const processLastMove = async () => {
        if (moves.length === 0) return;
        const lastMove = moves[moves.length - 1];
        
        // Ignore if processed? We don't have a "processed" flag easily without local state.
        // We can check if the move ID is already in our processed set.
        // But `moves` comes from `useGameRoom` which is refreshed.
        
        // Actually, we should probably iterate over all unprocessed moves.
        // But for simplicity, let's assume we handle them as they arrive (Realtime).
        // Wait, `moves` contains ALL history.
        // We need to filter by current game phase or ID.
        // Since we don't have a `gameId` in `moves` (just room_id), we might re-process old moves.
        // To fix this, we should filter moves created AFTER the current round started.
        // But `currentRound` start time is in `roundData`.
        
        // SIMPLIFICATION:
        // We only process the LATEST move if it's new.
        // We can store `lastProcessedMoveId` in a ref.
    };
    
    // Logic extracted to separate effect below
  }, [moves]);

  const lastProcessedMoveId = useRef<string | null>(null);

  useEffect(() => {
      if (!isHost || !moves || moves.length === 0) return;

      const processNewMoves = async () => {
          // Process all new moves
          const lastMove = moves[moves.length - 1];
          if (lastMove.id === lastProcessedMoveId.current) return;
          lastProcessedMoveId.current = lastMove.id;

          const { action_type, payload, player_id } = lastMove;
          
          // --- CLUES ---
          if (action_type === 'clue' && currentPhase === 'clues') {
              if (player_id !== currentSpeakerId) return; // Ignore out of turn (robustness)
              
              // Insert into SQL
              await supabase.from('undercover_clues').insert({
                  room_id: roomCode,
                  player_id: player_id,
                  text: payload.text,
                  round_number: currentClueRound
              });
              
              const currentIndex = alivePlayers.indexOf(player_id);
              const nextIndex = (currentIndex + 1) % alivePlayers.length;
              const nextSpeaker = alivePlayers[nextIndex];
              
              if (nextIndex === 0) {
                  // End of Clue Round
                  const nextRoundNum = currentClueRound + 1;
                  
                  if (nextRoundNum > clueRoundsBeforeVote) {
                        await supabase.from('undercover_games').update({
                            phase: 'vote',
                            current_speaker_id: null,
                            current_clue_round: nextRoundNum
                        }).eq('room_id', roomCode);

                        await updateRoundData({
                            phase: 'vote',
                            endTime: Date.now() + voteTime * 1000,
                            notification: { id: Date.now().toString(), message: "Tous les indices sont donnés ! Place au vote.", type: 'info' }
                        });
                  } else {
                        await supabase.from('undercover_games').update({
                            current_speaker_id: nextSpeaker,
                            current_clue_round: nextRoundNum
                        }).eq('room_id', roomCode);

                        await updateRoundData({
                            notification: { id: Date.now().toString(), message: `Tour d'indices ${nextRoundNum} / ${clueRoundsBeforeVote}`, type: 'info' }
                        });
                  }
              } else {
                  await supabase.from('undercover_games').update({
                      current_speaker_id: nextSpeaker
                  }).eq('room_id', roomCode);
              }
          }

          // --- SKIP VOTE ---
          if (action_type === 'skip_vote' && currentPhase === 'clues') {
              const currentSkipVotes = [...skipVotes];
              let changed = false;
              
              if (payload.action === 'add' && !currentSkipVotes.includes(player_id)) {
                  currentSkipVotes.push(player_id);
                  changed = true;
              } else if (payload.action === 'remove' && currentSkipVotes.includes(player_id)) {
                  const idx = currentSkipVotes.indexOf(player_id);
                  if (idx > -1) {
                      currentSkipVotes.splice(idx, 1);
                      changed = true;
                  }
              }

              if (changed) {
                  const majority = Math.floor(alivePlayers.length / 2) + 1;
                  if (currentSkipVotes.length >= majority) {
                       await supabase.from('undercover_games').update({
                           phase: 'vote'
                       }).eq('room_id', roomCode);
                       
                       await updateRoundData({
                           skipVotes: [],
                           phase: 'vote',
                           endTime: Date.now() + voteTime * 1000,
                           notification: { id: Date.now().toString(), message: "Majorité atteinte ! Place au vote.", type: 'info' }
                       });
                  } else {
                       await updateRoundData({
                           skipVotes: currentSkipVotes
                       });
                  }
              }
          }

          // --- VOTE ---
          if (action_type === 'vote' && currentPhase === 'vote') {
              // Insert into SQL
              await supabase.from('undercover_votes').insert({
                  room_id: roomCode,
                  voter_id: player_id,
                  target_id: payload.targetId
              });
          }
          
          // --- GUESS ---
          if (action_type === 'guess' && currentPhase === 'mrwhite_guess' && player_id === eliminatedPlayerId) {
               const guess = payload.text;
               const isCorrect = guess.trim().toLowerCase() === (civilWord || '').toLowerCase();
               if (isCorrect) {
                   await finishGame('MR_WHITE', alivePlayers);
               } else if (eliminatedPlayerId) {
                   await handleElimination(eliminatedPlayerId);
               }
          }
      };

      processNewMoves();
  }, [moves, isHost, currentPhase, currentSpeakerId, clues, alivePlayers, eliminatedPlayerId, civilWord, clueRoundsBeforeVote, voteTime, roundData, currentClueRound, skipVotes]);

  // OLD processAnswers (Legacy JSONB) - Removed or Kept for 'Ready' status if not fully migrated?
  // We migrated 'Ready' to SQL column.
  // We migrated 'Clue', 'Skip', 'Vote', 'Guess' to SQL `game_moves`.
  // So we can remove the old `processAnswers` effect.


  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 3 && currentPhase === 'setup') {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length, currentPhase]);


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
      showScores={false}
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
              
              {amIReadyRobust && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-20 animate-in fade-in">
                      <div className="text-center">
                          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <h3 className="text-2xl font-bold text-white">Vous êtes prêt !</h3>
                          <p className="text-gray-400 mt-2">En attente des autres joueurs ({allReadyIds.length}/{alivePlayers.length})</p>
                      </div>
                  </div>
              )}

              <h3 className="text-2xl font-bold text-gray-400 mb-6">Votre rôle est</h3>
              
              <div className="min-h-[200px] flex flex-col items-center justify-center relative w-full gap-6">
                  
                  {showRole ? (
                      <div className="animate-in fade-in zoom-in duration-300 w-full">
                          {playersKnowRole ? (
                              <>
                                  <div className="mb-6 flex justify-center">
                                      <div className={`p-6 rounded-full bg-white/5 border-2 ${myRole === 'CIVIL' ? 'border-blue-500' : 'border-red-500'}`}>
                                           {getRoleIcon(myRole)}
                                      </div>
                                  </div>
                                  
                                  <h2 className={`text-4xl font-black mb-4 ${getRoleColor(myRole)}`}>
                                      {myRole === 'CIVIL' ? 'CIVIL' : myRole === 'UNDERCOVER' ? 'UNDERCOVER' : 'MR. WHITE'}
                                  </h2>
                              </>
                          ) : (
                              <div className="mb-6 flex justify-center">
                                  <div className="p-6 rounded-full bg-white/5 border-2 border-gray-500">
                                      <User className="w-12 h-12 text-gray-300" />
                                  </div>
                                  <h2 className="text-xl font-bold mb-4 text-gray-300">Rôle Caché</h2>
                              </div>
                          )}

                          <div className="bg-white/5 p-4 rounded-xl border border-white/10 w-full">
                              <p className="text-sm text-gray-400 mb-1">Votre mot secret :</p>
                              <p className="text-3xl font-bold text-white tracking-widest uppercase break-all">
                                  {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                              </p>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 animate-in fade-in py-10">
                          <EyeOff className="w-12 h-12 mb-4 opacity-50" />
                          <p>Rôle masqué</p>
                          <p className="text-sm opacity-70">Cliquez ci-dessous pour révéler</p>
                      </div>
                  )}

                  {/* TOGGLE BUTTON IN FLOW */}
                  <Button 
                      variant="outline" 
                      onClick={() => setShowRole(!showRole)}
                      className="w-full bg-white/5 hover:bg-white/10 border-white/20 h-12"
                  >
                      {showRole ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {showRole ? 'Masquer mon rôle' : 'Afficher mon rôle'}
                  </Button>
              </div>

              <Button 
                  size="lg" 
                  onClick={sendReady} 
                  disabled={!!amIReady}
                  className="w-full h-16 mt-6 text-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                  {amIReady ? 'VOUS ÊTES PRÊT' : 'JE SUIS PRÊT'}
              </Button>
          </div>
       </div>
  )}

        {/* GAMEPLAY: CLUES & DISCUSSION */}
        {(currentPhase === 'clues' || currentPhase === 'discussion') && (
            <div className="w-full max-w-6xl flex flex-col items-center relative min-h-screen">
                 
                 {/* STICKY TURN DIALOG */}
                 {currentPhase === 'clues' && isMyTurn && (
                     <div className="sticky top-4 z-50 w-full max-w-xl animate-in slide-in-from-top-10 mb-6">
                        <div className="bg-slate-900/95 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
                             <p className="text-yellow-400 font-bold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"/>
                                C'est à votre tour !
                             </p>
                             <div className="flex gap-3">
                                 <Input 
                                    placeholder="Donnez votre indice (1 mot)..." 
                                    value={userClue}
                                    onChange={e => setUserClue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && sendClue()}
                                    className="bg-slate-800 border-white/20 text-lg h-12 text-white placeholder:text-gray-500"
                                    autoFocus
                                 />
                                 <Button 
                                    onClick={sendClue} 
                                    disabled={!userClue.trim()}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 px-6 shrink-0"
                                 >
                                     <Send className="w-5 h-5" />
                                 </Button>
                             </div>
                        </div>
                     </div>
                 )}

                 {/* GRID OF CLUES */}
                 <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                     <div className="flex flex-col md:flex-row justify-center gap-4 min-w-max md:min-w-0 px-4 w-full">
                        {alivePlayers.map(pid => {
                            const p = players.find(pl => pl.id === pid);
                            const pClues = clues.filter(c => c.playerId === pid);
                            const isSpeaking = currentPhase === 'clues' && currentSpeakerId === pid;
                            const isMe = pid === playerId;

                            return (
                                <div key={pid} className={`w-full md:w-48 flex flex-col transition-all duration-300 ${isSpeaking ? 'scale-[1.02] md:scale-105 z-10' : 'opacity-90'}`}>
                                    {/* Player Card Header */}
                                    <div className={`p-3 rounded-t-xl text-center border-b-4 relative ${isSpeaking ? 'bg-slate-700 border-yellow-500' : 'bg-slate-800 border-slate-600'}`}>
                                        <div className="font-bold text-white truncate text-lg">{p?.name}</div>
                                        {isSpeaking && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase shadow-sm whitespace-nowrap">
                                                En train d'écrire...
                                            </div>
                                        )}
                                        {/* PRESS TO REVEAL BUTTON (ONLY FOR ME) */}
                                        {isMe && (
                                            <button
                                                className="absolute top-1 right-1 p-1.5 text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg transition-colors"
                                                onMouseDown={() => setShowRole(true)}
                                                onMouseUp={() => setShowRole(false)}
                                                onTouchStart={() => setShowRole(true)}
                                                onTouchEnd={() => setShowRole(false)}
                                                title="Maintenir pour voir mon rôle"
                                            >
                                                {showRole ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>

                                    {/* Clues List */}
                                    <div className="bg-slate-900/60 p-2 rounded-b-xl min-h-[150px] md:min-h-[300px] max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar flex flex-col gap-2 border border-white/5 relative">
                                        
                                        {/* Overlay Role Reveal */}
                                        {isMe && showRole && myRole && (
                                            <div className="absolute inset-0 z-20 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center p-2 text-center animate-in fade-in duration-100">
                                                <div className={`text-xs font-black uppercase mb-1 ${getRoleColor(myRole)}`}>
                                                    {myRole === 'CIVIL' ? 'CIVIL' : myRole === 'UNDERCOVER' ? 'UNDERCOVER' : 'MR. WHITE'}
                                                </div>
                                                <div className="text-xl font-bold text-white break-all leading-tight">
                                                    {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                                                </div>
                                            </div>
                                        )}

                                        {pClues.map((c, idx) => (
                                            <div key={idx} className="bg-white/10 p-3 rounded-lg text-white font-medium break-words animate-in slide-in-from-bottom-2 fade-in shadow-sm relative group text-sm md:text-base">
                                                <span className="absolute -left-2 -top-2 w-5 h-5 bg-slate-700 rounded-full text-[10px] flex items-center justify-center text-gray-400 border border-white/10 select-none">
                                                    {idx + 1}
                                                </span>
                                                {c.text}
                                            </div>
                                        ))}
                                        
                                        {isSpeaking && (
                                            <div className="bg-yellow-400/5 p-3 rounded-lg border border-yellow-400/20 animate-pulse flex justify-center mt-auto">
                                                <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                     </div>
                 </div>

                 {/* SKIP VOTE BUTTON (ALL PLAYERS) - STICKY BOTTOM MOBILE */}
                 {isAlive && (
                     <div className="fixed bottom-4 right-4 md:top-24 md:right-4 z-40">
                         <Button 
                            onClick={async () => {
                                await submitAnswer({
                                    type: 'skip_vote',
                                    action: skipVotes.includes(playerId!) ? 'remove' : 'add'
                                });
                            }}
                            className={`font-bold shadow-xl transition-all h-14 md:h-10 px-6 rounded-full md:rounded-lg ${
                                skipVotes.includes(playerId!) 
                                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse ring-4 ring-red-600/30' 
                                : 'bg-slate-800 hover:bg-slate-700 text-gray-200 border border-white/10'
                            }`}
                         >
                            <AlertTriangle className="w-5 h-5 mr-2" />
                            <span className="mr-1">{skipVotes.includes(playerId!) ? 'Annuler' : 'Voter'}</span>
                            <span className="bg-black/30 px-2 py-0.5 rounded text-xs font-mono">
                                {skipVotes.length}/{Math.floor(alivePlayers.length / 2) + 1}
                            </span>
                         </Button>
                     </div>
                 )}
                 
                 {currentPhase === 'discussion' && (
                     <div className="fixed bottom-24 md:bottom-8 z-30 bg-red-600 text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg animate-bounce flex items-center gap-3 max-w-[90vw] text-center justify-center">
                         <MessageSquare className="w-5 h-5 shrink-0" />
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