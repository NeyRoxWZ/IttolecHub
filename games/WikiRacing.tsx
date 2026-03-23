'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Trophy, Clock, Loader2, ArrowRight, Target, Link as LinkIcon, Search, ChevronUp, ChevronDown, X, CornerRightUp } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function WikiRacing({ params }: { params: { code: string } }) {
    const roomCode = params.code;
    const router = useRouter();
    
    const { 
        roomStatus,
        gameState,
        roomId,
        players, 
        playerId, 
        isHost, 
        updateRoundData,
        sendMove,
        moves,
        setGameStatus,
        serverTime
    } = useGameSync(roomCode, 'wikiracing');

    const [htmlContent, setHtmlContent] = useState<string>('');
    const [isLoadingPage, setIsLoadingPage] = useState(false);
    const [localClicks, setLocalClicks] = useState(0);
    const [currentTitle, setCurrentTitle] = useState('');
    const [hasFinished, setHasFinished] = useState(false);
    const [cheatDetected, setCheatDetected] = useState(false);
    
    // Auto-scroll to top on page change
    const contentRef = useRef<HTMLDivElement>(null);

    // --- DERIVED STATE ---
    const roundData = gameState?.round_data || {};
    const currentPhase = roundData.phase || 'setup';
    const settings = gameState?.settings || {};
    const totalRounds = gameState?.total_rounds || settings.rounds || 3;
    const currentRound = gameState?.current_round || 1;
    const winCondition = settings.winCondition || 'speed'; // speed | optimization
    
    const startPage = roundData.start_page || '';
    const targetPage = roundData.target_page || '';
    const scores = roundData.scores || {};
    const playerStats = roundData.player_stats || {}; // { playerId: { clicks, time, finishedAt } }
    const countdownEndTime = roundData.countdown_end_time || null;
    const roundStartTime = roundData.start_time || null;

    // --- HOST LOGIC (EVENT SOURCING & COUNTDOWN) ---
    const processedMoves = useRef(new Set<string>());

    useEffect(() => {
        if (!isHost || !roomId) return;

        const processMoves = async () => {
            const newMoves = moves.filter(m => !processedMoves.current.has(m.id));
            if (newMoves.length === 0) return;

            let updatedRoundData = { ...roundData };
            let stateChanged = false;

            for (const move of newMoves) {
                processedMoves.current.add(move.id);

                if (move.action_type === 'wiki_finish' && updatedRoundData.phase === 'racing') {
                    const stats = updatedRoundData.player_stats || {};
                    if (!stats[move.player_id]) {
                        stats[move.player_id] = {
                            clicks: move.payload.clicks,
                            time: move.payload.time,
                            finishedAt: Date.now()
                        };
                        updatedRoundData.player_stats = stats;
                        stateChanged = true;
                    }
                }
            }

            if (stateChanged) {
                const currentStats = updatedRoundData.player_stats || {};
                const finishedCount = Object.keys(currentStats).length;
                const totalPlayers = players.length;

                // Rule: If 50% finished, start 20s countdown
                if (finishedCount >= Math.ceil(totalPlayers / 2) && !updatedRoundData.countdown_end_time && updatedRoundData.phase === 'racing') {
                    updatedRoundData.countdown_end_time = Date.now() + 20000;
                }

                // Rule: If everyone finished before countdown ends
                if (finishedCount === totalPlayers && updatedRoundData.phase === 'racing') {
                    endRound(updatedRoundData);
                    return; // endRound will handle the update
                }

                await updateRoundData(updatedRoundData);
            }
        };

        processMoves();
    }, [moves, isHost, roundData, players]);

    // Host checking countdown
    useEffect(() => {
        if (!isHost || currentPhase !== 'racing' || !countdownEndTime) return;

        const checkCountdown = () => {
            if (Date.now() >= countdownEndTime) {
                endRound({ ...roundData });
            }
        };

        const interval = setInterval(checkCountdown, 1000);
        return () => clearInterval(interval);
    }, [isHost, currentPhase, countdownEndTime, roundData]);

    const endRound = async (dataToUpdate: any) => {
        const stats = dataToUpdate.player_stats || {};
        const newScores = { ...(dataToUpdate.scores || {}) };

        // Calculate scores based on win condition
        const finishedPlayers = players.filter(p => stats[p.id]);
        
        if (winCondition === 'speed') {
            finishedPlayers.sort((a, b) => stats[a.id].time - stats[b.id].time);
        } else {
            finishedPlayers.sort((a, b) => {
                if (stats[a.id].clicks !== stats[b.id].clicks) {
                    return stats[a.id].clicks - stats[b.id].clicks;
                }
                return stats[a.id].time - stats[b.id].time; // Tie-breaker
            });
        }

        // Award points: 1st = 3, 2nd = 2, 3rd = 1
        finishedPlayers.forEach((p, index) => {
            let pts = 0;
            if (index === 0) pts = 3;
            else if (index === 1) pts = 2;
            else if (index === 2) pts = 1;
            newScores[p.id] = (newScores[p.id] || 0) + pts;
        });

        dataToUpdate.phase = 'round_results';
        dataToUpdate.scores = newScores;
        dataToUpdate.round_end_time = Date.now() + 8000; // 8s to see results

        await updateRoundData(dataToUpdate);
    };

    // Auto next round
    useEffect(() => {
        if (!isHost || currentPhase !== 'round_results' || !roundData.round_end_time) return;

        const timeToWait = roundData.round_end_time - Date.now();
        if (timeToWait <= 0) {
            nextRound();
            return;
        }

        const timer = setTimeout(() => {
            nextRound();
        }, timeToWait);

        return () => clearTimeout(timer);
    }, [isHost, currentPhase, roundData.round_end_time]);


    // --- GAME ACTIONS ---
    const startNewGame = async () => {
        if (!isHost) return;
        
        try {
            const res = await fetch(`/api/games/wikiracing?difficulty=${settings.difficulty}&count=${totalRounds}`);
            const pairs = await res.json();
            
            if (!pairs || pairs.length === 0) {
                toast.error("Erreur lors du chargement des mots.");
                return;
            }

            await supabase.from('game_sessions').upsert({
                room_id: roomId,
                status: 'round_active',
                current_round: 1,
                total_rounds: totalRounds,
                answers: { pairs },
                round_data: {
                    phase: 'racing',
                    start_page: pairs[0].start,
                    target_page: pairs[0].target,
                    start_time: Date.now(),
                    player_stats: {},
                    scores: {},
                    countdown_end_time: null
                }
            }, { onConflict: 'room_id' });

            await supabase.from('game_moves').delete().eq('room_id', roomId);
            await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
        } catch (e) {
            console.error(e);
            toast.error("Erreur au démarrage de la partie");
        }
    };

    const nextRound = async () => {
        if (!isHost) return;
        
        if (currentRound >= totalRounds) {
            await setGameStatus('game_over');
            await updateRoundData({
                ...roundData,
                phase: 'podium'
            });
        } else {
            const nextRoundNum = currentRound + 1;
            const pairs = gameState?.answers?.pairs || [];
            const nextPair = pairs[nextRoundNum - 1] || { start: "Pomme", target: "France" };

            await supabase.from('game_moves').delete().eq('room_id', roomId);
            await supabase.from('game_sessions').update({
                current_round: nextRoundNum,
                round_data: {
                    ...roundData,
                    phase: 'racing',
                    start_page: nextPair.start,
                    target_page: nextPair.target,
                    start_time: Date.now(),
                    player_stats: {},
                    countdown_end_time: null
                }
            }).eq('room_id', roomId);
        }
    };

    const returnToLobby = async () => {
        if (!isHost || !roomCode) return;
        await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
        await supabase.from('game_sessions').delete().eq('room_id', roomId);
        router.push(`/room/${roomCode}?return=true`);
    };

    // --- WIKIPEDIA LOGIC ---
    const loadWikiPage = async (title: string, isInitial = false) => {
        setIsLoadingPage(true);
        try {
            const cleanTitle = title.split('#')[0]; // Remove hash links
            const res = await fetch(`https://fr.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(cleanTitle)}&format=json&origin=*&disableeditsection=true`);
            const data = await res.json();
            
            if (data.error) {
                toast.error("Erreur Wikipédia: Page introuvable.");
                setIsLoadingPage(false);
                return;
            }

            let html = data.parse.text['*'];
            
            // Basic cleanup of Wikipedia HTML
            html = html.replace(/<span class="mw-editsection">.*?<\/span>/g, '');
            
            setHtmlContent(html);
            setCurrentTitle(data.parse.title);
            
            if (contentRef.current) {
                contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }

            // Check win condition
            if (!isInitial && data.parse.title.toLowerCase() === targetPage.replace(/_/g, ' ').toLowerCase()) {
                handleFinish();
            }

        } catch (e) {
            console.error(e);
            toast.error("Impossible de charger la page.");
        } finally {
            setIsLoadingPage(false);
        }
    };

    useEffect(() => {
        if (currentPhase === 'racing' && startPage && !hasFinished && currentTitle === '') {
            setLocalClicks(0);
            setHasFinished(false);
            loadWikiPage(startPage, true);
        }
    }, [currentPhase, startPage]);

    // Reset local state when round changes
    useEffect(() => {
        if (currentPhase === 'racing') {
            setHasFinished(false);
            setLocalClicks(0);
            setCurrentTitle('');
        }
    }, [currentRound, currentPhase]);

    const handleWikiClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (hasFinished || isLoadingPage || currentPhase !== 'racing') {
            e.preventDefault();
            return;
        }

        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        
        if (anchor) {
            e.preventDefault();
            const href = anchor.getAttribute('href');
            const titleAttr = anchor.getAttribute('title');
            
            if (href && href.startsWith('/wiki/')) {
                const nextTitle = decodeURIComponent(href.replace('/wiki/', ''));
                
                // Block special pages
                if (nextTitle.includes(':') && !nextTitle.startsWith('Catégorie:')) {
                    toast.error("Les pages spéciales sont interdites.");
                    return;
                }

                setLocalClicks(c => c + 1);
                loadWikiPage(nextTitle);
            }
        }
    };

    const handleFinish = () => {
        if (hasFinished || !playerId) return;
        setHasFinished(true);
        const timeTaken = Date.now() - (roundStartTime || Date.now());
        sendMove('wiki_finish', { clicks: localClicks + 1, time: timeTaken });
        toast.success("Vous avez atteint la cible !");
    };

    // --- ANTI-CHEAT (CTRL+F / F3) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (currentPhase !== 'racing' || hasFinished) return;

            // Detect Ctrl+F (Windows/Linux) or Cmd+F (Mac) or F3
            if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') || e.key === 'F3') {
                e.preventDefault(); // Block real search
                setCheatDetected(true);
                
                // Penalty of 5 seconds
                setTimeout(() => {
                    setCheatDetected(false);
                }, 5000);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentPhase, hasFinished]);

    // --- RENDER HELPERS ---
    const sortedPlayers = useMemo(() => {
        return [...players].map(p => ({
            ...p,
            score: scores[p.id] || 0
        })).sort((a, b) => b.score - a.score);
    }, [players, scores]);

    const playersRecord = useMemo(() => {
        const record: Record<string, number> = {};
        players.forEach(p => {
            record[p.name] = scores[p.id] || 0;
        });
        return record;
    }, [players, scores]);

    // Timer display
    const [timeLeft, setTimeLeft] = useState(0);
    useEffect(() => {
        if (currentPhase !== 'racing' || !countdownEndTime) {
            setTimeLeft(0);
            return;
        }
        
        const updateTimer = () => {
            const diff = Math.ceil((countdownEndTime - Date.now()) / 1000);
            setTimeLeft(diff > 0 ? diff : 0);
        };
        
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [countdownEndTime, currentPhase]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    if (!gameState) {
        return (
            <GameLayout gameTitle="WikiRacing" players={playersRecord} roundCount={1} maxRounds={1} timer="00" timeLeft={0} voteToLobby={<VoteToLobby roomCode={roomCode} roomId={roomId || ''} playerId={playerId || ''} players={players} />}>
                <div className="flex items-center justify-center flex-1">
                    <Loader2 className="w-12 h-12 animate-spin text-accent-primary" />
                </div>
            </GameLayout>
        );
    }

    return (
        <GameLayout
            gameTitle="WikiRacing"
            players={playersRecord}
            roundCount={currentRound}
            maxRounds={totalRounds}
            timer={countdownEndTime && timeLeft > 0 ? String(timeLeft) : "--"}
            timeLeft={countdownEndTime ? Math.max(0, (timeLeft / 20) * 100) : 100}
            voteToLobby={<VoteToLobby roomCode={roomCode} roomId={roomId || ''} playerId={playerId || ''} players={players} />}
            className="p-0 md:p-0 max-w-none" // Remove padding for full width wiki
        >
            {/* SETUP PHASE */}
            {currentPhase === 'setup' && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg p-4 mx-auto mt-12">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                        <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform -rotate-3">
                            <Search className="w-16 h-16 text-accent-primary" />
                        </div>
                        
                        <div className="text-center space-y-2 mb-8">
                            <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">
                                Wiki<span className="text-accent-primary">Racing</span>
                            </h2>
                            <p className="text-tx-secondary font-bold">
                                Rejoignez la page cible en cliquant sur les liens.
                            </p>
                        </div>
                        
                        {isHost ? (
                            <button 
                                onClick={startNewGame} 
                                className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                            >
                                COMMENCER LA PARTIE
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                                <Clock className="w-6 h-6 animate-spin text-accent-primary" />
                                <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* RACING PHASE */}
            {currentPhase === 'racing' && (
                <div className="flex flex-col w-full h-full relative flex-1">
                    {cheatDetected && (
                        <div className="fixed inset-0 bg-brand-bg/95 z-[9999] flex flex-col backdrop-blur-sm">
                            {/* Fake Search Bar UI at the top right, pushed down below navbar */}
                            <div className="absolute top-24 md:top-32 right-4 md:right-12 bg-white rounded-lg shadow-xl flex items-center p-1 w-72 animate-in fade-in slide-in-from-top-8 border border-gray-300 z-50">
                                <div className="flex-1 px-3 py-1.5 text-gray-500 text-sm font-sans flex items-center gap-2 border-r border-gray-200">
                                    <Search className="w-4 h-4 text-gray-400" />
                                    Rechercher...
                                </div>
                                <div className="flex items-center px-1 text-gray-400 gap-1">
                                    <span className="text-xs mr-2">0/0</span>
                                    <button className="p-1 hover:bg-gray-100 rounded cursor-not-allowed"><ChevronUp className="w-4 h-4" /></button>
                                    <button className="p-1 hover:bg-gray-100 rounded cursor-not-allowed border-r border-gray-200 pr-2 mr-1"><ChevronDown className="w-4 h-4" /></button>
                                    <button className="p-1 hover:bg-red-100 hover:text-red-500 rounded cursor-not-allowed"><X className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Arrow pointing to search bar - Hand drawn SVG */}
                            <div className="absolute top-[160px] md:top-[180px] right-32 md:right-48 flex flex-col items-end text-accent-primary animate-in zoom-in duration-500 delay-300">
                                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 stroke-current transform rotate-12">
                                    <path d="M15 85C25 70 40 45 80 20" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-[dash_1s_ease-in-out_forwards]"/>
                                    <path d="M60 15C70 15 80 15 85 20C85 30 80 40 75 45" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <h3 className="font-display font-black text-xl md:text-2xl transform -rotate-6 tracking-widest uppercase">C'est ça que tu cherches ?</h3>
                            </div>

                            {/* Main Warning Text */}
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-20">
                                <div className="bg-brand-inner border-4 border-brand-border p-8 rounded-3xl shadow-brutal mb-6 transform rotate-2">
                                    <h2 className="font-display text-4xl md:text-5xl font-black text-tx-base uppercase mb-4">La recherche est désactivée.</h2>
                                    <p className="text-xl font-bold text-tx-secondary uppercase tracking-widest">Pénalité de 5 secondes en cours...</p>
                                    <Loader2 className="w-12 h-12 animate-spin text-accent-primary mx-auto mt-6" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HUD - Fixed Top */}
                    <div className="bg-brand-card border-b-4 border-brand-border p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm z-10 sticky top-0">
                        <div className="flex items-center gap-3">
                            <span className="text-tx-secondary font-bold uppercase tracking-widest text-xs">Cible :</span>
                            <div className="font-display text-xl md:text-2xl font-black text-accent-primary break-words">
                                {targetPage.replace(/_/g, ' ')}
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 py-2 rounded-xl">
                                <LinkIcon className="w-5 h-5 text-tx-secondary" />
                                <span className="font-display font-black text-xl text-tx-base">{localClicks}</span>
                                <span className="text-xs text-tx-secondary font-bold uppercase ml-1">Clics</span>
                            </div>
                            {countdownEndTime && (
                                <div className="flex items-center gap-2 bg-accent-secondary border-2 border-brand-border px-4 py-2 rounded-xl text-brand-bg animate-pulse">
                                    <Clock className="w-5 h-5" />
                                    <span className="font-display font-black text-xl">{timeLeft}s</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Wiki Content */}
                    <div 
                        ref={contentRef}
                        className="flex-1 overflow-y-auto w-full bg-[#1e1e28] relative"
                    >
                        {isLoadingPage && !cheatDetected && (
                            <div className="absolute inset-0 bg-brand-bg/50 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <Loader2 className="w-12 h-12 text-accent-primary animate-spin mb-4" />
                                <span className="font-display font-black text-tx-base tracking-widest uppercase">Chargement de la page...</span>
                            </div>
                        )}
                        
                        {hasFinished && !cheatDetected ? (
                            <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
                                <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-3xl shadow-brutal mb-6 transform rotate-3">
                                    <Trophy className="w-16 h-16 text-[#FFD000]" />
                                </div>
                                <h3 className="font-display text-3xl font-black text-tx-base mb-4 uppercase">Objectif Atteint !</h3>
                                <p className="text-tx-secondary font-bold text-lg">
                                    En attente des autres joueurs...
                                </p>
                            </div>
                        ) : !cheatDetected && (
                            <div 
                                className="wiki-content max-w-4xl mx-auto p-4 md:p-8 text-white"
                                onClick={handleWikiClick}
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ROUND RESULTS PHASE */}
            {currentPhase === 'round_results' && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-2xl p-4 mx-auto mt-12">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col w-full">
                        <h2 className="font-display text-3xl font-black text-tx-base text-center uppercase tracking-wider mb-8">Résultats de la manche</h2>
                        
                        <div className="space-y-3">
                            {players.map(p => {
                                const stat = playerStats[p.id];
                                const isDnf = !stat;
                                
                                return (
                                    <div key={p.id} className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border-2 border-brand-border",
                                        isDnf ? "bg-brand-bg opacity-70" : "bg-brand-inner"
                                    )}>
                                        <span className="font-display font-black text-lg text-tx-base">{p.name}</span>
                                        {isDnf ? (
                                            <span className="text-accent-secondary font-bold uppercase tracking-widest text-sm">Temps écoulé</span>
                                        ) : (
                                            <div className="flex items-center gap-4">
                                                <span className="text-tx-secondary font-bold text-sm">{stat.clicks} clics</span>
                                                <span className="text-accent-primary font-black font-display">{formatTime(stat.time)}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {isHost && (
                            <div className="mt-8 flex items-center justify-center gap-2 text-tx-secondary font-bold text-sm uppercase tracking-widest">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Manche suivante imminente...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PODIUM PHASE */}
            {currentPhase === 'podium' && (
                <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in mx-auto mt-12">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                        <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                            <Trophy className="w-16 h-16 text-accent-primary" />
                        </div>
                        <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                        
                        <div className="w-full space-y-4 mb-8">
                            {sortedPlayers.map((p, i) => (
                                <div key={p.id} className={cn(
                                    "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                    i === 0 ? "bg-accent-primary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                                )}>
                                    {i === 0 && (
                                        <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                            Encyclopédie
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-4">
                                        <span className={cn(
                                            "w-12 h-12 flex items-center justify-center rounded-xl font-display font-black text-2xl border-2 border-brand-border",
                                            i === 0 ? "bg-[#FFD000] text-brand-bg" : "bg-brand-bg text-tx-base"
                                        )}>
                                            {i + 1}
                                        </span>
                                        
                                        <div className="flex flex-col text-left">
                                            <span className="text-xl font-display font-black">{p.name}</span>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "text-3xl font-display font-black",
                                        i === 0 ? "text-brand-bg" : "text-accent-primary"
                                    )}>{p.score} pts</span>
                                </div>
                            ))}
                        </div>
                        
                        {isHost && (
                            <button 
                                onClick={returnToLobby} 
                                className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg shadow-brutal"
                            >
                                RETOUR AU SALON
                            </button>
                        )}
                    </div>
                </div>
            )}
        </GameLayout>
    );
}