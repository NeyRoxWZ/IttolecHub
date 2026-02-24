'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import GameLayout from './components/GameLayout';
import { User } from 'lucide-react';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Phase = 'roles' | 'clues' | 'vote' | 'mrwhite_guess' | 'end';

interface RealtimeMessage {
  type: string;
  data?: any;
}

interface UndercoverProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function Undercover({ roomCode, settings }: UndercoverProps) {
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [phase, setPhase] = useState<Phase>('roles');
  const [civilWord, setCivilWord] = useState<string | null>(null);
  const [undercoverWord, setUndercoverWord] = useState<string | null>(null);
  const [alivePlayers, setAlivePlayers] = useState<string[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [clues, setClues] = useState<Record<string, string>>({});
  const [voteTargets, setVoteTargets] = useState<Record<string, string>>({});
  const [eliminated, setEliminated] = useState<string | null>(null);
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [winner, setWinner] = useState<string | null>(null);

  const { broadcast, presence, messages } = useRealtime(
    roomCode ?? '',
    'undercover',
  );

  const isHost =
    typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';
  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  const playersInRoom = useMemo(
    () =>
      presence
        .map((p: any) => p.playerName as string)
        .filter(Boolean)
        .sort(),
    [presence],
  );

  const myRole: Role | undefined = roles[playerName];
  const isAlive = eliminated ? !eliminated || eliminated !== playerName : true;

  const startGame = async () => {
    if (!roomCode || !isHost || playersInRoom.length < 4) return;

    try {
      const res = await fetch('/api/games/undercover');
      const data = await res.json();
      if (!res.ok || !data.civilWord || !data.undercoverWord) {
        console.error('Erreur API Undercover:', data.error);
        return;
      }

      const shuffled = [...playersInRoom].sort(
        () => Math.random() - 0.5,
      ) as string[];

      const mrWhite = shuffled[0];
      const undercover = shuffled[1];

      const newRoles: Record<string, Role> = {};
      shuffled.forEach((name) => {
        if (name === mrWhite) newRoles[name] = 'MR_WHITE';
        else if (name === undercover) newRoles[name] = 'UNDERCOVER';
        else newRoles[name] = 'CIVIL';
      });

      setRoles(newRoles);
      setCivilWord(data.civilWord);
      setUndercoverWord(data.undercoverWord);
      setAlivePlayers(shuffled);
      setCurrentSpeaker(shuffled[0]);
      setPhase('clues');
      setClues({});
      setVoteTargets({});
      setEliminated(null);
      setMrWhiteGuess('');
      setWinner(null);

      broadcast({
        type: 'game_init',
        data: {
          roles: newRoles,
          civilWord: data.civilWord,
          undercoverWord: data.undercoverWord,
          players: shuffled,
        },
      });
    } catch (error) {
      console.error('Erreur démarrage Undercover:', error);
    }
  };

  const handleClueSubmit = (clue: string) => {
    if (!clue.trim() || phase !== 'clues' || !currentSpeaker) return;
    if (playerName !== currentSpeaker) return;

    const trimmed = clue.trim();
    setClues((prev) => ({ ...prev, [playerName]: trimmed }));
    broadcast({
      type: 'clue',
      data: { player: playerName, clue: trimmed },
    });
  };

  const nextSpeaker = () => {
    if (!isHost || alivePlayers.length === 0) return;
    const idx = alivePlayers.indexOf(currentSpeaker ?? alivePlayers[0]);
    const next =
      idx === -1 || idx === alivePlayers.length - 1
        ? alivePlayers[0]
        : alivePlayers[idx + 1];
    setCurrentSpeaker(next);
    broadcast({ type: 'turn', data: { currentSpeaker: next } });

    const allHaveClue = alivePlayers.every((p) => clues[p]);
    if (allHaveClue) {
      setPhase('vote');
      broadcast({ type: 'phase', data: { phase: 'vote' } });
    }
  };

  const castVote = (target: string | null) => {
    if (!roomCode || !playerName || phase !== 'vote') return;
    if (!isAlive) return;
    setVoteTargets((prev) => ({ ...prev, [playerName]: target ?? '' }));
    broadcast({
      type: 'vote',
      data: { voter: playerName, target: target ?? null },
    });
  };

  const tallyVotes = () => {
    if (!isHost || phase !== 'vote') return;

    const votesArray = Object.entries(voteTargets).filter(
      ([, target]) => target,
    ) as [string, string][];
    if (votesArray.length === 0) return;

    const counts: Record<string, number> = {};
    votesArray.forEach(([, target]) => {
      counts[target] = (counts[target] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return;

    const [target] = sorted[0];
    setEliminated(target);
    broadcast({
      type: 'elimination',
      data: { eliminated: target },
    });

    const role = roles[target];
    if (role === 'MR_WHITE') {
      setPhase('mrwhite_guess');
      broadcast({ type: 'phase', data: { phase: 'mrwhite_guess' } });
    } else {
      const remaining = alivePlayers.filter((p) => p !== target);
      setAlivePlayers(remaining);
      const civils = remaining.filter((p) => roles[p] === 'CIVIL');
      const undercoverAlive = remaining.some(
        (p) => roles[p] === 'UNDERCOVER',
      );
      const mrWhiteAlive = remaining.some(
        (p) => roles[p] === 'MR_WHITE',
      );

      if (!undercoverAlive && !mrWhiteAlive) {
        setWinner('CIVILS');
        setPhase('end');
        broadcast({ type: 'game_end', data: { winner: 'CIVILS' } });
      } else if (civils.length <= 1) {
        setWinner('UNDERCOVER/MR_WHITE');
        setPhase('end');
        broadcast({
          type: 'game_end',
          data: { winner: 'UNDERCOVER/MR_WHITE' },
        });
      } else {
        setPhase('clues');
        broadcast({ type: 'phase', data: { phase: 'clues' } });
        const firstAlive = remaining[0];
        setCurrentSpeaker(firstAlive);
        broadcast({ type: 'turn', data: { currentSpeaker: firstAlive } });
        setClues({});
        setVoteTargets({});
      }
    }
  };

  const submitMrWhiteGuess = () => {
    if (phase !== 'mrwhite_guess' || !eliminated) return;
    const guess = mrWhiteGuess.trim().toLowerCase();
    if (!guess || !civilWord) return;
    const correct = civilWord.toLowerCase() === guess;
    setWinner(correct ? 'MR_WHITE' : 'CIVILS');
    setPhase('end');
    broadcast({
      type: 'game_end',
      data: { winner: correct ? 'MR_WHITE' : 'CIVILS' },
    });
  };

  useEffect(() => {
    const last = messages[messages.length - 1] as RealtimeMessage | undefined;
    if (!last) return;

    if (last.type === 'game_init') {
      setRoles(last.data.roles);
      setCivilWord(last.data.civilWord);
      setUndercoverWord(last.data.undercoverWord);
      setAlivePlayers(last.data.players);
      setCurrentSpeaker(last.data.players[0] ?? null);
      setPhase('clues');
      setClues({});
      setVoteTargets({});
      setEliminated(null);
      setWinner(null);
    } else if (last.type === 'clue') {
      setClues((prev) => ({
        ...prev,
        [last.data.player]: last.data.clue,
      }));
    } else if (last.type === 'turn') {
      setCurrentSpeaker(last.data.currentSpeaker);
    } else if (last.type === 'phase') {
      setPhase(last.data.phase);
    } else if (last.type === 'vote') {
      setVoteTargets((prev) => ({
        ...prev,
        [last.data.voter]: last.data.target ?? '',
      }));
    } else if (last.type === 'elimination') {
      setEliminated(last.data.eliminated);
    } else if (last.type === 'game_end') {
      setWinner(last.data.winner ?? null);
      setPhase('end');
    }
  }, [messages]);

  if (!roomCode) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        <p className="text-slate-400 text-center">
          Code de room introuvable. Reviens à l&apos;accueil pour créer une
          partie.
        </p>
      </main>
    );
  }

  const playersBar =
    alivePlayers.length > 0 ? (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {alivePlayers.map((name) => (
          <div
            key={name}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border text-sm shrink-0 ${
              eliminated === name
                ? 'border-rose-500 bg-rose-500/10 text-rose-100'
                : 'bg-slate-900 border-slate-800 text-slate-50'
            }`}
          >
            <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium max-w-[120px] truncate">{name}</span>
          </div>
        ))}
      </div>
    ) : null;

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
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            En attente de lancement
          </p>
          <p className="text-xs text-slate-500">
            Le Maître de la room distribue les rôles et lance la partie.
          </p>
        </>
      )}

      {(phase === 'clues' || phase === 'vote' || phase === 'mrwhite_guess') && (
        <>
          {myRole === 'CIVIL' && (
            <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 mb-4">
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Ton mot
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
                Tu n&apos;as pas de mot. Observe les indices pour deviner celui
                des civils.
              </p>
            </div>
          )}
        </>
      )}

      {phase === 'clues' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Phase des indices
          </p>
          <p className="text-xs text-slate-500 mb-4">
            À tour de rôle, chaque joueur donne un seul mot indice.
          </p>
          {currentSpeaker && (
            <div className="mb-3 px-4 py-2 rounded-2xl bg-slate-800 text-sm text-slate-200">
              C&apos;est au tour de{' '}
              <span className="font-semibold">{currentSpeaker}</span>.
            </div>
          )}
          <div className="w-full space-y-2">
            {alivePlayers.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-800"
              >
                <span className="text-sm text-slate-200">{name}</span>
                <span className="text-xs text-slate-400">
                  {clues[name] ? clues[name] : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'vote' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Phase de vote
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Votez pour éliminer le joueur que vous pensez être suspect.
          </p>
          <div className="w-full space-y-2">
            {alivePlayers.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-800"
              >
                <span className="text-sm text-slate-200">{name}</span>
                <span className="text-xs text-slate-400">
                  Indice : {clues[name] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'mrwhite_guess' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Mr. White tente de deviner le mot
          </p>
          <p className="text-xs text-slate-500 mb-4">
            S&apos;il devine correctement le mot des civils, il gagne la
            partie.
          </p>
        </>
      )}

      {phase === 'end' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Fin de la manche
          </p>
          {winner && (
            <p className="text-xs text-slate-400 mb-2">
              Gagnants : <span className="font-semibold">{winner}</span>
            </p>
          )}
          <p className="text-xs text-slate-500">
            Lancez une nouvelle partie ou changez de jeu depuis le lobby.
          </p>
        </>
      )}
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-3">
      {phase === 'roles' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500 text-center">
            En attente du Maître de la room pour distribuer les rôles.
          </p>
          {isHost && (
            <Button
              onClick={startGame}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
              disabled={playersInRoom.length < 4}
            >
              Distribuer les rôles & démarrer
            </Button>
          )}
        </div>
      )}

      {phase === 'clues' && isAlive && currentSpeaker === playerName && (
        <ClueInput
          onSubmit={handleClueSubmit}
          onNext={isHost ? nextSpeaker : undefined}
        />
      )}

      {phase === 'vote' && isAlive && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {alivePlayers.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  castVote(voteTargets[playerName] === name ? null : name)
                }
                className={`px-3 py-1.5 rounded-full text-xs border ${
                  voteTargets[playerName] === name
                    ? 'bg-indigo-600 border-indigo-500 text-slate-50'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          {isHost && (
            <Button
              onClick={tallyVotes}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-2.5 text-sm"
            >
              Clore le vote et appliquer le résultat
            </Button>
          )}
        </div>
      )}

      {phase === 'mrwhite_guess' && myRole === 'MR_WHITE' && (
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            value={mrWhiteGuess}
            onChange={(e) => setMrWhiteGuess(e.target.value)}
            placeholder="Devine le mot des civils"
            className="p-4 bg-slate-800 border-slate-700 rounded-2xl w-full text-center text-lg text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitMrWhiteGuess();
              }
            }}
          />
          <Button
            onClick={submitMrWhiteGuess}
            className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
          >
            Valider mon guess
          </Button>
        </div>
      )}
    </div>
  );

  return <GameLayout header={header} main={main} footer={footer} playersBar={playersBar} />;
}

interface ClueInputProps {
  onSubmit: (clue: string) => void;
  onNext?: () => void;
}

function ClueInput({ onSubmit, onNext }: ClueInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value);
    if (onNext) onNext();
    setValue('');
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ton mot indice..."
        className="p-4 bg-slate-800 border-slate-700 rounded-2xl w-full text-center text-lg text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button
        onClick={submit}
        className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
      >
        Envoyer mon indice
      </Button>
    </div>
  );
}

