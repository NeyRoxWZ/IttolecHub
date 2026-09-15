'use client';

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { pickOne } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, NextStep, PartyShell, PlayerChips, Podium, PromptCard, RevealBanner, ScoreList, SetupScreen, VoteScreen, Waiting } from './party/ui';

const SWATCH = { fill: '#8B3DFF', shade: '#6526C9' };
const RESULTS_TIME = 15;

type Card = { q: string; odd: string; catLabel?: string };

export default function HorsSujet({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'horssujet');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const answerTime = numSetting(settings, 'answerTime', 45, 10, 300);
  const voteTime = numSetting(settings, 'voteTime', 60, 15, 300);

  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [gid, roundNo]);
  const [sentAnswer, markAnswer] = useSent(party, 'answer');
  const [myPick, markPick] = useSent<string>(party, 'vote');

  const card: Card | undefined = round.card;
  const oddId: string | undefined = round.odd_pid;
  const answers = party.latestBy('answer', 'answer');
  const votes = party.latestBy('vote', 'vote');
  const shown: { pid: string; text: string }[] = round.shown || [];

  const firstRound = (deck: Card[], n: number) => ({
    phase: 'answer',
    card: deck[n - 1] ?? deck[0],
    odd_pid: pickOne(party.active.map((p) => p.id)),
    ends_at: party.deadline(answerTime),
  });

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 5, 1, 50);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=horssujet&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: Card[] = data?.items || [];
    if (!deck.length) { toast.error('Impossible de charger les questions.'); return; }
    await party.startGame(deck, firstRound(deck, 1), deck.length);
  };

  // Answers in (or time up): everyone sees every answer and the real question, then debates and votes.
  const allAnswered = active.length > 0 && active.every((p) => answers[p.id]);
  useHostStep(party, `${gid}:${roundNo}:answer-end`, phase === 'answer' && (party.expired || allAnswered), async () => {
    const list = party.active.map((p) => ({ pid: p.id, text: String(answers[p.id]?.text || '').trim().slice(0, 60) }));
    if (oddId && !list.some((e) => e.pid === oddId)) list.push({ pid: oddId, text: String(answers[oddId]?.text || '').trim() });
    await party.setRound({ phase: 'vote', card, odd_pid: oddId, shown: list, ends_at: party.deadline(voteTime) });
  });

  const allVoted = active.length > 0 && active.every((p) => votes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const counts: Record<string, number> = {};
    for (const [voter, v] of Object.entries(votes)) if (v?.pid && v.pid !== voter) counts[v.pid] = (counts[v.pid] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    const caught = max > 0 && leaders.length === 1 && leaders[0] === oddId;
    const gains: Scores = {};
    for (const [voter, v] of Object.entries(votes)) if (voter !== oddId && v?.pid === oddId) gains[voter] = 100;
    if (!caught && oddId) gains[oddId] = 200;
    await party.setRound({
      phase: 'results', card, odd_pid: oddId, shown, counts, caught, gains,
      voters: votes, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME),
    });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstRound(party.deck || [], roundNo + 1));
  });

  const isOdd = !!playerId && playerId === oddId;
  const answered = !!sentAnswer || (!!playerId && !!answers[playerId]);
  const myVote = myPick ?? (playerId ? votes[playerId]?.pid : undefined);

  return (
    <PartyShell party={party} title="Hors Sujet" maxTime={phase === 'answer' ? answerTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="Hors Sujet"
          tagline="Un joueur n’a pas eu la même question."
          icon={HelpCircle}
          swatch={SWATCH}
          minPlayers={3}
          onStart={start}
          rules={[
            'Tout le monde reçoit une question… sauf un joueur, qui en reçoit une autre sans le savoir.',
            'Chacun répond en quelques mots.',
            'La vraie question s’affiche avec toutes les réponses : débattez, puis votez pour le hors-sujet.',
            'Trouver le hors-sujet rapporte 100 points. S’il passe entre les mailles, il en gagne 200.',
          ]}
        />
      )}

      {phase === 'answer' && card && (
        <>
          <PromptCard eyebrow={`Ta question · ${card.catLabel ?? 'Manche ' + roundNo}`}>{isOdd ? card.odd : card.q}</PromptCard>
          <p className="text-center text-sm font-bold text-tx-secondary">Réponds court : un mot, un nombre, un nom.</p>
          {answered ? (
            <Waiting text="Réponse envoyée, on attend les autres…" />
          ) : (
            <AnswerInput
              value={draft}
              onChange={setDraft}
              maxLength={60}
              placeholder="Ta réponse…"
              onSubmit={() => { markAnswer(true); party.act('answer', { text: draft.trim() }); vibrate(HAPTIC.MEDIUM); }}
            />
          )}
          <PlayerChips party={party} done={Object.keys(answers)} label="Ont répondu" />
        </>
      )}

      {phase === 'vote' && card && (
        <VoteScreen
          party={party}
          title="Qui est hors sujet ?"
          subtitle={<>La vraie question : « {card.q} ». Débattez, puis votez.</>}
          candidates={shown.map((e) => ({ id: e.pid, title: <OgName name={party.nameOf(e.pid)} />, subtitle: e.text ? `« ${e.text} »` : 'pas de réponse', mine: e.pid === playerId }))}
          myVote={myVote}
          onVote={(pid) => { markPick(pid); party.act('vote', { pid }); vibrate(HAPTIC.SOFT); }}
          votes={Object.fromEntries(Object.entries(votes).map(([voter, v]) => [voter, v?.pid]))}
        />
      )}

      {phase === 'results' && card && (
        <>
          <RevealBanner tone={round.caught ? 'good' : 'bad'} eyebrow={round.caught ? 'Démasqué !' : 'Il vous a eus !'} detail={<>Sa question : « {card.odd} »</>}>
            <OgName name={party.nameOf(oddId)} /> était hors sujet
          </RevealBanner>
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {shown.map((e) => {
              const n = round.counts?.[e.pid] || 0;
              return (
                <div key={e.pid} className={cn('rounded-xl border-[3px] border-brand-border px-3 py-2', e.pid === oddId ? 'bg-accent-primary text-brand-bg' : 'bg-brand-inner')}>
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span className="min-w-0 truncate"><OgName name={party.nameOf(e.pid)} /></span>
                    <span className="shrink-0 font-display">{n} vote{n > 1 ? 's' : ''}</span>
                  </div>
                  <p className="font-display text-lg leading-snug [overflow-wrap:anywhere]">{e.text || '—'}</p>
                </div>
              );
            })}
          </div>
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleurs détecteurs de hors-sujet." />}
    </PartyShell>
  );
}
