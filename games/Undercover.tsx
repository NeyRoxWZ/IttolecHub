'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Skull, Loader2, Send, Check, Crown, Home, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import VoteToLobby from './components/VoteToLobby';
import { cn } from '@/lib/utils';

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
    nextRound,
    submitAnswer,
    moves,
    setGameStatus,
    roomId,
    roomStatus,
    lastEvent,
    broadcast,
    isConnected
  } = useGameSync(roomCode, 'undercover');

  // --- DERIVED STATE ---
  const game = undercover?.game || {};
  const currentPhase = (game.phase as Phase) || 'setup';

  // --- EFFECTS ---
  // Broadcast Listener for Lobby Return
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}?return=true`);
    }
  }, [lastEvent, roomCode, router]);
  
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

  // Filtered by round_id (set atomically with `phase` on the same
  // undercover_games row) rather than a wall-clock timestamp — clock-based
  // filtering could momentarily show clues from the previous game until the
  // separate game_sessions row caught up, making old words look "stuck"
  // until the first new clue was sent.
  const clues = useMemo(() => {
      const all = undercover?.clues || [];
      const currentRoundId = game.round_id;
      const filtered = currentRoundId ? all.filter((c: any) => c.round_id === currentRoundId) : all;
      return filtered.map((c: any) => ({
          playerId: c.player_id,
          text: c.text,
          timestamp: new Date(c.created_at).getTime()
      }));
  }, [undercover?.clues, game.round_id]);

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

  // Ready Status — tracked directly on the undercover_games row (not the
  // shared players.is_ready column) so the reset and the phase transition
  // land in the same row/table and can never arrive out of order on the
  // client. Cross-table ordering (players vs undercover_games) isn't
  // guaranteed, which caused the "ready" check to misfire on alternating
  // rounds.
  const readyPlayersFromTable = useMemo(() => {
      return (game.ready_players as string[]) || [];
  }, [game.ready_players]);
  const amIReady = playerId && readyPlayersFromTable.includes(playerId);

  // Local State
  const [userClue, setUserClue] = useState('');
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRole, setShowRole] = useState(false); // For Eye button logic
  
  useEffect(() => {
      if (currentPhase === 'setup' || currentPhase === 'roles') {
          setUserClue('');
          setMrWhiteGuess('');
          setShowRole(false);
      }
  }, [currentPhase]);

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

  // 5. Resolve Mr. White's guess (Host only)
  // Without this, the game stays stuck forever on the 'mrwhite_guess' phase
  // because nobody ever reads the 'guess' move Mr. White submits.
  const processedGuessRef = useRef<string>('');
  useEffect(() => {
      if (!isHost || !roomId || currentPhase !== 'mrwhite_guess' || !eliminatedPlayerId) return;

      const guessMoves = moves.filter((m: any) => m.action_type === 'guess' && m.player_id === eliminatedPlayerId);
      if (guessMoves.length === 0) return;

      const lastGuess = guessMoves[guessMoves.length - 1];
      if (lastGuess.id === processedGuessRef.current) return;
      processedGuessRef.current = lastGuess.id;

      const guessText = String(lastGuess.payload?.text || '').trim().toLowerCase();
      const target = String(civilWord || '').trim().toLowerCase();
      const isCorrect = guessText.length > 0 && guessText === target;

      const resolveGuess = async () => {
          if (isCorrect) {
              await updateRoundData({
                  notification: { id: Date.now().toString(), message: "Mr. White a trouvé le mot ! Victoire des imposteurs.", type: 'success' }
              });
              await finishGame('IMPOSTORS', alivePlayers);
          } else {
              await updateRoundData({
                  notification: { id: Date.now().toString(), message: "Mauvaise réponse de Mr. White !", type: 'error' }
              });
              await handleElimination(eliminatedPlayerId);
          }
      };
      resolveGuess();
  }, [isHost, roomId, currentPhase, moves, eliminatedPlayerId, civilWord, alivePlayers]);

  // Auto-start (Removed to fix automatic transition to role distribution)
  /*
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 3 && currentPhase === 'setup') {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length, currentPhase]);
  */

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
        if (!words || words.length === 0) {
            toast.error("Erreur: Impossible de charger les mots.");
            return;
        }

        const firstPair = Array.isArray(words) ? words[0] : words;
        const { newRoles } = assignRoles(players, mrWhiteEnabled, undercoverCount);

        // SQL Initialization
        const { error: gameError } = await supabase.from('undercover_games').upsert({
            room_id: roomId,
            round_id: String(currentRoundNumber || 1),
            phase: 'roles',
            civil_word: firstPair.civilWord,
            undercover_word: firstPair.undercoverWord,
            current_speaker_id: null,
            current_clue_round: 1,
            ready_players: [],
            skip_votes: []
        }, { onConflict: 'room_id' });

        if (gameError) {
            console.error("GAME ERROR", gameError);
            toast.error("Erreur lors de la création de la partie.");
        }

        const playerInserts = players.map(p => ({
            room_id: roomId,
            round_id: String(currentRoundNumber || 1),
            player_id: p.id,
            role: newRoles[p.id],
            is_alive: true
        }));
        
        await supabase.from('undercover_players').delete().eq('room_id', roomId);
        const { error: playersError } = await supabase.from('undercover_players').insert(playerInserts);

        if (playersError) {
            console.error("PLAYERS ERROR", playersError);
            toast.error("Erreur lors de l'attribution des rôles.");
        }

        await supabase.from('undercover_clues').delete().eq('room_id', roomId);
        await supabase.from('undercover_votes').delete().eq('room_id', roomId);
        
        // Ensure room status is in_game so players are redirected if they are in lobby
        await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);

        await supabase.from('game_sessions').update({
            current_round: 1,
            round_data: {
                phase: 'roles',
                current_round: 1,
                round_started_at: Date.now(),
                notification: { id: Date.now().toString(), message: "Partie lancée ! Révélation des rôles...", type: 'success' }
            }
        }).eq('room_id', roomId);
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
    
    // Safety check: ensure at least 2 Civils for a valid game
    const maxSpecials = Math.max(1, allPlayers.length - 2); 
    
    let specialsAdded = 0;
    
    // Assign Undercovers
    for (let i = 0; i < ucCount; i++) {
        if (specialsAdded >= maxSpecials) break;
        const undercover = available.pop();
        if (undercover) {
            newRoles[undercover.id] = 'UNDERCOVER';
            specialsAdded++;
        }
    }
    
    // Assign Mr White
    if (includeMrWhite && specialsAdded < maxSpecials) {
        const mrWhite = available.pop();
        if (mrWhite) {
            newRoles[mrWhite.id] = 'MR_WHITE';
            specialsAdded++;
        }
    }
    
    // Assign Civils
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
          
          router.push(`/room/${roomCode}?return=true`);
          return;
      }

      // Else, start next round
      try {
          const res = await fetch(`/api/games/undercover?count=1`);
          const words = await res.json();
          const nextPair = Array.isArray(words) ? words[0] : words;
          if (!nextPair) return;

          const { newRoles } = assignRoles(players, mrWhiteEnabled, undercoverCount);

          // Reset everything for next round
          await supabase.from('undercover_games').update({
              round_id: String(nextRoundNum),
              phase: 'roles',
              civil_word: nextPair.civilWord,
              undercover_word: nextPair.undercoverWord,
              current_speaker_id: null,
              current_clue_round: 1,
              winner: null,
              eliminated_player_id: null,
              skip_votes: [],
              ready_players: [],
              timer_start_at: null,
              timer_duration_seconds: null
          }).eq('room_id', roomId);

          // Clear clues and votes
          await supabase.from('undercover_clues').delete().eq('room_id', roomId);
          await supabase.from('undercover_votes').delete().eq('room_id', roomId);
          
          // Reset players state (alive, etc.)
          const playerInserts = players.map(p => ({
              room_id: roomId,
              round_id: String(nextRoundNum),
              player_id: p.id,
              role: newRoles[p.id],
              is_alive: true // Make everyone alive again
          }));
          await supabase.from('undercover_players').delete().eq('room_id', roomId);
          await supabase.from('undercover_players').insert(playerInserts);
          
          await supabase.from('game_sessions').update({
              current_round: nextRoundNum,
              round_data: {
                  ...(gameState?.round_data || {}),
                  current_round: nextRoundNum,
                  round_started_at: Date.now(),
                  notification: { id: Date.now().toString(), message: `Manche ${nextRoundNum} commencée !`, type: 'success' }
              }
          }).eq('room_id', roomId);
          
      } catch (e) { console.error(e); }
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('undercover_games').delete().eq('room_id', roomId);
      await supabase.from('undercover_players').delete().eq('room_id', roomId);
      await supabase.from('undercover_clues').delete().eq('room_id', roomId);
      await supabase.from('undercover_votes').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- CLIENT ---
  const sendReady = async () => {
    // Toggle ready state directly on the undercover_games row (round-scoped)
    if (!playerId || !roomId) return;
    const current = [...readyPlayersFromTable];
    const next = amIReady ? current.filter(id => id !== playerId) : [...current, playerId];
    await supabase.from('undercover_games').update({ ready_players: next }).eq('room_id', roomId);
  };

  const sendClue = async () => {
    if (!userClue.trim() || !roomId || !playerId) return;
    
    // Direct SQL Insert
    await supabase.from('undercover_clues').insert({
        room_id: roomId,
        round_id: String(currentRoundNumber || 1),
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
            round_id: String(currentRoundNumber || 1),
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
      isConnected={isConnected}
      players={playersMap}
      roundCount={currentRoundNumber}
      maxRounds={rounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="Undercover"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
      showScores={false}
      voteToLobby={currentPhase !== 'setup' ? <VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} /> : undefined}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in">
               {players.length < 3 ? (
                 <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center">
                     <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl mb-4">
                         <User className="w-12 h-12 text-tx-secondary animate-pulse" />
                     </div>
                     <p className="font-display text-2xl font-bold text-tx-base text-center">En attente de joueurs</p>
                     <p className="text-tx-secondary mt-2 font-bold">{players.length} / 3 minimum</p>
                 </div>
               ) : (
                 <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full max-w-md">
                    <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform -rotate-3">
                        <User className="w-16 h-16 text-accent-primary" />
                    </div>
                    <p className="font-display text-2xl font-black text-tx-base text-center mb-8 uppercase tracking-widest">Prêt à lancer ?</p>
                    
                    {isHost ? (
                        <button 
                            onClick={startNewGame}
                            className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                        >
                            COMMENCER LA PARTIE
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                            <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
                            <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                        </div>
                    )}
                 </div>
               )}
            </div>
        )}

        {/* PHASE: ROLES */}
        {currentPhase === 'roles' && (
            myRole ? (
                <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg p-4">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full shadow-brutal relative overflow-hidden">
                        {amIReady && (
                            <div className="absolute inset-0 bg-brand-bg/90 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in">
                                <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl shadow-brutal mb-4">
                                    <Check className="w-16 h-16 text-accent-success" />
                                </div>
                                <h3 className="font-display text-3xl font-black text-tx-base">Vous êtes prêt !</h3>
                                <p className="text-tx-secondary font-bold mt-2">En attente des autres...</p>
                            </div>
                        )}

                        <h3 className="font-display text-2xl font-black text-tx-secondary mb-8 uppercase tracking-widest">Votre Identité</h3>
                        
                        <div className="flex flex-col items-center gap-6 mb-8 min-h-[200px] justify-center">
                            {showRole ? (
                                <div className="animate-in zoom-in duration-200 flex flex-col items-center">
                                    {playersKnowRole && (
                                        <div className={cn(
                                            "font-display text-4xl font-black mb-6 px-6 py-2 rounded-xl border-4 border-brand-border bg-brand-inner shadow-brutal",
                                            myRole === 'CIVIL' ? 'text-[#06B6D4]' : myRole === 'UNDERCOVER' ? 'text-accent-secondary' : 'text-tx-base'
                                        )}>
                                            {myRole}
                                        </div>
                                    )}
                                    <div className="bg-brand-inner px-8 py-6 rounded-2xl border-4 border-brand-border shadow-brutal w-full">
                                        <span className="block text-xs font-bold text-tx-secondary uppercase tracking-widest mb-2">Mot Secret</span>
                                        <span className="font-display text-4xl font-black text-tx-base break-words">
                                            {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-tx-secondary flex flex-col items-center animate-in fade-in">
                                    <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-3xl shadow-brutal mb-6">
                                        <EyeOff className="w-16 h-16 opacity-50" />
                                    </div>
                                    <p className="font-bold text-lg uppercase tracking-widest">Maintenez pour révéler</p>
                                </div>
                            )}
                        </div>

                        <button
                            className="w-full bg-brand-inner border-4 border-brand-border rounded-2xl p-4 mb-6 transition-all hover:bg-tx-base hover:text-brand-bg group select-none touch-none shadow-brutal active:translate-y-1 active:shadow-none"
                            onMouseDown={() => setShowRole(true)}
                            onMouseUp={() => setShowRole(false)}
                            onMouseLeave={() => setShowRole(false)}
                            onTouchStart={() => setShowRole(true)}
                            onTouchEnd={() => setShowRole(false)}
                        >
                            <Eye className="w-8 h-8 mx-auto text-tx-secondary group-hover:text-brand-bg transition-colors" />
                        </button>

                        <button 
                            onClick={sendReady} 
                            className={cn(
                                "w-full h-16 font-display text-xl font-black tracking-wider rounded-2xl border-4 border-brand-border transition-all relative z-30 shadow-brutal",
                                amIReady 
                                ? "bg-accent-success text-brand-bg" 
                                : "bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary"
                            )}
                        >
                            {amIReady ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Check className="w-6 h-6" /> PRÊT (Annuler)
                                </div>
                            ) : (
                                "JE SUIS PRÊT"
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center flex-1 w-full p-4">
                    <Loader2 className="w-16 h-16 animate-spin text-accent-primary mb-4" />
                    <p className="font-display text-xl font-bold text-tx-base animate-pulse">Distribution des rôles en cours...</p>
                </div>
            )
        )}

        {/* PHASE: CLUES / DISCUSSION / VOTE */}
        {(currentPhase === 'clues' || currentPhase === 'discussion' || currentPhase === 'vote') && (
            <div className="flex flex-col w-full h-full relative">
                
                {/* TOP ZONE: ROLE/WORD */}
                <div className="flex justify-center w-full mb-6 px-4">
                    <div className="bg-brand-card border-4 border-brand-border rounded-2xl px-6 py-3 flex items-center gap-4 shadow-brutal select-none touch-none">
                        <span className="text-tx-secondary text-xs font-bold uppercase tracking-widest">Votre Mot</span>
                        <div className="w-1 h-6 bg-brand-border rounded-full" />
                        <div 
                            className="cursor-pointer flex items-center gap-2"
                            onMouseDown={() => setShowRole(true)}
                            onMouseUp={() => setShowRole(false)}
                            onMouseLeave={() => setShowRole(false)}
                            onTouchStart={() => setShowRole(true)}
                            onTouchEnd={() => setShowRole(false)}
                        >
                            {showRole ? (
                                <span className="font-display font-black text-tx-base animate-in fade-in">
                                    {playersKnowRole && <span className={cn(
                                        "mr-3 px-2 py-0.5 rounded border-2 border-brand-border bg-brand-inner",
                                        myRole === 'CIVIL' ? 'text-[#06B6D4]' : myRole === 'UNDERCOVER' ? 'text-accent-secondary' : 'text-tx-base'
                                    )}>{myRole}</span>}
                                    {myRole === 'MR_WHITE' ? '???' : myRole === 'UNDERCOVER' ? undercoverWord : civilWord}
                                </span>
                            ) : (
                                <div className="flex items-center gap-2 text-tx-muted font-bold uppercase text-sm">
                                    <Eye className="w-4 h-4" />
                                    <span>Maintenir</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MIDDLE: COLUMNS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-24 md:pb-4 w-full">
                    <div className="flex justify-center w-full">
                        <div className="flex flex-wrap justify-center gap-6 w-full max-w-7xl">
                            {alivePlayers.map(pid => {
                                const p = players.find(pl => pl.id === pid);
                                const pClues = clues.filter(c => c.playerId === pid);
                                const isSpeaking = currentPhase === 'clues' && currentSpeakerId === pid;
                                const votesForThisPlayer = votes.filter((v: any) => v.target_id === pid);
                                const hasVotedForThis = votesForThisPlayer.some((v: any) => v.voter_id === playerId);
                                
                                return (
                                    <div key={pid} className={cn(
                                        "flex flex-col bg-brand-card border-4 rounded-[24px] overflow-hidden h-[400px] md:h-[450px] relative w-full md:w-[31%] lg:w-[23%] shadow-brutal transition-all",
                                        isSpeaking ? "border-accent-primary" : "border-brand-border"
                                    )}>
                                        {/* Sticky Header */}
                                        <div className={cn(
                                            "p-4 text-center border-b-4 border-brand-border sticky top-0 z-10",
                                            isSpeaking ? "bg-accent-primary text-brand-bg" : "bg-brand-inner text-tx-base"
                                        )}>
                                            <div className="font-display font-black text-xl truncate">
                                                {p?.name}
                                            </div>
                                            {isSpeaking && <div className="text-[10px] font-black uppercase tracking-widest animate-pulse mt-1 opacity-80">En train d'écrire...</div>}
                                            
                                            {/* Votes Received Display */}
                                            {currentPhase === 'vote' && (
                                                <div className="mt-3 min-h-[24px]">
                                                    {votesForThisPlayer.length > 0 ? (
                                                        <div className="flex flex-wrap justify-center gap-2">
                                                            {votesForThisPlayer.map((v: any) => {
                                                                const voterName = players.find(pl => pl.id === v.voter_id)?.name;
                                                                return (
                                                                    <span key={v.id} className="text-[10px] font-bold bg-brand-bg border-2 border-brand-border px-2 py-1 rounded-md text-tx-base shadow-sm">
                                                                        {voterName}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="h-6"></div> // Placeholder
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Scrollable Content */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-20 bg-brand-bg/50">
                                            {pClues.map((c, idx) => (
                                                <div key={idx} className="bg-brand-inner border-2 border-brand-border p-3 rounded-xl text-sm font-bold text-tx-base shadow-brutal animate-in slide-in-from-bottom-2">
                                                    <span className="opacity-50 mr-2 text-xs font-black text-tx-secondary">#{idx + 1}</span>
                                                    {c.text}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Vote Button (Absolute Bottom of Column) */}
                                        {currentPhase === 'vote' && (
                                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-brand-card border-t-4 border-brand-border">
                                                <button 
                                                    onClick={() => sendVoteAction(pid)}
                                                    className={cn(
                                                        "w-full h-12 rounded-xl font-display font-black tracking-wider transition-colors border-2 border-brand-border flex items-center justify-center shadow-brutal",
                                                        pid === playerId ? "opacity-50 cursor-not-allowed bg-brand-inner text-tx-muted" :
                                                        hasVotedForThis ? "bg-accent-success text-brand-bg" : "bg-accent-secondary text-brand-bg hover:bg-brand-inner hover:text-accent-secondary"
                                                    )}
                                                    disabled={pid === playerId}
                                                >
                                                    {hasVotedForThis ? <Check className="w-5 h-5 mr-2" /> : <Skull className="w-5 h-5 mr-2" />}
                                                    {hasVotedForThis ? 'Voté' : 'Voter'}
                                                </button>
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
                    <div className="flex justify-center w-full py-4 z-20">
                        <button 
                            onClick={toggleSkipVote}
                            className={cn(
                                "rounded-2xl border-4 border-brand-border shadow-brutal font-display font-black tracking-wider transition-all px-8 py-4 text-lg flex items-center",
                                skipVotes.includes(playerId || '') ? "bg-accent-success text-brand-bg" : "bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg"
                            )}
                        >
                            {skipVotes.includes(playerId || '') ? (
                                <>
                                    <Check className="w-6 h-6 mr-3" /> Prêt à voter ({skipVotes.length}/{Math.floor(alivePlayers.length / 2) + 1})
                                </>
                            ) : (
                                <>
                                    Passer au vote ({skipVotes.length}/{Math.floor(alivePlayers.length / 2) + 1})
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* BOTTOM: INPUT (Desktop & Mobile Fixed) */}
                {isMyTurn && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 pr-[92px] z-50 md:relative md:bg-transparent md:border-none md:p-0 md:pr-0 md:mt-4">
                        <div className="max-w-3xl mx-auto flex gap-3">
                            <input 
                                placeholder="Donnez votre indice (1 mot)..." 
                                value={userClue}
                                onChange={e => setUserClue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendClue()}
                                className="flex-1 h-14 bg-brand-inner border-4 border-brand-border rounded-2xl px-6 text-lg font-bold text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors shadow-brutal"
                                autoFocus
                            />
                            <button 
                                onClick={sendClue} 
                                disabled={!userClue.trim()}
                                className="h-14 w-16 bg-accent-primary border-4 border-brand-border rounded-2xl flex items-center justify-center text-brand-bg hover:bg-tx-base transition-colors shadow-brutal disabled:bg-brand-inner disabled:text-tx-muted disabled:cursor-not-allowed"
                            >
                                <Send className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                )}
                
                {/* PHASE: DISCUSSION / VOTE INFO */}
                {currentPhase === 'discussion' && (
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-accent-secondary text-brand-bg px-8 py-3 rounded-2xl font-display font-black tracking-wider shadow-brutal border-4 border-brand-border animate-bounce z-40 flex items-center">
                        <MessageSquare className="w-5 h-5 mr-3" />
                        Débattez !
                    </div>
                )}
            </div>
        )}

        {/* PHASE: MR WHITE GUESS */}
        {currentPhase === 'mrwhite_guess' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-lg p-4">
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <AlertTriangle className="w-16 h-16 text-accent-primary animate-pulse" />
                    </div>
                    <h2 className="font-display text-3xl font-black text-tx-base mb-2">Mr. White a été trouvé !</h2>
                    <p className="text-tx-secondary font-bold mb-8">Il a une chance de gagner s&apos;il trouve le mot des Civils.</p>
                    
                    {eliminatedPlayerId === playerId ? (
                        <div className="flex flex-col gap-4">
                            <input 
                                placeholder="Quel est le mot ?" 
                                value={mrWhiteGuess}
                                onChange={e => setMrWhiteGuess(e.target.value)}
                                className="w-full h-14 bg-brand-inner border-4 border-brand-border rounded-2xl px-6 text-lg font-bold text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors shadow-brutal text-center"
                            />
                            <button 
                                onClick={sendMrWhiteGuess} 
                                className="w-full h-14 rounded-2xl font-display font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                            >
                                TENTER
                            </button>
                        </div>
                    ) : (
                        <p className="text-accent-primary font-black uppercase tracking-widest animate-pulse p-4 border-4 border-brand-border rounded-2xl bg-brand-inner shadow-brutal">
                            Mr. White réfléchit...
                        </p>
                    )}
                </div>
            </div>
        )}

        {/* PHASE: RESULTS */}
        {currentPhase === 'results' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4">
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <Crown className="w-16 h-16 text-accent-primary" />
                    </div>
                    
                    <h2 className="font-display text-4xl font-black text-tx-base mb-2 uppercase tracking-widest">
                        Victoire {game.winner === 'CIVILS' ? 'des Civils' : 'des Imposteurs'} !
                    </h2>
                    
                    <div className="grid gap-3 mt-8 text-left max-h-[300px] overflow-y-auto custom-scrollbar p-4 bg-brand-bg/50 rounded-2xl border-4 border-brand-border shadow-inner">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-4 bg-brand-inner border-2 border-brand-border rounded-xl shadow-sm">
                                <span className="font-display font-black text-lg text-tx-base">{p.name}</span>
                                <span className={cn(
                                    "font-black text-sm uppercase tracking-widest px-3 py-1 rounded-md border-2 border-brand-border",
                                    roles[p.id] === 'CIVIL' ? 'bg-[#06B6D4] text-brand-bg' : 
                                    roles[p.id] === 'UNDERCOVER' ? 'bg-accent-secondary text-brand-bg' : 'bg-tx-base text-brand-bg'
                                )}>
                                    {roles[p.id]}
                                </span>
                            </div>
                        ))}
                    </div>

                    {isHost && (
                        <button 
                            onClick={nextGameRound} 
                            className="mt-8 w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success shadow-brutal"
                        >
                            {currentRoundNumber >= rounds ? "REVENIR AU SALON" : "MANCHE SUIVANTE"}
                        </button>
                    )}
                    <button 
                        onClick={() => router.push('/')} 
                        className="mt-6 w-full h-14 rounded-2xl font-display font-black tracking-wider transition-colors border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base shadow-brutal flex items-center justify-center gap-3"
                    >
                        <Home className="w-5 h-5" /> RETOUR AU MENU
                    </button>
                </div>
            </div>
        )}
      </div>
    </GameLayout>
  );
} 
