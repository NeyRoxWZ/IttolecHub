'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brush } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, pickOne, shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { useFitBox } from './party/useFitBox';
import { AnswerInput, Column, Columns, PartyShell, Podium, PromptCard, ResultsScreen, RevealBanner, Screen, SecretCard, SetupScreen, TurnStrip, VoteScreen, Waiting, type RoundRow } from './party/ui';

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

  const [pending, setPending] = useState<Stroke | null>(null);
  const drawMoves = party.movesIn('draw', 'stroke');
  const strokes = useMemo(() => {
    const byTurn = new Map<number, Stroke>();
    for (const m of drawMoves) {
      const t = Number(m.payload?.t);
      if (!Number.isInteger(t) || byTurn.has(t) || order[t % Math.max(1, order.length)] !== m.player_id) continue;
      byTurn.set(t, { t, pid: m.player_id, pts: Array.isArray(m.payload?.pts) ? m.payload.pts : [], color: colorOf(m.player_id) });
    }
    if (pending && pending.pts.length && !byTurn.has(pending.t)) byTurn.set(pending.t, pending);
    return Array.from(byTurn.values()).sort((a, b) => a.t - b.t);
  }, [drawMoves, order, pending, colorOf]);
  useEffect(() => setPending(null), [gid, roundNo]);

  const live = phase === 'draw' && party.lastEvent?.type === 'trait_live' && party.lastEvent.payload?.g === gid && party.lastEvent.payload?.r === roundNo && party.lastEvent.payload?.t === turn
    ? { pts: party.lastEvent.payload.pts as Pt[], color: colorOf(party.lastEvent.payload.pid) } : null;

  const myTurn = phase === 'draw' && !!playerId && drawer === playerId;
  const drewThisTurn = strokes.some((s) => s.t === turn);

  const firstOf = (deck: Card[], n: number) => {
    const ids = shuffle(party.active.map((p) => p.id));
    return { phase: 'draw', card: deck[n - 1] ?? deck[0], imposter: pickOne(ids), order: ids, laps: numSetting(settings, 'laps', 2, 1, 5), turn: 0, ends_at: party.deadline(turnTime + 3) };
  };

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 4, 1, 30);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=untraitdetrop&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: Card[] = data?.items || [];
    if (!deck.length) { toast.error('Impossible de charger les mots.'); return; }
    await party.startGame(deck, firstOf(deck, 1), deck.length);
  };

  const drawerGone = !!drawer && !party.seated.some((p) => p.id === drawer);
  useHostStep(party, `${gid}:${roundNo}:turn${turn}`, phase === 'draw' && (party.expired || drewThisTurn || drawerGone), async () => {
    const nextTurn = turn + 1;
    if (nextTurn >= totalTurns) await party.patchRound({ phase: 'vote', ends_at: party.deadline(voteTime) });
    else await party.patchRound({ turn: nextTurn, ends_at: party.deadline(turnTime) });
  });

  const votesRaw = party.latestBy('vote', 'vote');
  const votes: Record<string, string> = Object.fromEntries(Object.entries(votesRaw).filter(([voter, v]) => v?.pid && order.includes(voter)).map(([voter, v]) => [voter, v.pid]));
  const [myPick, markPick] = useSent<string>(party, 'vote');
  const voters = active.filter((p) => order.includes(p.id));
  const allVoted = voters.length > 0 && voters.every((p) => votes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const counts: Record<string, number> = {};
    for (const [voter, target] of Object.entries(votes)) if (target !== voter) counts[target] = (counts[target] || 0) + 1;
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

  const imposterGuess: string | undefined = imposter ? party.latestBy('guess', 'guess')[imposter]?.text : undefined;
  const imposterGone = phase === 'guess' && !!imposter && !party.seated.some((p) => p.id === imposter);
  useHostStep(party, `${gid}:${roundNo}:guess-end`, phase === 'guess' && (party.expired || !!imposterGuess || imposterGone), async () => {
    const right = !!imposterGuess && isCloseEnough(imposterGuess, round.card?.text || '');
    const gains: Scores = {};
    if (right && imposter) gains[imposter] = 200;
    if (!right) {
      for (const pid of order) if (pid !== imposter) gains[pid] = 100;
      for (const [voter, target] of Object.entries((round.voters || {}) as Record<string, string>)) if (voter !== imposter && target === imposter) gains[voter] = (gains[voter] || 0) + 50;
    }
    await party.patchRound({ phase: 'results', caught: true, guess: imposterGuess || '', right, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  const card: Card | undefined = round.card;
  const isImposter = !!playerId && playerId === imposter;
  const [guessDraft, setGuessDraft] = useState('');
  const playing = order.includes(playerId || '');

  const roleCard = card && (playing ? (
    <SecretCard label={`Ton mot · ${card.catLabel}`} role={{ text: isImposter ? 'Imposteur' : 'Artiste', tone: isImposter ? 'bad' : 'good' }} secret={isImposter ? `Pas de mot : thème ${card.catLabel}` : card.text} />
  ) : <PromptCard eyebrow="Tu regardes">Thème : {card.catLabel}</PromptCard>);

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
  const boardBox = <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 items-center justify-center p-1.5')}>{board}</div>;

  return (
    <PartyShell party={party} title="Un Trait de Trop" maxTime={phase === 'draw' ? turnTime : phase === 'vote' ? voteTime : phase === 'guess' ? GUESS_TIME : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Un Trait de Trop" tagline="Un trait chacun. Un imposteur n’a pas le mot." icon={Brush} swatch={SWATCH} minPlayers={3} onStart={start}
          rules={['Tout le monde reçoit le même mot, sauf l’imposteur qui ne connaît que le thème.', 'À ton tour, tu dessines un seul trait : tu appuies, tu traces, tu relâches.', 'Après les tours de dessin, votez pour démasquer l’imposteur. Le dessin reste affiché.', 'Démasqué, il peut encore gagner en devinant le mot. Pas démasqué : 300 points pour lui.']}
        />
      )}

      {phase === 'draw' && (
        <Screen>
          <Columns className="grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:grid-rows-1">
            <Column className="lg:justify-center">
              {roleCard}
              <TurnStrip party={party} order={order} current={drawer} colorOf={colorOf} />
              <p className="shrink-0 text-center font-display text-lg">
                {myTurn ? (drewThisTurn || pending ? 'Trait envoyé !' : 'À toi : un seul trait !') : <>Au tour de <OgName name={party.nameOf(drawer)} /></>}
                <span className="ml-2 text-sm text-tx-secondary">trait {Math.min(turn + 1, totalTurns)}/{totalTurns}</span>
              </p>
            </Column>
            <Column>{boardBox}</Column>
          </Columns>
        </Screen>
      )}

      {phase === 'vote' && (
        <VoteScreen
          party={party}
          title="Qui est l’imposteur ?"
          recap={boardBox}
          candidates={order.filter((pid) => party.seated.some((p) => p.id === pid)).map((pid) => ({
            id: pid,
            title: <span className="inline-flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-border" style={{ background: colorOf(pid) }} /><OgName name={party.nameOf(pid)} /></span>,
            mine: pid === playerId,
          }))}
          hideMine
          myVote={myPick ?? (playerId ? votes[playerId] : undefined)}
          onVote={playing ? (pid) => { markPick(pid); party.act('vote', { pid }); vibrate(HAPTIC.SOFT); } : undefined}
          votes={votes}
          voters={voters.map((p) => p.id)}
        />
      )}

      {phase === 'guess' && card && (
        <Screen>
          <RevealBanner tone="good" eyebrow="Démasqué"><OgName name={party.nameOf(imposter)} /> était l’imposteur</RevealBanner>
          {boardBox}
          {isImposter ? (imposterGuess ? <Waiting text="Réponse envoyée…" /> : (
            <>
              <p className="shrink-0 text-center font-display text-lg">Dernière chance : quel était le mot ?</p>
              <AnswerInput value={guessDraft} onChange={setGuessDraft} maxLength={40} placeholder="Le mot…" onSubmit={() => party.act('guess', { text: guessDraft.trim() })} />
            </>
          )) : <Waiting text="L’imposteur tente de deviner le mot…" />}
        </Screen>
      )}

      {phase === 'results' && card && (
        <ResultsScreen
          party={party}
          reveal={
            <RevealBanner tone={round.caught && !round.right ? 'good' : 'bad'} eyebrow={!round.caught ? 'L’imposteur s’en sort' : round.right ? 'Démasqué, mais il a trouvé le mot !' : 'Imposteur démasqué !'} detail={<>Le mot : « {card.text} »{round.caught && <> · sa réponse : « {round.guess || '—'} »</>}</>}>
              <OgName name={party.nameOf(imposter)} /> était l’imposteur
            </RevealBanner>
          }
          media={boardBox}
          rows={Object.fromEntries(order.map((pid) => {
            const voted = (round.voters || {})[pid];
            return [pid, { answer: pid === imposter ? 'l’imposteur' : voted ? `a voté ${party.nameOf(voted)}` : 'pas voté', ok: pid === imposter ? !round.caught || !!round.right : voted === imposter } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Dessin suivant'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleurs artistes… et imposteurs." />}
    </PartyShell>
  );
}

/** The shared drawing, as large as its box allows at 4:3. */
function Board({ strokes, live, canDraw, color, onStroke, onLive }: {
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
      if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0][0] * W, pts[0][1] * H, 6, 0, Math.PI * 2); ctx.fill(); return; }
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
  const finish = () => { const pts = current.current; current.current = null; if (pts) onStroke(pts); };

  const fit = useFitBox(4 / 3);
  useEffect(() => { paint(); }, [fit.size.w, paint]);

  return (
    <div ref={fit.ref} className="relative h-full min-h-0 w-full min-w-0 flex-1 self-stretch">
    <div className="absolute inset-0 flex items-center justify-center">
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={cn('block rounded-xl bg-white touch-none', canDraw ? 'cursor-crosshair ring-4 ring-accent-success' : 'cursor-default', !fit.size.w && 'invisible')}
      style={{ width: fit.size.w || 1, height: fit.size.h || 1 }}
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
    </div>
  );
}
