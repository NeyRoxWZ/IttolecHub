'use client';

import { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { PartyShell, PlayerChips, Podium, ResultsScreen, RevealBanner, Screen, Scroll, SetupScreen, VoteScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#FF8A1F', shade: '#CC6508' };
const RESULTS_TIME = 10;

type Item = { pid: string; q: string; text: string };

export default function QuiADitCa({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'quiaditca');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const writeTime = numSetting(settings, 'writeTime', 120, 30, 600);
  const guessTime = numSetting(settings, 'guessTime', 20, 5, 120);

  const questions: string[] = round.questions || [];
  const [drafts, setDrafts] = useState<string[]>([]);
  useEffect(() => setDrafts([]), [gid]);
  const [sent, markSent] = useSent(party, 'write');
  const [myPick, markPick] = useSent<string>(party, 'guess');

  const written = party.latestBy('answers', 'write');
  const guessesRaw = party.latestBy('guess', 'guess');
  const item: Item | undefined = round.item;
  const pool: Item[] = round.pool || [];
  const guesses: Record<string, string> = {};
  for (const [voter, g] of Object.entries(guessesRaw)) if (g?.pid && voter !== item?.pid) guesses[voter] = g.pid;

  const start = async () => {
    const count = numSetting(settings, 'questions', 3, 1, 10);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=quiaditca&count=${count}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: string[] = (data?.items || []).map((i: { text: string }) => i.text);
    if (!deck.length) { toast.error('Impossible de charger les questions.'); return; }
    await party.startGame(deck, { phase: 'write', questions: deck, ends_at: party.deadline(writeTime) }, 1);
  };

  const submit = () => {
    const list = questions.map((_, i) => String(drafts[i] || '').trim().slice(0, 100));
    if (!list.some(Boolean)) return;
    markSent(true);
    party.act('answers', { list });
    vibrate(HAPTIC.MEDIUM);
  };

  // What was typed goes out anyway just before the end.
  const iWrote = !!sent || (!!playerId && !!written[playerId]);
  useEffect(() => {
    if (phase === 'write' && !iWrote && party.round.ends_at && party.timeLeft <= 2 && drafts.some((d) => d?.trim())) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, iWrote, party.timeLeft]);

  const allWritten = active.length > 0 && active.every((p) => written[p.id]);
  useHostStep(party, `${gid}:write-end`, phase === 'write' && (party.expired || allWritten), async () => {
    const byPlayer = shuffle(Object.entries(written)).map(([pid, a]) =>
      shuffle(((Array.isArray(a?.list) ? a.list : []) as string[]).map((text, qi): Item => ({ pid, q: questions[qi] || '', text: String(text || '').trim() })).filter((x) => x.text)),
    );
    const interleaved: Item[] = [];
    for (let i = 0; byPlayer.some((l) => l.length > i); i++) for (const l of byPlayer) if (l[i]) interleaved.push(l[i]);
    const chosen = interleaved.slice(0, numSetting(settings, 'rounds', 8, 1, 60));
    if (!chosen.length) { await party.endGame(); return; }
    await party.setRound({ phase: 'guess', pool: chosen, item: chosen[0], ends_at: party.deadline(guessTime) }, { total_rounds: chosen.length, current_round: 1 });
  });

  const guessers = item ? active.filter((p) => p.id !== item.pid) : [];
  const allGuessed = guessers.length > 0 && guessers.every((p) => guesses[p.id]);
  useHostStep(party, `${gid}:${roundNo}:guess-end`, phase === 'guess' && (party.expired || allGuessed), async () => {
    if (!item) return;
    const gains: Scores = {};
    let fooled = 0;
    for (const [voter, target] of Object.entries(guesses)) {
      if (target === item.pid) gains[voter] = 100;
      else fooled++;
    }
    if (fooled) gains[item.pid] = (gains[item.pid] || 0) + fooled * 50;
    await party.setRound({ phase: 'results', pool, item, guesses, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds || !pool[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, { phase: 'guess', pool, item: pool[roundNo], ends_at: party.deadline(guessTime) });
  });

  const finalGuesses: Record<string, string> = round.guesses || {};

  return (
    <PartyShell party={party} title="Qui a dit ça ?" maxTime={phase === 'write' ? writeTime : phase === 'guess' ? guessTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Qui a dit ça ?" tagline="Répondez en secret, puis devinez qui a écrit quoi." icon={Quote} swatch={SWATCH} minPlayers={3} onStart={start}
          rules={['Tout le monde répond en secret aux mêmes questions perso.', 'Une réponse s’affiche : les autres devinent qui l’a écrite.', '100 points par bonne réponse.', 'L’auteur ne vote pas : il gagne 50 points par joueur qui se trompe.']}
        />
      )}

      {phase === 'write' && (
        iWrote ? (
          <Screen center>
            <Waiting text="Réponses envoyées, on attend les autres…" />
            <PlayerChips party={party} done={Object.keys(written)} label="Répondu" />
          </Screen>
        ) : (
          <Screen center>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className={cn(BRAWL.panel, 'flex max-h-full min-h-0 w-full max-w-2xl flex-col gap-3 p-3 sm:p-4')}>
              <h2 className="shrink-0 text-center font-display text-2xl">Réponds en secret</h2>
              <Scroll className="space-y-3">
                {questions.map((q, i) => (
                  <label key={i} className="block">
                    <span className="mb-1 block text-sm font-bold text-tx-secondary">{q}</span>
                    <input
                      value={drafts[i] || ''}
                      onChange={(e) => setDrafts((prev) => { const n = [...prev]; n[i] = e.target.value.slice(0, 100); return n; })}
                      autoFocus={i === 0}
                      autoComplete="off"
                      className="h-12 w-full rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 text-lg font-bold text-tx-base placeholder:text-tx-muted outline-none focus:border-accent-success"
                      placeholder="Ta réponse…"
                    />
                  </label>
                ))}
              </Scroll>
              <button type="submit" disabled={!drafts.some((d) => d?.trim())} className={cn(BRAWL.green, 'h-12 w-full shrink-0 rounded-2xl text-lg')}>Envoyer mes réponses</button>
              <PlayerChips party={party} done={Object.keys(written)} label="Répondu" />
            </form>
          </Screen>
        )
      )}

      {phase === 'guess' && item && (
        <VoteScreen
          party={party}
          title={<>« {item.text} »</>}
          subtitle={item.pid === playerId ? `${item.q} · C’est ta réponse : tu ne votes pas, garde ton sérieux !` : `${item.q} · Qui a écrit ça ?`}
          candidates={party.active.map((p) => ({ id: p.id, title: <OgName name={p.name} />, mine: p.id === playerId }))}
          hideMine
          myVote={myPick ?? (playerId ? guesses[playerId] : undefined)}
          onVote={item.pid === playerId ? undefined : (pid) => { markPick(pid); party.act('guess', { pid }); vibrate(HAPTIC.SOFT); }}
          votes={{}}
          voted={Object.keys(guesses)}
          voters={guessers.map((p) => p.id)}
          cantVoteText="C’est ta réponse : les autres devinent."
        />
      )}

      {phase === 'results' && item && (
        <ResultsScreen
          party={party}
          reveal={<RevealBanner tone="neutral" eyebrow={`${item.q} · « ${item.text} »`}>C’était <OgName name={party.nameOf(item.pid)} /></RevealBanner>}
          rows={Object.fromEntries(party.seated.map((p) => {
            if (p.id === item.pid) return [p.id, { answer: 'l’auteur', note: `${Object.values(finalGuesses).filter((t) => t !== item.pid).length} piégé(s)` } as RoundRow];
            const g = finalGuesses[p.id];
            return [p.id, { ok: g === item.pid, answer: g ? `a voté ${party.nameOf(g)}` : 'pas voté' } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Réponse suivante'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Ceux qui connaissent le mieux leurs potes." />}
    </PartyShell>
  );
}
