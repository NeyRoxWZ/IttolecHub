'use client';

import { useEffect, useState } from 'react';
import { Laugh } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, PartyShell, PlayerChips, Podium, PromptCard, ResultsScreen, RevealBanner, Screen, SetupScreen, VoteScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#FF4F8B', shade: '#C92D63' };
const RESULTS_TIME = 14;

type Entry = { pid: string; text: string; votes?: string[] };

export default function Punchline({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'punchline');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const answerTime = numSetting(settings, 'answerTime', 60, 10, 300);
  const voteTime = numSetting(settings, 'voteTime', 30, 10, 180);

  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [gid, roundNo]);
  const [sentAnswer, markAnswer] = useSent(party, 'answer');
  const [myPick, markPick] = useSent<string>(party, 'vote');

  const answers = party.latestBy('answer', 'answer');
  const votes = party.latestBy('vote', 'vote');
  const entries: Entry[] = round.entries || [];

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 5, 1, 50);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=punchline&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: string[] = (data?.items || []).map((i: { text: string }) => i.text);
    if (!deck.length) { toast.error('Impossible de charger les questions.'); return; }
    await party.startGame(deck, { phase: 'answer', prompt: deck[0], ends_at: party.deadline(answerTime) }, deck.length);
  };

  const allAnswered = active.length > 0 && active.every((p) => answers[p.id]);
  useHostStep(party, `${gid}:${roundNo}:answer-end`, phase === 'answer' && (party.expired || allAnswered), async () => {
    const list: Entry[] = shuffle(Object.entries(answers).map(([pid, a]) => ({ pid, text: String(a?.text || '').trim().slice(0, 90) })).filter((e) => e.text));
    if (list.length < 2) {
      await party.setRound({ phase: 'results', prompt: round.prompt, entries: list, gains: {}, best: 0, skipped: true, ends_at: party.deadline(8) });
      return;
    }
    await party.setRound({ phase: 'vote', prompt: round.prompt, entries: list, ends_at: party.deadline(voteTime) });
  });

  // Everyone who has someone else's answer to vote for voted, or time is up.
  const allVoted = active.every((p) => votes[p.id] || !entries.some((e) => e.pid !== p.id));
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const tally = entries.map((e) => ({ ...e, votes: Object.entries(votes).filter(([voter, v]) => v?.pid === e.pid && voter !== e.pid).map(([voter]) => voter) }));
    const best = Math.max(0, ...tally.map((t) => t.votes.length));
    const gains: Scores = {};
    for (const t of tally) {
      const pts = t.votes.length * 100 + (best > 0 && t.votes.length === best ? 100 : 0);
      if (pts) gains[t.pid] = pts;
    }
    await party.setRound({ phase: 'results', prompt: round.prompt, entries: tally, gains, best, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    const deck: string[] = party.deck || [];
    await party.goToRound(roundNo + 1, { phase: 'answer', prompt: deck[roundNo] ?? deck[0], ends_at: party.deadline(answerTime) });
  });

  const answered = !!sentAnswer || (!!playerId && !!answers[playerId]);
  const myVote = myPick ?? (playerId ? votes[playerId]?.pid : undefined);
  const top = entries.filter((e) => round.best > 0 && (e.votes?.length || 0) === round.best);

  return (
    <PartyShell party={party} title="Punchline" maxTime={phase === 'answer' ? answerTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Punchline" tagline="La réponse la plus drôle gagne." icon={Laugh} swatch={SWATCH} minPlayers={3} onStart={start}
          rules={['Tout le monde reçoit la même question.', 'Chacun écrit sa réponse la plus drôle, en secret.', 'Vote anonyme pour ta réponse préférée (pas la tienne).', '100 points par vote reçu, 100 de bonus pour la punchline du tour.']}
        />
      )}

      {phase === 'answer' && (
        <Screen center>
          <div className="flex w-full max-w-2xl flex-col gap-3">
            <PromptCard eyebrow={`Question ${roundNo}/${totalRounds}`}>{round.prompt}</PromptCard>
            {answered ? <Waiting text="Réponse envoyée, on attend les autres…" /> : (
              <AnswerInput value={draft} onChange={setDraft} maxLength={90} placeholder="Ta punchline…" submitLabel="Envoyer" onSubmit={() => { markAnswer(true); party.act('answer', { text: draft.trim() }); vibrate(HAPTIC.MEDIUM); }} />
            )}
            <PlayerChips party={party} done={Object.keys(answers)} label="Répondu" />
          </div>
        </Screen>
      )}

      {phase === 'vote' && (
        <VoteScreen
          party={party}
          title={round.prompt}
          subtitle="Vote pour la réponse la plus drôle. Personne ne sait qui a écrit quoi."
          candidates={entries.map((e) => ({ id: e.pid, title: e.text, mine: e.pid === playerId }))}
          myVote={myVote}
          onVote={(pid) => { markPick(pid); party.act('vote', { pid }); vibrate(HAPTIC.SOFT); }}
          votes={{}}
          voted={Object.keys(votes)}
          voters={active.map((p) => p.id)}
        />
      )}

      {phase === 'results' && (
        <ResultsScreen
          party={party}
          reveal={round.skipped ? (
            <RevealBanner tone="bad" eyebrow={round.prompt}>Pas assez de réponses pour voter</RevealBanner>
          ) : (
            <RevealBanner tone={top.length ? 'good' : 'neutral'} eyebrow={`Punchline du tour · ${round.prompt}`} detail={top.length ? <>par {top.map((t, i) => <span key={t.pid}>{i ? ', ' : ''}<OgName name={party.nameOf(t.pid)} /></span>)}</> : undefined}>
              {top.length ? `« ${top[0].text} »` : 'Aucun vote'}
            </RevealBanner>
          )}
          rows={Object.fromEntries(entries.map((e) => [e.pid, { answer: `« ${e.text} »`, note: `${e.votes?.length || 0} vote${(e.votes?.length || 0) > 1 ? 's' : ''}` } as RoundRow]))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Question suivante'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les plus drôles de la soirée." />}
    </PartyShell>
  );
}
