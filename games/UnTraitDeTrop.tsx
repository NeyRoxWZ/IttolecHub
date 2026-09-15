'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brush } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, shuffle, pickOne } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, ChoiceButton, NextStep, PartyShell, PlayerChips, Podium, PromptCard, ScoreList, SetupScreen, Waiting } from './party/ui';

const SWATCH = { fill: '#FF8A1F', shade: '#CC6508' };
const COLORS = ['#FF4F8B', '#3B6BFF', '#1FB866', '#FF8A1F', '#8B3DFF', '#00A6C0', '#E63946', '#8D6E63', '#1F2937', '#E0A800'];
const GUESS_TIME = 25;
const RESULTS_TIME = 15;
const W = 1200;
const H = 900;

type Pt = [number, number];
type Stroke = { t: number; pid: string; pts: Pt[]; color: string };
type Card = { text: string; catLabel?: string };

export default function UnTraitDeTrop({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'untraitdetrop');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const turnTime = numSetting(settings, 'turnTime', 20, 5, 90);
  const voteTime = numSetting(settings, 'voteTime', 45, 10, 180);

  const order: string[] = round.order || [];
  const laps: number = round.laps || 2;
  const totalTurns = order.length * laps;
  const turn: number = round.turn || 0;
  const drawer = order.length ? order[turn % order.length] : undefined;
  const imposter: string | undefined = round.imposter;
  const colorOf = useCallback((pid: string) => COLORS[Math.max(0, order.indexOf(pid)) % COLORS.length], [order]);

  /* ---------------- strokes ---------------- */
  const [pending, setPending] = useState<Stroke | null>(null);
  const strokes = useMemo(() => {
    const byTurn = new Map<number, Stroke>();
    for (const m of party.movesIn('draw', 'stroke')) {
      const t = Number(m.payload?.t);
      if (!Number.isInteger(t) || byTurn.has(t) || order[t % Math.max(1, order.length)] !== m.player_id) continue;
      const pts = Array.isArray(m.payload?.pts) ? (m.payload.pts as Pt[]) : [];
      byTurn.set(t, { t, pid: m.player_id, pts, color: colorOf(m.player_id) });
    }
    if (pending && pending.pts.length && !byTurn.has(pending.t) && round.gid === gid) byTurn.set(pending.t, pending);
    return Array.from(byTurn.values()).sort((a, b) => a.t - b.t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party.moves, gid, roundNo, order, pending, colorOf]);
  useEffect(() => setPending(null), [gid, roundNo]);

  const live = party.lastEvent?.type === 'trait_live' && party.lastEvent.payload?.g === gid && party.lastEvent.payload?.r === roundNo && party.lastEvent.payload?.t === turn && phase === 'draw'
    ? { pts: party.lastEvent.payload.pts as Pt[], color: colorOf(party.lastEvent.payload.pid) }
    : null;

  const myTurn = phase === 'draw' && !!playerId && drawer === playerId;
  const drewThisTurn = strokes.some((s) => s.t === turn);

  const firstOf = (deck: Card[], n: number) => {
    const ids = shuffle(party.active.map((p) => p.id));
    return {
      phase: 'draw',
      card: deck[n - 1] ?? deck[0],
      imposter: pickOne(ids),
      order: ids,
      laps: numSetting(settings, 'laps', 2, 1, 5),
      turn: 0,
      ends_at: party.deadline(turnTime + 3),
    };
  };

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 4, 1, 30);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=untraitdetrop&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: Card[] = data?.items || [];
    if (!deck.length) { toast.error('Impossible de charger les mots.'); return; }
    await party.startGame(deck, firstOf(deck, 1), deck.length);
  };

  // A stroke drawn, time up, or the drawer left: next turn, then the vote.
  const drawerGone = !!drawer && !party.seated.some((p) => p.id === drawer);
  useHostStep(party, `${gid}:${roundNo}:turn${turn}`, phase === 'draw' && (party.expired || drewThisTurn || drawerGone), async () => {
    const nextTurn = turn + 1;
    if (nextTurn >= totalTurns) await party.patchRound({ phase: 'vote', ends_at: party.deadline(voteTime) });
    else await party.patchRound({ turn: nextTurn, ends_at: party.deadline(turnTime) });
  });

  const votes = party.latestBy('vote', 'vote');
  const [myPick, markPick] = useSent<string>(party, 'vote');
  const allVoted = active.length > 0 && active.every((p) => votes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const counts: Record<string, number> = {};
    for (const [voter, v] of Object.entries(votes)) if (v?.pid && v.pid !== voter) counts[v.pid] = (counts[v.pid] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    const caught = max > 0 && leaders.length === 1 && leaders[0] === imposter;
    if (caught) {
      await party.patchRound({ phase: 'guess', counts, voters: votes, ends_at: party.deadline(GUESS_TIME) });
      return;
    }
    const gains: Scores = imposter ? { [imposter]: 300 } : {};
    await party.patchRound({ phase: 'results', counts, voters: votes, caught: false, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const guesses = party.latestBy('guess', 'guess');
  const imposterGuess: string | undefined = imposter ? guesses[imposter]?.text : undefined;
  useHostStep(party, `${gid}:${roundNo}:guess-end`, phase === 'guess' && (party.expired || !!imposterGuess), async () => {
    const right = !!imposterGuess && isCloseEnough(imposterGuess, round.card?.text || '');
    const gains: Scores = {};
    if (right && imposter) gains[imposter] = 200;
    if (!right) {
      for (const p of party.seated) if (p.id !== imposter && order.includes(p.id)) gains[p.id] = 100;
      for (const [voter, v] of Object.entries((round.voters || {}) as Record<string, any>)) if (voter !== imposter && v?.pid === imposter) gains[voter] = (gains[voter] || 0) + 50;
    }
    await party.patchRound({ phase: 'results', caught: true, guess: imposterGuess || '', right, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  /* ---------------- render ---------------- */
  const card: Card | undefined = round.card;
  const isImposter = !!playerId && playerId === imposter;
  const [guessDraft, setGuessDraft] = useState('');
  const myVote = myPick ?? (playerId ? votes[playerId]?.pid : undefined);

  const roleCard = card && phase !== 'results' && (
    isImposter ? (
      <PromptCard eyebrow="Tu es l’imposteur" tone="pink">Thème : {card.catLabel}</PromptCard>
    ) : order.includes(playerId || '') ? (
      <PromptCard eyebrow={`Le mot · ${card.catLabel}`} tone="yellow">{card.text}</PromptCard>
    ) : (
      <PromptCard eyebrow="Tu regardes">Thème : {card.catLabel}</PromptCard>
    )
  );

  const board = (
    <Board
      strokes={strokes}
      live={live}
      canDraw={myTurn && !drewThisTurn && !pending}
      color={playerId ? colorOf(playerId) : '#000'}
      onLive={(pts) => party.broadcast('trait_live', { g: gid, r: roundNo, t: turn, pid: playerId, pts })}
      onStroke={(pts) => {
        if (!playerId) return;
        setPending({ t: turn, pid: playerId, pts, color: colorOf(playerId) });
        party.act('stroke', { t: turn, pts });
        vibrate(HAPTIC.MEDIUM);
      }}
    />
  );

  return (
    <PartyShell party={party} title="Un Trait de Trop" maxTime={phase === 'draw' ? turnTime : phase === 'vote' ? voteTime : phase === 'guess' ? GUESS_TIME : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="Un Trait de Trop"
          tagline="Un trait chacun. Un imposteur n’a pas le mot."
          icon={Brush}
          swatch={SWATCH}
          minPlayers={3}
          onStart={start}
          rules={[
            'Tout le monde reçoit le même mot, sauf l’imposteur qui ne connaît que le thème.',
            'À ton tour, tu dessines un seul trait : tu appuies, tu traces, tu relâches.',
            'Après les tours de dessin, votez pour démasquer l’imposteur.',
            'Démasqué, il peut encore gagner en devinant le mot. Pas démasqué : 300 points pour lui.',
          ]}
        />
      )}

      {phase === 'draw' && (
        <>
          {roleCard}
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            {order.map((pid, i) => (
              <span key={pid} className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-2.5 font-display text-sm', drawer === pid ? 'bg-accent-primary text-brand-bg' : 'bg-brand-inner text-tx-secondary')}>
                <span className="h-3 w-3 rounded-full border-2 border-brand-border" style={{ background: COLORS[i % COLORS.length] }} />
                <OgName name={party.nameOf(pid)} />
              </span>
            ))}
          </div>
          <p className="font-display text-xl text-center">
            {myTurn ? (drewThisTurn || pending ? 'Trait envoyé !' : 'À toi : un seul trait !') : <>Au tour de <OgName name={party.nameOf(drawer)} /></>}
            <span className="ml-2 text-tx-secondary text-base">Trait {Math.min(turn + 1, totalTurns)}/{totalTurns}</span>
          </p>
          {board}
        </>
      )}

      {phase === 'vote' && (
        <>
          {roleCard}
          {board}
          <p className="font-bold text-tx-secondary">Qui est l’imposteur ?</p>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {order.filter((pid) => pid !== playerId && party.seated.some((p) => p.id === pid)).map((pid) => (
              <ChoiceButton key={pid} selected={myVote === pid} onClick={() => { markPick(pid); party.act('vote', { pid }); vibrate(HAPTIC.SOFT); }} className="flex items-center justify-center gap-2 font-display text-lg">
                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-border" style={{ background: colorOf(pid) }} />
                <span className="truncate"><OgName name={party.nameOf(pid)} /></span>
              </ChoiceButton>
            ))}
          </div>
          <PlayerChips party={party} done={Object.keys(votes)} label="Ont voté" />
        </>
      )}

      {phase === 'guess' && card && (
        <>
          <div className="w-full rounded-[22px] border-4 border-brand-border bg-accent-success p-4 text-center text-brand-bg shadow-[0_6px_0_#05061A]">
            <p className="text-xs font-black uppercase tracking-widest opacity-80">Démasqué</p>
            <p className="font-display text-3xl"><OgName name={party.nameOf(imposter)} /> était l’imposteur</p>
          </div>
          {board}
          {isImposter ? (
            imposterGuess ? <Waiting text="Réponse envoyée…" /> : (
              <>
                <p className="font-display text-xl">Dernière chance : quel était le mot ?</p>
                <AnswerInput value={guessDraft} onChange={setGuessDraft} maxLength={40} placeholder="Le mot…" onSubmit={() => party.act('guess', { text: guessDraft.trim() })} />
              </>
            )
          ) : (
            <Waiting text="L’imposteur tente de deviner le mot…" />
          )}
        </>
      )}

      {phase === 'results' && card && (
        <>
          <div className={cn('w-full rounded-[22px] border-4 border-brand-border p-4 text-center shadow-[0_6px_0_#05061A]', round.caught && !round.right ? 'bg-accent-success text-brand-bg' : 'bg-accent-secondary text-white')}>
            <p className="text-xs font-black uppercase tracking-widest opacity-80">
              {!round.caught ? 'L’imposteur s’en sort' : round.right ? 'Démasqué, mais il a trouvé le mot !' : 'Imposteur démasqué !'}
            </p>
            <p className="font-display text-3xl"><OgName name={party.nameOf(imposter)} /> était l’imposteur</p>
            <p className="mt-1 font-bold">Le mot : « {card.text} »{round.caught && <> · sa réponse : « {round.guess || '—'} »</>}</p>
          </div>
          {board}
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Dessin suivant'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleurs artistes… et imposteurs." />}
    </PartyShell>
  );
}

/** The shared drawing: finished strokes, the one being drawn elsewhere, and this player's stroke while drawing. */
function Board({
  strokes, live, canDraw, color, onStroke, onLive,
}: {
  strokes: Stroke[]; live: { pts: Pt[]; color: string } | null; canDraw: boolean; color: string; onStroke: (pts: Pt[]) => void; onLive: (pts: Pt[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef<Pt[] | null>(null);
  const lastLive = useRef(0);

  const paint = useCallback(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    const draw = (pts: Pt[], col: string) => {
      if (!pts?.length) return;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0] * W, pts[0][1] * H, 6, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
      ctx.stroke();
    };
    for (const s of strokes) draw(s.pts, s.color);
    if (live) draw(live.pts, live.color);
    if (current.current) draw(current.current, color);
  }, [strokes, live, color]);

  useEffect(() => { paint(); }, [paint]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)];
  };

  const finish = () => {
    const pts = current.current;
    current.current = null;
    if (pts) onStroke(pts);
  };

  return (
    <div className="w-full max-w-[min(100%,calc((100dvh-320px)*4/3))] min-w-[260px]">
      <canvas
        ref={ref}
        width={W}
        height={H}
        className={cn('block h-auto w-full rounded-2xl border-4 border-brand-border bg-white shadow-[0_6px_0_#05061A] touch-none', canDraw ? 'cursor-crosshair ring-4 ring-accent-primary' : 'cursor-default')}
        onPointerDown={(e) => {
          if (!canDraw || current.current || e.button > 0) return;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          current.current = [pointAt(e)];
          paint();
        }}
        onPointerMove={(e) => {
          const pts = current.current;
          if (!pts) return;
          const p = pointAt(e);
          const last = pts[pts.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.004 || pts.length >= 600) return;
          pts.push(p);
          paint();
          if (Date.now() - lastLive.current > 80) { lastLive.current = Date.now(); onLive(pts); }
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
    </div>
  );
}
