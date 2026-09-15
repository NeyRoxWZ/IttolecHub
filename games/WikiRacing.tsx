'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flag, Link as LinkIcon, Loader2, Search, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerList, NextStep, PartyShell, Podium, RevealBanner, ScoreList, SetupScreen, Waiting } from './party/ui';

const SWATCH = { fill: '#FF8A1F', shade: '#CC6508' };
const MAX_RACE = 300;
const AFTER_HALF = 20;
const RESULTS_TIME = 12;

type Pair = { start: string; target: string };
const pretty = (t: string) => String(t || '').replace(/_/g, ' ');
const same = (a: string, b: string) => pretty(a).trim().toLowerCase() === pretty(b).trim().toLowerCase();
const clockOf = (ms: number) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };

export default function WikiRacing({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'wikiracing');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const byClicks = settings.winCondition === 'optimization';

  const pair: Pair | undefined = round.pair;
  const startedAt: number = round.started_at || 0;

  /* ---------------- this player's race ---------------- */
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [clicks, setClicks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [finishedLocal, markFinished] = useSent(party, 'race');
  const content = useRef<HTMLDivElement>(null);

  const finishes: Record<string, { clicks: number; ms: number }> = {};
  for (const m of party.movesIn('race', 'finish')) if (!finishes[m.player_id]) finishes[m.player_id] = { clicks: Number(m.payload?.clicks) || 0, ms: Number(m.payload?.ms) || 0 };
  const positions = party.latestBy('page', 'race');
  const finished = !!finishedLocal || (!!playerId && !!finishes[playerId]);

  const load = useCallback(async (page: string, nextClicks: number, initial = false) => {
    setLoading(true);
    try {
      const res = await fetch(`https://fr.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.split('#')[0])}&format=json&origin=*&disableeditsection=true&redirects=true`);
      const data = await res.json();
      if (data.error) { toast.error('Page Wikipédia introuvable.'); return; }
      const clean = String(data.parse.text['*'])
        .replace(/<(script|iframe|object|embed|style)[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<(script|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
      setHtml(clean);
      setTitle(data.parse.title);
      setClicks(nextClicks);
      content.current?.scrollTo({ top: 0 });
      party.act('page', { title: data.parse.title, clicks: nextClicks });
      if (!initial && pair && same(data.parse.title, pair.target)) {
        markFinished(true);
        party.act('finish', { clicks: nextClicks, ms: Math.max(0, party.serverTime() - startedAt) });
        vibrate(HAPTIC.SUCCESS);
      }
    } catch {
      toast.error('Impossible de charger la page.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair?.target, startedAt, party.act]);

  // A new race starts from its first page.
  useEffect(() => {
    if (phase === 'race' && pair && !finished) { setHtml(''); setTitle(''); void load(pair.start, 0, true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, roundNo, phase === 'race']);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    if (finished || loading || phase !== 'race') return;
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('/wiki/')) return;
    const next = decodeURIComponent(href.replace('/wiki/', ''));
    if (next.includes(':')) { toast.error('Les pages spéciales ne comptent pas.'); return; }
    vibrate(HAPTIC.SOFT);
    void load(next, clicks + 1);
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
  const half = Math.ceil(active.length / 2);
  // Half the players arrived: 20 seconds left for the others.
  useHostStep(party, `${gid}:${roundNo}:countdown`, phase === 'race' && !round.countdown && doneCount >= half && doneCount < active.length, async () => {
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
          <li key={p.id} className={cn('flex items-center gap-2 rounded-xl border-[3px] border-brand-border px-2 py-1.5', f ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner')}>
            <span className="w-24 shrink-0 truncate font-display text-sm"><OgName name={p.name} /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{f ? `Arrivé en ${clockOf(f.ms)}` : pretty(at?.title || pair?.start || '…')}</span>
            <span className="shrink-0 font-display text-sm tabular-nums">{f ? f.clicks : at?.clicks ?? 0} clics</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <PartyShell party={party} title="WikiRacing" maxTime={phase === 'race' ? (round.countdown ? AFTER_HALF : MAX_RACE) : RESULTS_TIME} wide>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="WikiRacing"
          tagline="Relie deux pages Wikipédia."
          icon={Search}
          swatch={SWATCH}
          minPlayers={1}
          onStart={start}
          rules={[
            'Tout le monde part de la même page Wikipédia.',
            'Clique de lien en lien pour atteindre la page d’arrivée. La recherche est interdite.',
            byClicks ? 'Le moins de clics gagne (le temps départage).' : 'Le plus rapide gagne.',
            'Quand la moitié des joueurs est arrivée, il reste 20 secondes aux autres. 300, 200 et 100 points aux trois premiers.',
          ]}
        />
      )}

      {phase === 'race' && pair && (
        <div className="flex w-full flex-1 flex-col gap-3">
          <div className={cn(BRAWL.panel, 'flex flex-wrap items-center gap-2 p-2 sm:p-3')}>
            <span className="inline-flex min-w-0 flex-1 items-center gap-2">
              <Flag className="h-5 w-5 shrink-0 text-accent-success" />
              <span className="min-w-0">
                <span className="block text-[11px] font-black uppercase tracking-widest text-tx-secondary">Arrivée</span>
                <span className="block truncate font-display text-lg text-accent-primary sm:text-xl">{pretty(pair.target)}</span>
              </span>
            </span>
            <span className="inline-flex h-10 items-center gap-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 font-display tabular-nums"><LinkIcon className="h-4 w-4" /> {clicks}</span>
            <button onClick={() => setShowBoard((v) => !v)} className={cn(showBoard ? BRAWL.green : BRAWL.dark, 'h-10 rounded-xl px-3 text-sm')}>
              <Users className="h-4 w-4" /> {doneCount}/{active.length}
            </button>
          </div>
          {showBoard && <div className={cn(BRAWL.panel, 'p-2')}>{board}</div>}

          {finished ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <RevealBanner tone="good" eyebrow="Arrivé !">{pretty(pair.target)}</RevealBanner>
              <Waiting text="On attend les autres coureurs…" />
              <div className={cn(BRAWL.panel, 'w-full p-2')}>{board}</div>
            </div>
          ) : (
            <div ref={content} className="relative min-h-[55vh] flex-1 overflow-y-auto rounded-[22px] border-4 border-brand-border bg-[#1E2358] shadow-[0_6px_0_#05061A]">
              <p className="sticky top-0 z-10 truncate border-b-[3px] border-brand-border bg-brand-card px-3 py-1.5 font-display">{pretty(title || pair.start)}</p>
              {(loading || blocked) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-brand-bg/80 p-6 text-center backdrop-blur-sm">
                  {blocked ? (
                    <>
                      <p className="font-display text-2xl">La recherche est désactivée.</p>
                      <p className="font-bold text-tx-secondary">5 secondes de pénalité…</p>
                    </>
                  ) : <Loader2 className="h-10 w-10 animate-spin text-accent-success" />}
                </div>
              )}
              <div className="wiki-content mx-auto max-w-4xl p-3 text-white md:p-6" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}
        </div>
      )}

      {phase === 'results' && pair && (
        <>
          <RevealBanner tone={(round.ranking || []).length ? 'good' : 'bad'} eyebrow={`${pretty(pair.start)} → ${pretty(pair.target)}`}>
            {(round.ranking || []).length ? <><Trophy className="mr-2 inline h-8 w-8" /><OgName name={party.nameOf(round.ranking[0].pid)} /></> : 'Personne n’est arrivé'}
          </RevealBanner>
          <AnswerList
            party={party}
            title="Arrivées"
            rows={party.seated.map((p) => {
              const f = (round.ranking || []).find((r: any) => r.pid === p.id);
              return { pid: p.id, ok: !!f, answer: f ? `${clockOf(f.ms)} · ${f.clicks} clics` : 'pas arrivé', points: round.gains?.[p.id] };
            })}
          />
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Course suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les as de l’encyclopédie." />}
    </PartyShell>
  );
}
