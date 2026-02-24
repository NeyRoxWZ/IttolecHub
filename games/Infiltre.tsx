'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useRealtime } from '@/hooks/useRealtime';
import GameLayout from './components/GameLayout';
import { Clock, EyeOff, Shield, User } from 'lucide-react';

type Role = 'MASTER' | 'INFILTRÉ' | 'CITOYEN';
type Phase = 'roles' | 'question' | 'vote1' | 'vote2' | 'end';

interface RealtimeMessage {
  type: string;
  data?: any;
}

interface InfiltreProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function Infiltre({ roomCode, settings }: InfiltreProps) {
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [phase, setPhase] = useState<Phase>('roles');
  const [secretWord, setSecretWord] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [finder, setFinder] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<'yes' | 'no' | 'maybe' | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [questionDuration, setQuestionDuration] = useState<number>(180);
  const [voteTargets, setVoteTargets] = useState<Record<string, string>>({});
  const [voteResult, setVoteResult] = useState<string | null>(null);

  const { broadcast, presence, messages } = useRealtime(
    roomCode ?? '',
    'infiltre',
  );

  const isHost =
    typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';
  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  useEffect(() => {
    const raw = settings?.time ?? '';
    const t = parseInt(raw, 10);
    if (!Number.isNaN(t) && t >= 60) {
      setQuestionDuration(t);
      setTimeLeft(t);
    } else {
      setQuestionDuration(180);
      setTimeLeft(180);
    }
  }, [settings]);

  const playersInRoom = useMemo(
    () =>
      presence
        .map((p: any) => p.playerName as string)
        .filter(Boolean)
        .sort(),
    [presence],
  );

  const myRole: Role | undefined = roles[playerName];

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }, [timeLeft]);

  const startGame = async () => {
    if (!roomCode || !isHost || playersInRoom.length < 4) return;

    try {
      const res = await fetch('/api/games/infiltre');
      const data = await res.json();
      if (!res.ok || !data.word) {
        console.error('Erreur Infiltré API:', data.error);
        return;
      }

      const shuffled = [...playersInRoom].sort(
        () => Math.random() - 0.5,
      ) as string[];
      const master = shuffled[0];
      const infiltré = shuffled[1];

      const newRoles: Record<string, Role> = {};
      shuffled.forEach((name) => {
        if (name === master) newRoles[name] = 'MASTER';
        else if (name === infiltré) newRoles[name] = 'INFILTRÉ';
        else newRoles[name] = 'CITOYEN';
      });

      setRoles(newRoles);
      setSecretWord(data.word);
      setCategory(data.category ?? null);
      setPhase('question');
      setFinder(null);
      setVoteTargets({});
      setVoteResult(null);
      setTimeLeft(questionDuration);
      setLastAnswer(null);

      broadcast({
        type: 'game_init',
        data: {
          roles: newRoles,
          word: data.word,
          category: data.category ?? null,
          duration: questionDuration,
        },
      });
    } catch (error) {
      console.error('Erreur démarrage Infiltré:', error);
    }
  };

  const handleMasterAnswer = (answer: 'yes' | 'no' | 'maybe') => {
    if (myRole !== 'MASTER') return;
    setLastAnswer(answer);
    broadcast({ type: 'answer', data: { answer } });
  };

  const announceFinder = (name: string) => {
    if (!isHost) return;
    setFinder(name);
    setPhase('vote1');
    setVoteTargets({});
    setVoteResult(null);
    broadcast({ type: 'word_found', data: { finder: name } });
  };

  const castVote = (target: string | null) => {
    if (!roomCode || !playerName) return;
    setVoteTargets((prev) => ({ ...prev, [playerName]: target ?? '' }));
    broadcast({
      type: 'vote',
      data: { phase, voter: playerName, target: target ?? null },
    });
  };

  const tallyVotes = () => {
    if (!isHost) return;

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

    const [suspect, votes] = sorted[0];
    setVoteResult(suspect);
    broadcast({
      type: 'vote_result',
      data: { phase, suspect, votes, totalVoters: votesArray.length },
    });

    if (phase === 'vote1') {
      if (!finder) return;
      if (suspect === finder) {
        const infiltréName = Object.entries(roles).find(
          ([, r]) => r === 'INFILTRÉ',
        )?.[0];
        const infiltréCaught = infiltréName === finder;
        setPhase('end');
        broadcast({
          type: 'game_end',
          data: { winner: infiltréCaught ? 'CITOYENS' : 'INFILTRÉ' },
        });
      } else {
        setPhase('vote2');
      }
    } else if (phase === 'vote2') {
      const infiltréName = Object.entries(roles).find(
        ([, r]) => r === 'INFILTRÉ',
      )?.[0];
      const infiltréCaught = infiltréName === suspect;
      setPhase('end');
      broadcast({
        type: 'game_end',
        data: { winner: infiltréCaught ? 'CITOYENS' : 'INFILTRÉ' },
      });
    }
  };

  useEffect(() => {
    const last = messages[messages.length - 1] as RealtimeMessage | undefined;
    if (!last) return;

    if (last.type === 'game_init') {
      setRoles(last.data.roles);
      setSecretWord(last.data.word);
      setCategory(last.data.category ?? null);
      setPhase('question');
      setFinder(null);
      setVoteTargets({});
      setVoteResult(null);
      setTimeLeft(last.data.duration ?? questionDuration);
      setLastAnswer(null);
    } else if (last.type === 'answer') {
      setLastAnswer(last.data.answer);
    } else if (last.type === 'word_found') {
      setFinder(last.data.finder);
      setPhase('vote1');
      setVoteTargets({});
      setVoteResult(null);
    } else if (last.type === 'vote') {
      setVoteTargets((prev) => ({
        ...prev,
        [last.data.voter]: last.data.target ?? '',
      }));
    } else if (last.type === 'vote_result') {
      setVoteResult(last.data.suspect);
    } else if (last.type === 'game_end') {
      setPhase('end');
    }
  }, [messages, questionDuration]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (phase === 'question' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (isHost) {
              setPhase('end');
              broadcast({
                type: 'game_end',
                data: { winner: 'AUCUN', reason: 'time' },
              });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, timeLeft, isHost]);

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
    playersInRoom.length > 0 ? (
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {playersInRoom.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm shrink-0"
          >
            <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-slate-50 max-w-[120px] truncate">
              {name}
            </span>
          </div>
        ))}
      </div>
    ) : null;

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
                width: `${Math.max(
                  0,
                  (timeLeft / questionDuration) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const main = (
    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center w-full shadow-xl">
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
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <EyeOff className="h-4 w-4" />
            <span>
              Pose des questions intelligentes au Maître du jeu pour découvrir le
              mot.
            </span>
          </div>
        </div>
      )}

      {phase === 'question' && (
        <>
          <p className="text-xs text-slate-500 mb-3">
            Les joueurs posent des questions oralement. Le Maître répond via
            l&apos;interface ci‑dessous.
          </p>
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
                    Je ne sais pas
                  </Button>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    Quand le mot est trouvé, clique sur le joueur concerné en
                    dessous pour passer au vote.
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Attends les réponses du Maître du jeu et discute avec les autres
                joueurs.
              </div>
            )}

            {lastAnswer && (
              <div className="mt-2 px-3 py-1.5 rounded-full bg-slate-800 text-xs text-slate-200 flex items-center gap-2">
                <span className="font-medium text-slate-400">
                  Dernière réponse :
                </span>
                <span className="uppercase tracking-wide">
                  {lastAnswer === 'yes'
                    ? 'OUI'
                    : lastAnswer === 'no'
                    ? 'NON'
                    : 'JE NE SAIS PAS'}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {phase === 'vote1' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Vote 1 : le trouveur est‑il l&apos;Infiltré ?
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Si la majorité l&apos;accuse et qu&apos;il est Infiltré, les citoyens
            gagnent. Sinon, l&apos;Infiltré gagne.
          </p>
          {finder && (
            <div className="mb-3 px-4 py-2 rounded-2xl bg-slate-800 text-sm text-slate-200">
              Trouveur déclaré : <span className="font-semibold">{finder}</span>
            </div>
          )}
        </>
      )}

      {phase === 'vote2' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Vote 2 : désignez l&apos;Infiltré
          </p>
          <p className="text-xs text-slate-500 mb-3">
            Si la majorité trouve le bon Infiltré, les citoyens gagnent. Sinon,
            l&apos;Infiltré gagne.
          </p>
        </>
      )}

      {phase === 'end' && (
        <>
          <p className="text-sm text-slate-200 mb-2 font-medium">
            Fin de la manche
          </p>
          <p className="text-xs text-slate-500 mb-3">
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

      {(phase === 'vote1' || phase === 'vote2') && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {playersInRoom.map((name) => (
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

          <p className="text-[11px] text-slate-500 text-center">
            Tu votes en cliquant sur un joueur. Tu peux cliquer à nouveau pour
            annuler ton vote.
          </p>

          {isHost && (
            <Button
              onClick={tallyVotes}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-2.5 text-sm"
            >
              Clore le vote et appliquer le résultat
            </Button>
          )}

          {voteResult && (
            <div className="text-xs text-center text-slate-300">
              Suspect principal :{' '}
              <span className="font-semibold">{voteResult}</span>
            </div>
          )}
        </div>
      )}

      {phase === 'question' && myRole === 'MASTER' && (
        <div className="flex flex-wrap gap-2 justify-center">
          {playersInRoom.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => announceFinder(name)}
              className="px-3 py-1.5 rounded-full text-xs border bg-slate-900 border-slate-700 text-slate-200"
            >
              {name} a trouvé le mot
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return <GameLayout header={header} main={main} footer={footer} playersBar={playersBar} />;
}

