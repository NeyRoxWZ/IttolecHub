'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Skull, Loader2, Send, Check, Crown, Home } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Phase = 'setup' | 'roles' | 'clues' | 'discussion' | 'vote' | 'mrwhite_guess' | 'results' | 'game_over';

interface UndercoverProps {
  roomCode: string;
}

export default function Undercover({ roomCode }: UndercoverProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    undercover,
    sendMove,
    getTimeLeft,
    updateRoundData,
    resetAllPlayersReady,
    nextRound,
    submitAnswer,
    setPlayerReady,
    moves,
    setGameStatus,
    roomId,
    roomStatus,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'undercover');

  // --- DERIVED STATE ---
  const game = undercover?.game || {};
  const currentPhase = (game.phase as Phase) || 'setup';

  // --- EFFECTS ---
  // Broadcast Listener for Lobby Return
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}`);
    }
  }, [lastEvent, roomCode, router]);

  // Listen for room status changes to navigate back to lobby
  useEffect(() => {
    if (roomStatus === 'waiting') {
      router.push(`/room/${roomCode}`);
    }
  }, [roomStatus, roomCode, router]);
  
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
  // Read skip_votes from SQL game state
  const skipVotes = (game.skip_votes as string[]) || []; 
  
  const clues = useMemo(() => {
      return undercover?.clues?.map((c: any) => ({
          playerId: c.player_id,
          text: c.text,
          timestamp: new Date(c.created_at).getTime()
      })) || [];
  }, [undercover?.clues]);

  // Read votes from SQL
  const votes = useMemo(() => {
      return undercover?.votes || [];
  }, [undercover?.votes]);

  const alivePlayers = useMemo(() => {
      return undercover?.roles?.filter((p: any) => p.is_alive).map((p: any) => p.player_id) || [];
  }, [undercover?.roles]);

  const eliminatedPlayerId = game.eliminated_player_id;
  
  // Settings
  const settings = gameState?.settings || {};
  const rounds = Number(settings.rounds || 1);
  const mrWhiteEnabled = settings.mrWhiteEnabled === 'true' || settings.mrWhiteEnabled === true;
  const voteTime = Number(settings.voteTime || 30);
  const playersKnowRole = settings.playersKnowRole === 'true' || settings.playersKnowRole === true;
  const clueRoundsBeforeVote = Number(settings.clueRounds || 3);
  const undercoverCount = Number(settings.undercoverCount || 1);
  const currentRoundNumber = gameState?.current_round || 0;

  // Ready Status
  const readyPlayersFromTable = useMemo(() => {
      return players.filter((p: any) => p.is_ready).map(p => p.id);
  }, [players]);
  const amIReady = playerId && readyPlayersFromTable.includes(playerId);

  // Local State
  const [userClue, setUserClue] = useState('');
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRole, setShowRole] = useState(false); // For Eye button logic

  const isMyTurn = currentPhase === 'clues' && currentSpeakerId === playerId;
  const isAlive = playerId && alivePlayers.includes(playerId);

  // --- NOTIFICATIONS & TIMER ---
  const lastNotificationId = useRef<string>('');
  const notification = (gameState?.round_data?.notification as { id: string, message: string, type: 'success' | 'info' | 'error' } | null) || null;

  useEffect(() => {
    if (notification && notification.id !== lastNotificationId.current) {
        lastNotificationId.current = notification.id;
        
        // Dismiss previous toasts to avoid stacking and overlapping text
        toast.dismiss();
        
        const options = { duration: 2000 };
        if (notification.type === 'success') toast.success(notification.message, options);
        else if (notification.type === 'error') toast.error(notification.message, options);
        else toast.info(notification.message, options);
    }
  }, [notification]);

  // Server-Authoritative Timer Logic
  useEffect(() => {
    if (!game.timer_start_at || !game.timer_duration_seconds) {
        setTimeLeft(0);
        return;
    }

    const timerStart = new Date(game.timer_start_at).getTime();
    const duration = game.timer_duration_seconds * 1000;
    
    const calculateRemaining = () => {
        const now = Date.now(); // Local time, but we rely on relative difference from start
        // Ideally we should sync server time offset, but for short durations, assuming synced clocks or relative drift is minor.
        // Or better: Supabase Realtime timestamp? No, simpler: 
        // We use the DB timestamp. Client clocks might be off.
        // Ideally we need `serverTime`. `useGameSync` provides `serverTime` (approx).
        // Let's use Date.now() for relative check if we trust NTP, or `serverTime` if available.
        // Actually, `game.timer_start_at` is server time.
        // `Date.now()` is client time. 
        // Difference = (ServerNow - Start) vs (ClientNow - Start).
        // If Client is ahead/behind, it breaks.
        // Robust way: Store `endTime` in DB (Start + Duration).
        // Then `remaining = endTime - serverTime`.
        // If we only have `start` and `duration`:
        // `endTime = start + duration`.
        // We need `serverNow`.
        // Let's use `new Date()` and accept small drift, or correct with offset if `serverTime` is passed.
        // We will assume `new Date()` is close enough for game logic (seconds resolution).
        
        // Actually, better pattern: `expires_at` column.
        // But we have `start_at` + `duration`.
        // `expires_at = new Date(game.timer_start_at).getTime() + duration`.
        // `remaining = expires_at - Date.now()`.
        
        const expiresAt = timerStart + duration;
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        return remaining;
    };

    // Initial sync
    setTimeLeft(calculateRemaining());

    const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setTimeLeft(prev => {
            // Smooth snap: only update if diff > 1s to avoid jitter, but for countdown we want every second.
            // Actually we want to tick down every second.
            // But we want to ensure we don't drift.
            // `calculateRemaining` IS the authoritative source.
            // So we just set it.
            return remaining;
        });
        
        if (remaining <= 0) {
            clearInterval(interval);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [game.timer_start_at, game.timer_duration_seconds]);

  const toggleSkipVote = async () => {
    if (!playerId || !roomId) return;
    
    // Calculate new array locally first
    const currentSkipVotes = [...skipVotes];
    let newSkipVotes = [];
    
    if (currentSkipVotes.includes(playerId)) {
        newSkipVotes = currentSkipVotes.filter(id => id !== playerId);
    } else {
        newSkipVotes = [...currentSkipVotes, playerId];
    }
    
    // Update SQL
    await supabase.from('undercover_games').update({
        skip_votes: newSkipVotes
    }).eq('room_id', roomId);
  };

  // --- HOST LOGIC ---
  
  // 2. Listen for Skip Votes (Majority check)
  useEffect(() => {
      if (!isHost || !roomId || currentPhase !== 'clues') return;

      const majority = Math.floor(alivePlayers.length / 2) + 1;
      const validSkipVotes = skipVotes.filter(id => alivePlayers.includes(id));
      
      if (validSkipVotes.length >= majority) {
           const triggerVote = async () => {
               await supabase.from('undercover_games').update({
                   phase: 'vote',
                   skip_votes: [], // Reset skip votes
                   timer_start_at: new Date().toISOString(),
                   timer_duration_seconds: voteTime
               }).eq('room_id', roomId);
               
               // Clear previous votes just in case
               await supabase.from('undercover_votes').delete().eq('room_id', roomId);
               
               await updateRoundData({
                   phase: 'vote',
                   notification: { id: Date.now().toString(), message: "Majorité atteinte ! Place au vote.", type: 'info' }
               });
           };
           triggerVote();
      }
  }, [isHost, roomId, currentPhase, skipVotes, alivePlayers.length, voteTime]);

  // 1. Listen for new Clues to advance turn
  useEffect(() => {
      if (!isHost || !roomId || clues.length === 0) return;

      const lastClue = clues[clues.length - 1];
      
      // If the last clue corresponds to the current speaker, we need to advance
      if (currentSpeakerId && lastClue.playerId === currentSpeakerId) {
          const advanceTurn = async () => {
              const currentIndex = alivePlayers.indexOf(currentSpeakerId);
              const nextIndex = (currentIndex + 1) % alivePlayers.length;
              
              if (nextIndex === 0) {
                  // End of Clue Round
                  const nextRoundNum = currentClueRound + 1;
                  
                  if (nextRoundNum > clueRoundsBeforeVote) {
                        // Go to Vote
                        await supabase.from('undercover_games').update({
                            phase: 'vote',
                            current_speaker_id: null,
                            current_clue_round: nextRoundNum,
                            timer_start_at: new Date().toISOString(),
                            timer_duration_seconds: voteTime
                        }).eq('room_id', roomId);

                        // Clear previous votes
                        await supabase.from('undercover_votes').delete().eq('room_id', roomId);

                        await updateRoundData({
                            phase: 'vote',
                            notification: { id: Date.now().toString(), message: "Tous les indices sont donnés ! Place au vote.", type: 'info' }
                        });
                  } else {
                        // Next Clue Round
                        await supabase.from('undercover_games').update({
                            current_speaker_id: alivePlayers[0], // Start from first player again? Usually yes. Or next? Let's say first.
                            current_clue_round: nextRoundNum
                        }).eq('room_id', roomId);

                        await updateRoundData({
                            notification: { id: Date.now().toString(), message: `Tour d'indices ${nextRoundNum} / ${clueRoundsBeforeVote}`, type: 'info' }
                        });
                  }
              } else {
                  // Next Player
                  await supabase.from('undercover_games').update({
                      current_speaker_id: alivePlayers[nextIndex]
                  }).eq('room_id', roomId);
              }
          };
          
          advanceTurn();
      }
  }, [isHost, roomId, clues, currentSpeakerId, alivePlayers, currentClueRound, clueRoundsBeforeVote, voteTime]);

  useEffect(() => {
    if (!isHost || !roomId) return;

    const managePhases = async () => {
        // 1. Roles -> Clues (All Ready)
        if (currentPhase === 'roles') {
             const allReady = alivePlayers.every(id => readyPlayersFromTable.includes(id));
             if (allReady && alivePlayers.length > 0) { 
                 await supabase.from('undercover_games').update({
                     phase: 'clues',
                     current_speaker_id: alivePlayers[0],
                     current_clue_round: 1
                 }).eq('room_id', roomId);
                 
                 // Clear clues from DB for new round if not done
                 // Usually done at startNewGame or nextGameRound
                 
                 await updateRoundData({
                     phase: 'clues',
                     notification: { id: Date.now().toString(), message: "Tout le monde est prêt ! Début des indices.", type: 'info' }
                 });
             }
        }

        // 3. Discussion -> Vote (Time limit)
        if (currentPhase === 'discussion' && timeLeft === 0 && game.timer_start_at) {
             await supabase.from('undercover_games').update({
                 phase: 'vote',
                 timer_start_at: new Date().toISOString(),
                 timer_duration_seconds: voteTime
             }).eq('room_id', roomId);
             
             // Clear previous votes
             await supabase.from('undercover_votes').delete().eq('room_id', roomId);
             
             await updateRoundData({
                 phase: 'vote',
                 notification: { id: Date.now().toString(), message: "Fin de la discussion ! Place au vote.", type: 'info' }
             });
        }

        // 4. Vote -> Results (Time limit)
        if (currentPhase === 'vote' && timeLeft === 0 && game.timer_start_at) {
             await processVotes();
        }
    };

    managePhases();
  }, [isHost, currentPhase, timeLeft, alivePlayers, voteTime, readyPlayersFromTable, gameState, roomId, game.timer_start_at]);

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 3 && currentPhase === 'setup') {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length, currentPhase]);

  // --- ACTIONS ---

  const startNewGame = async () => {
    if (!isHost || !roomId) return;
    if (players.length < 3) {
        toast.error("Il faut au moins 3 joueurs !");
        return;
    }

    try {
        const res = await fetch(`/api/games/undercover?count=${rounds}`);
        const words = await res.json();
        if (!words || words.length === 0) return;

        if (resetAllPlayersReady) await resetAllPlayersReady();

        const firstPair = Array.isArray(words) ? words[0] : words;
        const { newRoles } = assignRoles(players, mrWhiteEnabled, undercoverCount);

        // SQL Initialization
        await supabase.from('undercover_games').upsert({
            room_id: roomId,
            phase: 'roles',
            civil_word: firstPair.civilWord,
            undercover_word: firstPair.undercoverWord,
            current_speaker_id: null,
            current_clue_round: 1,
            created_at: new Date().toISOString()
        }, { onConflict: 'room_id' });

        const playerInserts = players.map(p => ({
            room_id: roomId,
            player_id: p.id,
            role: newRoles[p.id],
            is_alive: true
        }));
        await supabase.from('undercover_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });

        await supabase.from('undercover_clues').delete().eq('room_id', roomId);
        await supabase.from('undercover_votes').delete().eq('room_id', roomId);
        
        // Ensure room status is in_game so players are redirected if they are in lobby
        await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);

        await updateRoundData({
            phase: 'roles',
            current_round: 1,
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
    
    for (let i = 0; i < ucCount; i++) {
        const undercover = available.pop();
        if (undercover) newRoles[undercover.id] = 'UNDERCOVER';
    }
    if (includeMrWhite && available.length > 0) {
        const mrWhite = available.pop();
        if (mrWhite) newRoles[mrWhite.id] = 'MR_WHITE';
    }
    available.forEach(p => newRoles[p.id] = 'CIVIL');
    shuffled.forEach(p => alive.push(p.id));
    return { newRoles, alive };
  };

  const processVotes = async () => {
    if (!roomId) return;
    const { data: votesData } = await supabase.from('undercover_votes').select('*').eq('room_id', roomId);
    
    const voteCounts: Record<string, number> = {};
    votesData?.forEach((v: any) => {
        if (v.target_id) voteCounts[v.target_id] = (voteCounts[v.target_id] || 0) + 1;
    });

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
        await updateRoundData({
            phase: 'vote',
            notification: { id: Date.now().toString(), message: "Égalité ! Revotez !", type: 'error' }
        });
        await supabase.from('undercover_votes').delete().eq('room_id', roomId);
        
        // Reset Timer for Re-vote
        await supabase.from('undercover_games').update({
             timer_start_at: new Date().toISOString(),
             timer_duration_seconds: voteTime
        }).eq('room_id', roomId);
        
        return;
    }

    const eliminatedRole = roles[eliminatedId];
    if (eliminatedRole === 'MR_WHITE') {
        await supabase.from('undercover_games').update({
            phase: 'mrwhite_guess',
            eliminated_player_id: eliminatedId
        }).eq('room_id', roomId);
        
        await updateRoundData({
            notification: { id: Date.now().toString(), message: "Mr. White trouvé ! Il peut se sauver...", type: 'success' }
        });
        return;
    }

    await handleElimination(eliminatedId);
  };

  const handleElimination = async (eliminatedId: string) => {
    if (!roomId) return;
    await supabase.from('undercover_players').update({ is_alive: false }).eq('room_id', roomId).eq('player_id', eliminatedId);

    const newAlive = alivePlayers.filter(id => id !== eliminatedId);
    const remainingRoles = newAlive.map(id => roles[id]);
    const hasUndercover = remainingRoles.includes('UNDERCOVER');
    const hasMrWhite = remainingRoles.includes('MR_WHITE');
    const civilsCount = remainingRoles.filter(r => r === 'CIVIL').length;
    const impostorsCount = (hasUndercover ? 1 : 0) + (hasMrWhite ? 1 : 0);

    if (!hasUndercover && !hasMrWhite) {
        await finishGame('CIVILS', newAlive);
    } else if (impostorsCount >= civilsCount) {
        await finishGame('IMPOSTORS', newAlive);
    } else {
        await supabase.from('undercover_games').update({
            phase: 'clues',
            current_speaker_id: newAlive[0],
            eliminated_player_id: eliminatedId
        }).eq('room_id', roomId);
        
        await updateRoundData({
            phase: 'clues',
            notification: { id: Date.now().toString(), message: "Un joueur a été éliminé. La partie continue !", type: 'info' }
        });
    }
  };

  const finishGame = async (winner: string, alive: string[]) => {
      if (!roomId) return;
      await supabase.from('undercover_games').update({
          phase: 'results',
          winner: winner
      }).eq('room_id', roomId);

      await updateRoundData({
          phase: 'results',
          notification: { id: Date.now().toString(), message: "Fin de la partie !", type: 'success' }
      });
  };

  const nextGameRound = async () => {
      if (!isHost || !roomId) return;
      
      const nextRoundNum = currentRoundNumber + 1;
      
      // If we reached max rounds, return to lobby (reset to setup)
      if (nextRoundNum > rounds) {
          await supabase.from('undercover_games').delete().eq('room_id', roomId);
          await supabase.from('undercover_players').delete().eq('room_id', roomId);
          await supabase.from('undercover_clues').delete().eq('room_id', roomId);
          await supabase.from('undercover_votes').delete().eq('room_id', roomId);
          
          await updateRoundData({
              phase: 'setup',
              current_round: 0,
              notification: { id: Date.now().toString(), message: "Retour au salon...", type: 'info' }
          });

          await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
          
          // Broadcast return to lobby
          if (broadcast) await broadcast('return_to_lobby', {});
          
          router.push(`/room/${roomCode}`);
          return;
      }

      // Else, start next round
      try {
          const res = await fetch(`/api/games/undercover?count=1`);
          const words = await res.json();
          const nextPair = Array.isArray(words) ? words[0] : words;
          if (!nextPair) return;

          const { newRoles } = assignRoles(players, mrWhiteEnabled, undercoverCount);
          if (resetAllPlayersReady) await resetAllPlayersReady();

          // Reset everything for next round
          await supabase.from('undercover_games').update({
              phase: 'roles',
              civil_word: nextPair.civilWord,
              undercover_word: nextPair.undercoverWord,
              current_speaker_id: null,
              current_clue_round: 1,
              winner: null,
              eliminated_player_id: null,
              skip_votes: [],
              timer_start_at: null,
              timer_duration_seconds: null
          }).eq('room_id', roomId);

          // Clear clues and votes
          await supabase.from('undercover_clues').delete().eq('room_id', roomId);
          await supabase.from('undercover_votes').delete().eq('room_id', roomId);
          
          // Reset players state (alive, etc.)
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              role: newRoles[p.id],
              is_alive: true // Make everyone alive again
          }));
          await supabase.from('undercover_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });
          
          await updateRoundData({
              current_round: nextRoundNum,
              notification: { id: Date.now().toString(), message: `Manche ${nextRoundNum} commencée !`, type: 'success' }
          });
          
      } catch (e) { console.error(e); }
  };

  // --- CLIENT ---
  const sendReady = async () => {
    // Toggle ready state
    if (!setPlayerReady) return;
    await setPlayerReady(!amIReady);
  };

  const sendClue = async () => {
    if (!userClue.trim() || !roomId || !playerId) return;
    
    // Direct SQL Insert
    await supabase.from('undercover_clues').insert({
        room_id: roomId,
        player_id: playerId,
        text: userClue,
        round_number: currentClueRound
    });
    
    setUserClue('');
  };

  const sendVoteAction = async (targetId: string) => {
    if (!roomId || !playerId || !isAlive) return; // Only alive players can vote
    
    // Check if already voted
    const { data: existingVotes } = await supabase.from('undercover_votes').select('id').eq('room_id', roomId).eq('voter_id', playerId);
    
    if (existingVotes && existingVotes.length > 0) {
        // Update vote
        await supabase.from('undercover_votes').update({
            target_id: targetId
        }).eq('id', existingVotes[0].id);
        toast.success('Vote modifié');
    } else {
        // Insert new vote
        await supabase.from('undercover_votes').insert({
            room_id: roomId,
            voter_id: playerId,
            target_id: targetId
        });
        toast.success('Vote enregistré');
    }
  };

  const sendMrWhiteGuess = async () => {
    if (!mrWhiteGuess.trim()) return;
    await sendMove('guess', { text: mrWhiteGuess });
  };

  // --- RENDER HELPERS ---
  const playersMap = useMemo(() => {
     return players.reduce((acc, p) => ({ ...acc, [p.name]: 0 }), {} as Record<string, number>);
  }, [players]);

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
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in">
               {players.length < 3 ? (
                 <>
                    <User className="w-16 h-16 text-gray-600 animate-pulse" />
                    <p className="text-2xl font-medium text-gray-400">En attente de joueurs ({players.length}/3)...</p>
                 </>
               ) : (
                 <>
                    <Loader2 className="w-16 h-16 animate-spin text-red-500" />
                    <p className="text-2xl font-medium animate-pulse text-red-200">Démarrage de la mission...</p>
                 </>
               )}
            </div>
        )}

        {/* PHASE: ROLES */}
        {currentPhase === 'roles' && myRole && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg p-4">
                <div className="bg-[#0F172A]/80 p-8 rounded-3xl border border-[#334155] text-center w-full shadow-2xl relative overflow-hidden">
                    {amIReady && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in">
                            <Check className="w-20 h-20 text-green-500 mb-4" />
                            <h3 className="text-3xl font-bold text-[#F8FAFC]">Vous êtes prêt !</h3>
                            <p className="text-gray-400 mt-2">En attente des autres...</p>
                        </div>
                    )}

                    <h3 className="text-2xl font-bold text-gray-400 mb-8">Votre Identité</h3>
                    
                    <div className="flex flex-col items-center gap-6 mb-8 min-h-[200px] justify-center">
                        {showRole ? (
                            <div className="animate-in zoom-in duration-200 flex flex-col items-center">
                                {playersKnowRole && (
                                    <div className={`text-4xl font-black mb-4 ${myRole === 'CIVIL' ? 'text-blue-400' : myRole === 'UNDERCOVER' ? 'text-red-500' : 'text-[#F8FAFC]}'}`}>
                                        {myRole}
                                    </div>
                                )}
                                <div className="bg-[#334155] px-8 py-4 rounded-xl border border-[#475569]">
                                    <span className="block text-sm text-[#94A3B8] uppercase tracking-widest mb-1">Mot Secret</span>
                                    <span className="text-3xl font-bold text-[#F8FAFC]">
                                        {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-500 flex flex-col items-center animate-in fade-in">
                                <EyeOff className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-lg">Maintenez pour révéler</p>
                            </div>
                        )}
                    </div>

                    <button
                        className="w-full bg-[#334155] hover:bg-[#475569] active:bg-[#475569] border border-[#475569] rounded-xl p-4 mb-4 transition-colors select-none touch-none"
                        onMouseDown={() => setShowRole(true)}
                        onMouseUp={() => setShowRole(false)}
                        onMouseLeave={() => setShowRole(false)}
                        onTouchStart={() => setShowRole(true)}
                        onTouchEnd={() => setShowRole(false)}
                    >
                        <Eye className="w-6 h-6 mx-auto text-gray-300" />
                    </button>

                    <Button 
                        size="lg" 
                        onClick={sendReady} 
                        // disabled={!!amIReady}
                        className={`w-full h-16 text-xl font-bold rounded-xl shadow-lg transition-all relative z-30 ${
                            amIReady 
                            ? 'bg-green-600 hover:bg-green-500 shadow-green-600/20' 
                            : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                        }`}
                    >
                        {amIReady ? (
                            <>
                                <Check className="w-6 h-6 mr-2" /> PRÊT (Annuler)
                            </>
                        ) : (
                            "JE SUIS PRÊT"
                        )}
                    </Button>
                </div>
            </div>
        )}

        {/* PHASE: CLUES / DISCUSSION / VOTE */}
        {(currentPhase === 'clues' || currentPhase === 'discussion' || currentPhase === 'vote') && (
            <div className="flex flex-col w-full h-full relative">
                
                {/* TOP ZONE: ROLE/WORD */}
                <div className="flex justify-center w-full mb-6 px-4">
                    <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded-full px-6 py-2 flex items-center gap-4 shadow-lg select-none touch-none">
                        <span className="text-gray-400 text-sm font-bold uppercase">Votre Mot</span>
                        <div className="w-px h-4 bg-white/20" />
                        <div 
                            className="cursor-pointer flex items-center gap-2"
                            onMouseDown={() => setShowRole(true)}
                            onMouseUp={() => setShowRole(false)}
                            onMouseLeave={() => setShowRole(false)}
                            onTouchStart={() => setShowRole(true)}
                            onTouchEnd={() => setShowRole(false)}
                        >
                            {showRole ? (
                                <span className="font-bold text-white animate-in fade-in">
                                    {playersKnowRole && <span className={myRole === 'CIVIL' ? 'text-blue-400 mr-2' : myRole === 'UNDERCOVER' ? 'text-red-500 mr-2' : 'text-white mr-2'}>{myRole}</span>}
                                    {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                                </span>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Eye className="w-4 h-4" />
                                    <span className="text-sm">Maintenir</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MIDDLE: COLUMNS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24 md:pb-4 w-full">
                    <div className="flex justify-center w-full">
                        <div className="flex flex-wrap justify-center gap-4 w-full max-w-7xl">
                            {alivePlayers.map(pid => {
                                const p = players.find(pl => pl.id === pid);
                                const pClues = clues.filter(c => c.playerId === pid);
                                const isSpeaking = currentPhase === 'clues' && currentSpeakerId === pid;
                                const votesForThisPlayer = votes.filter((v: any) => v.target_id === pid);
                                const hasVotedForThis = votesForThisPlayer.some((v: any) => v.voter_id === playerId);
                                
                                return (
                                    <div key={pid} className="flex flex-col bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden h-[400px] md:h-[500px] relative w-full md:w-[31%] lg:w-[23%]">
                                        {/* Sticky Header */}
                                        <div className={`p-3 text-center border-b border-white/5 sticky top-0 z-10 backdrop-blur-md ${isSpeaking ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-slate-900/80'}`}>
                                            <div className={`font-bold truncate ${isSpeaking ? 'text-yellow-400' : 'text-white'}`}>
                                                {p?.name}
                                            </div>
                                            {isSpeaking && <div className="text-[10px] text-yellow-500 font-black uppercase tracking-wider animate-pulse mt-1">En train d'écrire...</div>}
                                            
                                            {/* Votes Received Display */}
                                            {currentPhase === 'vote' && (
                                                <div className="mt-2 min-h-[20px]">
                                                    {votesForThisPlayer.length > 0 ? (
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            <span className="text-xs text-gray-400 mr-1">🗳</span>
                                                            {votesForThisPlayer.map((v: any) => {
                                                                const voterName = players.find(pl => pl.id === v.voter_id)?.name;
                                                                return (
                                                                    <span key={v.id} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                                                        {voterName}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="h-5"></div> // Placeholder
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Scrollable Content */}
                                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar pb-16">
                                            {pClues.map((c, idx) => (
                                                <div key={idx} className="bg-white/5 p-3 rounded-lg text-sm text-gray-200 animate-in slide-in-from-bottom-2">
                                                    <span className="opacity-50 mr-2 text-xs">#{idx + 1}</span>
                                                    {c.text}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Vote Button (Absolute Bottom of Column) */}
                                        {currentPhase === 'vote' && (
                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 to-transparent pt-6">
                                                <Button 
                                                    onClick={() => sendVoteAction(pid)}
                                                    className={`w-full font-bold ${hasVotedForThis ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                                                    disabled={pid === playerId}
                                                >
                                                    {hasVotedForThis ? <Check className="w-4 h-4 mr-2" /> : <Skull className="w-4 h-4 mr-2" />}
                                                    {hasVotedForThis ? 'Voté' : 'Voter'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* SKIP VOTE BUTTON (Static below columns) */}
                {currentPhase === 'clues' && isAlive && (
                    <div className="flex justify-center w-full py-4">
                        <Button 
                            onClick={toggleSkipVote}
                            className={`rounded-full shadow-lg font-bold transition-all px-6 py-6 text-lg ${skipVotes.includes(playerId || '') ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            {skipVotes.includes(playerId || '') ? (
                                <>
                                    <Check className="w-5 h-5 mr-2" /> Prêt à voter ({skipVotes.length}/{Math.floor(alivePlayers.length / 2) + 1})
                                </>
                            ) : (
                                <>
                                    Passer au vote ({skipVotes.length}/{Math.floor(alivePlayers.length / 2) + 1})
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* BOTTOM: INPUT (Desktop & Mobile Fixed) */}
                {isMyTurn && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-white/10 z-50 md:relative md:bg-transparent md:border-none md:p-0 md:mt-4">
                        <div className="max-w-2xl mx-auto flex gap-2">
                            <Input 
                                placeholder="Donnez votre indice (1 mot)..." 
                                value={userClue}
                                onChange={e => setUserClue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendClue()}
                                className="w-full bg-[#334155] border border-[#334155] text-lg md:h-12"
                                autoFocus
                            />
                            <Button 
                                onClick={sendClue} 
                                disabled={!userClue.trim()}
                                className="h-14 px-8 bg-indigo-600 hover:bg-indigo-500 font-bold md:h-12"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}
                
                {/* PHASE: DISCUSSION / VOTE INFO */}
                {currentPhase === 'discussion' && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-lg animate-bounce z-40">
                        <MessageSquare className="w-4 h-4 inline mr-2" />
                        Débattez !
                    </div>
                )}
            </div>
        )}

        {/* PHASE: MR WHITE GUESS */}
        {currentPhase === 'mrwhite_guess' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg p-4">
                <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 text-center w-full">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
                    <h2 className="text-2xl font-bold text-white mb-2">Mr. White a été trouvé !</h2>
                    <p className="text-gray-400 mb-6">Il a une chance de gagner s'il trouve le mot des Civils.</p>
                    
                    {eliminatedPlayerId === playerId ? (
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Quel est le mot ?" 
                                value={mrWhiteGuess}
                                onChange={e => setMrWhiteGuess(e.target.value)}
                                className="bg-slate-800 border-white/20"
                            />
                            <Button onClick={sendMrWhiteGuess} className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold">
                                Tenter
                            </Button>
                        </div>
                    ) : (
                        <p className="text-yellow-500 font-bold animate-pulse">Mr. White réfléchit...</p>
                    )}
                </div>
            </div>
        )}

        {/* PHASE: RESULTS */}
        {currentPhase === 'results' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4">
                <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 text-center w-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />
                    
                    <Crown className="w-20 h-20 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                    
                    <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">
                        Victoire {game.winner === 'CIVILS' ? 'des Civils' : 'des Imposteurs'} !
                    </h2>
                    
                    <div className="grid gap-2 mt-8 text-left max-h-[300px] overflow-y-auto custom-scrollbar bg-black/20 p-4 rounded-xl">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                <span className="font-bold text-white">{p.name}</span>
                                <span className={`font-mono text-sm font-bold ${
                                    roles[p.id] === 'CIVIL' ? 'text-blue-400' : 
                                    roles[p.id] === 'UNDERCOVER' ? 'text-red-500' : 'text-white'
                                }`}>
                                    {roles[p.id]}
                                </span>
                            </div>
                        ))}
                    </div>

                    {isHost && (
                        <Button onClick={nextGameRound} variant="primary" className="mt-8 w-full h-14 text-lg font-bold rounded-xl">
                            {currentRoundNumber >= rounds ? "Revenir au salon" : "Manche Suivante"}
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => router.push('/')} className="mt-4 text-[#94A3B8] hover:text-[#F8FAFC]">
                        <Home className="w-4 h-4 mr-2" /> Retour au menu
                    </Button>
                </div>
            </div>
        )}

      </div>
    </GameLayout>
  );
} 