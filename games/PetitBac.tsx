'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Grid3x3, Hand, ThumbsDown } from 'lucide-react';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { fold, normalize, shuffle } from '@/lib/party/text';
import { PETIT_BAC_CATEGORIES } from '@/lib/party/catalog';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { PartyShell, PlayerChips, Podium, ResultsScreen, RevealBanner, Screen, Scroll, SetupScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#1FB866', shade: '#158A4B' };
const LETTERS_EASY = 'ABCDEFGHIJLMNOPRSTUV'.split('');
const LETTERS_ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DEFAULT_CATS = ['prenom', 'pays', 'animal', 'metier', 'fruitlegume', 'objet', 'marque', 'celebrite'];
const STOP_DELAY = 5;
const RESULTS_TIME = 15;

type Sheet = Record<string, string>;
const labelOf = (id: string) => PETIT_BAC_CATEGORIES.find((c) => c.value === id)?.label ?? id;
const startsWith = (text: string, letter: string) => fold(text).startsWith(letter.toLowerCase());

/** The round's letter, small enough to stay on screen next to the grid. */
function LetterBadge({ letter, extra }: { letter: string; extra?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-brand-border bg-accent-primary font-display text-4xl text-brand-bg shadow-[0_4px_0_#05061A]">{letter}</span>
      {extra}
    </div>
  );
}

export default function PetitBac({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'petitbac');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const answerTime = numSetting(settings, 'time', 90, 20, 600);

  const letter: string = round.letter || '';
  const cats: string[] = round.cats || [];
  const reviewTime = Math.min(120, 15 + cats.length * 6);

  const [drafts, setDrafts] = useState<Sheet>({});
  useEffect(() => setDrafts({}), [gid, roundNo]);
  const [sentSheet, markSheet] = useSent(party, 'sheet');

  const sheets: Record<string, Sheet> = {
    ...Object.fromEntries(Object.entries(party.latestBy('answers', 'answer')).map(([k, v]) => [k, v?.a || {}])),
    ...Object.fromEntries(Object.entries(party.latestBy('answers', 'collect')).map(([k, v]) => [k, v?.a || {}])),
  };
  const iSent = !!sentSheet || (!!playerId && !!sheets[playerId]);
  const stopMove = party.movesIn('answer', 'stop')[0];

  const sendSheet = () => {
    if (iSent) return;
    markSheet(true);
    const a: Sheet = {};
    for (const c of cats) a[c] = String(drafts[c] || '').trim().slice(0, 40);
    party.act('answers', { a });
  };

  const start = async () => {
    const pool = settings.letters === 'all' ? LETTERS_ALL : LETTERS_EASY;
    const letters = shuffle(pool).slice(0, numSetting(settings, 'rounds', 5, 1, pool.length));
    const valid = new Set(PETIT_BAC_CATEGORIES.map((c) => c.value));
    const chosen = listSetting(settings, 'categories').filter((c) => valid.has(c));
    await party.startGame(letters, { phase: 'answer', letter: letters[0], cats: chosen.length ? chosen : DEFAULT_CATS, ends_at: party.deadline(answerTime) }, letters.length);
  };

  // Grids go out on their own when time runs out, even from a player who didn't press anything.
  useEffect(() => {
    if (iSent) return;
    if ((phase === 'answer' && party.round.ends_at && party.timeLeft <= 1) || phase === 'collect') sendSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, party.timeLeft, iSent]);

  useHostStep(party, `${gid}:${roundNo}:stop`, phase === 'answer' && !!stopMove, async () => {
    const soon = party.deadline(STOP_DELAY);
    if (round.ends_at > soon) await party.patchRound({ ends_at: soon, stopper: stopMove!.player_id });
  });

  const allSent = active.length > 0 && active.every((p) => sheets[p.id]);
  const toReview = () => party.setRound({ phase: 'review', letter, cats, sheets, ends_at: party.deadline(reviewTime) });
  useHostStep(party, `${gid}:${roundNo}:answer-end`, phase === 'answer' && (party.expired || allSent), async () => {
    if (allSent) await toReview();
    else await party.setRound({ ...round, phase: 'collect', ends_at: party.deadline(3) });
  });
  useHostStep(party, `${gid}:${roundNo}:collect-end`, phase === 'collect' && (party.expired || allSent), toReview);

  const frozen: Record<string, Sheet> = round.sheets || {};
  const reviewMoves = party.movesIn('review');
  const vetoes = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    for (const m of reviewMoves) {
      if (m.action_type !== 'veto' || m.payload?.pid === m.player_id) continue;
      const key = `${m.payload?.pid}|${m.payload?.cat}`;
      const set = (out[key] ||= new Set());
      if (m.payload?.on) set.add(m.player_id); else set.delete(m.player_id);
    }
    return out;
  }, [reviewMoves]);
  const okBy = new Set(reviewMoves.filter((m) => m.action_type === 'ok').map((m) => m.player_id));
  const refused = (pid: string, cat: string) => {
    const others = Math.max(1, active.filter((p) => p.id !== pid).length);
    return (vetoes[`${pid}|${cat}`]?.size || 0) > others / 2;
  };
  const allChecked = active.length > 0 && active.every((p) => okBy.has(p.id));

  useHostStep(party, `${gid}:${roundNo}:review-end`, phase === 'review' && (party.expired || allChecked), async () => {
    const verdict: Record<string, Record<string, number>> = {};
    const gains: Scores = {};
    for (const cat of cats) {
      const valid = Object.entries(frozen).map(([pid, s]) => ({ pid, text: String(s?.[cat] || '') })).filter((x) => x.text && startsWith(x.text, letter) && !refused(x.pid, cat));
      const counts: Record<string, number> = {};
      for (const v of valid) counts[normalize(v.text)] = (counts[normalize(v.text)] || 0) + 1;
      for (const v of valid) {
        const pts = counts[normalize(v.text)] > 1 ? 10 : 20;
        (verdict[v.pid] ||= {})[cat] = pts;
        gains[v.pid] = (gains[v.pid] || 0) + pts;
      }
    }
    await party.setRound({ phase: 'results', letter, cats, sheets: frozen, verdict, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    const letters: string[] = party.deck || [];
    await party.goToRound(roundNo + 1, { phase: 'answer', letter: letters[roundNo] ?? LETTERS_EASY.find((l) => !letters.includes(l)) ?? 'A', cats, ends_at: party.deadline(answerTime) });
  });

  const filled = cats.every((c) => startsWith(drafts[c] || '', letter));
  const withSheets = party.seated.filter((p) => frozen[p.id]);

  return (
    <PartyShell party={party} title="Petit Bac" maxTime={phase === 'answer' ? answerTime : phase === 'review' ? reviewTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Petit Bac" tagline="Une lettre, des catégories, le chrono tourne." icon={Grid3x3} swatch={SWATCH} minPlayers={2} onStart={start}
          rules={['Une lettre est tirée : trouve un mot qui commence par elle dans chaque catégorie.', 'Grille complète ? Appuie sur STOP : les autres n’ont plus que 5 secondes.', 'Tout le monde vérifie les réponses et refuse celles qui ne vont pas.', 'Réponse unique : 20 points. Réponse que quelqu’un d’autre a aussi : 10 points.']}
        />
      )}

      {(phase === 'answer' || phase === 'collect') && (
        <Screen>
          <LetterBadge letter={letter} extra={round.stopper && <span className="rounded-xl border-[3px] border-brand-border bg-accent-secondary px-3 py-1 font-display text-white">STOP de <OgName name={party.nameOf(round.stopper)} /> !</span>} />
          {iSent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Waiting text="Grille envoyée, on attend les autres…" />
              <PlayerChips party={party} done={Object.keys(sheets)} label="Grilles" />
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className={cn(BRAWL.panel, 'mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-2 p-2 sm:p-3')}>
              <Scroll className="grid content-start gap-2 sm:grid-cols-2">
                {cats.map((c) => {
                  const v = drafts[c] || '';
                  const ok = v.trim() && startsWith(v, letter);
                  return (
                    <label key={c} className="block">
                      <span className="block text-[11px] font-black uppercase tracking-widest text-tx-secondary">{labelOf(c)}</span>
                      <input
                        value={v}
                        onChange={(e) => setDrafts((d) => ({ ...d, [c]: e.target.value.slice(0, 40) }))}
                        autoComplete="off" autoCorrect="off" spellCheck={false}
                        placeholder={`${letter}…`}
                        className={cn('h-11 w-full rounded-xl border-[3px] bg-brand-inner px-3 text-lg font-bold text-tx-base outline-none placeholder:text-tx-muted', ok ? 'border-accent-success' : v.trim() ? 'border-accent-secondary' : 'border-brand-border focus:border-accent-success')}
                      />
                    </label>
                  );
                })}
              </Scroll>
              <button type="button" disabled={!filled || phase !== 'answer'} onClick={() => { sendSheet(); party.act('stop'); vibrate(HAPTIC.HEAVY); }} className={cn(BRAWL.pink, 'h-12 w-full shrink-0 rounded-2xl text-xl')}>
                <Hand className="h-6 w-6" /> {filled ? 'STOP !' : 'Remplis tout pour dire STOP'}
              </button>
            </form>
          )}
        </Screen>
      )}

      {phase === 'review' && (
        <Screen>
          <LetterBadge letter={letter} extra={<span className="max-w-[16rem] text-sm font-bold text-tx-secondary">Refuse les réponses qui ne vont pas, puis valide.</span>} />
          <Scroll className="grid content-start gap-2 md:grid-cols-2 xl:grid-cols-3">
            {cats.map((c) => (
              <div key={c} className={cn(BRAWL.panel, 'p-2')}>
                <h3 className="mb-1 font-display text-base">{labelOf(c)}</h3>
                <ul className="space-y-1">
                  {withSheets.map((p) => {
                    const text = frozen[p.id]?.[c] || '';
                    const wrongLetter = !!text && !startsWith(text, letter);
                    const out = !text || wrongLetter || refused(p.id, c);
                    const mine = !!playerId && !!vetoes[`${p.id}|${c}`]?.has(playerId);
                    const n = vetoes[`${p.id}|${c}`]?.size || 0;
                    return (
                      <li key={p.id} className="flex items-center gap-1.5 rounded-lg border-2 border-brand-border bg-brand-inner px-1.5 py-1">
                        <span className="w-16 shrink-0 truncate text-[11px] font-bold text-tx-secondary"><OgName name={p.name} /></span>
                        <span className={cn('min-w-0 flex-1 truncate text-sm font-bold', out && 'text-tx-muted line-through')}>{text || '—'}</span>
                        {n > 0 && <span className="text-xs font-bold text-accent-secondary">{n}</span>}
                        {p.id !== playerId && text && !wrongLetter && (
                          <button onClick={() => { party.act('veto', { pid: p.id, cat: c, on: !mine }); vibrate(HAPTIC.SOFT); }} className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-brand-border shadow-none', mine ? 'bg-accent-secondary text-white' : 'bg-[#2B3170] text-white')} aria-label={mine ? 'Annuler le refus' : 'Refuser'}>
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </Scroll>
          {okBy.has(playerId || '') ? <Waiting text="Validé, on attend les autres…" /> : (
            <button onClick={() => party.act('ok')} className={cn(BRAWL.green, 'h-12 w-full shrink-0 rounded-2xl text-lg')}><Check className="h-5 w-5" /> J’ai vérifié</button>
          )}
          <PlayerChips party={party} done={Array.from(okBy)} label="Vérifié" />
        </Screen>
      )}

      {phase === 'results' && (
        <ResultsScreen
          party={party}
          reveal={<RevealBanner tone="neutral" eyebrow="Lettre">{letter}</RevealBanner>}
          media={
            <div className={cn(BRAWL.panel, 'flex h-full min-h-0 w-full flex-col p-2')}>
              <Scroll className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-widest text-tx-secondary">
                      <th className="p-1">Catégorie</th>
                      {withSheets.map((p) => <th key={p.id} className="max-w-[90px] truncate p-1"><OgName name={p.name} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c} className="border-t-2 border-brand-border">
                        <td className="p-1 font-display">{labelOf(c)}</td>
                        {withSheets.map((p) => {
                          const pts = round.verdict?.[p.id]?.[c] || 0;
                          return (
                            <td key={p.id} className="p-1">
                              <span className={cn('font-bold', !pts && 'text-tx-muted line-through')}>{frozen[p.id]?.[c] || '—'}</span>
                              {pts > 0 && <span className={cn('ml-1 font-display', pts === 20 ? 'text-accent-success' : 'text-accent-primary')}>+{pts}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </div>
          }
          rows={Object.fromEntries(withSheets.map((p) => [p.id, { note: `${Object.keys(round.verdict?.[p.id] || {}).length}/${cats.length} catégories validées` } as RoundRow]))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Lettre suivante'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les as du Petit Bac." />}
    </PartyShell>
  );
}
