'use client';

import { useEffect, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, AnswerList, NextStep, PartyShell, PlayerChips, Podium, PromptCard, RevealBanner, ScoreList, SetupScreen, Waiting } from './party/ui';

const SWATCH = { fill: '#8B3DFF', shade: '#6526C9' };
const CLUE_TIME = 60;
const RESULTS_TIME = 12;
const COLORS = ['#5B8CFF', '#FF4F8B', '#FF8A1F', '#8B3DFF', '#00A6C0', '#E0A800', '#1F2937', '#8D6E63'];

type Pair = { left: string; right: string };
const zones = (difficulty: string) => (difficulty === 'easy' ? { bull: 12, near: 24 } : difficulty === 'hard' ? { bull: 3, near: 8 } : { bull: 6, near: 16 });
const pointsFor = (angle: number, target: number, z: { bull: number; near: number }) => {
  const d = Math.abs(angle - target);
  return d <= z.bull / 2 ? 300 : d <= z.bull / 2 + z.near ? 100 : 0;
};

export default function JaugeGuessr({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'jaugeguessr');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const guessTime = numSetting(settings, 'time', 45, 10, 300);
  const z = zones(String(settings.difficulty || 'normal'));

  const pair: Pair | undefined = round.pair;
  const guide: string | undefined = round.guide;
  const target: number = round.target ?? 90;
  const isGuide = !!playerId && playerId === guide;

  const [angle, setAngle] = useState(90);
  const [clue, setClue] = useState('');
  const [peek, setPeek] = useState(false);
  useEffect(() => { setAngle(90); setClue(''); }, [gid, roundNo]);
  const [sentGuess, markGuess] = useSent<number>(party, 'guess');

  const guesses: Record<string, number> = {};
  for (const [pid, g] of Object.entries(party.latestBy('guess', 'guess'))) if (Number.isFinite(g?.angle)) guesses[pid] = g.angle;
  const clueMove = party.movesIn('clue', 'clue').find((m) => m.player_id === guide);

  const roundOf = (deck: Pair[], n: number) => {
    const order = party.active.map((p) => p.id);
    return { phase: 'clue', pair: deck[n - 1], guide: order[(n - 1) % Math.max(1, order.length)], target: Math.floor(Math.random() * 141) + 20, ends_at: party.deadline(CLUE_TIME) };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', 5, 1, 30);
    const deck: Pair[] = await fetch(`/api/games/jaugeguessr?count=${rounds}`).then((r) => r.json()).catch(() => []);
    if (!Array.isArray(deck) || !deck.length) { toast.error('Impossible de charger les jauges.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  // The guide's clue opens the guessing; no clue in time, the round is skipped.
  useHostStep(party, `${gid}:${roundNo}:clue-end`, phase === 'clue' && (!!clueMove || party.expired), async () => {
    if (!clueMove) {
      await party.patchRound({ phase: 'results', skipped: true, gains: {}, ends_at: party.deadline(6) });
      return;
    }
    await party.patchRound({ phase: 'guess', clue: String(clueMove.payload?.text || '').slice(0, 60), ends_at: party.deadline(guessTime) });
  });

  const seekers = active.filter((p) => p.id !== guide);
  const allGuessed = seekers.length > 0 && seekers.every((p) => guesses[p.id] !== undefined);
  useHostStep(party, `${gid}:${roundNo}:guess-end`, phase === 'guess' && (party.expired || allGuessed), async () => {
    const gains: Scores = {};
    let bullseyes = 0;
    for (const [pid, a] of Object.entries(guesses)) {
      if (pid === guide) continue;
      const pts = pointsFor(a, target, z);
      if (pts) gains[pid] = pts;
      if (pts === 300) bullseyes++;
    }
    if (guide && bullseyes) gains[guide] = (gains[guide] || 0) + bullseyes * 100;
    await party.patchRound({ phase: 'results', guesses, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: Pair[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  const myGuess = sentGuess ?? (playerId ? guesses[playerId] : undefined);
  const seekerIds = party.seated.filter((p) => p.id !== guide).map((p) => p.id);
  const colorOf = (pid: string) => COLORS[Math.max(0, seekerIds.indexOf(pid)) % COLORS.length];
  const shownGuesses: Record<string, number> = round.guesses || {};

  return (
    <PartyShell party={party} title="JaugeGuessr" maxTime={phase === 'clue' ? CLUE_TIME : phase === 'guess' ? guessTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="JaugeGuessr"
          tagline="Place l’aiguille entre deux extrêmes."
          icon={Target}
          swatch={SWATCH}
          minPlayers={2}
          onStart={start}
          rules={[
            'Chaque manche, un guide voit une cible cachée sur une jauge entre deux extrêmes.',
            'Il donne un indice qui correspond à cet endroit de la jauge.',
            'Les autres placent l’aiguille là où ils pensent que se trouve la cible.',
            'En plein dans le mille : 300 points. À côté : 100. Le guide gagne 100 par joueur dans le mille.',
          ]}
        />
      )}

      {phase !== 'setup' && phase !== 'podium' && pair && (
        <>
          <PromptCard eyebrow={phase === 'clue' ? (isGuide ? 'Tu es le guide' : `${party.nameOf(guide)} est le guide`) : 'L’indice'}>
            {phase === 'clue' ? (isGuide ? 'Trouve un indice pour la cible' : 'Le guide cherche un indice…') : `« ${round.clue || '—'} »`}
          </PromptCard>

          <Gauge
            left={pair.left}
            right={pair.right}
            value={phase === 'guess' && !isGuide ? (myGuess ?? angle) : undefined}
            onChange={phase === 'guess' && !isGuide ? (a) => setAngle(a) : undefined}
            target={phase === 'results' || (isGuide && (phase !== 'clue' || peek)) ? target : undefined}
            zones={z}
            needles={phase === 'results' ? Object.entries(shownGuesses).map(([pid, a]) => ({ pid, angle: a, color: colorOf(pid) })) : []}
          />

          {phase === 'clue' && isGuide && (
            <div className="w-full space-y-3">
              <button
                onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}
                onContextMenu={(e) => e.preventDefault()}
                className={cn(BRAWL.dark, 'h-12 w-full select-none touch-none rounded-2xl text-lg')}
              >
                Maintiens pour voir la cible
              </button>
              <AnswerInput value={clue} onChange={setClue} maxLength={60} placeholder="Ton indice…" submitLabel="Envoyer" onSubmit={() => { party.act('clue', { text: clue.trim() }); vibrate(HAPTIC.MEDIUM); }} />
            </div>
          )}
          {phase === 'clue' && !isGuide && <Waiting text={`${party.nameOf(guide)} réfléchit à un indice…`} />}

          {phase === 'guess' && !isGuide && (
            <>
              <button
                onClick={() => { markGuess(angle); party.act('guess', { angle }); vibrate(HAPTIC.MEDIUM); }}
                className={cn(BRAWL.green, 'h-14 w-full max-w-sm rounded-2xl text-xl')}
              >
                {myGuess !== undefined ? 'Changer ma position' : 'Valider ma position'}
              </button>
              <p className="text-center text-sm font-bold text-tx-secondary">Fais glisser l’aiguille sur la jauge.</p>
            </>
          )}
          {phase === 'guess' && isGuide && <Waiting text="Les autres placent leur aiguille…" />}
          {phase === 'guess' && <PlayerChips party={party} only={seekerIds} done={Object.keys(guesses)} label="Ont validé" />}

          {phase === 'results' && (
            <>
              {round.skipped ? (
                <RevealBanner tone="bad" eyebrow="Manche passée">Pas d’indice à temps</RevealBanner>
              ) : (
                <AnswerList
                  party={party}
                  title="Positions"
                  rows={Object.entries(shownGuesses).map(([pid, a]) => ({
                    pid,
                    ok: pointsFor(a, target, z) > 0,
                    answer: <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-brand-border" style={{ background: colorOf(pid) }} /> écart de {Math.round(Math.abs(a - target))}°</span>,
                    points: round.gains?.[pid],
                  }))}
                />
              )}
              <ScoreList party={party} gains={round.gains} />
              <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'} />
            </>
          )}
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les télépathes de la soirée." />}
    </PartyShell>
  );
}

/** A half-circle gauge from `left` (0°) to `right` (180°), with a draggable needle. */
function Gauge({ left, right, value, onChange, target, zones: z, needles }: {
  left: string; right: string; value?: number; onChange?: (a: number) => void; target?: number; zones: { bull: number; near: number }; needles: { pid: string; angle: number; color: string }[];
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const polar = (a: number, r = 90) => { const rad = Math.PI - (a * Math.PI) / 180; return { x: 100 + r * Math.cos(rad), y: 100 - r * Math.sin(rad) }; };
  const arc = (a: number, b: number) => { const s = polar(a); const e = polar(b); return `M ${s.x} ${s.y} A 90 90 0 0 1 ${e.x} ${e.y}`; };
  const setFrom = (e: React.PointerEvent) => {
    if (!svg.current || !onChange) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 200 - 100;
    const y = 100 - ((e.clientY - r.top) / r.height) * 110;
    let a = (Math.atan2(Math.max(0, y), x) * 180) / Math.PI;
    a = 180 - Math.min(180, Math.max(0, a));
    onChange(Math.round(a));
  };
  const clamp = (a: number) => Math.min(180, Math.max(0, a));

  return (
    <div className="w-full max-w-xl">
      <svg
        ref={svg}
        viewBox="0 0 200 110"
        className={cn('w-full overflow-visible', onChange && 'cursor-pointer touch-none')}
        onPointerDown={(e) => { if (!onChange) return; dragging.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} setFrom(e); }}
        onPointerMove={(e) => { if (dragging.current) setFrom(e); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <path d={arc(0, 180)} fill="none" stroke="#05061A" strokeWidth="24" strokeLinecap="round" />
        <path d={arc(0, 180)} fill="none" stroke="#151942" strokeWidth="18" strokeLinecap="round" />
        {target !== undefined && (
          <>
            <path d={arc(clamp(target - z.bull / 2 - z.near), clamp(target - z.bull / 2))} fill="none" stroke="#FFC61A" strokeWidth="18" />
            <path d={arc(clamp(target + z.bull / 2), clamp(target + z.bull / 2 + z.near))} fill="none" stroke="#FFC61A" strokeWidth="18" />
            <path d={arc(clamp(target - z.bull / 2), clamp(target + z.bull / 2))} fill="none" stroke="#33D17A" strokeWidth="18" />
          </>
        )}
        {needles.map((n) => (
          <g key={n.pid} transform={`rotate(${n.angle}, 100, 100)`}>
            <line x1="22" y1="100" x2="100" y2="100" stroke={n.color} strokeWidth="3" strokeLinecap="round" />
            <circle cx="22" cy="100" r="5" fill={n.color} stroke="#05061A" strokeWidth="1.5" />
          </g>
        ))}
        {value !== undefined && (
          <g transform={`rotate(${value}, 100, 100)`}>
            <line x1="18" y1="100" x2="100" y2="100" stroke="#FF4F8B" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="18" cy="100" r="7" fill="#FF4F8B" stroke="#05061A" strokeWidth="2" />
          </g>
        )}
        <circle cx="100" cy="100" r="8" fill="#FFFFFF" stroke="#05061A" strokeWidth="3" />
      </svg>
      <div className="mt-2 flex justify-between gap-4">
        <span className="max-w-[48%] font-display text-base leading-tight md:text-lg">{left}</span>
        <span className="max-w-[48%] text-right font-display text-base leading-tight md:text-lg">{right}</span>
      </div>
    </div>
  );
}
