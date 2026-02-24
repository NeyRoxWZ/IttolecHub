'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { Flag, Trophy, User } from 'lucide-react';
import TimerBar from '@/games/components/TimerBar';
import PlayerStatus from '@/games/components/PlayerStatus';
import ScoreBoard from '@/games/components/ScoreBoard';
import ReactionButton from '@/games/components/ReactionButton';

interface CountryData {
  name: { [lang: string]: string };
  flagUrl: string;
  population: number;
}

export default function FlagGuessrPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.code as string;
  const maxRounds = Math.max(1, parseInt(searchParams.get('rounds') || '5', 10));
  const roundTime = Math.max(5, parseInt(searchParams.get('time') || '15', 10));

  const [countryData, setCountryData] = useState<CountryData | null>(null);
  const [guess, setGuess] = useState('');
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(roundTime);
  const [players, setPlayers] = useState<{ name: string; score: number }[]>([]);
  const [gameEnded, setGameEnded] = useState(false);

  const { broadcast, messages } = useRealtime(roomCode, 'flagguessr');
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
      const payload = { type: 'round_start', data: { country: data, roundNumber: roundCount + 1 } };
      broadcast(payload);
      setCountryData(data);
      setRoundCount((c) => c + 1);
      setRoundEnded(false);
      setWinner(null);
      setAnsweredPlayers([]);
      setGuess('');
      setTimeLeft(roundTime);
    } catch (e) {
      console.error(e);
    }
  }, [isHost, roundCount, maxRounds, broadcast, players, roundTime]);

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !countryData || roundEnded) return;
    const name = playerName;
    const correct = Object.values(countryData.name).some(
      (n) => n.toLowerCase() === guess.toLowerCase().trim()
    );
    broadcast({ type: 'player_guess', data: { player: name, guess: guess.trim() } });
    setAnsweredPlayers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    if (correct && !winner) {
      setWinner(name);
      const newPlayers = [...players];
      const idx = newPlayers.findIndex((p) => p.name === name);
      if (idx >= 0) newPlayers[idx].score += 10;
      else newPlayers.push({ name, score: 10 });
      setPlayers(newPlayers);
      broadcast({ type: 'round_end', data: { winner: name, players: newPlayers } });
    }
    setGuess('');
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.type === 'round_start') {
      setCountryData(last.data.country);
      setRoundCount(last.data.roundNumber ?? roundCount + 1);
      setRoundEnded(false);
      setWinner(null);
      setAnsweredPlayers([]);
      setGuess('');
      setTimeLeft(roundTime);
      setGameStarted(true);
    } else if (last.type === 'player_guess') {
      setAnsweredPlayers((prev) =>
        prev.includes(last.data.player) ? prev : [...prev, last.data.player]
      );
    } else if (last.type === 'round_end') {
      setWinner(last.data.winner);
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
    if (gameStarted && !roundEnded && timeLeft <= 0) {
      setRoundEnded(true);
      if (isHost && !winner) broadcast({ type: 'round_end', data: { winner: null, players: [...players] } });
    }
    return () => clearInterval(t!);
  }, [gameStarted, roundEnded, timeLeft, isHost, winner, players, broadcast]);

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
        <h1 className="text-2xl font-bold text-center">FlagGuessr</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
          Manche {roundCount}/{maxRounds} • Score : {players.find((p) => p.name === playerName)?.score ?? 0}
        </p>
        <div className="flex justify-center">
          <ReactionButton roomCode={roomCode} gameType="flagguessr" />
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
              <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Quel est ce pays ?</h2>
              <img src={countryData.flagUrl} alt="Drapeau" className="w-64 h-40 object-contain mx-auto rounded-lg shadow" />
            </Card>

            {!roundEnded && (
              <form onSubmit={handleGuess} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Nom du pays..."
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <Button type="submit" className="rounded-xl" disabled={answeredPlayers.includes(playerName)}>
                  Valider
                </Button>
              </form>
            )}

            <PlayerStatus answeredPlayers={answeredPlayers} />

            {roundEnded && (
              <Card className="p-6 text-center bg-green-100 dark:bg-green-900/40">
                <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {winner ? `${winner} a trouvé !` : 'Temps écoulé'}
                </p>
                <p className="text-slate-700 dark:text-slate-300 mt-1">
                  Réponse : <strong>{countryData.name['fr']}</strong>
                </p>
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
