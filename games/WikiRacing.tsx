'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flag, Link as LinkIcon, List, Loader2, Search, Trophy, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { PartyShell, Podium, ResultsScreen, RevealBanner, Screen, Scroll, SetupScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#FF8A1F', shade: '#CC6508' };
const MAX_RACE = 300;
const AFTER_HALF = 20;
const RESULTS_TIME = 12;

type Pair = { start: string; target: string };
type Section = { level: number; line: string; anchor: string };
const pretty = (t: string) => String(t || '').replace(/_/g, ' ');
const same = (a: string, b: string) => pretty(a).trim().toLowerCase() === pretty(b).trim().toLowerCase();
const clockOf = (ms: number) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };
const stripTags = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

export default function WikiRacing({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'wikiracing');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const byClicks = settings.winCondition === 'optimization';

  const pair: Pair | undefined = round.pair;
  const startedAt: number = round.started_at || 0;

  /* ---------------- this player's race ---------------- */
  const [page, setPage] = useState<{ title: string; html: string; sections: Section[]; n: number } | null>(null);
  const [clicks, setClicks] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [panel, setPanel] = useState<'none' | 'toc' | 'board'>('none');
  const [finishedLocal, markFinished] = useSent(party, 'race');
  const content = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);

  const finishes: Record<string, { clicks: number; ms: number }> = {};
  for (const m of party.movesIn('race', 'finish')) if (!finishes[m.player_id]) finishes[m.player_id] = { clicks: Number(m.payload?.clicks) || 0, ms: Number(m.payload?.ms) || 0 };
  const positions = party.latestBy('page', 'race');
  const finished = !!finishedLocal || (!!playerId && !!finishes[playerId]);

  const actRef = useRef(party.act);
  actRef.current = party.act;

  /** Loads a page. A new click cancels the page still loading: every click counts, none is lost. */
  const load = useCallback(async (title: string, nextClicks: number, initial = false) => {
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setLoading(true);
    try {
      const url = `https://fr.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title.split('#')[0])}&prop=text|sections&format=json&origin=*&disableeditsection=true&redirects=true`;
      const data = await fetch(url, { signal: ctrl.signal }).then((r) => r.json());
      if (ctrl.signal.aborted) return;
      if (data.error) { toast.error('Page Wikipédia introuvable.'); return; }
      const clean = String(data.parse.text['*'])
        .replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<(script|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
      const sections: Section[] = (data.parse.sections || []).map((s: any) => ({ level: Number(s.toclevel) || 1, line: stripTags(String(s.line)), anchor: String(s.anchor) }));
      setPage({ title: data.parse.title, html: clean, sections, n: Date.now() });
      setClicks(nextClicks);
      setPanel('none');
      actRef.current('page', { title: data.parse.title, clicks: nextClicks });
      if (!initial && pair && same(data.parse.title, pair.target)) {
        markFinished(true);
        actRef.current('finish', { clicks: nextClicks, ms: Math.max(0, party.serverTime() - startedAt) });
        vibrate(HAPTIC.SUCCESS);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error('Impossible de charger la page.');
    } finally {
      if (request.current === ctrl) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.target, startedAt]);

  // Each new page opens at its top.
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [page?.n]);

  useEffect(() => {
    if (phase === 'race' && pair && !finished) { setPage(null); setHistory([]); void load(pair.start, 0, true); }
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, roundNo, phase === 'race']);

  const goToSection = (anchor: string) => {
    const box = content.current;
    const el = box?.querySelector(`[id="${CSS.escape(anchor)}"]`) as HTMLElement | null;
    if (box && el) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8, behavior: 'smooth' });
    setPanel('none');
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    if (finished || phase !== 'race' || !page) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) { goToSection(decodeURIComponent(href.slice(1))); return; }
    if (/redlink=1/.test(href)) { toast.error('Cette page n’existe pas encore sur Wikipédia.'); return; }
    if (!href.startsWith('/wiki/')) { toast.error('Ce lien sort de Wikipédia.'); return; }
    const [path, hash] = href.replace('/wiki/', '').split('#');
    const nextTitle = decodeURIComponent(path);
    if (nextTitle.includes(':')) { toast.error('Les pages spéciales ne comptent pas.'); return; }
    // A link to a section of the page you are on just scrolls there.
    if (same(nextTitle, page.title)) { if (hash) goToSection(decodeURIComponent(hash)); return; }
    vibrate(HAPTIC.SOFT);
    setHistory((h) => (h[h.length - 1] === page.title ? h : [...h, page.title]));
    void load(nextTitle, clicks + 1);
  };

  const back = () => {
    const prev = history[history.length - 1];
    if (!prev || loading) return;
    setHistory((h) => h.slice(0, -1));
    void load(prev, clicks + 1);
  };

  // The page search would make it too easy: blocked, with a short penalty.
  useEffect(() => {
    if (phase !== 'race' || finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') || e.key === 'F3') {
        e.preventDefault();
        setBlocked(true);
        setTimeout(() => setBlocked(false), 5000);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, finished]);

  /* ---------------- host ---------------- */
  const roundOf = (deck: Pair[], n: number) => {
    const now = party.serverTime();
    return { phase: 'race', pair: deck[n - 1], started_at: now, ends_at: now + MAX_RACE * 1000, countdown: false };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', 3, 1, 10);
    const deck: Pair[] = await fetch(`/api/games/wikiracing?difficulty=${settings.difficulty || 'easy'}&count=${rounds}`).then((r) => r.json()).catch(() => []);
    if (!Array.isArray(deck) || !deck.length) { toast.error('Impossible de charger les courses.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const doneCount = Object.keys(finishes).length;
  useHostStep(party, `${gid}:${roundNo}:countdown`, phase === 'race' && !round.countdown && doneCount >= Math.ceil(active.length / 2) && doneCount < active.length, async () => {
    await party.patchRound({ countdown: true, ends_at: Math.min(round.ends_at, party.deadline(AFTER_HALF)) });
  });

  const everyone = active.length > 0 && active.every((p) => finishes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:race-end`, phase === 'race' && (party.expired || everyone), async () => {
    const ranked = Object.entries(finishes).sort((a, b) => (byClicks ? a[1].clicks - b[1].clicks || a[1].ms - b[1].ms : a[1].ms - b[1].ms));
    const gains: Scores = {};
    ranked.forEach(([pid], i) => { gains[pid] = [300, 200, 100][i] ?? 50; });
    await party.patchRound({ phase: 'results', ranking: ranked.map(([pid, f]) => ({ pid, ...f })), gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: Pair[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  /* ---------------- render ---------------- */
  const board = (
    <ul className="space-y-1.5">
      {party.seated.map((p) => {
        const f = finishes[p.id];
        const at = positions[p.id];
        return (
          <li key={p.id} className={cn('rounded-lg border-2 border-brand-border px-2 py-1', f ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner')}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-display text-sm"><OgName name={p.name} /></span>
              <span className="shrink-0 font-display text-xs tabular-nums">{f ? f.clicks : at?.clicks ?? 0} clics</span>
            </div>
            <p className="truncate text-xs font-bold opacity-80">{f ? `Arrivé en ${clockOf(f.ms)}` : pretty(at?.title || pair?.start || '…')}</p>
          </li>
        );
      })}
    </ul>
  );
  const toc = page && (
    <ul className="space-y-0.5">
      <li><button onClick={() => content.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="w-full truncate rounded px-1 text-left text-sm font-bold hover:bg-brand-inner">↑ Début</button></li>
      {page.sections.map((s) => (
        <li key={s.anchor}>
          <button onClick={() => goToSection(s.anchor)} className="w-full truncate rounded px-1 text-left text-sm font-bold text-tx-secondary hover:bg-brand-inner hover:text-white" style={{ paddingLeft: `${(s.level - 1) * 10 + 4}px` }}>{s.line}</button>
        </li>
      ))}
      {!page.sections.length && <li className="text-sm font-bold text-tx-muted">Pas de sections.</li>}
    </ul>
  );

  return (
    <PartyShell party={party} title="WikiRacing" maxTime={phase === 'race' ? (round.countdown ? AFTER_HALF : MAX_RACE) : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="WikiRacing" tagline="Relie deux pages Wikipédia." icon={Search} swatch={SWATCH} minPlayers={1} onStart={start}
          rules={['Tout le monde part de la même page Wikipédia.', 'Clique de lien en lien pour atteindre la page d’arrivée. Le sommaire aide à trouver la bonne section ; la recherche est interdite.', byClicks ? 'Le moins de clics gagne (le temps départage). Revenir en arrière compte un clic.' : 'Le plus rapide gagne. Revenir en arrière compte un clic.', 'Quand la moitié des joueurs est arrivée, il reste 20 secondes aux autres. 300, 200 et 100 points aux trois premiers.']}
        />
      )}

      {phase === 'race' && pair && (
        <Screen>
          <div className={cn(BRAWL.panel, 'flex shrink-0 items-center gap-1.5 p-1.5')}>
            <button onClick={back} disabled={!history.length || loading || finished} aria-label="Page précédente" className={cn(BRAWL.dark, 'h-9 w-9 shrink-0 rounded-lg')}><ArrowLeft className="h-4 w-4" /></button>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <Flag className="h-4 w-4 shrink-0 text-accent-success" />
              <span className="min-w-0">
                <span className="block text-[10px] font-black uppercase leading-none tracking-widest text-tx-secondary">Arrivée</span>
                <span className="block truncate font-display text-accent-primary">{pretty(pair.target)}</span>
              </span>
            </span>
            <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border-[3px] border-brand-border bg-brand-inner px-2 font-display tabular-nums"><LinkIcon className="h-4 w-4" />{clicks}</span>
            <button onClick={() => setPanel((p) => (p === 'toc' ? 'none' : 'toc'))} aria-label="Sommaire" className={cn(panel === 'toc' ? BRAWL.green : BRAWL.dark, 'h-9 w-9 shrink-0 rounded-lg lg:hidden')}><List className="h-4 w-4" /></button>
            <button onClick={() => setPanel((p) => (p === 'board' ? 'none' : 'board'))} aria-label="Classement en direct" className={cn(panel === 'board' ? BRAWL.green : BRAWL.dark, 'h-9 shrink-0 rounded-lg px-2 text-sm lg:hidden')}><Users className="h-4 w-4" />{doneCount}/{active.length}</button>
          </div>

          {finished ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <RevealBanner tone="good" eyebrow="Arrivé !">{pretty(pair.target)}</RevealBanner>
              <Waiting text="On attend les autres coureurs…" />
              <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 flex-col p-2')}><Scroll>{board}</Scroll></div>
            </div>
          ) : (
            <div className="relative grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="relative flex min-h-0 flex-col overflow-hidden rounded-[18px] border-[3px] border-brand-border bg-[#1E2358] shadow-[0_4px_0_#05061A]">
                <p className="shrink-0 truncate border-b-[3px] border-brand-border bg-brand-card px-3 py-1 font-display">{pretty(page?.title || pair.start)}</p>
                <div ref={content} className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
                  <div className="wiki-content mx-auto max-w-3xl p-3 text-white md:p-5" onClick={onClick} dangerouslySetInnerHTML={{ __html: page?.html || '' }} />
                </div>
                {(loading || blocked) && (
                  <div className="absolute inset-0 top-8 z-20 flex flex-col items-center justify-center gap-2 bg-brand-bg/70 p-6 text-center backdrop-blur-sm">
                    {blocked ? <><p className="font-display text-2xl">La recherche est désactivée.</p><p className="font-bold text-tx-secondary">5 secondes de pénalité…</p></> : <Loader2 className="h-10 w-10 animate-spin text-accent-success" />}
                  </div>
                )}
              </div>

              <aside className={cn('min-h-0 flex-col gap-2', panel === 'none' ? 'hidden lg:flex' : 'absolute inset-x-0 top-0 z-30 flex max-h-full lg:static')}>
                <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 flex-col p-2', panel === 'board' && 'hidden lg:flex')}>
                  <div className="mb-1 flex shrink-0 items-center justify-between"><p className="text-[11px] font-black uppercase tracking-widest text-tx-secondary">Sommaire</p>{panel !== 'none' && <button onClick={() => setPanel('none')} aria-label="Fermer" className="lg:hidden"><X className="h-4 w-4" /></button>}</div>
                  <Scroll>{toc}</Scroll>
                </div>
                <div className={cn(BRAWL.panel, 'flex min-h-0 flex-col p-2 lg:max-h-[45%]', panel === 'toc' && 'hidden lg:flex')}>
                  <div className="mb-1 flex shrink-0 items-center justify-between"><p className="text-[11px] font-black uppercase tracking-widest text-tx-secondary">En direct · {doneCount}/{active.length} arrivés</p>{panel !== 'none' && <button onClick={() => setPanel('none')} aria-label="Fermer" className="lg:hidden"><X className="h-4 w-4" /></button>}</div>
                  <Scroll>{board}</Scroll>
                </div>
              </aside>
            </div>
          )}
        </Screen>
      )}

      {phase === 'results' && pair && (
        <ResultsScreen
          party={party}
          reveal={
            <RevealBanner tone={(round.ranking || []).length ? 'good' : 'bad'} eyebrow={`${pretty(pair.start)} → ${pretty(pair.target)}`}>
              {(round.ranking || []).length ? <><Trophy className="mr-2 inline h-7 w-7" /><OgName name={party.nameOf(round.ranking[0].pid)} /></> : 'Personne n’est arrivé'}
            </RevealBanner>
          }
          rows={Object.fromEntries(party.seated.map((p) => {
            const f = (round.ranking || []).find((r: any) => r.pid === p.id);
            return [p.id, { ok: !!f, answer: f ? `${clockOf(f.ms)} · ${f.clicks} clics` : 'pas arrivé' } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Course suivante'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les as de l’encyclopédie." />}
    </PartyShell>
  );
}
