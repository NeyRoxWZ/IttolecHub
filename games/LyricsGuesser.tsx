'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Check, Music, Disc, Mic2, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface LyricsRoundData {
  extract: string;
  artist: string;
  title: string;
  cover?: string;
}

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
}

interface LyricsGuesserProps {
  roomCode: string | null;
}

export default function LyricsGuesser({ roomCode }: LyricsGuesserProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

  // Sync with DB
  const {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
    startGame,
    submitAnswer,
    nextRound,
    updateRoundData,
    setGameStatus,
    updatePlayerScore
  } = useGameSync(roomCode ?? '', 'lyricsguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'lyricsguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const roundData: LyricsRoundData | null = gameState?.round_data?.lyrics || null;
  const currentRound = gameState?.current_round || 0;
  
  // Settings from DB
  const maxRounds = Number(gameState?.settings?.rounds || 5);
  const roundTime = Number(gameState?.settings?.time || 45);
  const targetArtist = gameState?.settings?.artist || 'Daft Punk';

  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [gameState?.round_data?.endTime, gameStarted, roundEnded]);

  // Timer interval
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
    return () => clearInterval(interval);
  }, [gameStarted, roundEnded, timeLeft, isHost]);

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  const fetchLyrics = async (artist: string, count: number): Promise<LyricsRoundData[]> => {
    try {
      const res = await fetch(`/api/games/lyrics?artist=${encodeURIComponent(artist)}&count=${count}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Error fetching lyrics', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;
    
    // Use targetArtist from settings or default
    const artist = targetArtist || 'Daft Punk';

    try {
      const songs = await fetchLyrics(artist, maxRounds);
      
      if (songs.length === 0) {
          console.error("Impossible de trouver des chansons pour cet artiste.");
          return;
      }

      const firstSong = songs[0];
      const queue = songs.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        lyrics: firstSong,
        queue,
        endTime
      });
      
      setUserAnswer('');
    } catch (e) {
      console.error('Erreur lancement:', e);
    }
  };

  // Auto-start
  useEffect(() => {
    if (isHost && gameState?.round_data?.phase === 'setup') {
        startRound();
    }
  }, [isHost, gameState?.round_data?.phase]);

  const handleNextRound = async () => {
    if (!isHost || !gameState?.round_data) return;
    
    try {
      const queue = gameState.round_data.queue || [];
      
      if (queue.length === 0) {
           // Try fetching one more?
           const songs = await fetchLyrics(targetArtist, 1);
           if (songs.length > 0) {
               const nextSong = songs[0];
               const endTime = Date.now() + roundTime * 1000;
               await nextRound({ lyrics: nextSong, queue: [], endTime });
           } else {
               // End game logic here if needed
           }
           return;
      }

      const nextSong = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         lyrics: nextSong,
         queue: nextQueue,
         endTime
      });
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    submitAnswer(userAnswer.trim());
  };

  const endRound = async () => {
    if (!isHost || !roundData || !gameState) return;

    // Simple normalization for comparison
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/gi, '').trim();
    const correctTitle = normalize(roundData.title);
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        let isCorrect = false;
        
        if (pAnswer) {
             // Check if answer is contained in title or vice versa (fuzzy match)
             const normAnswer = normalize(pAnswer);
             isCorrect = correctTitle.includes(normAnswer) && normAnswer.length > 3 || normAnswer === correctTitle;
        }
        
        results.push({
            player: p.name,
            answer: pAnswer || '-',
            isCorrect
        });

        if (isCorrect) {
            await updatePlayerScore(p.id, p.score + 10);
        }
    }
    
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing logic
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.type === 'typing') {
         if (lastMessage.data.player !== playerName && lastMessage.data.isTyping) {
          setTypingPlayer(lastMessage.data.player);
        } else if (lastMessage.data.player !== playerName && !lastMessage.data.isTyping) {
          setTypingPlayer((current) =>
            current === lastMessage.data.player ? null : current,
          );
        }
    }
  }, [messages, playerName]);
  
  useEffect(() => {
    if (!typingPlayer) return;
    const timeout = setTimeout(() => setTypingPlayer(null), 3000);
    return () => clearTimeout(timeout);
  }, [typingPlayer]);
  
  const playerResults = useMemo(() => {
      if (gameState?.round_data?.results) {
          return gameState.round_data.results as PlayerAnswer[];
      }
      return [];
  }, [gameState?.round_data?.results]);

  const answeredPlayers = useMemo(() => {
      if (gameState?.answers) {
          return Object.keys(gameState.answers).map(pid => {
              const p = players.find(pl => pl.id === pid);
              return p ? p.name : 'Unknown';
          });
      }
      return [];
  }, [gameState?.answers, players]);

  return (
    <GameLayout
      gameTitle="LyricsGuessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
      gameStarted={gameStarted}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8 animate-in fade-in duration-700">
        {!gameStarted ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <Mic2 className="w-24 h-24 text-pink-500 animate-pulse" />
            <h2 className="text-3xl font-bold text-white">Prêt pour le karaoké ?</h2>
            <p className="text-slate-400 max-w-md">
               Devinez le titre de la chanson à partir des paroles affichées.
            </p>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <span className="text-sm text-slate-400 uppercase tracking-widest block mb-1">Artiste sélectionné</span>
                <span className="text-xl font-bold text-white">{targetArtist}</span>
            </div>
            {isHost ? (
               <Button onClick={startRound} size="lg" className="mt-4 bg-pink-600 hover:bg-pink-500 text-lg px-8 py-6 rounded-xl shadow-lg shadow-pink-500/20">
                  Lancer la partie
               </Button>
            ) : (
               <div className="flex items-center gap-2 text-pink-400 bg-pink-950/30 px-4 py-2 rounded-full border border-pink-500/30 animate-pulse">
                  <div className="w-2 h-2 bg-pink-400 rounded-full" />
                  En attente de l'hôte...
               </div>
            )}
          </div>
        ) : (
          <>
            {roundData && (
              <div className="w-full max-w-3xl mx-auto mb-8 animate-in slide-in-from-bottom-8 duration-700">
                 <div className="bg-slate-900/60 p-10 rounded-3xl backdrop-blur-md border border-white/10 text-center relative overflow-hidden shadow-2xl group hover:border-pink-500/30 transition-colors">
                    <Music className="w-32 h-32 text-white/5 absolute -top-8 -right-8 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                    <p className="text-2xl md:text-4xl font-serif leading-relaxed italic text-white/90 drop-shadow-md">
                      "{roundData.extract}"
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                       <div className="h-px w-12 bg-white/20" />
                       <span className="text-sm text-pink-400 font-bold uppercase tracking-widest">
                          {roundData.artist}
                       </span>
                       <div className="h-px w-12 bg-white/20" />
                    </div>
                 </div>
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-6 animate-in fade-in delay-300 duration-700">
                <div className="relative group">
                  <Input
                    type="text"
                    placeholder="Titre de la chanson ?"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-16 text-xl pr-14 text-center font-bold bg-slate-800/50 border-white/10 focus:ring-pink-500 focus:border-pink-500 rounded-xl shadow-inner transition-all"
                    autoFocus
                  />
                  <div className="absolute right-3 top-3 bottom-3 w-10 flex items-center justify-center text-slate-500 group-focus-within:text-pink-400 transition-colors">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>

                {typingPlayer && (
                    <p className="text-center text-xs text-pink-400 animate-pulse font-mono -mt-4">
                        {typingPlayer} est en train d'écrire...
                    </p>
                )}

                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-all rounded-xl"
                  onClick={handleAnswer}
                >
                  Valider
                </Button>
                
                {answeredPlayers.length > 0 && (
                   <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {answeredPlayers.map(p => (
                         <div key={p} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium animate-in zoom-in duration-300">
                           <Check className="w-3 h-3" /> {p}
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-slate-900/80 rounded-3xl p-8 backdrop-blur-xl border border-white/10 animate-in zoom-in-95 duration-500 shadow-2xl">
                <div className="text-center mb-8 relative">
                   <div className="absolute inset-0 bg-pink-500/20 blur-3xl rounded-full -z-10" />
                  <h3 className="text-sm font-bold mb-4 text-pink-400 uppercase tracking-widest">
                    La réponse était
                  </h3>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-6">
                      {roundData?.cover ? (
                          <div className="w-40 h-40 relative rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 rotate-3 transition-transform hover:rotate-0 duration-500">
                              <Image src={roundData.cover} alt="Cover" fill className="object-cover" />
                          </div>
                      ) : (
                          <div className="w-40 h-40 bg-slate-800 rounded-xl flex items-center justify-center">
                              <Disc className="w-20 h-20 text-slate-600 animate-spin-slow" />
                          </div>
                      )}
                      <div className="text-center md:text-left">
                          <div className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight">
                            {roundData?.title}
                          </div>
                          <div className="text-xl text-slate-400 font-medium">
                            {roundData?.artist}
                          </div>
                      </div>
                  </div>
                </div>

                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all border ${
                        p.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-rose-500/10 border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg text-slate-200">{p.player}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-slate-400 uppercase tracking-wide">{p.answer !== '-' ? p.answer : 'Pas de réponse'}</span>
                        {p.isCorrect ? <CheckCircle className="text-emerald-400 w-6 h-6" /> : <XCircle className="text-rose-400 w-6 h-6" />}
                      </div>
                    </div>
                  ))}
                </div>

                {isHost && (
                  <div className="flex justify-center">
                      <Button
                        size="lg"
                        className="bg-white text-black hover:bg-slate-200 text-lg px-10 py-6 rounded-full shadow-lg shadow-white/10 transition-all hover:scale-105 font-bold"
                        onClick={handleNextRound}
                      >
                        Manche suivante
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </GameLayout>
  );
}
