'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRealtime } from '@/hooks/useRealtime';
import { Trophy, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import PokemonImage from './components/PokemonImage';
import GuessInput from './components/GuessInput';
import PlayerStatus from './components/PlayerStatus';
import ScoreBoard from './components/ScoreBoard';

interface PokemonData {
  id: number;
  names: { [lang: string]: string };
  imageUrl: string;
}

interface Player {
  name: string;
  score: number;
}

interface PokeGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function PokeGuessr({ roomCode, settings }: PokeGuessrProps) {
  if (!roomCode) {
    return <div>Code de room non spécifié.</div>;
  }

  const router = useRouter();
  const [pokemon, setPokemon] = useState<PokemonData | null>(null);
  const [guess, setGuess] = useState('');
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5); // Nombre de manches par partie
  const [timeLeft, setTimeLeft] = useState(30); // Timer en secondes
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null); // Validation feedback
  const [blurLevel, setBlurLevel] = useState(20); // Niveau de flou progressif
  const [generation, setGeneration] = useState(9); // Génération Pokémon (1-9)

  const { broadcast, messages } = useRealtime(roomCode, 'pokeguessr');

  const isHost = sessionStorage.getItem('isHost') === 'true';
  const playerName = sessionStorage.getItem('playerName') || 'Anonyme';

  // Initialize settings from URL parameters
  useEffect(() => {
    if (settings) {
      if (settings.rounds) setMaxRounds(parseInt(settings.rounds));
      if (settings.time) setTimeLeft(parseInt(settings.time));
      if (settings.gen) setGeneration(parseInt(settings.gen));
    }
  }, [settings]);

  const startRound = async () => {
    if (!isHost) return;
    
    if (roundCount >= maxRounds) {
      // Fin de la partie
      setGameEnded(true);
      broadcast({ type: 'game_end', data: { players } });
      return;
    }

    try {
      const response = await fetch(`/api/games/pokemon?gen=${generation}`);
      const data = await response.json();
      const roundData = { type: 'round_start', data };
      broadcast(roundData);
      handleNewMessage(roundData);
      
      // Reset timer and blur for new round
      setTimeLeft(settings?.time ? parseInt(settings.time) : 30);
      setBlurLevel(20);
      setIsCorrect(null);
    } catch (error) {
      console.error('Erreur démarrage manche:', error);
    }
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !pokemon || winner) return;

    const isAnswerCorrect = Object.values(pokemon.names).some(
      name => name.toLowerCase() === guess.toLowerCase().trim()
    );

    // Show validation feedback
    setIsCorrect(isAnswerCorrect);
    setTimeout(() => setIsCorrect(null), 2000); // Hide after 2 seconds

    broadcast({
      type: 'player_guess',
      data: { player: playerName, isCorrect: isAnswerCorrect },
    });

    if (isAnswerCorrect && !winner) {
      // Ajouter des points au gagnant
      setPlayers(prev => {
        const updated = [...prev];
        const winnerPlayer = updated.find(p => p.name === playerName);
        if (winnerPlayer) {
          winnerPlayer.score += 10;
        } else {
          updated.push({ name: playerName, score: 10 });
        }
        return updated;
      });

      const winData = { type: 'round_end', data: { winner: playerName } };
      broadcast(winData);
      handleNewMessage(winData);
    }
    setGuess('');
  };

  const handleNewMessage = (message: any) => {
    if (!message) return;

    switch (message.type) {
      case 'round_start':
        setPokemon(message.data);
        setGameStarted(true);
        setWinner(null);
        setRevealed(false);
        setAnsweredPlayers([]);
        setGuess('');
        setRoundCount(prev => prev + 1);
        break;
      case 'player_guess':
        setAnsweredPlayers(prev => {
          const updated = [...prev, message.data.player];
          return Array.from(new Set(updated));
        });
        break;
      case 'round_end':
        if (!winner) {
          setWinner(message.data.winner);
          setRevealed(true);
        }
        break;
      case 'game_end':
        setGameEnded(true);
        if (message.data.players) {
          setPlayers(message.data.players);
        }
        break;
    }
  }

  const handleReplay = () => {
    // Réinitialiser le jeu pour une nouvelle partie
    setGameEnded(false);
    setPlayers([]);
    setRoundCount(0);
    setGameStarted(false);
    setWinner(null);
    setRevealed(false);
    setAnsweredPlayers([]);
    setGuess('');
    setPokemon(null);
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    handleNewMessage(lastMessage);
  }, [messages]);

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !revealed && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRevealed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, revealed, timeLeft]);

  // Blur progression effect (gradual reveal every 10 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !revealed) {
      interval = setInterval(() => {
        setBlurLevel(prev => Math.max(0, prev - 2));
      }, 10000); // Reduce blur every 10 seconds
    }
    return () => clearInterval(interval);
  }, [gameStarted, revealed]);

  // Initialiser le joueur local dans la liste des scores
  useEffect(() => {
    if (playerName && players.length === 0) {
      setPlayers([{ name: playerName, score: 0 }]);
    }
  }, [playerName]);

  if (gameEnded) {
    return <ScoreBoard players={players} roomCode={roomCode} onReplay={handleReplay} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-6 game-layout">
      <div className="max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6">
        {/* Timer */}
        {gameStarted && !revealed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Temps restant</span>
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{timeLeft}s</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 dark:bg-red-600 rounded-full transition-all duration-1000"
                style={{ width: `${(timeLeft / (settings?.time ? parseInt(settings.time, 10) : 30)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isCorrect !== null && (
          <div className={`p-3 rounded-2xl flex items-center gap-2 ${
            isCorrect
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
          }`}>
            {isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            <span className="font-medium">{isCorrect ? 'Correct !' : 'Incorrect'}</span>
          </div>
        )}

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">PokeGuessr</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manche {roundCount}/{maxRounds} • Score : {players.find(p => p.name === playerName)?.score ?? 0}
          </p>
        </div>

        {!gameStarted && isHost && (
          <Card className="p-6 sm:p-8 text-center">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">Prêt à deviner ?</h2>
            <Button onClick={startRound} className="rounded-2xl bg-red-600 hover:bg-red-700 text-white px-8 py-3">
              Commencer la partie
            </Button>
          </Card>
        )}

        {!gameStarted && !isHost && (
          <Card className="p-6 sm:p-8 text-center">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">En attente de l&apos;hôte</h2>
            <p className="text-slate-600 dark:text-slate-400">L&apos;hôte va lancer la partie.</p>
          </Card>
        )}

        {gameStarted && (
          <div className="space-y-4 sm:space-y-6">
            {pokemon && (
              <PokemonImage
                imageUrl={pokemon.imageUrl}
                revealed={revealed}
                blurLevel={blurLevel}
              />
            )}

            {!winner && (
              <GuessInput
                guess={guess}
                setGuess={setGuess}
                handleGuess={handleGuess}
                disabled={!!winner || answeredPlayers.includes(playerName)}
              />
            )}

            <PlayerStatus answeredPlayers={answeredPlayers} />

            {winner && (
              <Card className="p-6 sm:p-8 text-center bg-green-100 dark:bg-green-900/40 border-green-200 dark:border-green-800">
                <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl sm:text-2xl font-bold text-green-800 dark:text-green-200">
                  {winner} a trouvé !
                </h2>
                <p className="text-slate-700 dark:text-slate-300 mt-2">
                  Réponse : <span className="font-bold text-slate-900 dark:text-slate-100">{pokemon?.names['fr']}</span>
                </p>
                {isHost && (
                  <Button onClick={startRound} className="mt-6 rounded-2xl">
                    {roundCount >= maxRounds ? 'Voir les scores' : 'Manche suivante'}
                  </Button>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}