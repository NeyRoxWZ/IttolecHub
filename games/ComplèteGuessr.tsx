'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRealtime } from '@/hooks/useRealtime';
import { Trophy, CheckCircle, XCircle, Send } from 'lucide-react';

import PlayerStatus from './components/PlayerStatus';
import ScoreBoard from './components/ScoreBoard';

interface Player {
  name: string;
  score: number;
}

interface SuggestionItem {
  text: string;
  found: boolean;
  foundBy?: string;
}

interface ComplèteGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export default function ComplèteGuessr({ roomCode, settings }: ComplèteGuessrProps) {
  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-200">
        Code de room non spécifié.
      </div>
    );
  }

  const [guess, setGuess] = useState('');
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  const { broadcast, messages } = useRealtime(roomCode, 'completeguessr');

  const isHost = typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';
  const playerName = typeof window !== 'undefined' ? sessionStorage.getItem('playerName') || 'Anonyme' : 'Anonyme';

  useEffect(() => {
    if (settings?.rounds) setMaxRounds(parseInt(settings.rounds, 10));
  }, [settings]);

  const startRound = useCallback(async () => {
    if (!isHost) return;

    if (roundCount >= maxRounds) {
      setGameEnded(true);
      broadcast({ type: 'game_end', data: { players } });
      return;
    }

    try {
      const lang = settings?.lang || 'fr';
      const res = await fetch(`/api/games/autocomplete?lang=${encodeURIComponent(lang)}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.error || !data.prompt || !data.suggestions?.length) throw new Error(data.error || 'Pas de suggestions');

      const roundData = {
        type: 'round_start',
        data: {
          prompt: data.prompt,
          suggestions: data.suggestions.map((s: { text: string; found?: boolean }) => ({
            text: s.text,
            found: false,
          })),
        },
      };
      broadcast(roundData);
      setPrompt(data.prompt);
      setSuggestions(
        data.suggestions.map((s: { text: string }) => ({ text: s.text, found: false }))
      );
      setGameStarted(true);
      setAnsweredPlayers([]);
      setGuess('');
      setIsCorrect(null);
      setRoundCount((c) => c + 1);
    } catch (e) {
      console.error('Erreur démarrage manche ComplèteGuessr:', e);
    }
  }, [isHost, roundCount, maxRounds, broadcast, players, settings?.lang]);

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || !suggestions.length) return;

    const normalizedGuess = normalize(guess);
    const promptBase = prompt.replace(/\.\.\.$/, '').trim();

    let matchedIndex = -1;
    for (let i = 0; i < suggestions.length; i++) {
      if (suggestions[i].found) continue;
      const fullPhrase = `${promptBase} ${suggestions[i].text}`;
      if (
        normalizedGuess === normalize(suggestions[i].text) ||
        normalizedGuess === normalize(fullPhrase)
      ) {
        matchedIndex = i;
        break;
      }
    }

    broadcast({
      type: 'player_guess',
      data: { player: playerName, guess: guess.trim() },
    });

    setAnsweredPlayers((prev) =>
      prev.includes(playerName) ? prev : [...prev, playerName]
    );

    if (matchedIndex >= 0) {
      setIsCorrect(true);
      setTimeout(() => setIsCorrect(null), 2000);

      const newSuggestions = suggestions.map((s, i) =>
        i === matchedIndex ? { ...s, found: true, foundBy: playerName } : s
      );
      setSuggestions(newSuggestions);

      setPlayers((prev) => {
        const next = [...prev];
        const entry = next.find((p) => p.name === playerName);
        if (entry) entry.score += 10;
        else next.push({ name: playerName, score: 10 });
        return next;
      });

      broadcast({
        type: 'suggestion_found',
        data: { index: matchedIndex, player: playerName, suggestions: newSuggestions },
      });
    } else {
      setIsCorrect(false);
      setTimeout(() => setIsCorrect(null), 2000);
    }
    setGuess('');
  };

  const handleNewMessage = useCallback(
    (message: { type: string; data?: any }) => {
      if (!message) return;
      switch (message.type) {
        case 'round_start':
          setPrompt(message.data.prompt || '');
          setSuggestions(
            (message.data.suggestions || []).map((s: SuggestionItem) => ({
              ...s,
              found: false,
            }))
          );
          setGameStarted(true);
          setAnsweredPlayers([]);
          setGuess('');
          setRoundCount((c) => c + 1);
          setIsCorrect(null);
          break;
        case 'player_guess':
          setAnsweredPlayers((prev) => {
            const p = message.data?.player;
            return p && !prev.includes(p) ? [...prev, p] : prev;
          });
          break;
        case 'suggestion_found':
          if (message.data?.suggestions) {
            setSuggestions(message.data.suggestions);
          }
          if (message.data?.player) {
            setPlayers((prev) => {
              const next = [...prev];
              const entry = next.find((p) => p.name === message.data.player);
              if (entry) entry.score += 10;
              else next.push({ name: message.data.player, score: 10 });
              return next;
            });
          }
          break;
        case 'game_end':
          setGameEnded(true);
          if (message.data?.players) setPlayers(message.data.players);
          break;
        default:
          break;
      }
    },
    []
  );

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) handleNewMessage(last);
  }, [messages, handleNewMessage]);

  useEffect(() => {
    if (playerName && players.length === 0) {
      setPlayers([{ name: playerName, score: 0 }]);
    }
  }, [playerName, players.length]);

  const handleReplay = () => {
    setGameEnded(false);
    setPlayers([]);
    setRoundCount(0);
    setGameStarted(false);
    setPrompt('');
    setSuggestions([]);
    setAnsweredPlayers([]);
    setGuess('');
  };

  if (gameEnded) {
    return (
      <ScoreBoard
        players={players}
        roomCode={roomCode}
        onReplay={handleReplay}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 sm:p-6 game-layout">
      <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            ComplèteGuessr
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manche {roundCount}/{maxRounds} • Ton score :{' '}
            {players.find((p) => p.name === playerName)?.score ?? 0}
          </p>
        </div>

        {!gameStarted && isHost && (
          <Card className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">
              Prêt à jouer ?
            </h2>
            <Button
              onClick={startRound}
              className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Commencer la partie
            </Button>
          </Card>
        )}

        {!gameStarted && !isHost && (
          <Card className="p-8 text-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-100">
              En attente de l&apos;hôte
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              L&apos;hôte va lancer la partie.
            </p>
          </Card>
        )}

        {gameStarted && (
          <>
            {/* Phrase de départ — bien visible */}
            <Card className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <p className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100 text-center leading-relaxed">
                {prompt}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 text-center">
                Trouve une des suggestions Google (phrase exacte ou fin de phrase).
              </p>
            </Card>

            {/* Liste des suggestions (révélées ou masquées) */}
            <Card className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
                Suggestions trouvées
              </h3>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    {s.found ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        <span className="text-slate-800 dark:text-slate-100">
                          {prompt.replace(/\.\.\.$/, '')} {s.text}
                        </span>
                        {s.foundBy && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                            → {s.foundBy}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
                        <span className="text-slate-400 dark:text-slate-500 italic">
                          ???
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            {/* Feedback correct / incorrect */}
            {isCorrect !== null && (
              <div
                className={`rounded-2xl p-4 flex items-center gap-2 ${
                  isCorrect
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                }`}
              >
                {isCorrect ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {isCorrect ? 'Correct !' : 'Pas dans la liste.'}
                </span>
              </div>
            )}

            {/* Saisie */}
            <form onSubmit={handleGuess} className="flex gap-2">
              <input
                type="text"
                placeholder="Ta réponse..."
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                className="flex-1 rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                type="submit"
                className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-6"
                disabled={!guess.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>

            <PlayerStatus answeredPlayers={answeredPlayers} />

            {isHost && (
              <div className="text-center">
                <Button
                  onClick={startRound}
                  variant="outline"
                  className="rounded-2xl"
                >
                  {roundCount >= maxRounds ? 'Voir les résultats' : 'Manche suivante'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
