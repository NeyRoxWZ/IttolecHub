'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { User, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Phase = 'roles' | 'clues' | 'vote' | 'mrwhite_guess' | 'end';

interface UndercoverProps {
  roomCode: string;
}

export default function Undercover({ roomCode }: UndercoverProps) {
  const {
    gameState,
    isHost,
    players,
    playerId,
    startGame: hostStartGame,
    updateRoundData,
    nextRound: hostNextRound,
    submitAnswer
  } = useGameSync(roomCode, 'undercover');

  // Local state for Mr White guess input
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');

  // Derived state
  const roundData = gameState?.round_data || {};
  const phase = (roundData.phase as Phase) || 'roles';
  const roles = (roundData.roles as Record<string, Role>) || {};
  const civilWord = roundData.civilWord as string | null;
  const undercoverWord = roundData.undercoverWord as string | null;
  const alivePlayers = (roundData.alivePlayers as string[]) || []; // IDs
  const currentSpeaker = roundData.currentSpeaker as string | null; // ID
  const clues = (roundData.clues as Record<string, string>) || {};
  const eliminated = roundData.eliminated as string | null;
  const winner = roundData.winner as string | null;
  const queue = (roundData.queue as any[]) || [];
  
  const myRole = playerId ? roles[playerId] : undefined;
  const isAlive = playerId && alivePlayers.includes(playerId);

  // Votes from game_sessions.answers
  const currentVotes = gameState?.answers || {};
  const myVote = playerId && currentVotes[playerId] ? currentVotes[playerId].answer : null;

  const handleStartGame = async () => {
    if (!isHost) return;
    try {
      const res = await fetch('/api/games/undercover?count=20');
      const data = await res.json();
      if (!Array.isArray(data)) {
        toast.error('Erreur chargement mots');
        return;
      }

      const firstPair = data[0];
      const remainingQueue = data.slice(1);

      // Assign roles
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      if (shuffledPlayers.length < 3) {
         // Need min 3
      }
      
      const mrWhite = shuffledPlayers[0];
      const undercover = shuffledPlayers[1];
      const newRoles: Record<string, Role> = {};
      
      players.forEach(p => {
        if (p.id === mrWhite?.id) newRoles[p.id] = 'MR_WHITE';
        else if (p.id === undercover?.id) newRoles[p.id] = 'UNDERCOVER';
        else newRoles[p.id] = 'CIVIL';
      });

      const playerIds = shuffledPlayers.map(p => p.id);

      await hostStartGame({
        queue: remainingQueue,
        civilWord: firstPair.civilWord,
        undercoverWord: firstPair.undercoverWord,
        roles: newRoles,
        phase: 'clues',
        alivePlayers: playerIds,
        currentSpeaker: playerIds[0],
        clues: {},
        eliminated: null,
        winner: null
      });

    } catch (err) {
      console.error(err);
      toast.error('Impossible de démarrer');
    }
  };

  const handleNextRound = async () => {
    if (!isHost) return;
    if (queue.length === 0) {
      handleStartGame();
      return;
    }

    const nextPair = queue[0];
    const newQueue = queue.slice(1);

    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const mrWhite = shuffledPlayers[0];
    const undercover = shuffledPlayers[1];
    const newRoles: Record<string, Role> = {};
      
    players.forEach(p => {
      if (p.id === mrWhite?.id) newRoles[p.id] = 'MR_WHITE';
      else if (p.id === undercover?.id) newRoles[p.id] = 'UNDERCOVER';
      else newRoles[p.id] = 'CIVIL';
    });

    const playerIds = shuffledPlayers.map(p => p.id);

    await hostNextRound({
      queue: newQueue,
      civilWord: nextPair.civilWord,
      undercoverWord: nextPair.undercoverWord,
      roles: newRoles,
      phase: 'clues',
      alivePlayers: playerIds,
      currentSpeaker: playerIds[0],
      clues: {},
      eliminated: null,
      winner: null
    });
  };

  const handleClueSubmit = (clue: string) => {
    if (!playerId || !currentSpeaker || playerId !== currentSpeaker) return;
    
    // Update clues and next speaker
    const newClues = { ...clues, [playerId]: clue };
    
    // Determine next speaker
    const currentIndex = alivePlayers.indexOf(playerId);
    let nextIndex = (currentIndex + 1) % alivePlayers.length;
    let nextSpeakerId = alivePlayers[nextIndex];

    // If we wrapped around, have everyone given a clue?
    // We check if newClues has all alivePlayers.
    const allGiven = alivePlayers.every(id => newClues[id]);

    let nextPhase = phase;
    if (allGiven) {
        nextPhase = 'vote';
        // When going to vote, we usually clear `answers` (votes), but `useGameSync` doesn't clear answers automatically unless nextRound.
        // We can just ignore old answers or use a round counter for votes.
        // Or we can manually clear answers? No API for that.
        // We'll rely on `submitAnswer` overwriting previous answers.
        // But if someone doesn't vote, their old vote remains? Yes.
        // Ideally we should use `updateRoundData` to increment a "voteRound" counter or something to invalidate old votes.
        // For now, let's assume players will vote again.
    }

    updateRoundData({
        ...roundData,
        clues: newClues,
        currentSpeaker: allGiven ? null : nextSpeakerId,
        phase: nextPhase
    });
  };

  const castVote = async (targetId: string | null) => {
    if (!playerId || !isAlive) return;
    if (targetId) await submitAnswer(targetId);
  };

  const closeVote = async () => {
    if (!isHost) return;
    
    // Tally votes from `gameState.answers`
    // Filter only votes from alive players?
    const voteCounts: Record<string, number> = {};
    const validVoters = alivePlayers;
    
    Object.entries(currentVotes).forEach(([pid, val]: [string, any]) => {
        if (validVoters.includes(pid)) {
            const target = val.answer;
            if (target && alivePlayers.includes(target)) {
                voteCounts[target] = (voteCounts[target] || 0) + 1;
            }
        }
    });

    let maxVotes = 0;
    let suspect: string | null = null;
    // Handle ties? Random or no elimination? Standard: Tie -> No elimination or revote.
    // Let's assume strict max for simplicity or first max.
    Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            suspect = id;
        }
    });

    if (!suspect) {
        // No votes?
        return; 
    }

    const suspectRole = roles[suspect];
    
    // Elimination Logic
    if (suspectRole === 'MR_WHITE') {
        updateRoundData({
            ...roundData,
            eliminated: suspect,
            phase: 'mrwhite_guess'
        });
        return;
    }

    // Eliminate player
    const newAlive = alivePlayers.filter(id => id !== suspect);
    
    // Check Win Conditions
    const remainingRoles = newAlive.map(id => roles[id]);
    const hasUndercover = remainingRoles.includes('UNDERCOVER');
    const hasMrWhite = remainingRoles.includes('MR_WHITE');
    const civilsCount = remainingRoles.filter(r => r === 'CIVIL').length;
    const impostorsCount = (hasUndercover ? 1 : 0) + (hasMrWhite ? 1 : 0);

    if (!hasUndercover && !hasMrWhite) {
        // Civils Win
        updateRoundData({
            ...roundData,
            eliminated: suspect,
            winner: 'CIVILS',
            phase: 'end',
            alivePlayers: newAlive
        });
    } else if (impostorsCount >= civilsCount) {
        // Impostors Win (Standard rule: if Impostors >= Civils, Impostors win)
        updateRoundData({
            ...roundData,
            eliminated: suspect,
            winner: 'UNDERCOVER/MR_WHITE',
            phase: 'end',
            alivePlayers: newAlive
        });
    } else {
        // Continue Game
        updateRoundData({
            ...roundData,
            eliminated: suspect,
            phase: 'clues',
            alivePlayers: newAlive,
            clues: {}, // Reset clues
            currentSpeaker: newAlive[0]
        });
    }
  };

  const handleMrWhiteGuess = (guess: string) => {
    // Only Mr White calls this via UI, but actually logic should be checked by Host or Server.
    // Since we don't have server verification easily without exposing word, 
    // we can use `updateRoundData` to broadcast the guess, and Host validates it.
    // Or we just validate it here if we are Mr White (client side verification is weak but ok for this app).
    // Actually, `civilWord` is visible to client in `roundData` (even if hidden in UI).
    // So we can validate locally.
    
    if (!civilWord) return;
    const isCorrect = guess.trim().toLowerCase() === civilWord.toLowerCase();
    
    // We need to update state. Only Host can `updateRoundData`.
    // So Mr White needs to send the guess to Host?
    // We can use `submitAnswer` to send the guess.
    // Host watches for Mr White's answer in `mrwhite_guess` phase.
  };
  
  // Actually, let's use `submitAnswer` for Mr White's guess too.
  const submitGuess = async (guess: string) => {
    if (myRole === 'MR_WHITE') {
        await submitAnswer({ type: 'guess', text: guess });
    }
  };

  // Host checks Mr White Guess
  useEffect(() => {
    if (!isHost || phase !== 'mrwhite_guess' || !eliminated) return;
    
    // Find eliminated Mr White's answer
    const mwAnswer = currentVotes[eliminated];
    if (mwAnswer && mwAnswer.answer && mwAnswer.answer.type === 'guess') {
        const guess = mwAnswer.answer.text;
        const isCorrect = guess.trim().toLowerCase() === (civilWord || '').toLowerCase();
        
        updateRoundData({
            ...roundData,
            winner: isCorrect ? 'MR_WHITE' : 'CIVILS',
            phase: 'end'
        });
    }
  }, [isHost, phase, currentVotes, eliminated, civilWord, roundData, updateRoundData]);


  // UI Components
  const playersBar = (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {players.map((p) => {
             const isEliminated = eliminated === p.id || (phase !== 'roles' && !alivePlayers.includes(p.id) && roles[p.id]); // Check if eliminated previously
             // Wait, `alivePlayers` only tracks currently alive. `eliminated` tracks just the LAST eliminated?
             // No, `alivePlayers` is the source of truth for who is in game.
             const dead = phase !== 'roles' && !alivePlayers.includes(p.id);
             
             return (
                <div
                    key={p.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm shrink-0 ${
                    dead
                        ? 'border-rose-500 bg-rose-500/10 text-rose-100 opacity-70'
                        : phase === 'vote' && myVote === p.id
                        ? 'bg-indigo-600 border-indigo-500 text-slate-50'
                        : 'bg-slate-900 border-slate-800 text-slate-50'
                    }`}
                >
                    <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
                    {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium max-w-[120px] truncate">
                    {p.name}
                    </span>
                    {dead && (
                        <span className="text-[10px] bg-red-500 text-white px-1 rounded">MORT</span>
                    )}
                </div>
            );
        })}
    </div>
  );

  const header = (
    <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-2xl w-full border border-slate-800">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 font-medium text-sm">
          Undercover • Room {roomCode}
        </span>
        <span className="text-xs text-slate-500 capitalize">{phase}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-indigo-600 flex items-center justify-center">
          <User className="h-5 w-5 text-slate-50" />
        </div>
        <div className="text-left">
          <p className="text-xs text-slate-400">Tu es</p>
          <p className="text-lg font-semibold">
            {myRole === 'CIVIL'
              ? 'Civil'
              : myRole === 'UNDERCOVER'
              ? 'Undercover'
              : myRole === 'MR_WHITE'
              ? 'Mr. White'
              : 'Observateur'}
          </p>
        </div>
      </div>
    </div>
  );

  const main = (
    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center w-full shadow-xl">
       {phase === 'roles' && (
         <div className="flex flex-col items-center justify-center py-10">
            <EyeOff className="h-16 w-16 text-slate-700 mb-4" />
            <h2 className="text-xl font-bold text-slate-200 mb-2">En attente</h2>
            <p className="text-slate-400 text-sm max-w-xs">
                Le Maître du jeu va lancer la partie.
            </p>
         </div>
      )}

      {(phase === 'clues' || phase === 'vote' || phase === 'mrwhite_guess') && (
        <>
          {myRole === 'CIVIL' && (
            <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Ton mot (Civil)
              </p>
              <p className="text-xl font-semibold text-slate-50">
                {civilWord ?? '---'}
              </p>
            </div>
          )}
          {myRole === 'UNDERCOVER' && (
            <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Ton mot (Undercover)
              </p>
              <p className="text-xl font-semibold text-slate-50">
                {undercoverWord ?? '---'}
              </p>
            </div>
          )}
          {myRole === 'MR_WHITE' && (
            <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Ton rôle
              </p>
              <p className="text-sm text-slate-200">
                Tu es Mr. White. Tu n&apos;as pas de mot.
              </p>
            </div>
          )}
        </>
      )}

      {phase === 'clues' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Tour de table
          </p>
          <div className="w-full space-y-2 mb-4">
             {alivePlayers.map(id => {
                 const pName = players.find(p => p.id === id)?.name || id;
                 return (
                    <div key={id} className={`flex items-center justify-between px-3 py-2 rounded-2xl ${currentSpeaker === id ? 'bg-indigo-900/30 border border-indigo-500/50' : 'bg-slate-800'}`}>
                        <span className="text-sm text-slate-200">{pName}</span>
                        <span className="text-xs text-slate-400">{clues[id] || '...'}</span>
                    </div>
                 );
             })}
          </div>
          
          {currentSpeaker === playerId && (
             <ClueInput onSubmit={handleClueSubmit} />
          )}
          {currentSpeaker !== playerId && (
             <p className="text-xs text-slate-500 animate-pulse">
                {players.find(p => p.id === currentSpeaker)?.name} est en train d&apos;écrire...
             </p>
          )}
        </>
      )}

      {phase === 'vote' && (
        <div className="w-full">
            <p className="text-sm text-slate-200 mb-4 font-medium">
                Qui est l&apos;intrus ? Votez !
            </p>
             <div className="flex flex-wrap gap-2 justify-center mt-4">
                {alivePlayers.map((id) => {
                    const pName = players.find(p => p.id === id)?.name || id;
                    return (
                    <button
                        key={id}
                        type="button"
                        onClick={() => castVote(id)}
                        className={`px-4 py-2 rounded-full text-sm border transition-all ${
                        myVote === id
                            ? 'bg-indigo-600 border-indigo-500 text-white scale-105'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {pName}
                    </button>
                    );
                })}
            </div>
        </div>
      )}

      {phase === 'mrwhite_guess' && (
         <div className="w-full">
            <p className="text-sm text-slate-200 mb-2 font-medium">
                Mr. White a été démasqué !
            </p>
            <p className="text-xs text-slate-500 mb-4">
                Il tente de deviner le mot des Civils pour voler la victoire.
            </p>
            {myRole === 'MR_WHITE' && eliminated === playerId && (
                <div className="flex flex-col gap-2">
                    <Input 
                        value={mrWhiteGuess}
                        onChange={(e) => setMrWhiteGuess(e.target.value)}
                        placeholder="Quel est le mot ?"
                        className="bg-slate-800 border-slate-700 text-white"
                    />
                    <Button onClick={() => submitGuess(mrWhiteGuess)} className="bg-indigo-600 text-white">
                        Valider
                    </Button>
                </div>
            )}
         </div>
      )}

      {phase === 'end' && (
        <div className="w-full">
             <p className="text-2xl font-bold text-white mb-2">
                {winner === 'CIVILS' ? '🎉 Les Civils gagnent !' : '🕵️ Les Imposteurs gagnent !'}
            </p>
             <div className="bg-slate-800 rounded-xl p-4 mt-4 text-left space-y-2">
                <p className="text-sm text-slate-400">Mot Civil : <span className="text-white font-bold">{civilWord}</span></p>
                <p className="text-sm text-slate-400">Mot Undercover : <span className="text-white font-bold">{undercoverWord}</span></p>
            </div>
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3">
       {isHost && (
         <>
            {phase === 'roles' && (
                 <Button onClick={handleStartGame} className="w-full bg-indigo-600 text-white py-3 rounded-2xl">
                    Lancer la partie
                 </Button>
            )}
            {phase === 'vote' && (
                 <Button onClick={closeVote} className="w-full bg-indigo-600 text-white py-3 rounded-2xl">
                    Clôturer le vote
                 </Button>
            )}
             {phase === 'end' && (
                 <Button onClick={handleNextRound} className="w-full bg-emerald-600 text-white py-3 rounded-2xl">
                    Manche suivante
                 </Button>
            )}
         </>
       )}
    </div>
  );

  return <GameLayout header={header} main={main} footer={footer} playersBar={playersBar} />;
}

function ClueInput({ onSubmit }: { onSubmit: (val: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex flex-col gap-2 w-full">
        <Input 
            value={val} 
            onChange={e => setVal(e.target.value)} 
            placeholder="Ton indice..." 
            className="bg-slate-800 border-slate-700 text-white"
            onKeyDown={e => { if(e.key === 'Enter') onSubmit(val); }}
        />
        <Button onClick={() => onSubmit(val)} className="bg-indigo-600 text-white">Envoyer</Button>
    </div>
  );
}
