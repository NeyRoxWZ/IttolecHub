'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { Users, Trophy } from 'lucide-react';
import TimerBar from '@/games/components/TimerBar';
import PlayerStatus from '@/games/components/PlayerStatus';
import ScoreBoard from '@/games/components/ScoreBoard';
import ReactionButton from '@/games/components/ReactionButton';

interface CountryData {
  name: { [lang: string]: string };
  flagUrl: string;
  population: number;
}

interface PlayerAnswer {
  player: string;
  answer: number;
  difference: number;
}

export default function PopulationGuessrPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.code as string;
  const maxRounds = Math.max(1, parseInt(searchParams.get('rounds') || '5', 10));
  const roundTime = Math.max(5, parseInt(searchParams.get('time') || '20', 10));

  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [guess, setGuess] = useState<number>(50_000_000);
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(roundTime);
  const [players, setPlayers] = useState<{ name: string; score: number }[]>([]);
  const [gameEnded, setGameEnded] = useState(false);

  const { broadcast, messages } = useRealtime(roomCode, 'populationguessr');
  const isHost = typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || 'Anonyme' : 'Anonyme';

  const startRound = useCallback(async () => {
    if (!isHost) return;
    if (roundCount >= maxRounds) {
      setGameEnded(true);
      broadcast({ type: 'game_end', data: { players } });
      return;
    }
    try {
      const response = await fetch('/api/games/country');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      broadcast({ type: 'round_start', data: { country: data, roundNumber: roundCount + 1 } });
      setCountryData(data);
      setRoundCount((c) => c + 1);
      setRoundEnded(false);
      setAnsweredPlayers([]);
      setPlayerAnswers([]);
      setGuess(50_000_000);
      setTimeLeft(roundTime);
    } catch (e) {
      console.error(e);
    }
  }, [isHost, roundCount, maxRounds, broadcast, players, roundTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryData || roundEnded || answeredPlayers.includes(playerName)) return;
    broadcast({ type: 'player_answer', data: { player: playerName, answer: guess } });
    setAnsweredPlayers((prev) => (prev.includes(playerName) ? prev : [...prev, playerName]));
  };

  const endRoundAsHost = () => {
    if (!isHost || !countryData || roundEnded) return;
    const pop = countryData.population;
    const withDiff = playerAnswers.map((a) => ({ ...a, difference: Math.abs(a.answer - pop) }));
    withDiff.sort((a, b) => a.difference - b.difference);
    const newPlayers = [...players];
    withDiff.forEach((a, i) => {
      const pts = i === 0 ? 10 : i === 1 ? 5 : 0;
      if (pts > 0) {
        const idx = newPlayers.findIndex((p) => p.name === a.player);
        if (idx >= 0) newPlayers[idx].score += pts;
        else newPlayers.push({ name: a.player, score: pts });
      }
    });
    setPlayers(newPlayers);
    setRoundEnded(true);
    broadcast({ type: 'round_end', data: { results: withDiff, players: newPlayers, correctAnswer: pop } });
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.type === 'round_start') {
      setCountryData(last.data.country);
      setRoundCount(last.data.roundNumber ?? roundCount + 1);
      setRoundEnded(false);
      setAnsweredPlayers([]);
      setPlayerAnswers([]);
      setGuess(50_000_000);
      setTimeLeft(roundTime);
      setGameStarted(true);
    } else if (last.type === 'player_answer') {
      setPlayerAnswers((prev) => [...prev, { player: last.data.player, answer: last.data.answer, difference: 0 }]);
      setAnsweredPlayers((prev) => (prev.includes(last.data.player) ? prev : [...prev, last.data.player]));
    } else if (last.type === 'round_end') {
      setPlayerAnswers(last.data.results || []);
      if (last.data.players) setPlayers(last.data.players);
      setRoundEnded(true);
    } else if (last.type === 'game_end') {
      if (last.data.players) setPlayers(last.data.players);
      setGameEnded(true);
    }
  }, [messages]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (gameStarted && !roundEnded && timeLeft > 0) {
      t = setInterval(() => setTimeLeft((l) => (l <= 1 ? 0 : l - 1)), 1000);
    }
    if (gameStarted && !roundEnded && timeLeft <= 0 && isHost) {
      endRoundAsHost();
    }
    return () => clearInterval(t!);
  }, [gameStarted, roundEnded, timeLeft, isHost]);

  useEffect(() => {
    if (playerName && players.length === 0) setPlayers([{ name: playerName, score: 0 }]);
  }, [playerName]);

  const handleReplay = () => {
    setGameEnded(false);
    setPlayers([]);
    setRoundCount(0);
    setGameStarted(false);
  };

  if (gameEnded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 game-layout text-slate-800 dark:text-slate-100">
        <ScoreBoard players={players} roomCode={roomCode} onReplay={handleReplay} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 game-layout text-slate-800 dark:text-slate-100">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-center">PopulationGuessr</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Manche {roundCount}/{maxRounds} • Score : {players.find((p) => p.name === playerName)?.score ?? 0}
        </p>
        <div className="flex justify-center">
          <ReactionButton roomCode={roomCode} gameType="populationguessr" />
        </div>

        {!gameStarted && isHost && (
          <Card className="p-6 text-center">
            <p className="mb-4 text-slate-700 dark:text-slate-300">Prêt à jouer ?</p>
            <Button onClick={startRound} className="rounded-xl">Commencer</Button>
          </Card>
        )}
        {!gameStarted && !isHost && (
          <Card className="p-6 text-center">
            <p className="text-slate-600 dark:text-slate-400">En attente de l&apos;hôte...</p>
          </Card>
        )}

        {gameStarted && countryData && (
          <>
            <TimerBar timeLeft={timeLeft} totalSeconds={roundTime} />
            <Card className="p-6 text-center">
              <h2 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-100">
                Quelle est la population de ce pays ?
              </h2>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">{countryData.name['fr']}</p>
              <img src={countryData.flagUrl} alt="Drapeau" className="w-48 h-32 object-contain mx-auto rounded-lg" />
            </Card>

            {!roundEnded && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center">
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {Number(guess).toLocaleString('fr-FR')}
                  </span>
                </div>
                <Input
                  type="range"
                  min={100_000}
                  max={1_500_000_000}
                  step={1_000_000}
                  value={guess}
                  onChange={(e) => setGuess(Number(e.target.value))}
                  className="w-full"
                />
                <Button type="submit" className="w-full rounded-xl" disabled={answeredPlayers.includes(playerName)}>
                  {answeredPlayers.includes(playerName) ? 'Réponse envoyée' : 'Valider'}
                </Button>
              </form>
            )}

            <PlayerStatus answeredPlayers={answeredPlayers} />

            {roundEnded && (
              <Card className="p-6 text-center bg-green-100 dark:bg-green-900/40">
                <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  Population : <strong>{countryData.population.toLocaleString('fr-FR')}</strong>
                </p>
                <div className="mt-4 space-y-2 text-left">
                  {playerAnswers.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                      <span>{a.player}</span>
                      <span>{a.answer.toLocaleString('fr-FR')} (écart: {a.difference.toLocaleString('fr-FR')})</span>
                    </div>
                  ))}
                </div>
                {isHost && (
                  <Button onClick={startRound} className="mt-4 rounded-xl">
                    {roundCount >= maxRounds ? 'Voir les scores' : 'Manche suivante'}
                  </Button>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
