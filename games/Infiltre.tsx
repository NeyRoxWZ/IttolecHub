'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Skull, Loader2, Send, Check, Crown, Home, ThumbsUp, ThumbsDown, HelpCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type Role = 'MASTER' | 'INFILTRE' | 'CITIZEN';
type Phase = 'setup' | 'roles' | 'playing' | 'voting_finder' | 'voting_infiltre' | 'results';
type AnswerType = 'OUI' | 'NON' | 'NE_SAIS_PAS';

interface InfiltreProps {
  roomCode: string;
}

export default function Infiltre({ roomCode }: InfiltreProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    infiltre,
    sendMove,
    getTimeLeft,
    updateRoundData,
    resetAllPlayersReady,
    setPlayerReady,
    setGameStatus,
    roomId,
    roomStatus,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'infiltre');

  // --- DERIVED STATE ---
  const game = infiltre?.game || {};
  const currentPhase = (game.phase as Phase) || 'setup';

  // --- EFFECTS ---
  // Broadcast Listener for Lobby Return
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}`);
    }
  }, [lastEvent, roomCode, router]);
  
  const roles = useMemo(() => {
      const r: Record<string, Role> = {};
      infiltre?.roles?.forEach((p: any) => r[p.player_id] = p.role as Role);
      return r;
  }, [infiltre?.roles]);
  
  const myRole = playerId ? roles[playerId] : null;
  const secretWord = game.secret_word;
  const masterId = game.master_id;
  const finderId = game.finder_id;
  
  const questions = useMemo(() => {
      return infiltre?.questions?.map((q: any) => ({
          id: q.id,
          playerId: q.player_id,
          text: q.text,
          answer: q.answer as AnswerType | null,
          timestamp: new Date(q.created_at).getTime()
      })) || [];
  }, [infiltre?.questions]);

  // Read votes from SQL
  const votes = useMemo(() => {
      return infiltre?.votes || [];
  }, [infiltre?.votes]);

  const alivePlayers = useMemo(() => {
      // Sort players by ID to keep consistent order (or by joined_at if available in players object)
      // We use players array which might be unsorted. Let's sort it.
      const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
      return sorted.map(p => p.id);
  }, [players]);

  // Settings
  const settings = gameState?.settings || {};
  const rounds = Number(settings.rounds || 1);
  const guessTime = Number(settings.guessTime || 5) * 60; // Minutes to seconds
  const voteTime = Number(settings.voteTime || 30); // Seconds
  const currentRoundNumber = gameState?.current_round || 0;

  // Ready Status
  const readyPlayersFromTable = useMemo(() => {
      return players.filter((p: any) => p.is_ready).map(p => p.id);
  }, [players]);
  const amIReady = playerId && readyPlayersFromTable.includes(playerId);

  // Local State
  const [userQuestion, setUserQuestion] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRole, setShowRole] = useState(false); // For Eye button logic
  const [confirmingWinnerId, setConfirmingWinnerId] = useState<string | null>(null);

  const isMaster = myRole === 'MASTER';
  
  // --- NOTIFICATIONS & TIMER ---
  const lastNotificationId = useRef<string>('');
  const notification = (gameState?.round_data?.notification as { id: string, message: string, type: 'success' | 'info' | 'error' } | null) || null;

  useEffect(() => {
    if (notification && notification.id !== lastNotificationId.current) {
        lastNotificationId.current = notification.id;
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
        const expiresAt = timerStart + duration;
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        return remaining;
    };

    setTimeLeft(calculateRemaining());

    const interval = setInterval(() => {
        const remaining = calculateRemaining();
        setTimeLeft(remaining);
        if (remaining <= 0) {
            clearInterval(interval);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [game.timer_start_at, game.timer_duration_seconds]);

  // --- HOST LOGIC ---
  useEffect(() => {
    if (!isHost || !roomId) return;

    const managePhases = async () => {
        // 1. Roles -> Playing (All Ready)
        if (currentPhase === 'roles') {
             const allReady = alivePlayers.every(id => readyPlayersFromTable.includes(id));
             if (allReady && alivePlayers.length > 0) { 
                 await supabase.from('infiltre_games').update({
                     phase: 'playing',
                     timer_start_at: new Date().toISOString(),
                     timer_duration_seconds: guessTime
                 }).eq('room_id', roomId);
                 
                 await updateRoundData({
                     phase: 'playing',
                     notification: { id: Date.now().toString(), message: "La partie commence ! Posez vos questions.", type: 'info' }
                 });
             }
        }

        // 2. Playing -> Results (Time limit reached = Defeat)
        if (currentPhase === 'playing' && game.timer_start_at) {
             const timerStart = new Date(game.timer_start_at).getTime();
             const duration = (game.timer_duration_seconds || 0) * 1000;
             const now = Date.now();
             
             // Check strict expiry with a small buffer
             if (now > timerStart + duration + 1000) {
                 // Time up! Everyone loses? Or Infiltrator wins?
                 // "Si le mot n'est pas trouvé → tout le monde perd"
                 await supabase.from('infiltre_games').update({
                     phase: 'results',
                     winner: 'NONE' // Everyone loses
                 }).eq('room_id', roomId);
                 
                 await updateRoundData({
                     phase: 'results',
                     notification: { id: Date.now().toString(), message: "Temps écoulé ! Personne n'a trouvé le mot.", type: 'error' }
                 });
             }
        }
        
        // 3. Voting Phases (Time limit logic if we want to auto-resolve?)
        if ((currentPhase === 'voting_finder' || currentPhase === 'voting_infiltre') && game.timer_start_at) {
             const timerStart = new Date(game.timer_start_at).getTime();
             const duration = (game.timer_duration_seconds || 0) * 1000;
             const now = Date.now();
             
             if (now > timerStart + duration + 1000) {
                 // Time up for voting -> Force resolve
                 const votePhase = currentPhase === 'voting_finder' ? 'FINDER' : 'INFILTRE';
                 const { data: currentVotes } = await supabase.from('infiltre_votes').select('*').eq('room_id', roomId).eq('vote_phase', votePhase);
                 await processVotes(currentVotes || [], votePhase);
             }
        }
    };

    managePhases();
  }, [isHost, currentPhase, timeLeft, alivePlayers, guessTime, readyPlayersFromTable, gameState, roomId, game.timer_start_at]);

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 4 && currentPhase === 'setup') {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length, currentPhase]);

  // --- ACTIONS ---

  const startNewGame = async () => {
    if (!isHost || !roomId) return;
    if (players.length < 4) {
        toast.error("Il faut au moins 4 joueurs !");
        return;
    }

    try {
        const res = await fetch(`/api/games/infiltre?category=${settings.category}`);
        const data = await res.json();
        if (!data || !data.secretWord) return;

        if (resetAllPlayersReady) await resetAllPlayersReady();

        const { newRoles } = assignRoles(players);

        // Find Master ID
        const newMasterId = Object.keys(newRoles).find(id => newRoles[id] === 'MASTER');

        // SQL Initialization
        await supabase.from('infiltre_games').upsert({
            room_id: roomId,
            phase: 'roles',
            secret_word: data.secretWord,
            category: data.category,
            master_id: newMasterId,
            finder_id: null,
            timer_start_at: null,
            timer_duration_seconds: null,
            created_at: new Date().toISOString()
        }, { onConflict: 'room_id' });

        const playerInserts = players.map(p => ({
            room_id: roomId,
            player_id: p.id,
            role: newRoles[p.id],
            is_alive: true
        }));
        await supabase.from('infiltre_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });

        await supabase.from('infiltre_questions').delete().eq('room_id', roomId);
        await supabase.from('infiltre_votes').delete().eq('room_id', roomId);

        // Ensure room status is in_game so players are redirected if they are in lobby
        await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);

        await updateRoundData({
            phase: 'roles',
            current_round: 1,
            notification: { id: Date.now().toString(), message: "Rôles attribués ! Découvrez votre identité.", type: 'success' }
        });
    } catch (e) {
        console.error(e);
        toast.error("Erreur au démarrage");
    }
  };

  const assignRoles = (allPlayers: any[]) => {
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const newRoles: Record<string, Role> = {};
    
    // 1 Master (Random from ALL players)
    const masterIndex = Math.floor(Math.random() * shuffled.length);
    const master = shuffled[masterIndex];
    newRoles[master.id] = 'MASTER';
    
    // Remove Master from pool for other roles
    const remaining = shuffled.filter((_, i) => i !== masterIndex);
    
    // 1 Infiltre (Random from remaining)
    const infiltre = remaining.pop();
    if (infiltre) newRoles[infiltre.id] = 'INFILTRE';
    
    // Rest Citizens
    remaining.forEach(p => newRoles[p.id] = 'CITIZEN');

    return { newRoles };
  };

  // --- PLAYING ACTIONS ---

  const sendQuestion = async () => {
      if (!userQuestion.trim() || !roomId || !playerId) return;
      
      const questionText = userQuestion;
      
      // AI-like suggestion (Simple check if secret word is in question)
      // This is local check, but good enough.
      // Master will see the question. We can add a "flag" or just rely on Master.
      // The user asked for "AI suggests to Master".
      // We can insert with a flag 'contains_secret' if we want, or just highlight it on Master side.
      // But we can't easily check secretWord on client side for non-Master/non-Infiltre (it is hidden).
      // Wait, 'secretWord' variable is only available if I am Master or Infiltre or Game Over.
      // If I am Citizen, secretWord is undefined or hidden?
      // In `useGameSync` -> `infiltre.game` -> `secret_word`.
      // Row Level Security should hide it? Or is it sent to everyone?
      // In `Infiltre.tsx`: `const secretWord = game.secret_word;`.
      // If RLS is not set up to hide columns, everyone receives it.
      // Assuming everyone receives it but UI hides it.
      // If so, we can check it here.
      // If RLS hides it, `secretWord` is null for Citizens.
      // So we can't check on Client for Citizens.
      // We must check on Server (Postgres Function) or just let Master see it.
      // But we can't do server side logic easily here without Edge Function.
      // Workaround: Master client detects it when receiving the question.
      
      await supabase.from('infiltre_questions').insert({
          room_id: roomId,
          player_id: playerId,
          text: questionText,
          answer: null
      });
      
      setUserQuestion('');
  };

  const answerQuestion = async (questionId: string, answer: AnswerType) => {
      if (!isMaster || !roomId) return;
      await supabase.from('infiltre_questions').update({
          answer: answer
      }).eq('id', questionId);
  };

  const triggerWordFound = async (finderId: string) => {
      if (!isMaster || !roomId) return;
      
      // Reset confirmation state
      setConfirmingWinnerId(null);
      
      // Move to Voting Phase 1
      await supabase.from('infiltre_games').update({
          phase: 'voting_finder',
          finder_id: finderId,
          timer_start_at: new Date().toISOString(),
          timer_duration_seconds: voteTime
      }).eq('room_id', roomId);
      
      await updateRoundData({
          phase: 'voting_finder',
          notification: { id: Date.now().toString(), message: "Le mot a été trouvé ! Votez : Qui est l'Infiltré ?", type: 'success' }
      });
  };

  // --- VOTING ACTIONS ---

  const sendVote = async (targetId: string) => {
      if (!roomId || !playerId || isMaster) return; // Master cannot vote
      
      // Determine phase for vote tagging
      const votePhase = currentPhase === 'voting_finder' ? 'FINDER' : 'INFILTRE';
      
      // Check if already voted
      const myVote = votes.find((v: any) => v.voter_id === playerId && v.vote_phase === votePhase);
      if (myVote) {
          // Update existing vote
          await supabase.from('infiltre_votes').update({
              target_id: targetId
          }).eq('id', myVote.id);
          toast.success('Vote modifié');
      } else {
          // Insert new vote
          await supabase.from('infiltre_votes').insert({
              room_id: roomId,
              voter_id: playerId,
              target_id: targetId,
              vote_phase: votePhase
          });
          toast.success('Vote enregistré');
      }
      
      // Check if everyone voted (Client-side trigger for Host)
      if (isHost) {
          // Slight delay to allow propagation
          setTimeout(() => checkVoteCompletion(votePhase), 500);
      }
  };

  const checkVoteCompletion = async (votePhase: string) => {
      // Fetch fresh votes
      const { data: currentVotes } = await supabase.from('infiltre_votes').select('*').eq('room_id', roomId).eq('vote_phase', votePhase);
      
      // Filter votes to ensure unique voters (in case of race conditions, take latest)
      // Actually DB should handle uniqueness via RLS or constraint, but we don't have unique constraint on (room_id, voter_id, phase) yet?
      // Let's assume frontend prevents it mostly, but let's be safe.
      // Filter out duplicate voters if any.
      
      const uniqueVoters = new Set(currentVotes?.map((v: any) => v.voter_id));
      
      // All players except Master vote? Or Master votes too?
      // Rules: "Majorité accuse..." usually implies everyone votes including Master.
      // But user said "le grand maitre est toujours dans les votes ils doit pas etre affiché".
      // This refers to TARGETS. Does Master VOTE?
      // Usually Master is impartial referee.
      // If Master doesn't vote, we check against `players.length - 1`.
      // Let's assume Master does NOT vote.
      const votersCount = uniqueVoters.size;
      const expectedVoters = players.length - 1; // Master doesn't vote
      
      if (votersCount >= expectedVoters) {
          processVotes(currentVotes || [], votePhase);
      }
  };

  const processVotes = async (currentVotes: any[], votePhase: string) => {
      if (!roomId) return;
      
      // Count votes
      const voteCounts: Record<string, number> = {};
      currentVotes.forEach((v: any) => {
          voteCounts[v.target_id] = (voteCounts[v.target_id] || 0) + 1;
      });

      // Find max
      let maxVotes = 0;
      let accusedId: string | null = null;
      let isTie = false;

      Object.entries(voteCounts).forEach(([pid, count]) => {
          if (count > maxVotes) {
              maxVotes = count;
              accusedId = pid;
              isTie = false;
          } else if (count === maxVotes) {
              isTie = true;
          }
      });
      
      // If we are in voting phase and timer is done, or if everyone voted.
      // But this function is called either by "All Voted" or "Time Up".
      // So we just process.

      const accusedRole = accusedId ? roles[accusedId] : null;

      if (votePhase === 'FINDER') {
          // Vote 1: Did the Finder find it because they are the Infiltrator?
          
          if (accusedId === finderId && accusedRole === 'INFILTRE') {
              // Caught!
              await finishGame('CITIZENS');
          } else {
              // Not caught or Wrong person accused -> 2nd Vote
              await supabase.from('infiltre_games').update({
                  phase: 'voting_infiltre',
                  timer_start_at: new Date().toISOString(),
                  timer_duration_seconds: voteTime
              }).eq('room_id', roomId);
              
              await updateRoundData({
                  phase: 'voting_infiltre',
                  notification: { id: Date.now().toString(), message: "Infiltré non trouvé ! Dernière chance : Vote Final.", type: 'error' }
              });
          }
      } else {
          // Vote 2: General Vote
          
          if (accusedRole === 'INFILTRE') {
              await finishGame('CITIZENS');
          } else {
              await finishGame('INFILTRE');
          }
      }
  };

  const finishGame = async (winner: string) => {
      if (!roomId) return;
      await supabase.from('infiltre_games').update({
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
      
      if (nextRoundNum > rounds) {
          // Return to lobby
          await supabase.from('infiltre_games').delete().eq('room_id', roomId);
          await supabase.from('infiltre_players').delete().eq('room_id', roomId);
          await supabase.from('infiltre_questions').delete().eq('room_id', roomId);
          await supabase.from('infiltre_votes').delete().eq('room_id', roomId);
          
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

      // Next Round
      try {
          const res = await fetch(`/api/games/infiltre?category=${settings.category}`);
          const data = await res.json();
          if (!data || !data.secretWord) return;

          if (resetAllPlayersReady) await resetAllPlayersReady();
          const { newRoles } = assignRoles(players);
          const newMasterId = Object.keys(newRoles).find(id => newRoles[id] === 'MASTER');

          await supabase.from('infiltre_games').update({
              phase: 'roles',
              secret_word: data.secretWord,
              category: data.category,
              master_id: newMasterId,
              finder_id: null,
              timer_start_at: null,
              timer_duration_seconds: null,
              winner: null
          }).eq('room_id', roomId);

          // Clear previous questions and votes
          await supabase.from('infiltre_questions').delete().eq('room_id', roomId);
          await supabase.from('infiltre_votes').delete().eq('room_id', roomId);
          
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              role: newRoles[p.id],
              is_alive: true
          }));
          await supabase.from('infiltre_players').upsert(playerInserts, { onConflict: 'room_id,player_id' });
          
          await updateRoundData({
              current_round: nextRoundNum,
              notification: { id: Date.now().toString(), message: `Manche ${nextRoundNum} commencée !`, type: 'success' }
          });
          
      } catch (e) { console.error(e); }
  };

  // --- CLIENT ACTIONS ---
  const sendReady = async () => {
    // Toggle ready state
    if (!setPlayerReady) return;
    await setPlayerReady(!amIReady);
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
      gameTitle="L'Infiltré"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
      showScores={false}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in">
               {players.length < 4 ? (
                 <>
                    <User className="w-16 h-16 text-gray-600 animate-pulse" />
                    <p className="text-2xl font-medium text-gray-400">En attente de joueurs ({players.length}/4+)...</p>
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
                <div className="bg-slate-900/80 p-8 rounded-3xl border border-white/10 text-center w-full shadow-2xl relative overflow-hidden">
                    {amIReady && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in">
                            <Check className="w-20 h-20 text-green-500 mb-4" />
                            <h3 className="text-3xl font-bold text-white">Vous êtes prêt !</h3>
                            <p className="text-gray-400 mt-2">En attente des autres...</p>
                        </div>
                    )}

                    <h3 className="text-2xl font-bold text-gray-400 mb-8">Votre Identité</h3>
                    
                    <div className="flex flex-col items-center gap-6 mb-8 min-h-[200px] justify-center">
                        {showRole ? (
                            <div className="animate-in zoom-in duration-200 flex flex-col items-center">
                                <div className={`text-4xl font-black mb-4 ${myRole === 'MASTER' ? 'text-yellow-400' : myRole === 'INFILTRE' ? 'text-red-500' : 'text-blue-400'}`}>
                                    {myRole === 'MASTER' ? 'MAÎTRE DU JEU' : myRole === 'INFILTRE' ? 'INFILTRÉ' : 'CITOYEN'}
                                </div>
                                <div className="bg-white/10 px-8 py-4 rounded-xl border border-white/20">
                                    <span className="block text-sm text-gray-400 uppercase tracking-widest mb-1">Mot Secret</span>
                                    <span className="text-3xl font-bold text-white">
                                        {myRole === 'CITIZEN' ? '???' : secretWord}
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
                        className="w-full bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/20 rounded-xl p-4 mb-4 transition-colors select-none touch-none"
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
                        // disabled={!!amIReady} // Allow toggling ready
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

        {/* PHASE: PLAYING */}
        {currentPhase === 'playing' && (
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
                                    <span className={myRole === 'MASTER' ? 'text-yellow-400 mr-2' : myRole === 'INFILTRE' ? 'text-red-500 mr-2' : 'text-blue-400 mr-2'}>
                                        {myRole === 'MASTER' ? 'MAÎTRE' : myRole === 'INFILTRE' ? 'INFILTRÉ' : 'CITOYEN'}
                                    </span>
                                    {myRole === 'CITIZEN' ? '???' : secretWord}
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

                {/* QUESTIONS FEED */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-32 md:pb-4 w-full max-w-4xl mx-auto">
                    <div className="space-y-4">
                        {questions.length === 0 && (
                            <div className="text-center text-gray-500 mt-10">
                                <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Posez des questions pour trouver le mot !</p>
                            </div>
                        )}
                        {questions.map((q: any) => {
                            const asker = players.find(p => p.id === q.playerId);
                            
                            // Fuzzy search for secret word detection
                            const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const normalizedText = normalize(q.text);
                            const normalizedSecret = secretWord ? normalize(secretWord) : '';
                            
                            // Check exact containment (normalized)
                            let likelySecret = isMaster && secretWord && normalizedText.includes(normalizedSecret);
                            
                            // Check similarity (Levensthein-ish) if not found and word is long enough
                            if (!likelySecret && isMaster && secretWord && normalizedSecret.length > 3) {
                                const words = normalizedText.split(/\s+/);
                                likelySecret = words.some(w => {
                                    if (Math.abs(w.length - normalizedSecret.length) > 2) return false;
                                    // Simple distance check: count different chars
                                    let diff = 0;
                                    for(let i=0; i<Math.min(w.length, normalizedSecret.length); i++) {
                                        if(w[i] !== normalizedSecret[i]) diff++;
                                    }
                                    diff += Math.abs(w.length - normalizedSecret.length);
                                    return diff <= 2; // Allow 2 typos
                                });
                            }

                            return (
                                <div key={q.id} className={`bg-slate-900/50 border ${likelySecret ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-white/5'} rounded-xl p-4 animate-in slide-in-from-bottom-2 relative`}>
                                    {likelySecret && !q.answer && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 text-yellow-500 text-xs font-bold animate-pulse bg-yellow-500/10 px-2 py-1 rounded-full">
                                            <Crown className="w-3 h-3" /> Mot trouvé ?
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-blue-300">{asker?.name}</span>
                                        <span className="text-xs text-gray-500">{new Date(q.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-lg text-white mb-3">{q.text}</p>
                                    
                                    {/* ANSWER AREA */}
                                    {q.answer ? (
                                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold 
                                            ${q.answer === 'OUI' ? 'bg-green-500/20 text-green-400' : 
                                              q.answer === 'NON' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {q.answer === 'OUI' ? <ThumbsUp className="w-4 h-4 mr-2" /> : 
                                             q.answer === 'NON' ? <ThumbsDown className="w-4 h-4 mr-2" /> : <HelpCircle className="w-4 h-4 mr-2" />}
                                            {q.answer.replace('_', ' ')}
                                        </div>
                                    ) : isMaster ? (
                                        <div className="flex flex-col gap-2">
                                            {likelySecret && (
                                                <div className="flex gap-2 w-full">
                                                    {confirmingWinnerId === q.playerId ? (
                                                        <div className="flex gap-2 w-full animate-in fade-in">
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => triggerWordFound(q.playerId)} 
                                                                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold"
                                                            >
                                                                Confirmer
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => setConfirmingWinnerId(null)} 
                                                                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white"
                                                            >
                                                                Annuler
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => setConfirmingWinnerId(q.playerId)} 
                                                                className="flex-[2] bg-yellow-500 text-black hover:bg-yellow-400 font-bold animate-pulse"
                                                            >
                                                                <Crown className="w-4 h-4 mr-2" /> Valider que {asker?.name} a trouvé !
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => answerQuestion(q.id, 'NON')} 
                                                                className="flex-1 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs"
                                                            >
                                                                Non, pas trouvé
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {/* Hide regular buttons if we are in confirmation mode for this specific question */}
                                            {likelySecret && confirmingWinnerId === q.playerId ? null : (
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={() => answerQuestion(q.id, 'OUI')} className="bg-green-600 hover:bg-green-500 text-white flex-1">Oui</Button>
                                                    <Button size="sm" onClick={() => answerQuestion(q.id, 'NON')} className="bg-red-600 hover:bg-red-500 text-white flex-1">Non</Button>
                                                    <Button size="sm" onClick={() => answerQuestion(q.id, 'NE_SAIS_PAS')} className="bg-gray-600 hover:bg-gray-500 text-white flex-1">Je ne sais pas</Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">En attente du Maître...</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* BOTTOM INPUT (Fixed Mobile) */}
                {!isMaster && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-white/10 z-50 md:relative md:bg-transparent md:border-none md:p-0 md:mt-4">
                        <div className="max-w-2xl mx-auto flex gap-2">
                            <Input 
                                placeholder="Posez une question..." 
                                value={userQuestion}
                                onChange={e => setUserQuestion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                                className="h-14 bg-slate-900 border-white/20 text-lg md:h-12"
                            />
                            <Button 
                                onClick={sendQuestion} 
                                disabled={!userQuestion.trim()}
                                className="h-14 px-8 bg-indigo-600 hover:bg-indigo-500 font-bold md:h-12"
                            >
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* MASTER CONTROLS */}
                {isMaster && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-lg border-t border-white/10 z-50 md:relative md:bg-transparent md:border-none md:p-0 md:mt-4 text-center">
                        <p className="text-gray-400 mb-2">Quelqu'un a trouvé le mot ?</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {players.filter(p => p.id !== playerId).map(p => (
                                <Button 
                                    key={p.id}
                                    onClick={() => triggerWordFound(p.id)}
                                    variant="outline"
                                    className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                                >
                                    <Crown className="w-4 h-4 mr-2" />
                                    {p.name} a trouvé
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* PHASE: VOTING (FINDER or INFILTRE) */}
        {(currentPhase === 'voting_finder' || currentPhase === 'voting_infiltre') && (
            <div className="flex flex-col w-full h-full relative">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {currentPhase === 'voting_finder' ? "Qui est l'Infiltré ?" : "Dernière chance !"}
                    </h2>
                    <p className="text-gray-400">
                        {currentPhase === 'voting_finder' 
                            ? `Le mot a été trouvé par ${players.find(p => p.id === finderId)?.name}. Est-ce l'Infiltré ?`
                            : "Le précédent vote a échoué. Trouvez l'Infiltré pour gagner !"}
                    </p>
                </div>

                {/* VOTING COLUMNS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 w-full">
                    <div className="flex justify-center w-full">
                        <div className="flex flex-wrap justify-center gap-4 w-full max-w-7xl">
                            {alivePlayers.filter(pid => {
                                const role = roles[pid];
                                // Exclude Master from being a target in both voting phases
                                if (role === 'MASTER') return false;
                                return true;
                            }).map(pid => {
                                const p = players.find(pl => pl.id === pid);
                                const votesForThisPlayer = votes.filter((v: any) => v.target_id === pid && v.vote_phase === (currentPhase === 'voting_finder' ? 'FINDER' : 'INFILTRE'));
                                const hasVotedForThis = votesForThisPlayer.some((v: any) => v.voter_id === playerId);
                                
                                return (
                                    <div key={pid} className="flex flex-col bg-slate-900/50 border border-white/5 rounded-xl overflow-hidden h-[300px] relative w-full md:w-[31%] lg:w-[23%]">
                                        <div className="p-4 text-center border-b border-white/5 bg-slate-900/80">
                                            <div className="font-bold text-xl text-white">{p?.name}</div>
                                            {pid === finderId && currentPhase === 'voting_finder' && (
                                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full mt-1 inline-block">A trouvé le mot</span>
                                            )}
                                        </div>

                                        {/* Votes Display */}
                                        <div className="flex-1 p-4 flex flex-wrap content-start gap-2 justify-center">
                                            {votesForThisPlayer.map((v: any) => {
                                                const voterName = players.find(pl => pl.id === v.voter_id)?.name;
                                                return (
                                                    <span key={v.id} className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300 flex items-center">
                                                        🗳 {voterName}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        {/* Vote Button */}
                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900 to-transparent pt-6">
                                            {!isMaster && (
                                                <Button 
                                                    onClick={() => sendVote(pid)}
                                                    className={`w-full font-bold ${hasVotedForThis ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                                                    disabled={pid === playerId} // Can't vote for self? Rules don't specify, but usually yes.
                                                >
                                                    {hasVotedForThis ? <Check className="w-4 h-4 mr-2" /> : <Skull className="w-4 h-4 mr-2" />}
                                                    {hasVotedForThis ? 'Voté' : 'Accuser'}
                                                </Button>
                                            )}
                                            {isMaster && (
                                                <div className="text-center text-xs text-gray-500 italic pb-2">
                                                    Le Maître observe le vote...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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
                        Victoire {game.winner === 'CITIZENS' ? 'des Citoyens' : game.winner === 'INFILTRE' ? "de l'Infiltré" : 'de Personne'} !
                    </h2>
                    
                    <div className="grid gap-2 mt-8 text-left max-h-[300px] overflow-y-auto custom-scrollbar bg-black/20 p-4 rounded-xl">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                <span className="font-bold text-white">{p.name}</span>
                                <span className={`font-mono text-sm font-bold ${
                                    roles[p.id] === 'MASTER' ? 'text-yellow-400' : 
                                    roles[p.id] === 'INFILTRE' ? 'text-red-500' : 'text-blue-400'
                                }`}>
                                    {roles[p.id] === 'MASTER' ? 'MAÎTRE' : roles[p.id] === 'INFILTRE' ? 'INFILTRÉ' : 'CITOYEN'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {isHost && (
                        <Button onClick={nextGameRound} className="mt-8 w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl">
                            {currentRoundNumber >= rounds ? "Revenir au salon" : "Manche Suivante"}
                        </Button>
                    )}
                    <Button variant="ghost" onClick={() => router.push('/')} className="mt-4 text-gray-500 hover:text-white">
                        <Home className="w-4 h-4 mr-2" /> Retour au menu
                    </Button>
                </div>
            </div>
        )}

      </div>
    </GameLayout>
  );
}
