'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap } from 'lucide-react';

interface FoodCalorieProfile {
  label: string;
  min: number;
  max: number;
  exact: number;
  portion: string;
}

interface FoodData {
  category: string;
  image: string;
  profile: FoodCalorieProfile;
}

interface PlayerAnswer {
  player: string;
  answer: number;
  difference: number;
}

interface CaloriesGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

const FOOD_CALORIES: Record<string, FoodCalorieProfile> = {
  burger: { label: 'Burger', min: 400, max: 900, exact: 650, portion: '1 burger moyen' },
  pizza: { label: 'Pizza', min: 500, max: 1100, exact: 800, portion: '2 parts de pizza' },
  pasta: { label: 'Pâtes', min: 350, max: 900, exact: 600, portion: '1 assiette de 250g' },
  biryani: { label: 'Biryani', min: 500, max: 1100, exact: 800, portion: '1 assiette' },
  dessert: { label: 'Dessert', min: 250, max: 900, exact: 550, portion: '1 portion' },
  dosa: { label: 'Dosa', min: 250, max: 600, exact: 400, portion: '1 dosa' },
  idly: { label: 'Idly', min: 100, max: 350, exact: 220, portion: '2 idlis' },
  rice: { label: 'Riz', min: 150, max: 500, exact: 320, portion: '1 bol (180g)' },
  sandwich: { label: 'Sandwich', min: 300, max: 800, exact: 550, portion: '1 sandwich' },
  steak: { label: 'Steak', min: 400, max: 900, exact: 650, portion: '1 steak + accompagnement' },
  generic: { label: 'Plat', min: 200, max: 900, exact: 550, portion: '1 portion' },
};

export default function CaloriesGuessr({ roomCode, settings }: CaloriesGuessrProps) {
  const [foodData, setFoodData] = useState<FoodData | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [roundEnded, setRoundEnded] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [players, setPlayers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

  const { broadcast, messages } = useRealtime(roomCode ?? '', 'caloriesguessr');

  const isHost =
    typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';
  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  useEffect(() => {
    if (settings?.rounds) {
      const r = parseInt(settings.rounds, 10);
      if (!Number.isNaN(r) && r > 0) {
        setMaxRounds(r);
      }
    }
    if (settings?.time) {
      const t = parseInt(settings.time, 10);
      if (!Number.isNaN(t) && t > 5) {
        setRoundTime(t);
        setTimeLeft(t);
      }
    }
  }, [settings]);

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }, [timeLeft]);

  const fetchFoodFromApi = async (): Promise<FoodData> => {
    const res = await fetch('https://foodish-api.com/api/');
    const json = (await res.json()) as { image: string };
    const imageUrl = json.image;

    let categoryKey = 'generic';
    try {
      const url = new URL(imageUrl);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === 'images');
      if (idx !== -1 && parts[idx + 1]) {
        categoryKey = parts[idx + 1].toLowerCase();
      }
    } catch {
      categoryKey = 'generic';
    }

    const profile = FOOD_CALORIES[categoryKey] ?? FOOD_CALORIES.generic;

    return {
      category: categoryKey,
      image: imageUrl,
      profile,
    };
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    if (roundCount >= maxRounds) {
      setGameEnded(true);
      broadcast({ type: 'game_end', data: { players } });
      return;
    }

    try {
      const newFood = await fetchFoodFromApi();
      setFoodData(newFood);
      setRoundCount((prev) => prev + 1);
      setRoundEnded(false);
      setUserAnswer('');
      setPlayerAnswers([]);
      setAnsweredPlayers([]);
      setTimeLeft(roundTime);
      setGameStarted(true);

      broadcast({
        type: 'round_start',
        data: {
          food: newFood,
          roundNumber: roundCount + 1,
          roundTime,
          maxRounds,
        },
      });
    } catch (e) {
      console.error('Erreur lors de la récupération de l’image Foodish:', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    const answer = parseInt(userAnswer.trim(), 10);
    if (Number.isNaN(answer)) return;

    broadcast({
      type: 'player_answer',
      data: { player: playerName, answer },
    });

    setAnsweredPlayers((prev) =>
      prev.includes(playerName) ? prev : [...prev, playerName],
    );
  };

  const endRound = () => {
    if (!isHost || !foodData) return;

    const exact = foodData.profile.exact;
    const existing = [...playerAnswers];

    if (!existing.find((a) => a.player === playerName)) {
      const hostAnswer = parseInt(userAnswer.trim(), 10);
      if (!Number.isNaN(hostAnswer)) {
        existing.push({
          player: playerName,
          answer: hostAnswer,
          difference: Math.abs(hostAnswer - exact),
        });
      }
    }

    const validated = existing
      .map((a) => ({
        ...a,
        difference: Math.abs(a.answer - exact),
      }))
      .sort((a, b) => a.difference - b.difference);

    const updatedPlayers: Record<string, number> = { ...players };
    if (validated[0]) {
      const winner = validated[0].player;
      updatedPlayers[winner] = (updatedPlayers[winner] || 0) + 10;
    }

    setPlayers(updatedPlayers);
    setPlayerAnswers(validated);
    setRoundEnded(true);

    broadcast({
      type: 'round_end',
      data: {
        results: validated,
        players: updatedPlayers,
        correctAnswer: exact,
      },
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (gameStarted && !roundEnded && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (isHost && !roundEnded) {
              endRound();
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
  }, [gameStarted, roundEnded, timeLeft, isHost]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'round_start':
        setFoodData(lastMessage.data.food);
        setRoundCount(lastMessage.data.roundNumber);
        setRoundEnded(false);
        setUserAnswer('');
        setPlayerAnswers([]);
        setAnsweredPlayers([]);
        setTimeLeft(lastMessage.data.roundTime ?? roundTime);
        setGameStarted(true);
        break;
      case 'player_answer':
        setPlayerAnswers((prev) => {
          if (prev.find((p) => p.player === lastMessage.data.player)) {
            return prev;
          }
          return [
            ...prev,
            {
              player: lastMessage.data.player,
              answer: lastMessage.data.answer,
              difference: 0,
            },
          ];
        });
        setAnsweredPlayers((prev) =>
          prev.includes(lastMessage.data.player)
            ? prev
            : [...prev, lastMessage.data.player],
        );
        break;
      case 'round_end':
        setPlayerAnswers(lastMessage.data.results);
        setPlayers(lastMessage.data.players);
        setRoundEnded(true);
        break;
      case 'game_end':
        setPlayers(lastMessage.data.players);
        setGameEnded(true);
        break;
      case 'typing':
        if (lastMessage.data.player !== playerName && lastMessage.data.isTyping) {
          setTypingPlayer(lastMessage.data.player);
        } else if (lastMessage.data.player !== playerName && !lastMessage.data.isTyping) {
          setTypingPlayer((current) =>
            current === lastMessage.data.player ? null : current,
          );
        }
        break;
      default:
        break;
    }
  }, [messages, roundTime, playerName]);

  useEffect(() => {
    if (!typingPlayer) return;
    const timeout = setTimeout(() => setTypingPlayer(null), 3000);
    return () => clearTimeout(timeout);
  }, [typingPlayer]);

  const handleInputChange = (value: string) => {
    setUserAnswer(value);
    if (!roomCode) return;
    broadcast({
      type: 'typing',
      data: { player: playerName, isTyping: value.trim().length > 0 },
    });
  };

  if (!roomCode) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-4">
        <p className="text-slate-400 text-center">
          Code de room introuvable. Reviens à l&apos;accueil pour créer une partie.
        </p>
      </main>
    );
  }

  const playersBar = Object.entries(players).length ? (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {Object.entries(players)
        .sort(([, a], [, b]) => b - a)
        .map(([name, score]) => (
          <div
            key={name}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-800 text-sm shrink-0"
          >
            <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-slate-50 max-w-[120px] truncate">
                {name}
              </span>
              <span className="text-xs text-slate-400">{score} pts</span>
            </div>
          </div>
        ))}
    </div>
  ) : null;

  if (gameEnded) {
    const sortedPlayers = Object.entries(players).sort(([, a], [, b]) => b - a);
    return (
      <GameLayout
        header={
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl w-full border border-slate-800">
            <span className="text-slate-400 font-medium">CaloriesGuessr</span>
            <span className="text-xs font-mono text-slate-500">Room • {roomCode}</span>
          </div>
        }
        main={
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 w-full shadow-xl text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Zap className="h-8 w-8 text-emerald-500" />
              <h1 className="text-2xl font-bold">Partie terminée</h1>
            </div>
            <div className="flex flex-col gap-3">
              {sortedPlayers.map(([name, score], index) => (
                <div
                  key={name}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl border ${
                    index === 0
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="h-5 w-5 text-slate-200" />
                    </div>
                    <span className="font-semibold text-slate-50">{name}</span>
                  </div>
                  <span className="text-lg font-bold text-indigo-400 tabular-nums">
                    {score} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
        footer={
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => {
                setGameEnded(false);
                setRoundCount(0);
                setPlayers({});
                setFoodData(null);
                setGameStarted(false);
              }}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
            >
              Rejouer dans cette room
            </Button>
            <Button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              variant="outline"
              className="w-full rounded-2xl border-slate-700 text-slate-50 py-3 text-base"
            >
              Retour à l&apos;accueil
            </Button>
          </div>
        }
        playersBar={playersBar}
      />
    );
  }

  if (!gameStarted) {
    return (
      <GameLayout
        header={
          <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl w-full border border-slate-800">
            <div className="flex flex-col">
              <span className="text-slate-400 font-medium text-sm">
                Room • {roomCode}
              </span>
              <span className="text-slate-50 font-semibold text-base">
                CaloriesGuessr
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Manches</p>
              <p className="text-sm font-semibold text-slate-200">
                {maxRounds} manches
              </p>
            </div>
          </div>
        }
        main={
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 w-full shadow-xl text-center">
            <h2 className="text-xl font-semibold mb-3">
              Devine les calories du plat
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              {maxRounds} manches • 10 points pour le plus proche • {roundTime} s par
              manche
            </p>
            {isHost ? (
              <Button
                onClick={startRound}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
              >
                Démarrer la partie
              </Button>
            ) : (
              <p className="text-slate-500 text-sm">
                En attente de l&apos;hôte pour lancer la première manche...
              </p>
            )}
          </div>
        }
        footer={
          <div className="text-center text-xs text-slate-500">
            Les scores seront affichés en bas de l&apos;écran pendant la partie.
          </div>
        }
        playersBar={playersBar}
      />
    );
  }

  return (
    <GameLayout
      header={
        <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded-2xl w-full border border-slate-800">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-medium text-sm">
              Manche {roundCount}/{maxRounds}
            </span>
            <span className="text-xs font-mono text-slate-500">Room • {roomCode}</span>
          </div>
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
                  width: `${Math.max(0, (timeLeft / roundTime) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      }
      main={
        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col items-center text-center w-full shadow-xl">
          {foodData ? (
            <>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">
                Devine les calories pour
              </p>
              <h2 className="text-xl font-semibold mb-1">
                {foodData.profile.label}
              </h2>
              <p className="text-xs text-slate-500 mb-4">{foodData.profile.portion}</p>
              <div className="w-full h-64 rounded-xl overflow-hidden mb-4 bg-slate-800">
                <Image
                  src={foodData.image}
                  alt={foodData.profile.label}
                  width={640}
                  height={360}
                  className="w-full h-full object-cover"
                />
              </div>
              {roundEnded && (
                <div className="w-full rounded-2xl bg-slate-800 px-4 py-3 text-left">
                  <p className="text-sm text-slate-200 font-semibold">
                    Réponse officielle :{' '}
                    <span className="text-indigo-400">
                      {foodData.profile.exact} kcal
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Fourchette typique : {foodData.profile.min}–{foodData.profile.max}{' '}
                    kcal
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <Clock className="h-6 w-6 text-slate-500 animate-spin" />
              <p className="text-sm text-slate-400">
                Chargement d&apos;un nouveau plat...
              </p>
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col gap-3">
          {!roundEnded ? (
            <>
              <Input
                type="number"
                inputMode="numeric"
                value={userAnswer}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Entre ton estimation en kcal"
                className="p-4 bg-slate-800 border-slate-700 rounded-2xl w-full text-center text-lg text-slate-50 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAnswer();
                  }
                }}
              />
              <Button
                onClick={handleAnswer}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
              >
                Valider ma réponse
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {playerAnswers.length > 0 && (
                  <div className="space-y-2">
                    {playerAnswers.map((answer, index) => (
                      <div
                        key={`${answer.player}-${index}`}
                        className={`flex items-center justify-between px-3 py-2 rounded-2xl border ${
                          index === 0
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-300" />
                          <span className="text-sm font-medium text-slate-50">
                            {answer.player}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-300 tabular-nums">
                            {answer.answer} kcal
                          </span>
                          <span className="text-xs text-slate-500">
                            (±{answer.difference})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isHost && (
                <Button
                  onClick={startRound}
                  className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-slate-50 py-3 text-base"
                >
                  {roundCount >= maxRounds ? 'Voir les scores finaux' : 'Manche suivante'}
                </Button>
              )}
            </>
          )}

          <div className="min-h-[20px] text-xs text-slate-500 text-center">
            {typingPlayer ? (
              <span>{typingPlayer} est en train d&apos;écrire...</span>
            ) : answeredPlayers.length ? (
              <span>
                {answeredPlayers.length} joueur
                {answeredPlayers.length > 1 ? 's ont' : ' a'} déjà répondu.
              </span>
            ) : (
              <span>En attente des réponses des autres joueurs...</span>
            )}
          </div>
        </div>
      }
      playersBar={playersBar}
    />
  );
}
