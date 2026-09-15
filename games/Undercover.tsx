'use client';

import { useEffect, useState } from 'react';
import { EyeOff, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough, shuffle } from '@/lib/party/text';
import { addScores, numSetting, useHostStep, usePartyGame, type Scores } from './party/usePartyGame';
import {
  AnswerInput, Column, Columns, PartyShell, Podium, PromptCard, ReadyScreen, RecapPanel, ResultsScreen, RevealBanner, Screen, SecretCard, SetupScreen, TurnStrip, VoteScreen, Waiting, type RoundRow,
} from './party/ui';

type Role = 'CIVIL' | 'UNDERCOVER' | 'MR_WHITE';
type Pair = { civilWord: string; undercoverWord: string };
type Clue = { pid: string; text: string; lap: number; turn: number; s: number };

const SWATCH = { fill: '#FF8A1F', shade: '#CC6508' };
const CLUE_TIME = 45;
const GUESS_TIME = 30;
const REVEAL_TIME = 7;
const RESULTS_TIME = 15;
const ROLE_LABEL: Record<Role, string> = { CIVIL: 'Civil', UNDERCOVER: 'Undercover', MR_WHITE: 'Mr. White' };
const on = (v: unknown, fallback: boolean) => (v === undefined ? fallback : v === true || v === 'true');

export default function Undercover({ roomCode }: { roomCode: string }) {
  const party = usePartyGame(roomCode, 'undercover');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid, stage } = party;
  const clueRounds = numSetting(settings, 'clueRounds', 3, 1, 10);
  const voteTime = numSetting(settings, 'voteTime', 60, 15, 300);
  const mrWhite = on(settings.mrWhiteEnabled, true);
  const showRoles = on(settings.playersKnowRole, true);

  const pair: Pair | undefined = round.pair;
  const roles: Record<string, Role> = round.roles || {};
  const alive: string[] = round.alive || [];
  const out: string[] = round.out || [];
  const lap: number = round.lap || 1;
  const turn: number = round.turn || 0;
  const speaker = alive.length ? alive[turn % alive.length] : undefined;
  const myRole = playerId ? roles[playerId] : undefined;
  const iAmAlive = !!playerId && alive.includes(playerId);
  const here = (id: string) => active.some((p) => p.id === id);
  const wordOf = (role?: Role) => (role === 'CIVIL' ? pair?.civilWord : role === 'UNDERCOVER' ? pair?.undercoverWord : undefined);

  const [draft, setDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');
  useEffect(() => setDraft(''), [turn, lap, stage]);

  const clues: Clue[] = party.movesIn('clues', 'clue').map((m) => ({ pid: m.player_id, text: String(m.payload?.text || '').slice(0, 40), lap: Number(m.payload?.lap), turn: Number(m.payload?.turn), s: Number(m.payload?.s ?? 0) }));
  const currentClue = clues.find((c) => c.s === stage && c.lap === lap && c.turn === turn && c.pid === speaker);
  const ready = Object.keys(party.latestBy('ready', 'roles'));
  const skips = Object.entries(party.latestBy('skip', 'clues', stage)).filter(([pid, v]) => v?.on && alive.includes(pid)).map(([pid]) => pid);
  const votes: Record<string, string> = {};
  for (const [voter, v] of Object.entries(party.latestBy('vote', 'vote', stage))) if (alive.includes(voter) && v?.pid && v.pid !== voter) votes[voter] = v.pid;
  const whiteGuess = round.eliminated ? party.latestBy('guess', 'guess', stage)[round.eliminated]?.text : undefined;

  /* ---------------- host ---------------- */
  const assign = (ids: string[]): Record<string, Role> => {
    const order = shuffle(ids);
    const maxSpecial = Math.max(1, ids.length - 2);
    const result: Record<string, Role> = {};
    let specials = 0;
    const ucCount = numSetting(settings, 'undercoverCount', 1, 1, 5);
    for (const id of order) {
      if (specials < Math.min(ucCount, maxSpecial)) { result[id] = 'UNDERCOVER'; specials++; }
      else if (mrWhite && specials < maxSpecial && !Object.values(result).includes('MR_WHITE')) { result[id] = 'MR_WHITE'; specials++; }
      else result[id] = 'CIVIL';
    }
    return result;
  };

  const roundOf = (deck: Pair[], n: number) => {
    const ids = shuffle(party.active.map((p) => p.id));
    return { phase: 'roles', pair: deck[n - 1], roles: assign(ids), alive: ids, out: [], lap: 1, turn: 0, stage: 0, revoted: false };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', 1, 1, 10);
    const data = await fetch(`/api/games/undercover?count=${Math.max(2, rounds)}`).then((r) => r.json()).catch(() => null);
    const deck: Pair[] = (Array.isArray(data) ? data : data ? [data] : []).slice(0, rounds);
    if (!deck.length) { toast.error('Impossible de charger les mots.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const finish = async (winner: 'CIVILS' | 'IMPOSTORS', whiteFound = false) => {
    const gains: Scores = {};
    for (const [pid, role] of Object.entries(roles)) if (winner === 'CIVILS' ? role === 'CIVIL' : role !== 'CIVIL') gains[pid] = 200;
    if (whiteFound && round.eliminated) gains[round.eliminated] = (gains[round.eliminated] || 0) + 100;
    await party.patchRound({ phase: 'results', winner, whiteFound, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  };

  const settle = async (eliminated: string, nextAlive: string[], nextOut: string[]) => {
    const impostors = nextAlive.filter((id) => roles[id] !== 'CIVIL').length;
    const civils = nextAlive.length - impostors;
    if (impostors === 0) return finish('CIVILS');
    if (impostors >= civils) return finish('IMPOSTORS');
    await party.patchRound({ phase: 'eliminated', eliminated, alive: nextAlive, out: nextOut, stage: stage + 1, revoted: false, ends_at: party.deadline(REVEAL_TIME) });
  };

  const toVote = () => party.patchRound({ phase: 'vote', stage: stage + 1, notice: null, ends_at: party.deadline(voteTime) });

  const everyoneReady = alive.filter(here).every((id) => ready.includes(id));
  useHostStep(party, `${gid}:${roundNo}:ready`, phase === 'roles' && alive.length > 0 && everyoneReady, async () => {
    await party.patchRound({ phase: 'clues', lap: 1, turn: 0, ends_at: party.deadline(CLUE_TIME) });
  });

  const speakerGone = !!speaker && !here(speaker);
  useHostStep(party, `${gid}:${roundNo}:${stage}:${lap}:${turn}`, phase === 'clues' && (!!currentClue || party.expired || speakerGone), async () => {
    const nextTurn = turn + 1;
    if (nextTurn < alive.length) return party.patchRound({ turn: nextTurn, ends_at: party.deadline(CLUE_TIME) });
    if (lap + 1 > clueRounds) return toVote();
    await party.patchRound({ lap: lap + 1, turn: 0, ends_at: party.deadline(CLUE_TIME) });
  });

  const majority = Math.floor(alive.length / 2) + 1;
  useHostStep(party, `${gid}:${roundNo}:${stage}:skip`, phase === 'clues' && skips.length >= majority, toVote);

  const voters = alive.filter(here);
  const allVoted = voters.length > 0 && voters.every((id) => votes[id]);
  useHostStep(party, `${gid}:${roundNo}:${stage}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const counts: Record<string, number> = {};
    for (const target of Object.values(votes)) counts[target] = (counts[target] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    if (max === 0 || leaders.length > 1) {
      if (!round.revoted) return party.patchRound({ stage: stage + 1, revoted: true, notice: 'Égalité ! On revote.', ends_at: party.deadline(voteTime) });
      return party.patchRound({ phase: 'clues', lap: 1, turn: 0, stage: stage + 1, revoted: false, notice: 'Encore une égalité : personne ne sort, nouveau tour d’indices.', ends_at: party.deadline(CLUE_TIME) });
    }
    const eliminated = leaders[0];
    const nextAlive = alive.filter((id) => id !== eliminated);
    const nextOut = [...out, eliminated];
    if (roles[eliminated] === 'MR_WHITE') return party.patchRound({ phase: 'guess', eliminated, alive: nextAlive, out: nextOut, stage: stage + 1, ends_at: party.deadline(GUESS_TIME) });
    await settle(eliminated, nextAlive, nextOut);
  });

  const whiteGone = phase === 'guess' && !!round.eliminated && !party.seated.some((p) => p.id === round.eliminated);
  useHostStep(party, `${gid}:${roundNo}:${stage}:guess-end`, phase === 'guess' && (!!whiteGuess || party.expired || whiteGone), async () => {
    if (whiteGuess && pair && isCloseEnough(whiteGuess, pair.civilWord)) return finish('IMPOSTORS', true);
    await settle(round.eliminated, alive, out);
  });

  useHostStep(party, `${gid}:${roundNo}:${stage}:reveal-end`, phase === 'eliminated' && party.expired, async () => {
    await party.patchRound({ phase: 'clues', lap: 1, turn: 0, stage: stage + 1, ends_at: party.deadline(CLUE_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: Pair[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  /* ---------------- render ---------------- */
  const secret = myRole && (
    <SecretCard label="Ton mot" secret={myRole === 'MR_WHITE' ? 'Pas de mot : bluffe !' : wordOf(myRole)} role={showRoles ? { text: ROLE_LABEL[myRole], tone: myRole === 'CIVIL' ? 'good' : 'bad' } : undefined} />
  );
  const board = (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
      {[...alive, ...out].map((pid) => (
        <div key={pid} className={cn('rounded-lg border-2 border-brand-border p-1.5', pid === speaker && phase === 'clues' ? 'bg-accent-success/25' : 'bg-brand-inner', out.includes(pid) && 'opacity-50')}>
          <p className={cn('truncate font-display text-sm', out.includes(pid) && 'line-through')}><OgName name={party.nameOf(pid)} /></p>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {clues.filter((c) => c.pid === pid).map((c, i) => <li key={i} className="rounded border-2 border-brand-border bg-brand-card px-1 text-xs font-bold">{c.text}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
  const notice = round.notice && <p className="shrink-0 rounded-xl border-[3px] border-brand-border bg-accent-primary px-3 py-1 text-center text-sm font-bold text-brand-bg">{round.notice}</p>;

  return (
    <PartyShell party={party} title="Undercover" maxTime={phase === 'clues' ? CLUE_TIME : phase === 'vote' ? voteTime : phase === 'guess' ? GUESS_TIME : phase === 'eliminated' ? REVEAL_TIME : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Undercover" tagline="Bluffez pour survivre." icon={EyeOff} swatch={SWATCH} minPlayers={3} onStart={start}
          rules={['Les civils ont tous le même mot. Les undercovers en ont un très proche. Mr. White n’en a pas.', 'Chacun à son tour donne un indice sur son mot, sans trop en dire.', 'Après les tours d’indices, votez pour éliminer un joueur. Les indices restent affichés.', 'Les civils gagnent s’ils éliminent tous les imposteurs. Mr. White éliminé peut gagner en trouvant le mot des civils.']}
        />
      )}

      {phase === 'roles' && (myRole ? (
        <ReadyScreen party={party} ready={ready} onReady={() => party.act('ready')}>
          <PromptCard eyebrow={`Manche ${roundNo}/${totalRounds}`}>Découvre ton mot en secret</PromptCard>
          {secret}
        </ReadyScreen>
      ) : <Screen center><Waiting text="Tu regardes cette manche." /></Screen>)}

      {phase === 'clues' && (
        <Screen>
          <Columns className="grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1">
            <Column className="lg:justify-center">
              {notice}
              {secret}
              <TurnStrip party={party} order={alive} current={speaker} />
              <p className="shrink-0 text-center text-sm font-bold text-tx-secondary">Tour d’indices {lap}/{clueRounds}</p>
              {speaker === playerId ? (
                <AnswerInput value={draft} onChange={setDraft} maxLength={40} placeholder="Ton indice…" submitLabel="Envoyer" onSubmit={() => { party.act('clue', { text: draft.trim(), lap, turn }); vibrate(HAPTIC.SOFT); }} />
              ) : <Waiting text={<><OgName name={party.nameOf(speaker)} /> donne son indice…</>} />}
              {iAmAlive && (
                <button onClick={() => party.act('skip', { on: !skips.includes(playerId!) })} className={cn(skips.includes(playerId || '') ? BRAWL.green : BRAWL.dark, 'h-10 shrink-0 rounded-xl px-3 text-sm')}>
                  <SkipForward className="h-4 w-4" /> Passer au vote ({skips.length}/{majority})
                </button>
              )}
            </Column>
            <Column><RecapPanel title="Indices">{board}</RecapPanel></Column>
          </Columns>
        </Screen>
      )}

      {phase === 'vote' && (
        <VoteScreen
          party={party}
          title="Qui éliminer ?"
          subtitle={round.notice || undefined}
          recap={<RecapPanel title="Indices">{board}</RecapPanel>}
          candidates={alive.map((pid) => ({ id: pid, title: <OgName name={party.nameOf(pid)} />, mine: pid === playerId }))}
          hideMine
          myVote={playerId ? votes[playerId] : undefined}
          onVote={iAmAlive ? (pid) => { party.act('vote', { pid }); vibrate(HAPTIC.SOFT); } : undefined}
          votes={votes}
          voters={voters}
          cantVoteText="Tu es éliminé : tu regardes le vote."
        />
      )}

      {phase === 'guess' && (
        <Screen>
          <RevealBanner tone="good" eyebrow="Éliminé"><OgName name={party.nameOf(round.eliminated)} /> était Mr. White</RevealBanner>
          {round.eliminated === playerId ? (whiteGuess ? <Waiting text="Réponse envoyée…" /> : (
            <>
              <p className="shrink-0 text-center font-display text-lg">Dernière chance : quel est le mot des civils ?</p>
              <AnswerInput value={guessDraft} onChange={setGuessDraft} maxLength={40} placeholder="Le mot…" onSubmit={() => party.act('guess', { text: guessDraft.trim() })} />
            </>
          )) : <Waiting text="Mr. White tente de trouver le mot des civils…" />}
          <RecapPanel title="Indices">{board}</RecapPanel>
        </Screen>
      )}

      {phase === 'eliminated' && (
        <Screen>
          <RevealBanner tone={roles[round.eliminated] === 'CIVIL' ? 'bad' : 'good'} eyebrow="Éliminé" detail="La partie continue.">
            <OgName name={party.nameOf(round.eliminated)} /> était {ROLE_LABEL[roles[round.eliminated] as Role] ?? '?'}
          </RevealBanner>
          <RecapPanel title="Indices">{board}</RecapPanel>
        </Screen>
      )}

      {phase === 'results' && pair && (
        <ResultsScreen
          party={party}
          reveal={
            <RevealBanner tone={round.winner === 'CIVILS' ? 'good' : 'bad'} eyebrow="Fin de la manche" detail={<>Civils : « {pair.civilWord} » · Undercover : « {pair.undercoverWord} »{round.whiteFound ? ' · Mr. White a trouvé !' : ''}</>}>
              {round.winner === 'CIVILS' ? 'Victoire des civils' : 'Victoire des imposteurs'}
            </RevealBanner>
          }
          media={<RecapPanel title="Indices">{board}</RecapPanel>}
          rows={Object.fromEntries(Object.entries(roles).map(([pid, role]) => [pid, { ok: round.winner === 'CIVILS' ? role === 'CIVIL' : role !== 'CIVIL', answer: `${ROLE_LABEL[role]}${wordOf(role) ? ` · ${wordOf(role)}` : ''}` } as RoundRow]))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleurs menteurs… et détectives." />}
    </PartyShell>
  );
}
