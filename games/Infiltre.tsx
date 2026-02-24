'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Clock, EyeOff, Shield, User } from 'lucide-react';
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

  // Derived state from gameState.round_data
  const roundData = gameState?.round_data || {};
  const phase = (roundData.phase as Phase) || 'roles';
  const roles = (roundData.roles as Record<string, Role>) || {};
  const secretWord = roundData.word as string | null;
  const category = roundData.category as string | null;
  const lastAnswer = roundData.lastAnswer as 'yes' | 'no' | 'maybe' | null;
  const voteResult = roundData.voteResult as string | null;
  const winner = roundData.winner as 'CITOYENS' | 'INFILTRÉ' | 'AUCUN' | null;
  const queue = (roundData.queue as any[]) || [];
  const questionDuration = (gameState?.settings?.time ? parseInt(gameState.settings.time, 10) : 180) || 180;
  
  const myRole = playerId ? roles[playerId] : undefined;
  
  // Votes from game_sessions.answers
  const currentVotes = gameState?.answers || {};
  const myVote = playerId && currentVotes[playerId] ? currentVotes[playerId].answer : null;

  // Timer logic
  useEffect(() => {
    if (phase === 'question') {
      setTimeLeft(questionDuration);
    }
  }, [phase, questionDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (phase === 'question' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  // Host checks time
  useEffect(() => {
    if (isHost && phase === 'question' && timeLeft === 0) {
      // Time up -> Go to Vote
      updateRoundData({ ...roundData, phase: 'vote' });
    }
  }, [isHost, phase, timeLeft, roundData, updateRoundData]);

  const handleStartGame = async () => {
    if (!isHost) return;
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
      if (shuffledPlayers.length < 3) {
        // Need at least 3 players ideally, but allow less for testing if needed
      }
      
      const master = shuffledPlayers[0];
      const infiltre = shuffledPlayers[1]; // Might be undefined if 1 player
      const newRoles: Record<string, Role> = {};
      
      players.forEach(p => {
        if (p.id === master?.id) newRoles[p.id] = 'MASTER';
        else if (p.id === infiltre?.id) newRoles[p.id] = 'INFILTRÉ';
        else newRoles[p.id] = 'CITOYEN';
      });

      await hostStartGame({
        queue: remainingQueue,
        word: firstWord.word,
        category: firstWord.category,
        roles: newRoles,
        phase: 'question',
        lastAnswer: null,
        voteResult: null,
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
      winner: null
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
    // Toggle vote if clicking same person? No, just set.
    // If targetId is null (cancel), send empty?
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

  const playersBar = (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {players.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm shrink-0 ${
               phase === 'vote' && myVote === p.id 
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
            {phase === 'end' && roles[p.id] === 'INFILTRÉ' && (
                <span className="text-[10px] bg-red-500 text-white px-1 rounded">INF</span>
            )}
             {phase === 'end' && roles[p.id] === 'MASTER' && (
                <span className="text-[10px] bg-blue-500 text-white px-1 rounded">GM</span>
            )}
          </div>
        ))}
    </div>
  );

  const header = (
    <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-2xl w-full border border-slate-800">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 font-medium text-sm">
          L&apos;Infiltré • Room {roomCode}
        </span>
        <span className="text-xs text-slate-500 capitalize">{phase}</span>
      </div>
      {phase === 'question' && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Temps restant
          </span>
          <span className="text-2xl font-bold text-indigo-400 tabular-nums">
            {formattedTimer}
          </span>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="h-full bg-indigo-600 transition-all duration-1000"
              style={{
                width: `${Math.max(0, (timeLeft / questionDuration) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const main = (
    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center w-full shadow-xl">
      {phase === 'roles' ? (
         <div className="flex flex-col items-center justify-center py-10">
            <Shield className="h-16 w-16 text-slate-700 mb-4" />
            <h2 className="text-xl font-bold text-slate-200 mb-2">En attente</h2>
            <p className="text-slate-400 text-sm max-w-xs">
                Le Maître du jeu va lancer la partie et distribuer les rôles.
            </p>
         </div>
      ) : (
        <>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">
                Ton rôle
            </p>
            <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                {myRole === 'MASTER' ? (
                    <Shield className="h-5 w-5 text-slate-50" />
                ) : (
                    <User className="h-5 w-5 text-slate-50" />
                )}
                </div>
                <div className="text-left">
                <p className="text-sm text-slate-400">Tu es</p>
                <p className="text-lg font-semibold">
                    {myRole === 'MASTER'
                    ? 'Maître du jeu'
                    : myRole === 'INFILTRÉ'
                    ? 'Infiltré'
                    : 'Citoyen'}
                </p>
                </div>
            </div>

            {myRole === 'MASTER' || myRole === 'INFILTRÉ' ? (
                <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
                <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                    Mot secret
                </p>
                <p className="text-xl font-semibold text-slate-50">
                    {secretWord ?? '---'}
                </p>
                {category && (
                    <p className="text-xs text-slate-400 mt-1">{category}</p>
                )}
                </div>
            ) : (
                <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">
                    Mot secret inconnu
                </p>
                <div className="flex items-center gap-2 text-slate-400 text-sm justify-center">
                    <EyeOff className="h-4 w-4" />
                    <span>Pose des questions au Maître !</span>
                </div>
                </div>
            )}

            {phase === 'question' && (
                <div className="w-full flex flex-col items-center gap-3">
                {myRole === 'MASTER' ? (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="grid grid-cols-3 gap-2">
                        <Button
                            className="rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm py-2"
                            onClick={() => handleMasterAnswer('yes')}
                        >
                            Oui
                        </Button>
                        <Button
                            className="rounded-2xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-sm py-2"
                            onClick={() => handleMasterAnswer('no')}
                        >
                            Non
                        </Button>
                        <Button
                            className="rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-50 text-sm py-2"
                            onClick={() => handleMasterAnswer('maybe')}
                        >
                            ???
                        </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-xs text-slate-500">
                        Attends les réponses du Maître du jeu.
                    </div>
                )}

                {lastAnswer && (
                    <div className="mt-2 px-3 py-1.5 rounded-full bg-slate-800 text-xs text-slate-200 flex items-center gap-2">
                        <span className="font-medium text-slate-400">
                        Dernière réponse :
                        </span>
                        <span className="uppercase tracking-wide font-bold text-white">
                        {lastAnswer === 'yes'
                            ? 'OUI'
                            : lastAnswer === 'no'
                            ? 'NON'
                            : 'JE NE SAIS PAS'}
                        </span>
                    </div>
                )}
                </div>
            )}

            {phase === 'vote' && (
                <div className="w-full">
                    <p className="text-sm text-slate-200 mb-2 font-medium">
                        Votez pour démasquer l&apos;Infiltré !
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                        {players.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => castVote(p.id)}
                            className={`px-4 py-2 rounded-full text-sm border transition-all ${
                            myVote === p.id
                                ? 'bg-indigo-600 border-indigo-500 text-white scale-105 shadow-lg shadow-indigo-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                        >
                            {p.name}
                        </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                        Le Maître du jeu clôturera le vote.
                    </p>
                </div>
            )}

            {phase === 'end' && (
                <div className="w-full">
                    <p className="text-2xl font-bold text-white mb-2">
                        {winner === 'CITOYENS' ? '🎉 Les Citoyens gagnent !' : '🕵️ L\'Infiltré gagne !'}
                    </p>
                    <div className="bg-slate-800 rounded-xl p-4 mt-4 text-left space-y-2">
                        <p className="text-sm text-slate-400">L&apos;Infiltré était : <span className="text-white font-bold">{players.find(p => roles[p.id] === 'INFILTRÉ')?.name || 'Inconnu'}</span></p>
                        <p className="text-sm text-slate-400">Le suspect voté : <span className="text-white font-bold">{players.find(p => p.id === voteResult)?.name || 'Aucun'}</span></p>
                        <p className="text-sm text-slate-400">Le mot était : <span className="text-white font-bold">{secretWord}</span></p>
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3">
      {isHost && (
        <>
            {phase === 'roles' && (
                <Button
                    onClick={handleStartGame}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
                    disabled={players.length < 3} // Should be 3 normally
                >
                    Distribuer les rôles & démarrer
                </Button>
            )}
            {phase === 'question' && (
                 <Button
                    onClick={startVote}
                    className="w-full rounded-2xl bg-rose-600 hover:bg-rose-500 text-slate-50 py-3 text-base"
                >
                    Lancer le vote (Fin du temps)
                </Button>
            )}
            {phase === 'vote' && (
                 <Button
                    onClick={closeVote}
                    className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
                >
                    Clôturer le vote
                </Button>
            )}
             {phase === 'end' && (
                 <Button
                    onClick={handleNextRound}
                    className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-50 py-3 text-base"
                >
                    Manche suivante
                </Button>
            )}
        </>
      )}
      {!isHost && phase === 'roles' && (
        <p className="text-xs text-slate-500 text-center">En attente de l&apos;hôte...</p>
      )}
    </div>
  );

  return <GameLayout header={header} main={main} footer={footer} playersBar={playersBar} />;
}
