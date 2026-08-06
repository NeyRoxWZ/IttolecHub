'use client';

import { useEffect, useMemo, useState, useRef } from 'react';


import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff, MessageSquare, AlertTriangle, Skull, Loader2, Send, Check, Crown, Home, ThumbsUp, ThumbsDown, HelpCircle, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import VoteToLobby from './components/VoteToLobby';
import { vibrate, HAPTIC } from '@/lib/haptic';

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
    broadcast,
    isConnected
  } = useGameSync(roomCode, 'infiltre');

  // --- DERIVED STATE ---
  const game = infiltre?.game || {};
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
      infiltre?.roles?.forEach((p: any) => r[p.player_id] = p.role as Role);
      return r;
  }, [infiltre?.roles]);
  
  const myRole = playerId ? roles[playerId] : null;
  const secretWord = game.secret_word;
  const masterId = game.master_id;
  const finderId = game.finder_id;
  const roundStartedAt = Number((gameState?.round_data as any)?.round_started_at || 0);
  
  const questions = useMemo(() => {
      const all = infiltre?.questions?.map((q: any) => ({
          id: q.id,
          playerId: q.player_id,
          text: q.text,
          answer: q.answer as AnswerType | null,
          timestamp: new Date(q.created_at).getTime()
      })) || [];
      if (!roundStartedAt) return all;
      return all.filter(q => q.timestamp >= roundStartedAt);
  }, [infiltre?.questions, roundStartedAt]);

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

  // Reset local state when phase changes to setup or roles
  useEffect(() => {
      if (currentPhase === 'setup' || currentPhase === 'roles') {
          setUserQuestion('');
          setShowRole(false);
          setConfirmingWinnerId(null);
      }
  }, [currentPhase]);

  const isAlive = useMemo(() => {
    // Check if player is alive in DB (if we add elimination)
    // For now, everyone is alive until game end.
    return true;
  }, []);
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

  // Auto-start (Removed to fix automatic transition to role distribution)
  /*
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup' && players.length >= 4 && currentPhase === 'setup') {
          startNewGame();
      }
  }, [isHost, gameState?.round_data?.phase, players.length, currentPhase]);
  */

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

        const { error: gameError } = await supabase.from('infiltre_games').upsert({
            room_id: roomId,
            round_id: String(currentRoundNumber || 1),
            phase: 'roles',
            secret_word: data.secretWord,
            category: data.category,
            master_id: newMasterId,
            finder_id: null,
            timer_start_at: null,
            timer_duration_seconds: null,
            created_at: new Date().toISOString()
        }, { onConflict: 'room_id' });

        if (gameError) console.error("GAME ERROR", gameError);

        const playerInserts = players.map(p => ({
            room_id: roomId,
            round_id: String(currentRoundNumber || 1),
            player_id: p.id,
            role: newRoles[p.id],
            is_alive: true
        }));
        
        await supabase.from('infiltre_players').delete().eq('room_id', roomId);
        const { error: playersError } = await supabase.from('infiltre_players').insert(playerInserts);

        if (playersError) console.error("PLAYERS ERROR", playersError);

        await supabase.from('infiltre_questions').delete().eq('room_id', roomId);
        await supabase.from('infiltre_votes').delete().eq('room_id', roomId);

        // Ensure room status is in_game so players are redirected if they are in lobby
        await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);

        await supabase.from('game_sessions').update({
            current_round: 1,
            round_data: {
                phase: 'roles',
                current_round: 1,
                round_started_at: Date.now(),
                notification: { id: Date.now().toString(), message: "Rôles attribués ! Découvrez votre identité.", type: 'success' }
            }
        }).eq('room_id', roomId);
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

      vibrate(HAPTIC.SOFT);
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
      if (!roomId || !playerId || isMaster || !isAlive) return; // Master cannot vote, Dead cannot vote (if any dead logic)
      
      // Determine phase for vote tagging
      const votePhase = currentPhase === 'voting_finder' ? 'FINDER' : 'INFILTRE';
      
      // Check if already voted
      const myVote = votes.find((v: any) => v.voter_id === playerId && v.vote_phase === votePhase);
      if (myVote) {
          // Update existing vote
          await supabase.from('infiltre_votes').update({
              target_id: targetId
          }).eq('id', myVote.id);
          vibrate(HAPTIC.MEDIUM);
          toast.success('Vote modifié');
      } else {
          // Insert new vote
          await supabase.from('infiltre_votes').insert({
              room_id: roomId,
              voter_id: playerId,
              target_id: targetId,
              vote_phase: votePhase
          });
          vibrate(HAPTIC.MEDIUM);
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
      
      const uniqueVoters = new Set(currentVotes?.map((v: any) => v.voter_id));
      
      const votersCount = uniqueVoters.size;
      const expectedVoters = players.length - 1; // Master doesn't vote
      
      // If we are in the second vote, maybe fewer people?
      // "si y'en a que 3 a voté si un mec meurt il doit plus pouvoir voté"
      // In Infiltre, no one dies before the end.
      // But if user wants "handle early end if only 2 players left" -> implies elimination?
      // In Infiltre, usually you vote, if wrong -> game continues?
      // No, rules say: "Si Infiltré non trouvé -> Infiltré gagne" OR "2ème vote".
      // Our logic: Vote 1 (Finder) -> if fail -> Vote 2 (General).
      // If Vote 2 fails -> Infiltré Wins.
      // So no one dies in between.
      // But maybe user refers to "Undercover" logic mixed with Infiltre?
      // "le deuxieme vote sers a rien a l'infiltré si il reste que 2 joueur"
      // Ah, if only 2 players (Master + Finder + Infiltre? No 2 players total?)
      // Minimum 4 players.
      // If 4 players: 1 Master, 1 Infiltre, 2 Citizens.
      // Master doesn't vote.
      // Voters: 3 (Infiltre + 2 Citizens).
      // If Infiltre is Finder -> Vote 1 on Finder.
      // Voters: 3.
      // If Vote 1 fails -> Vote 2 on Everyone.
      // Voters: 3.
      // So always > 2 voters.
      
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
      
      const accusedRole = accusedId ? roles[accusedId] : null;

      if (votePhase === 'FINDER') {
          // Vote 1: Did the Finder find it because they are the Infiltrator?
          
          if (accusedId === finderId && accusedRole === 'INFILTRE') {
              // Caught!
              await finishGame('CITIZENS');
          } else {
              // Not caught or Wrong person accused -> 2nd Vote
              // BUT if remaining players count is low (e.g. only 3 people playing), 2nd vote is same people?
              // The user said: "le deuxieme vote sers a rien a l'infiltré si il reste que 2 joueur".
              // Maybe if 3 players total (Master + 2).
              // If Finder is NOT Infiltrator.
              // Then the OTHER person IS Infiltrator (by elimination, if we trust Master).
              // So if Vote 1 fails (Finder cleared), then automatically the other person is guilty?
              // Logic:
              // Players: Master, A, B.
              // A finds word.
              // Vote 1: Is A Infiltrator?
              // If NO (or A is innocent): Then B MUST be Infiltrator.
              // So Citizens win automatically? Or we vote to confirm?
              // If we proceed to Vote 2: "Who is Infiltrator?".
              // Options: A, B.
              // We know A is innocent (or at least majority voted so).
              // So everyone votes B.
              // So if (Players - Master) <= 2, we can skip Vote 2?
              // Let's implement this shortcut.
              
              const activeVoters = players.length - 1; // Exclude Master
              if (activeVoters <= 2) {
                   // S'il ne reste que 2 votants actifs (1 Infiltré + 1 Citoyen), le 2ème vote ne sert à rien.
                   // Puisque le Finder n'était pas l'Infiltré (ou n'a pas été condamné), c'est l'Infiltré qui gagne direct.
                   await finishGame('INFILTRE');
              } else {
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
          
          router.push(`/room/${roomCode}?return=true`);
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
              round_id: String(nextRoundNum),
              player_id: p.id,
              role: newRoles[p.id],
              is_alive: true
          }));
          await supabase.from('infiltre_players').delete().eq('room_id', roomId);
          await supabase.from('infiltre_players').insert(playerInserts);
          
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
      await supabase.from('infiltre_games').delete().eq('room_id', roomId);
      await supabase.from('infiltre_players').delete().eq('room_id', roomId);
      await supabase.from('infiltre_questions').delete().eq('room_id', roomId);
      await supabase.from('infiltre_votes').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- CLIENT ACTIONS ---
  const sendReady = async () => {
    // Toggle ready state
    if (!setPlayerReady) return;
    await setPlayerReady(!amIReady);
  };

  return (
    <GameLayout
      isConnected={isConnected}
      roundCount={currentRoundNumber}
      maxRounds={rounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="L'Infiltré"
      timeLeft={timeLeft}
      voteToLobby={currentPhase !== 'setup' ? <VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} /> : undefined}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in">
               {players.length < 4 ? (
                 <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center">
                     <div className="bg-brand-inner border-2 border-brand-border p-4 rounded-xl mb-4">
                         <User className="w-12 h-12 text-tx-secondary animate-pulse" />
                     </div>
                     <p className="font-display text-2xl font-bold text-tx-base text-center">En attente de joueurs</p>
                     <p className="text-tx-secondary mt-2 font-bold">{players.length} / 4 minimum</p>
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
                                    <div className={cn(
                                        "font-display text-4xl font-black mb-6 px-6 py-2 rounded-xl border-4 border-brand-border bg-brand-inner shadow-brutal",
                                        myRole === 'MASTER' ? 'text-accent-primary' : myRole === 'INFILTRE' ? 'text-accent-secondary' : 'text-[#06B6D4]'
                                    )}>
                                        {myRole === 'MASTER' ? 'MAÎTRE DU JEU' : myRole === 'INFILTRE' ? 'INFILTRÉ' : 'CITOYEN'}
                                    </div>
                                    <div className="bg-brand-inner px-8 py-6 rounded-2xl border-4 border-brand-border shadow-brutal w-full">
                                        <span className="block text-xs font-bold text-tx-secondary uppercase tracking-widest mb-2">Mot Secret</span>
                                        <span className="font-display text-4xl font-black text-tx-base break-words">
                                            {myRole === 'CITIZEN' ? '???' : secretWord}
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

        {/* PHASE: PLAYING */}
        {currentPhase === 'playing' && (
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
                                    <span className={cn(
                                        "mr-3 px-2 py-0.5 rounded border-2 border-brand-border bg-brand-inner",
                                        myRole === 'MASTER' ? 'text-accent-primary' : myRole === 'INFILTRE' ? 'text-accent-secondary' : 'text-[#06B6D4]'
                                    )}>
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
                            <div className="text-center text-tx-secondary mt-10">
                                <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p className="font-bold">Posez des questions pour trouver le mot !</p>
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
                                <div key={q.id} className={cn(
                                    "border-4 rounded-2xl p-4 animate-in slide-in-from-bottom-2 relative shadow-brutal",
                                    likelySecret ? "border-accent-primary bg-brand-card" : "border-brand-border bg-brand-inner"
                                )}>
                                    {likelySecret && !q.answer && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 text-accent-primary text-xs font-black uppercase tracking-widest animate-pulse bg-brand-inner px-3 py-1 rounded-lg border-4 border-accent-primary">
                                            <Crown className="w-3 h-3" /> Mot trouvé ?
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-[#06B6D4]">{asker?.name}</span>
                                        <span className="text-xs text-tx-secondary font-bold">{new Date(q.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-lg text-tx-base mb-4 font-bold">{q.text}</p>
                                    
                                    {/* ANSWER AREA */}
                                    {q.answer ? (
                                        <div className={cn(
                                            "inline-flex items-center px-4 py-2 rounded-xl text-sm font-black tracking-wider uppercase border-4 shadow-brutal",
                                            q.answer === 'OUI' ? 'bg-accent-success border-brand-border text-brand-bg' : 
                                            q.answer === 'NON' ? 'bg-accent-secondary border-brand-border text-brand-bg' : 'bg-brand-inner border-brand-border text-tx-base'
                                        )}>
                                            {q.answer === 'OUI' ? <ThumbsUp className="w-4 h-4 mr-2" /> : 
                                             q.answer === 'NON' ? <ThumbsDown className="w-4 h-4 mr-2" /> : <HelpCircle className="w-4 h-4 mr-2" />}
                                            {q.answer === 'NE_SAIS_PAS' ? 'NE SAIT PAS' : q.answer}
                                        </div>
                                    ) : isMaster ? (
                                        <div className="flex flex-col gap-3">
                                            {likelySecret && (
                                                <div className="flex flex-col items-center p-3 border-4 border-accent-primary rounded-xl bg-brand-inner shadow-sm">
                                                    <span className="text-sm font-black uppercase text-accent-primary mb-2 flex items-center gap-2">
                                                        <Crown className="w-4 h-4" /> Mot potentiellement trouvé !
                                                    </span>
                                                    {confirmingWinnerId === q.playerId ? (
                                                        <div className="flex gap-2 w-full animate-in fade-in">
                                                            <button 
                                                                onClick={() => triggerWordFound(q.playerId)} 
                                                                className="flex-1 h-12 rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                                                            >
                                                                CONFIRMER
                                                            </button>
                                                            <button 
                                                                onClick={() => setConfirmingWinnerId(null)} 
                                                                className="h-12 px-4 rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setConfirmingWinnerId(q.playerId)} 
                                                            className="w-full h-12 rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-accent-primary hover:bg-accent-primary hover:text-brand-bg shadow-brutal transition-colors flex items-center justify-center gap-2"
                                                        >
                                                            Valider la victoire de {asker?.name}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* Regular buttons */}
                                            {likelySecret && confirmingWinnerId === q.playerId ? null : (
                                                <div className="grid grid-cols-3 gap-3">
                                                    <button onClick={() => answerQuestion(q.id, 'OUI')} className="h-14 flex flex-col items-center justify-center rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success shadow-brutal transition-colors">
                                                        <ThumbsUp className="w-5 h-5 mb-1" /> OUI
                                                    </button>
                                                    <button onClick={() => answerQuestion(q.id, 'NON')} className="h-14 flex flex-col items-center justify-center rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-secondary text-brand-bg hover:bg-brand-inner hover:text-accent-secondary shadow-brutal transition-colors">
                                                        <ThumbsDown className="w-5 h-5 mb-1" /> NON
                                                    </button>
                                                    <button onClick={() => answerQuestion(q.id, 'NE_SAIS_PAS')} className="h-14 flex flex-col items-center justify-center rounded-xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base shadow-brutal transition-colors">
                                                        <HelpCircle className="w-5 h-5 mb-1" /> NSP
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-sm text-tx-secondary font-bold italic">En attente du Maître...</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* BOTTOM INPUT (Fixed Mobile) */}
                {!isMaster && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 pr-[92px] z-50 md:relative md:p-0 md:pr-0 md:mt-4">
                        <div className="max-w-3xl mx-auto flex gap-3">
                            <input 
                                placeholder="Posez une question..." 
                                value={userQuestion}
                                onChange={e => setUserQuestion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendQuestion()}
                                className="flex-1 h-14 bg-brand-inner border-4 border-brand-border rounded-2xl px-6 text-lg font-bold text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors shadow-brutal"
                            />
                            <button 
                                onClick={sendQuestion} 
                                disabled={!userQuestion.trim()}
                                className="h-14 w-16 bg-accent-primary border-4 border-brand-border rounded-2xl flex items-center justify-center text-brand-bg hover:bg-tx-base transition-colors shadow-brutal disabled:bg-brand-inner disabled:text-tx-muted disabled:cursor-not-allowed"
                            >
                                <Send className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                )}

                {/* MASTER CONTROLS */}
                {isMaster && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 pr-[92px] z-50 md:relative md:p-0 md:pr-0 md:mt-4 text-center">
                        <p className="text-tx-secondary font-bold mb-2 uppercase tracking-widest text-sm">Quelqu'un a trouvé le mot ?</p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {players.filter(p => p.id !== playerId).map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => triggerWordFound(p.id)}
                                    className="h-12 px-4 rounded-xl border-2 border-brand-border bg-brand-inner text-accent-primary font-bold hover:border-accent-primary shadow-sm flex items-center"
                                >
                                    <Crown className="w-4 h-4 mr-2" />
                                    {p.name}
                                </button>
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
                    <h2 className="font-display text-4xl font-black text-tx-base mb-2 uppercase tracking-widest">
                        {currentPhase === 'voting_finder' ? "Qui est l'Infiltré ?" : "Dernière chance !"}
                    </h2>
                    <p className="text-tx-secondary font-bold text-lg">
                        {currentPhase === 'voting_finder' 
                            ? `Le mot a été trouvé par ${players.find(p => p.id === finderId)?.name}. Est-ce l'Infiltré ?`
                            : "Le précédent vote a échoué. Trouvez l'Infiltré pour gagner !"}
                    </p>
                </div>

                {/* VOTING COLUMNS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 w-full">
                    <div className="flex justify-center w-full">
                        <div className="flex flex-wrap justify-center gap-6 w-full max-w-7xl">
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
                                    <div key={pid} className="flex flex-col bg-brand-card border-4 border-brand-border rounded-[24px] overflow-hidden h-[300px] relative w-full md:w-[31%] lg:w-[23%] shadow-brutal">
                                        <div className="p-4 text-center border-b-4 border-brand-border bg-brand-inner">
                                            <div className="font-display font-black text-xl text-tx-base">{p?.name}</div>
                                            {pid === finderId && currentPhase === 'voting_finder' && (
                                                <span className="text-[10px] bg-accent-primary text-brand-bg px-2 py-1 rounded-md mt-2 inline-block font-black uppercase tracking-widest shadow-sm">A trouvé le mot</span>
                                            )}
                                        </div>

                                        {/* Votes Display */}
                                        <div className="flex-1 p-4 flex flex-wrap content-start gap-2 justify-center bg-brand-bg/50">
                                            {votesForThisPlayer.map((v: any) => {
                                                const voterName = players.find(pl => pl.id === v.voter_id)?.name;
                                                return (
                                                    <span key={v.id} className="text-[10px] font-bold bg-brand-inner border-2 border-brand-border px-2 py-1 rounded-md text-tx-base shadow-sm">
                                                        {voterName}
                                                    </span>
                                                );
                                            })}
                                        </div>

                                        {/* Vote Button */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-brand-card border-t-4 border-brand-border">
                                            {!isMaster && (
                                                <button 
                                                    onClick={() => sendVote(pid)}
                                                    className={cn(
                                                        "w-full h-12 rounded-xl font-display font-black tracking-wider transition-colors border-2 border-brand-border flex items-center justify-center shadow-brutal",
                                                        pid === playerId ? "opacity-50 cursor-not-allowed bg-brand-inner text-tx-muted" :
                                                        hasVotedForThis ? "bg-accent-success text-brand-bg" : "bg-accent-secondary text-brand-bg hover:bg-brand-inner hover:text-accent-secondary"
                                                    )}
                                                    disabled={pid === playerId}
                                                >
                                                    {hasVotedForThis ? <Check className="w-5 h-5 mr-2" /> : <Skull className="w-5 h-5 mr-2" />}
                                                    {hasVotedForThis ? 'Voté' : 'Accuser'}
                                                </button>
                                            )}
                                            {isMaster && (
                                                <div className="text-center text-xs text-tx-secondary font-bold italic pb-2">
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
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <Crown className="w-16 h-16 text-accent-primary" />
                    </div>
                    
                    <h2 className="font-display text-4xl font-black text-tx-base mb-2 uppercase tracking-widest">
                        Victoire {game.winner === 'CITIZENS' ? 'des Citoyens' : game.winner === 'INFILTRE' ? "de l'Infiltré" : 'de Personne'} !
                    </h2>
                    
                    <div className="grid gap-3 mt-8 text-left max-h-[300px] overflow-y-auto custom-scrollbar p-4 bg-brand-bg/50 rounded-2xl border-4 border-brand-border shadow-inner">
                        {players.map(p => (
                            <div key={p.id} className="flex justify-between items-center p-4 bg-brand-inner border-2 border-brand-border rounded-xl shadow-sm">
                                <span className="font-display font-black text-lg text-tx-base">{p.name}</span>
                                <span className={cn(
                                    "font-black text-sm uppercase tracking-widest px-3 py-1 rounded-md border-2 border-brand-border",
                                    roles[p.id] === 'MASTER' ? 'bg-accent-primary text-brand-bg' : 
                                    roles[p.id] === 'INFILTRE' ? 'bg-accent-secondary text-brand-bg' : 'bg-[#06B6D4] text-brand-bg'
                                )}>
                                    {roles[p.id] === 'MASTER' ? 'MAÎTRE' : roles[p.id] === 'INFILTRE' ? 'INFILTRÉ' : 'CITOYEN'}
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
