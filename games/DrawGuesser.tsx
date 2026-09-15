'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, PaintBucket, PenTool, Pencil, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, levenshtein, normalize } from '@/lib/party/text';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type PartyMove, type Scores } from './party/usePartyGame';
import { useFitBox } from './party/useFitBox';
import { speedPoints } from './party/ImageGuessGame';
import { AnswerInput, ChoiceButton, Column, Columns, PartyShell, PlayerChips, Podium, PromptCard, RecapPanel, ResultsScreen, RevealBanner, Screen, SetupScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#8B3DFF', shade: '#6526C9' };
const CHOOSE_TIME = 15;
const RESULTS_TIME = 10;
const W = 1200;
const H = 900;
const WHITE = '#FFFFFF';
const NO_BAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
const COLORS = ['#05061A', '#FFFFFF', '#8D6E63', '#9CA3AF', '#E63946', '#FF8A1F', '#FFC61A', '#33D17A', '#1F8A4C', '#5B8CFF', '#1E3A8A', '#8B3DFF', '#FF4F8B', '#F5C9A0'];
const SIZES = [6, 14, 26, 44];

type Pt = [number, number];
type Op =
  | { k: 'stroke'; id: string; pts: Pt[]; color: string; size: number }
  | { k: 'fill'; id: string; x: number; y: number; color: string }
  | { k: 'undo'; id: string }
  | { k: 'clear'; id: string };
type Word = { word: string };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawStroke(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, size: number) {
  if (!pts.length) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) { ctx.beginPath(); ctx.arc(pts[0][0] * W, pts[0][1] * H, size / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * W, pts[i][1] * H);
  ctx.stroke();
}

/** Paint bucket: scanline flood fill on the fixed-size board, so every screen fills the same area. */
function floodFill(ctx: CanvasRenderingContext2D, fx: number, fy: number, hex: string) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const sx = Math.min(W - 1, Math.max(0, Math.floor(fx * W)));
  const sy = Math.min(H - 1, Math.max(0, Math.floor(fy * H)));
  const o = (sy * W + sx) * 4;
  const [tr, tg, tb] = [d[o], d[o + 1], d[o + 2]];
  const [r, g, b] = hexToRgb(hex);
  if (Math.abs(tr - r) + Math.abs(tg - g) + Math.abs(tb - b) < 12) return;
  const match = (i: number) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= 96;
  const seen = new Uint8Array(W * H);
  const stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    let i = y * W + x;
    while (x >= 0 && !seen[i] && match(i * 4)) { x--; i--; }
    x++; i++;
    let up = false;
    let down = false;
    while (x < W && !seen[i] && match(i * 4)) {
      seen[i] = 1;
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      if (y > 0) { const j = i - W; if (!seen[j] && match(j * 4)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
      if (y < H - 1) { const j = i + W; if (!seen[j] && match(j * 4)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false; }
      x++; i++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function flatten(ops: Op[]): Op[] {
  let list: Op[] = [];
  for (const op of ops) {
    if (op.k === 'clear') list = [];
    else if (op.k === 'undo') list = list.slice(0, -1);
    else list.push(op);
  }
  return list;
}

/** The drawing, as large as its box allows at 4:3. */
function Board({ ops, live, canDraw, tool, color, size, onStroke, onFill, onLive }: {
  ops: Op[]; live: { pts: Pt[]; color: string; size: number } | null; canDraw: boolean; tool: 'pen' | 'fill';
  color: string; size: number; onStroke: (pts: Pt[]) => void; onFill: (x: number, y: number) => void; onLive: (pts: Pt[]) => void;
}) {
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const applied = useRef<string[]>([]);
  const painted = useRef(false);
  const current = useRef<Pt[] | null>(null);
  const lastLive = useRef(0);
  const flat = useMemo(() => flatten(ops), [ops]);
  const fit = useFitBox(4 / 3);

  useEffect(() => {
    const ctx = base.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const ids = flat.map((o) => o.id);
    const prev = applied.current;
    // A blank canvas is transparent, which the paint bucket would read as black ink: start from white.
    const extends_ = painted.current && prev.length <= ids.length && prev.every((id, i) => ids[i] === id);
    painted.current = true;
    let from = prev.length;
    if (!extends_) { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H); from = 0; }
    for (const op of flat.slice(from)) {
      if (op.k === 'stroke') drawStroke(ctx, op.pts, op.color, op.size);
      else if (op.k === 'fill') floodFill(ctx, op.x, op.y, op.color);
    }
    applied.current = ids;
  }, [flat]);

  const paintOverlay = useCallback(() => {
    const ctx = overlay.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (live) drawStroke(ctx, live.pts, live.color, live.size);
    if (current.current) drawStroke(ctx, current.current, color, size);
  }, [live, color, size]);
  useEffect(() => { paintOverlay(); }, [paintOverlay]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
    return [c((e.clientX - r.left) / r.width), c((e.clientY - r.top) / r.height)];
  };
  const end = () => { const pts = current.current; current.current = null; if (pts) onStroke(pts); paintOverlay(); };

  return (
    <div ref={fit.ref} className="relative h-full min-h-0 w-full min-w-0 flex-1 self-stretch">
      <div className="absolute inset-0 flex items-center justify-center">
      <div className={cn('relative overflow-hidden rounded-xl bg-white', !fit.size.w && 'invisible')} style={{ width: fit.size.w || 1, height: fit.size.h || 1 }}>
        <canvas ref={base} width={W} height={H} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={overlay}
          width={W}
          height={H}
          className={cn('absolute inset-0 h-full w-full touch-none', canDraw ? (tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default')}
          onPointerDown={(e) => {
            if (!canDraw || e.button > 0) return;
            if (tool === 'fill') { const [x, y] = at(e); onFill(x, y); return; }
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
            current.current = [at(e)];
            paintOverlay();
          }}
          onPointerMove={(e) => {
            const pts = current.current;
            if (!pts) return;
            const p = at(e);
            const last = pts[pts.length - 1];
            if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.003 || pts.length >= 1500) return;
            pts.push(p);
            paintOverlay();
            if (Date.now() - lastLive.current > 80) { lastLive.current = Date.now(); onLive(pts.slice(-400)); }
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
      </div>
      </div>
    </div>
  );
}

export default function DrawGuesser({ roomCode }: { roomCode: string }) {
  const party = usePartyGame(roomCode, 'drawguessr');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const drawTime = numSetting(settings, 'time', 90, 20, 300);

  const drawer: string | undefined = round.drawer;
  const isDrawer = !!playerId && playerId === drawer;
  const word: string | undefined = round.word;
  const startedAt: number = round.started_at || 0;

  const [tool, setTool] = useState<'pen' | 'fill'>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Op[]>([]);
  useEffect(() => { setDraft(''); setPending([]); setTool('pen'); setEraser(false); }, [gid, roundNo]);
  const [foundLocal, markFound] = useSent(party, 'draw');

  const drawMoves: PartyMove[] = party.movesIn('draw');
  const ops = useMemo(() => {
    const list: Op[] = [];
    const ids = new Set<string>();
    for (const m of drawMoves) {
      if (m.player_id !== drawer || !['stroke', 'fill', 'undo', 'clear'].includes(m.action_type)) continue;
      const id = String(m.payload?.id || m.id);
      ids.add(id);
      list.push({ ...(m.payload || {}), k: m.action_type, id } as Op);
    }
    for (const op of pending) if (!ids.has(op.id)) list.push(op);
    return list;
  }, [drawMoves, drawer, pending]);

  const live = !isDrawer && phase === 'draw' && party.lastEvent?.type === 'draw_live' && party.lastEvent.payload?.g === gid && party.lastEvent.payload?.r === roundNo
    ? { pts: party.lastEvent.payload.pts as Pt[], color: String(party.lastEvent.payload.color), size: Number(party.lastEvent.payload.size) } : null;

  const foundAt: Record<string, string> = {};
  for (const m of drawMoves) if (m.action_type === 'found' && m.player_id !== drawer && !foundAt[m.player_id]) foundAt[m.player_id] = m.created_at;
  const iFound = !!foundLocal || (!!playerId && !!foundAt[playerId]);
  const feed = drawMoves.filter((m) => m.action_type === 'guess' || m.action_type === 'found').slice(-40);

  const opId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const push = (k: Op['k'], data: Record<string, unknown>) => {
    const op = { k, id: opId(), ...data } as Op;
    setPending((p) => [...p, op]);
    party.act(k, { ...data, id: op.id });
  };

  const roundOf = (deck: Word[][], n: number) => {
    const order = party.active.map((p) => p.id);
    return { phase: 'choose', drawer: order[(n - 1) % Math.max(1, order.length)], options: (deck[n - 1] || []).map((w) => w.word), ends_at: party.deadline(CHOOSE_TIME) };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', 5, 1, 30);
    const words: Word[] = await fetch(`/api/games/draw?count=${rounds * 3}&difficulty=${settings.difficulty || 'mix'}`).then((r) => r.json()).catch(() => []);
    if (!Array.isArray(words) || words.length < 3) { toast.error('Impossible de charger les mots.'); return; }
    const deck: Word[][] = [];
    for (let i = 0; i + 2 < words.length && deck.length < rounds; i += 3) deck.push(words.slice(i, i + 3));
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const pick = party.movesIn('choose', 'pick').find((m) => m.player_id === drawer);
  const drawerGone = !!drawer && !party.seated.some((p) => p.id === drawer);
  useHostStep(party, `${gid}:${roundNo}:choose-end`, phase === 'choose' && (!!pick || party.expired || drawerGone), async () => {
    const options: string[] = round.options || [];
    const chosen = options[Number(pick?.payload?.i)] ?? options[0];
    const now = party.serverTime();
    await party.patchRound({ phase: 'draw', word: chosen, started_at: now, ends_at: now + drawTime * 1000 });
  });

  const guessers = active.filter((p) => p.id !== drawer);
  const allFound = guessers.length > 0 && guessers.every((p) => foundAt[p.id]);
  useHostStep(party, `${gid}:${roundNo}:draw-end`, phase === 'draw' && (party.expired || allFound || drawerGone), async () => {
    const gains: Scores = {};
    const finds = Object.entries(foundAt).sort((a, b) => a[1].localeCompare(b[1]));
    for (const [pid, at] of finds) gains[pid] = speedPoints(Math.max(0, (Date.parse(at) - startedAt) / 1000), drawTime);
    if (drawer && finds.length) gains[drawer] = 500 + (allFound ? 300 : 0);
    await party.patchRound({ phase: 'results', finds: finds.map(([pid, at]) => ({ pid, sec: Math.round(Math.max(0, (Date.parse(at) - startedAt) / 100)) / 10 })), gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: Word[][] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  const guess = () => {
    if (!word || iFound || isDrawer) return;
    const text = draft.trim();
    setDraft('');
    if (isCloseEnough(text, word)) { markFound(true); party.act('found'); vibrate(HAPTIC.SUCCESS); return; }
    const close = levenshtein(normalize(text), normalize(word)) <= 3;
    party.act('guess', { text: text.slice(0, 40), close });
    vibrate(close ? HAPTIC.WARNING : HAPTIC.ERROR);
  };

  const inkColor = eraser ? WHITE : color;
  const inkSize = eraser ? SIZES[3] : size;
  const board = (
    <Board
      ops={ops}
      live={live}
      canDraw={isDrawer && phase === 'draw'}
      tool={tool}
      color={inkColor}
      size={inkSize}
      onStroke={(pts) => push('stroke', { pts, color: inkColor, size: inkSize })}
      onFill={(x, y) => push('fill', { x, y, color })}
      onLive={(pts) => party.broadcast('draw_live', { g: gid, r: roundNo, pts, color: inkColor, size: inkSize })}
    />
  );
  const boardBox = <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 items-center justify-center p-1.5')}>{board}</div>;
  const toolBtn = (activeTool: boolean) => cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[3px] border-brand-border', activeTool ? 'bg-accent-success text-brand-bg' : 'bg-[#2B3170] text-white');

  const feedList = (
    <ul className="flex flex-col gap-1">
      {[...feed].reverse().map((m) => (
        <li key={m.id} className={cn('rounded-md px-2 py-0.5 text-sm font-bold', m.action_type === 'found' ? 'bg-accent-success text-brand-bg' : m.payload?.close ? 'bg-accent-primary text-brand-bg' : 'bg-brand-inner')}>
          <OgName name={party.nameOf(m.player_id)} /> {m.action_type === 'found' ? 'a trouvé !' : m.payload?.close ? 'est tout proche !' : `: ${m.payload?.text}`}
        </li>
      ))}
      {!feed.length && <li className="text-center text-sm font-bold text-tx-secondary">Les propositions s’affichent ici.</li>}
    </ul>
  );

  return (
    <PartyShell party={party} title="DrawGuessr" maxTime={phase === 'choose' ? CHOOSE_TIME : phase === 'draw' ? drawTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="DrawGuessr" tagline="Dessinez, c’est gagné !" icon={PenTool} swatch={SWATCH} minPlayers={2} onStart={start}
          rules={['À chaque manche, un joueur choisit un mot parmi trois et le dessine.', 'Les autres tapent leurs propositions : le plus rapide marque le plus.', 'Crayon, couleurs, gomme, pot de peinture, annuler : tout pour bien dessiner.', 'Le dessinateur gagne 500 points si quelqu’un trouve, 800 si tout le monde trouve.']}
        />
      )}

      {phase === 'choose' && (isDrawer ? (
        <Screen center>
          <div className="flex w-full max-w-2xl flex-col gap-3">
            <PromptCard eyebrow="À toi de dessiner" tone="green">Choisis ton mot</PromptCard>
            <div className="grid gap-2 sm:grid-cols-3">
              {((round.options as string[]) || []).map((w, i) => <ChoiceButton key={w} onClick={() => party.act('pick', { i })} className="min-h-[64px] text-center font-display text-2xl">{w}</ChoiceButton>)}
            </div>
          </div>
        </Screen>
      ) : <Screen center><Waiting text={<><OgName name={party.nameOf(drawer)} /> choisit un mot…</>} /></Screen>)}

      {phase === 'draw' && (
        <Screen>
          <Columns className="grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-1">
            <Column>
              <PromptCard eyebrow={isDrawer ? 'Ton mot' : <><OgName name={party.nameOf(drawer)} /> dessine</>} tone={isDrawer ? 'yellow' : 'default'}>
                {isDrawer ? word : iFound ? 'Trouvé ! Regarde les autres chercher.' : 'Devine le dessin'}
              </PromptCard>
              {boardBox}
              {isDrawer && (
                <div className={cn(BRAWL.panel, 'flex shrink-0 flex-col gap-1.5 p-1.5')}>
                  <div className={cn('flex gap-1.5 overflow-x-auto', NO_BAR)}>
                    {COLORS.map((c) => (
                      <button key={c} onClick={() => { setColor(c); setEraser(false); }} aria-label={`Couleur ${c}`} className={cn('h-8 w-8 shrink-0 rounded-full border-[3px] shadow-none', !eraser && color === c ? 'border-accent-success ring-2 ring-white' : 'border-brand-border')} style={{ background: c }} />
                    ))}
                  </div>
                  <div className={cn('flex items-center gap-1.5 overflow-x-auto', NO_BAR)}>
                    {SIZES.map((s) => (
                      <button key={s} onClick={() => { setSize(s); setTool('pen'); setEraser(false); }} aria-label={`Épaisseur ${s}`} className={toolBtn(size === s && tool === 'pen' && !eraser)}>
                        <span className="rounded-full bg-current" style={{ width: Math.max(4, s / 2.5), height: Math.max(4, s / 2.5) }} />
                      </button>
                    ))}
                    <span className="mx-1 h-6 w-[3px] shrink-0 rounded bg-brand-border" />
                    <button onClick={() => { setTool('pen'); setEraser(false); }} aria-label="Crayon" className={toolBtn(tool === 'pen' && !eraser)}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { setTool('pen'); setEraser(true); }} aria-label="Gomme" className={toolBtn(eraser)}><Eraser className="h-4 w-4" /></button>
                    <button onClick={() => { setTool('fill'); setEraser(false); }} aria-label="Pot de peinture" className={toolBtn(tool === 'fill')}><PaintBucket className="h-4 w-4" /></button>
                    <button onClick={() => push('undo', {})} aria-label="Annuler" className={toolBtn(false)}><Undo2 className="h-4 w-4" /></button>
                    <button onClick={() => push('clear', {})} aria-label="Tout effacer" className={cn(toolBtn(false), 'bg-accent-secondary')}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </Column>
            <Column className="max-h-[28dvh] lg:max-h-none">
              {!isDrawer && !iFound && <AnswerInput value={draft} onChange={setDraft} onSubmit={guess} maxLength={40} placeholder="Ta proposition…" submitLabel="Proposer" />}
              <RecapPanel title="Propositions">{feedList}</RecapPanel>
              <PlayerChips party={party} only={guessers.map((p) => p.id)} done={Object.keys(foundAt)} label="Trouvé" />
            </Column>
          </Columns>
        </Screen>
      )}

      {phase === 'results' && (
        <ResultsScreen
          party={party}
          reveal={<RevealBanner tone={(round.finds || []).length ? 'good' : 'bad'} eyebrow={<>Dessin de <OgName name={party.nameOf(drawer)} /></>}>Le mot était « {word} »</RevealBanner>}
          media={boardBox}
          rows={Object.fromEntries(party.seated.map((p) => {
            if (p.id === drawer) return [p.id, { answer: 'le dessinateur' } as RoundRow];
            const f = (round.finds || []).find((x: any) => x.pid === p.id);
            return [p.id, { ok: !!f, note: f ? `trouvé en ${f.sec} s` : 'pas trouvé' } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Dessin suivant'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les Picasso de la soirée." />}
    </PartyShell>
  );
}
