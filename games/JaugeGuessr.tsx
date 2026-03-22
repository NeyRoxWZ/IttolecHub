'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Send, Target, Trophy, Clock, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function JaugeGuessr({ params }: { params: { code: string } }) {
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
        setGameStatus
    } = useGameSync(roomCode, 'jaugeguessr');

    const [userGuess, setUserGuess] = useState<number>(90);
    const [clueInput, setClueInput] = useState('');
    const [showTarget, setShowTarget] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    const svgRef = useRef<SVGSVGElement>(null);

    // --- DERIVED STATE ---
    const roundData = gameState?.round_data || {};
    const currentPhase = roundData.phase || 'setup';
    const settings = gameState?.settings || {};
    const difficulty = settings.difficulty || 'normal';
    const totalRounds = gameState?.total_rounds || settings.rounds || 5;
    const currentRound = gameState?.current_round || 1;
    
    const guiderId = roundData.guider_id;
    const isGuider = playerId === guiderId;
    const leftWord = roundData.left_word || '???';
    const rightWord = roundData.right_word || '???';
    const targetAngle = roundData.target_angle || 90;
    const clue = roundData.clue || '';
    const guesses = roundData.guesses || {};
    const scores = roundData.scores || {};

    const seekers = players.filter(p => p.id !== guiderId);
    const hasGuessed = Boolean(playerId && guesses[playerId] !== undefined);
    const allGuessed = seekers.length > 0 && seekers.every(p => guesses[p.id] !== undefined);

    // --- SIZES FOR DIFFICULTY ---
    const getTargetSizes = () => {
        switch (difficulty) {
            case 'easy': return { bullseye: 12, adjacent: 24 };
            case 'hard': return { bullseye: 3, adjacent: 8 };
            default: return { bullseye: 6, adjacent: 16 };
        }
    };
    const sizes = getTargetSizes();

    // --- HOST LOGIC (EVENT SOURCING) ---
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

                if (move.action_type === 'jauge_clue' && updatedRoundData.phase === 'writing_clue') {
                    updatedRoundData.clue = move.payload.clue;
                    updatedRoundData.phase = 'guessing';
                    stateChanged = true;
                }

                if (move.action_type === 'jauge_guess' && updatedRoundData.phase === 'guessing') {
                    updatedRoundData.guesses = {
                        ...updatedRoundData.guesses,
                        [move.player_id]: move.payload.angle
                    };
                    stateChanged = true;
                }
            }

            if (stateChanged) {
                // Check if all guessed after processing
                const currentSeekers = players.filter(p => p.id !== updatedRoundData.guider_id);
                const currentAllGuessed = currentSeekers.length > 0 && currentSeekers.every(p => updatedRoundData.guesses[p.id] !== undefined);

                if (currentAllGuessed && updatedRoundData.phase === 'guessing') {
                    // Calculate scores
                    const newScores = { ...(updatedRoundData.scores || {}) };
                    currentSeekers.forEach(seeker => {
                        const guess = updatedRoundData.guesses[seeker.id];
                        if (guess !== undefined) {
                            const diff = Math.abs(guess - updatedRoundData.target_angle);
                            let points = 0;
                            if (diff <= sizes.bullseye / 2) points = 3;
                            else if (diff <= sizes.bullseye / 2 + sizes.adjacent) points = 1;
                            
                            newScores[seeker.id] = (newScores[seeker.id] || 0) + points;
                        }
                    });
                    updatedRoundData.phase = 'round_results';
                    updatedRoundData.scores = newScores;
                    updatedRoundData.round_end_time = Date.now() + 5000; // 5 seconds before next round
                }

                await updateRoundData(updatedRoundData);
            }
        };

        processMoves();
    }, [moves, isHost, roundData, players, sizes]);

    // --- AUTO NEXT ROUND ---
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
            const res = await fetch(`/api/games/jaugeguessr?count=${totalRounds}`);
            const pairs = await res.json();
            
            if (!pairs || pairs.length === 0) {
                toast.error("Erreur lors du chargement des mots.");
                return;
            }

            const initialGuider = players[0]?.id;
            
            await supabase.from('game_sessions').upsert({
                room_id: roomId,
                status: 'round_active',
                current_round: 1,
                total_rounds: totalRounds,
                answers: { pairs }, // Store pairs in answers to reuse them across rounds
                round_data: {
                    phase: 'writing_clue',
                    guider_id: initialGuider,
                    left_word: pairs[0].left,
                    right_word: pairs[0].right,
                    target_angle: Math.floor(Math.random() * 141) + 20, // 20 to 160 integer
                    clue: '',
                    guesses: {},
                    scores: {}
                }
            }, { onConflict: 'room_id' });

            await supabase.from('game_moves').delete().eq('room_id', roomId);
            await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
        } catch (e) {
            console.error(e);
            toast.error("Erreur au démarrage de la partie");
        }
    };

    const submitClue = () => {
        if (!isGuider || !clueInput.trim()) return;
        sendMove('jauge_clue', { clue: clueInput.trim() });
    };

    const submitGuess = () => {
        if (isGuider || hasGuessed || !playerId) return;
        sendMove('jauge_guess', { angle: userGuess });
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
            const nextPair = pairs[nextRoundNum - 1] || { left: "A", right: "B" };
            
            // Cycle guider
            const currentGuiderIndex = players.findIndex(p => p.id === guiderId);
            const nextGuiderIndex = (currentGuiderIndex + 1) % players.length;
            const nextGuiderId = players[nextGuiderIndex]?.id;

            await supabase.from('game_moves').delete().eq('room_id', roomId);
            await supabase.from('game_sessions').update({
                current_round: nextRoundNum,
                round_data: {
                    ...roundData,
                    phase: 'writing_clue',
                    guider_id: nextGuiderId,
                    left_word: nextPair.left,
                    right_word: nextPair.right,
                    target_angle: Math.floor(Math.random() * 141) + 20, // 20 to 160 integer
                    clue: '',
                    guesses: {}
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

    // --- DRAWING LOGIC ---
    const polarToCartesian = (angle: number) => {
        const rad = Math.PI - (angle * Math.PI / 180); // Reverse so 0 is left, 180 is right
        return {
            x: 100 + 90 * Math.cos(rad),
            y: 100 - 90 * Math.sin(rad)
        };
    };

    const describeArc = (startAngle: number, endAngle: number) => {
        const start = polarToCartesian(startAngle);
        const end = polarToCartesian(endAngle);
        return [
            "M", start.x, start.y, 
            "A", 90, 90, 0, 0, 1, end.x, end.y
        ].join(" ");
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (currentPhase !== 'guessing' || isGuider || hasGuessed) return;
        // Don't capture right clicks
        if (e.button !== 0) return;
        setIsDragging(true);
        updateAngleFromEvent(e);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || currentPhase !== 'guessing' || isGuider || hasGuessed) return;
        updateAngleFromEvent(e);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {
            // Ignore if pointer capture was already released
        }
    };

    const updateAngleFromEvent = (e: React.PointerEvent) => {
        if (!svgRef.current) return;
        
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        
        // Transform screen coordinates to SVG coordinates
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        
        const svgP = pt.matrixTransform(ctm.inverse());
        
        // In the viewBox="0 0 200 110", the center of the arc is exactly at (100, 100)
        const dx = svgP.x - 100;
        const dy = 100 - svgP.y; // Up is positive
        
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        // atan2 returns angle from -180 to 180.
        // For our top semi-circle, dy is positive, so angle is 0 to 180.
        // 0 is right, 180 is left.
        if (angle < 0) {
            // If they drag below the center line, clamp to edges
            angle = dx > 0 ? 0 : 180;
        }
        
        // We want 0 on the left, 180 on the right, so we do 180 - angle.
        angle = 180 - angle;
        
        if (angle < 0) angle = 0;
        if (angle > 180) angle = 180;
        
        setUserGuess(angle);
    };

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

    if (!gameState) {
        return (
            <GameLayout gameTitle="JaugeGuessr" players={playersRecord} roundCount={1} maxRounds={1} timer="00" timeLeft={0} voteToLobby={<VoteToLobby roomCode={roomCode} roomId={roomId || ''} playerId={playerId || ''} players={players} />}>
                <div className="flex items-center justify-center flex-1">
                    <Loader2 className="w-12 h-12 animate-spin text-accent-primary" />
                </div>
            </GameLayout>
        );
    }

    return (
        <GameLayout
            gameTitle="JaugeGuessr"
            players={playersRecord}
            roundCount={currentRound}
            maxRounds={totalRounds}
            timer="--"
            timeLeft={30}
            voteToLobby={<VoteToLobby roomCode={roomCode} roomId={roomId || ''} playerId={playerId || ''} players={players} />}
        >
            {/* SETUP PHASE */}
            {currentPhase === 'setup' && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                        <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform rotate-3">
                            <Target className="w-16 h-16 text-accent-primary" />
                        </div>
                        
                        <div className="text-center space-y-2 mb-8">
                            <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">
                                Jauge <span className="text-accent-primary">Guessr</span>
                            </h2>
                            <p className="text-tx-secondary font-bold">
                                Jauger la bonne intensité entre deux extrêmes.
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

            {/* PLAYING PHASES */}
            {(currentPhase === 'writing_clue' || currentPhase === 'guessing' || currentPhase === 'round_results') && (
                <div className="flex flex-col items-center w-full max-w-3xl gap-4 p-2 flex-1 mt-2">
                    
                    {/* Header Info */}
                    <div className="relative text-center w-full bg-brand-card p-4 rounded-2xl border-4 border-brand-border shadow-brutal flex flex-col justify-center min-h-[100px]">
                        {/* Eye Button for Guider (Small, Top Right) */}
                        {isGuider && currentPhase === 'writing_clue' && (
                            <button
                                className="absolute -top-3 -right-3 bg-brand-inner border-4 border-brand-border rounded-full p-2 transition-all shadow-brutal active:translate-y-1 active:shadow-none z-10 text-tx-secondary hover:text-accent-primary"
                                onPointerDown={() => setShowTarget(true)}
                                onPointerUp={() => setShowTarget(false)}
                                onPointerCancel={() => setShowTarget(false)}
                                onContextMenu={(e) => e.preventDefault()}
                                title="Maintenir pour voir la cible"
                            >
                                {showTarget ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </button>
                        )}

                        {currentPhase === 'writing_clue' && (
                            <h3 className="font-display text-lg md:text-xl font-black text-tx-base uppercase tracking-wider">
                                {isGuider ? "Fais deviner avec un indice !" : `${players.find(p => p.id === guiderId)?.name} réfléchit...`}
                            </h3>
                        )}
                        {currentPhase === 'guessing' && (
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-tx-secondary uppercase tracking-widest mb-1">L'indice est :</span>
                                <div className="font-display text-2xl md:text-3xl font-black text-accent-primary break-words max-w-full">
                                    {clue}
                                </div>
                            </div>
                        )}
                        {currentPhase === 'round_results' && (
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-xs font-bold text-tx-secondary uppercase tracking-widest mb-1">L'indice était :</span>
                                <div className="font-display text-2xl md:text-3xl font-black text-tx-base break-words max-w-full">
                                    {clue}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* JAUGE (Arc) */}
                    <div className="relative w-full max-w-xl mt-4 px-4 md:px-8">
                        {/* Words at extremities */}
                        <div className="absolute top-full left-0 mt-2 text-left w-1/2 -translate-x-2 md:-translate-x-4 pr-4">
                            <span className="font-display font-black text-sm md:text-lg text-tx-base leading-tight block break-words">{leftWord}</span>
                        </div>
                        <div className="absolute top-full right-0 mt-2 text-right w-1/2 translate-x-2 md:translate-x-4 pl-4">
                            <span className="font-display font-black text-sm md:text-lg text-tx-base leading-tight block break-words">{rightWord}</span>
                        </div>

                        <svg 
                            ref={svgRef}
                            viewBox="0 0 200 110" 
                            className={cn(
                                "w-full drop-shadow-2xl overflow-visible",
                                currentPhase === 'guessing' && !isGuider && !hasGuessed ? "cursor-pointer" : ""
                            )}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            style={{ touchAction: 'none' }}
                        >
                            {/* Background Arc */}
                            <path 
                                d={describeArc(0, 180)} 
                                fill="none" 
                                stroke="#1E1E28" 
                                strokeWidth="20" 
                                strokeLinecap="round"
                            />

                            {/* Target Zones */}
                            {(currentPhase === 'round_results' || (isGuider && showTarget)) && (
                                <>
                                    {/* Left Adjacent */}
                                    <path 
                                        d={describeArc(Math.max(0, targetAngle - sizes.bullseye/2 - sizes.adjacent), Math.max(0, targetAngle - sizes.bullseye/2))} 
                                        fill="none" 
                                        stroke="#FFD000" 
                                        strokeWidth="20" 
                                    />
                                    {/* Right Adjacent */}
                                    <path 
                                        d={describeArc(Math.min(180, targetAngle + sizes.bullseye/2), Math.min(180, targetAngle + sizes.bullseye/2 + sizes.adjacent))} 
                                        fill="none" 
                                        stroke="#FFD000" 
                                        strokeWidth="20" 
                                    />
                                    {/* Bullseye */}
                                    <path 
                                        d={describeArc(Math.max(0, targetAngle - sizes.bullseye/2), Math.min(180, targetAngle + sizes.bullseye/2))} 
                                        fill="none" 
                                        stroke="#00FF94" 
                                        strokeWidth="20" 
                                    />
                                    {/* Target Marker for precise center */}
                                    <circle 
                                        cx={polarToCartesian(targetAngle).x} 
                                        cy={polarToCartesian(targetAngle).y} 
                                        r="3" 
                                        fill="#000000" 
                                    />
                                </>
                            )}

                            {/* User's Needle (during guessing or results) */}
                            {(!isGuider && (currentPhase === 'guessing' || currentPhase === 'round_results')) && (
                                <g transform={`rotate(${userGuess}, 100, 100)`}>
                                    <line x1="20" y1="100" x2="100" y2="100" stroke="#FF2A55" strokeWidth="4" strokeLinecap="round" />
                                    <circle cx="20" cy="100" r="6" fill="#FF2A55" stroke="#000" strokeWidth="2" />
                                </g>
                            )}

                            {/* All Needles (Results) */}
                            {currentPhase === 'round_results' && seekers.map(seeker => {
                                const guess = guesses[seeker.id];
                                if (guess === undefined || seeker.id === playerId) return null; // Don't draw own needle twice
                                return (
                                    <g key={seeker.id} transform={`rotate(${guess}, 100, 100)`}>
                                        <line x1="20" y1="100" x2="100" y2="100" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
                                        <circle cx="20" cy="100" r="5" fill="#06B6D4" stroke="#000" strokeWidth="1.5" />
                                    </g>
                                );
                            })}
                            
                            {/* Center Pin */}
                            <circle cx="100" cy="100" r="8" fill="#FFFFFF" stroke="#000000" strokeWidth="3" />
                        </svg>
                    </div>

                    {/* Interactions */}
                    <div className="mt-16 md:mt-20 w-full max-w-md pb-4">
                        {currentPhase === 'writing_clue' && isGuider && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        value={clueInput}
                                        onChange={e => setClueInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && submitClue()}
                                        placeholder="Écrivez un indice..."
                                        className="flex-1 h-16 px-6 text-xl font-bold bg-brand-inner border-4 border-brand-border rounded-2xl text-tx-base placeholder:text-tx-muted focus:border-tx-base shadow-brutal outline-none"
                                    />
                                    <button 
                                        onClick={submitClue}
                                        disabled={!clueInput.trim()}
                                        className="h-16 px-8 bg-accent-success hover:bg-tx-base text-brand-bg font-display font-black tracking-wider rounded-2xl shadow-brutal border-4 border-brand-border transition-colors disabled:bg-brand-inner disabled:text-tx-muted disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentPhase === 'guessing' && !isGuider && (
                            <div className="animate-in slide-in-from-bottom-4">
                                <button 
                                    onClick={submitGuess}
                                    disabled={hasGuessed}
                                    className={cn(
                                        "w-full h-16 font-display text-xl font-black tracking-wider rounded-2xl transition-all border-4 border-brand-border shadow-brutal flex items-center justify-center gap-3",
                                        hasGuessed 
                                        ? "bg-brand-inner text-tx-muted cursor-not-allowed" 
                                        : "bg-accent-primary text-brand-bg hover:bg-tx-base active:translate-y-1 active:shadow-none"
                                    )}
                                >
                                    {hasGuessed ? (
                                        <>EN ATTENTE DES AUTRES <Loader2 className="w-5 h-5 animate-spin" /></>
                                    ) : (
                                        <>VALIDER MA POSITION <Target className="w-6 h-6" /></>
                                    )}
                                </button>
                                {!hasGuessed && (
                                    <p className="text-center text-tx-secondary font-bold text-sm mt-4 uppercase tracking-widest">
                                        Faites glisser l'aiguille sur la jauge
                                    </p>
                                )}
                            </div>
                        )}

                        {currentPhase === 'round_results' && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="bg-brand-card border-4 border-brand-border rounded-2xl p-4 shadow-brutal">
                                    <h4 className="font-display font-black text-tx-base uppercase tracking-widest text-center mb-4">Points de la manche</h4>
                                    <div className="space-y-2">
                                        {seekers.map(seeker => {
                                            const guess = guesses[seeker.id];
                                            if (guess === undefined) return null;
                                            const diff = Math.abs(guess - targetAngle);
                                            let points = 0;
                                            let color = "text-tx-muted";
                                            if (diff <= sizes.bullseye / 2) { points = 3; color = "text-accent-success"; }
                                            else if (diff <= sizes.bullseye / 2 + sizes.adjacent) { points = 1; color = "text-[#FFD000]"; }
                                            
                                            return (
                                                <div key={seeker.id} className="flex items-center justify-between bg-brand-inner p-3 rounded-xl border-2 border-brand-border">
                                                    <span className="font-bold text-tx-base">{players.find(p => p.id === seeker.id)?.name}</span>
                                                    <span className={cn("font-display font-black text-xl", color)}>+{points}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {isHost && (
                                    <div className="mt-4 flex items-center justify-center gap-2 text-tx-secondary font-bold text-sm uppercase tracking-widest">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Manche suivante imminente...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PODIUM PHASE */}
            {currentPhase === 'podium' && (
                <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                    <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                        <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                            <Trophy className="w-16 h-16 text-accent-primary" />
                        </div>
                        <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                        
                        <div className="w-full space-y-4 mb-8">
                            {sortedPlayers.filter(p => p.id !== guiderId || seekers.length === 0 /* handle 1 player edge case */).map((p, i) => (
                                <div key={p.id} className={cn(
                                    "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                    i === 0 ? "bg-accent-primary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                                )}>
                                    {/* Badges */}
                                    {i === 0 && (
                                        <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                            Télépathe
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
                                            <span className={cn(
                                                "text-xs font-bold uppercase tracking-widest",
                                                i === 0 ? "text-brand-bg/80" : "text-tx-secondary"
                                            )}>
                                                {i === 0 ? '🎯 Précision absolue' : '🤔 Sur la bonne voie'}
                                            </span>
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
