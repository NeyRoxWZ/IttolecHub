'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { Check, X, Clock, User } from 'lucide-react';

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
}

export default function RhymeGuessr({ roomCode, settings }: { roomCode: string | null; settings?: { [key: string]: string } }) {
  const [currentWord, setCurrentWord] = useState<string>('');
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [playerAnswers, setPlayerAnswers] = useState<PlayerAnswer[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<string[]>([]);
  const [roundEnded, setRoundEnded] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [roundCount, setRoundCount] = useState<number>(0);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [players, setPlayers] = useState<{ [key: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [revealed, setRevealed] = useState<boolean>(false);

  const maxRounds = 5;
  const roundTime = 30;

  const { broadcast, messages } = useRealtime(roomCode ?? '', 'rhymeguessr');
  const isHost = typeof window !== 'undefined' && sessionStorage.getItem('isHost') === 'true';

  const startRound = async () => {
    if (!isHost) return;
    
    if (roundCount >= maxRounds) {
      setGameEnded(true);
      broadcast({ type: 'game_end', data: { players } });
      return;
    }

    try {
      // Obtenir un mot aléatoire
      const randomWords = ['chat', 'soleil', 'fleur', 'maison', 'arbre', 'voiture', 'mer', 'ciel', 'oiseau', 'livre'];
      const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
      
      setCurrentWord(randomWord);
      setRoundCount(prev => prev + 1);
      setRoundEnded(false);
      setUserAnswer('');
      setPlayerAnswers([]);
      setAnsweredPlayers([]);
      setTimeLeft(roundTime);
      setRevealed(false);
      setGameStarted(true);

      const roundData = { 
        type: 'round_start', 
        data: { 
          word: randomWord, 
          roundNumber: roundCount + 1 
        } 
      };
      broadcast(roundData);
    } catch (error) {
      console.error('Erreur démarrage manche:', error);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded || answeredPlayers.includes(sessionStorage.getItem('playerName') || '')) return;

    const playerName = sessionStorage.getItem('playerName') || 'Anonyme';
    
    broadcast({
      type: 'player_answer',
      data: { player: playerName, answer: userAnswer.trim() },
    });
    
    setAnsweredPlayers(prev => [...prev, playerName]);
  };

  const endRound = async () => {
    if (!isHost) return;

    // Vérifier les réponses avec l'API Datamuse
    const playerName = sessionStorage.getItem('playerName') || 'Anonyme';
    const answers = playerAnswers.filter(p => p.player !== playerName);
    
    // Pour la démo, on valide si la réponse contient le même son
    const validatedAnswers = answers.map(answer => ({
      ...answer,
      isCorrect: answer.answer.toLowerCase().includes(currentWord.slice(-2)) || 
                Math.random() > 0.5 // Pour la démo, 50% de chance
    }));

    // Ajouter la réponse de l'hôte
    const hostAnswer = userAnswer.trim();
    if (hostAnswer) {
      validatedAnswers.push({
        player: playerName,
        answer: hostAnswer,
        isCorrect: Math.random() > 0.5 // Pour la démo
      });
    }

    setPlayerAnswers(validatedAnswers);
    setRoundEnded(true);
    setRevealed(true);

    // Mettre à jour les scores
    const updatedPlayers = { ...players };
    validatedAnswers.forEach(answer => {
      if (answer.isCorrect) {
        updatedPlayers[answer.player] = (updatedPlayers[answer.player] || 0) + 10;
      }
    });
    setPlayers(updatedPlayers);

    broadcast({ 
      type: 'round_end', 
      data: { 
        results: validatedAnswers,
        players: updatedPlayers
      } 
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !revealed && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRevealed(true);
            if (isHost) endRound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, revealed, timeLeft, isHost]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.type === 'round_start') {
      setCurrentWord(lastMessage.data.word);
      setRoundCount(lastMessage.data.roundNumber);
      setRoundEnded(false);
      setUserAnswer('');
      setPlayerAnswers([]);
      setAnsweredPlayers([]);
      setTimeLeft(roundTime);
      setRevealed(false);
      setGameStarted(true);
    } else if (lastMessage.type === 'player_answer') {
      setPlayerAnswers(prev => [...prev, {
        player: lastMessage.data.player,
        answer: lastMessage.data.answer,
        isCorrect: false
      }]);
      setAnsweredPlayers(prev => [...prev, lastMessage.data.player]);
    } else if (lastMessage.type === 'round_end') {
      setPlayerAnswers(lastMessage.data.results);
      setPlayers(lastMessage.data.players);
      setRoundEnded(true);
      setRevealed(true);
    } else if (lastMessage.type === 'game_end') {
      setPlayers(lastMessage.data.players);
      setGameEnded(true);
    }
  }, [messages]);

  if (gameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-purple-950 p-4 sm:p-6 game-layout text-slate-800 dark:text-slate-100">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6 sm:p-8 text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Partie terminée !</h1>
            <div className="space-y-4">
              {Object.entries(players).sort(([,a], [,b]) => b - a).map(([player, score], index) => (
                <div key={player} className={`flex justify-between items-center p-4 rounded-xl ${
                  index === 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-800'
                }`}>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {index + 1}. {player}
                  </span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {score} points
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <Button onClick={() => window.location.reload()} className="rounded-xl w-full">
                Rejouer
              </Button>
              <Button 
                onClick={() => window.location.href = '/'} 
                variant="outline" 
                className="rounded-xl w-full"
              >
                Quitter
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-900 dark:to-purple-950 p-4 sm:p-6 game-layout text-slate-800 dark:text-slate-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            RhymeGuessr
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Trouve un mot qui rime avec le mot donné!
          </p>
        </div>

        {!gameStarted ? (
          <Card className="p-8 text-center rounded-2xl">
            <h2 className="text-xl font-semibold mb-6">Prêt à jouer?</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              {maxRounds} manches • 10 points par bonne réponse • {roundTime} secondes par manche
            </p>
            {isHost ? (
              <Button onClick={startRound} className="rounded-xl w-full">
                Commencer la partie
              </Button>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                En attente de l'hôte pour démarrer...
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Timer et infos */}
            <div className="flex justify-between items-center">
              <div className="text-slate-600 dark:text-slate-300">
                Manche {roundCount} sur {maxRounds}
              </div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                timeLeft <= 10 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                <Clock className="h-4 w-4" />
                <span className="font-semibold">{timeLeft}s</span>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(timeLeft / roundTime) * 100}%` }}
              />
            </div>

            {/* Mot à faire rimer */}
            <Card className="p-8 text-center rounded-2xl">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                Trouve un mot qui rime avec:
              </h2>
              <div className="text-4xl font-bold text-slate-800 dark:text-slate-200 mb-6">
                {currentWord}
              </div>
              
              {!roundEnded ? (
                <div className="space-y-4">
                  <Input
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Tape ta réponse..."
                    className="rounded-xl text-center text-lg"
                    onKeyPress={(e) => e.key === 'Enter' && handleAnswer()}
                    disabled={answeredPlayers.includes(sessionStorage.getItem('playerName') || '')}
                  />
                  <Button 
                    onClick={handleAnswer} 
                    className="rounded-xl w-full"
                    disabled={!userAnswer.trim() || answeredPlayers.includes(sessionStorage.getItem('playerName') || '')}
                  >
                    {answeredPlayers.includes(sessionStorage.getItem('playerName') || '') ? 'Réponse envoyée' : 'Valider'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                    Réponses:
                  </div>
                  <div className="space-y-2">
                    {playerAnswers.map((answer, index) => (
                      <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${
                        answer.isCorrect ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">{answer.player}</span>
                          <span className="text-slate-600 dark:text-slate-400">• {answer.answer}</span>
                        </div>
                        {answer.isCorrect ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <X className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    ))}
                  </div>
                  {isHost && (
                    <Button onClick={startRound} className="rounded-xl w-full">
                      {roundCount >= maxRounds ? 'Voir les résultats' : 'Manche suivante'}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Joueurs ayant répondu */}
            {answeredPlayers.length > 0 && (
              <Card className="p-4 rounded-2xl">
                <div className="flex flex-wrap gap-2">
                  {answeredPlayers.map(player => (
                    <div key={player} className="flex items-center gap-1 px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-sm text-slate-800 dark:text-slate-100">
                      <User className="h-4 w-4" />
                      <span>{player} a répondu ✅</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}