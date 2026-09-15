'use client';

import { useEffect, useState } from 'react';
import { Laugh } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, ChoiceButton, NextStep, PartyShell, PlayerChips, Podium, PromptCard, ScoreList, SetupScreen, Waiting } from './party/ui';

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

  // Everyone answered, or time is up: the answers go to the vote, anonymously.
  const allAnswered = active.length > 0 && active.every((p) => answers[p.id]);
  useHostStep(party, `${gid}:${roundNo}:answer-end`, phase === 'answer' && (party.expired || allAnswered), async () => {
    const list: Entry[] = shuffle(
      Object.entries(answers)
        .map(([pid, a]) => ({ pid, text: String(a?.text || '').trim().slice(0, 90) }))
        .filter((e) => e.text),
    );
    if (list.length < 2) {
      await party.setRound({ phase: 'results', prompt: round.prompt, entries: list, gains: {}, best: 0, skipped: true, ends_at: party.deadline(8) });
      return;
    }
    await party.setRound({ phase: 'vote', prompt: round.prompt, entries: list, ends_at: party.deadline(voteTime) });
  });

  // Everyone who can vote did, or time is up: count.
  const canVote = (pid: string) => entries.some((e) => e.pid !== pid);
  const allVoted = active.every((p) => votes[p.id] || !canVote(p.id));
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const tally = entries.map((e) => ({
      ...e,
      votes: Object.entries(votes).filter(([voter, v]) => v?.pid === e.pid && voter !== e.pid).map(([voter]) => voter),
    }));
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

  return (
    <PartyShell party={party} title="Punchline" maxTime={phase === 'answer' ? answerTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="Punchline"
          tagline="La réponse la plus drôle gagne."
          icon={Laugh}
          swatch={SWATCH}
          minPlayers={3}
          onStart={start}
          rules={[
            'Tout le monde reçoit la même question.',
            'Chacun écrit sa réponse la plus drôle, en secret.',
            'Vote anonyme pour ta réponse préférée (pas la tienne).',
            '100 points par vote reçu, 100 de bonus pour la punchline du tour.',
          ]}
        />
      )}

      {phase === 'answer' && (
        <>
          <PromptCard eyebrow={`Question ${roundNo}/${totalRounds}`}>{round.prompt}</PromptCard>
          {answered ? (
            <Waiting text="Réponse envoyée, on attend les autres…" />
          ) : (
            <AnswerInput
              value={draft}
              onChange={setDraft}
              maxLength={90}
              placeholder="Ta punchline…"
              submitLabel="Envoyer"
              onSubmit={() => { markAnswer(true); party.act('answer', { text: draft.trim() }); vibrate(HAPTIC.MEDIUM); }}
            />
          )}
          <PlayerChips party={party} done={Object.keys(answers)} label="Ont répondu" />
        </>
      )}

      {phase === 'vote' && (
        <>
          <PromptCard eyebrow="Vote pour la meilleure">{round.prompt}</PromptCard>
          <div className="grid w-full gap-3 sm:grid-cols-2">
            {entries.map((e) => {
              const mine = e.pid === playerId;
              return (
                <ChoiceButton
                  key={e.pid}
                  selected={myVote === e.pid}
                  disabled={mine}
                  onClick={() => { markPick(e.pid); party.act('vote', { pid: e.pid }); vibrate(HAPTIC.SOFT); }}
                  className={cn('min-h-[76px] text-lg leading-snug', mine && 'opacity-60')}
                >
                  {e.text}
                  {mine && <span className="mt-1 block text-xs font-black uppercase tracking-widest opacity-80">Ta réponse</span>}
                </ChoiceButton>
              );
            })}
          </div>
          <PlayerChips party={party} done={Object.keys(votes)} label="Ont voté" />
        </>
      )}

      {phase === 'results' && (
        <>
          <PromptCard eyebrow="Résultats">{round.prompt}</PromptCard>
          {round.skipped && <p className="font-bold text-tx-secondary">Pas assez de réponses pour voter cette fois.</p>}
          <div className="w-full space-y-3">
            {[...entries].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).map((e) => {
              const n = e.votes?.length || 0;
              const top = round.best > 0 && n === round.best;
              return (
                <div key={e.pid} className={cn('rounded-2xl border-[3px] border-brand-border p-4 shadow-[0_4px_0_#05061A]', top ? 'bg-accent-primary text-brand-bg' : 'bg-brand-inner')}>
                  <p className="font-display text-xl leading-snug [overflow-wrap:anywhere]">{e.text}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-sm font-bold">
                    <span className="min-w-0 truncate">par <OgName name={party.nameOf(e.pid)} /></span>
                    <span className="shrink-0 font-display text-lg">{n} vote{n > 1 ? 's' : ''}</span>
                  </div>
                  {n > 0 && (
                    <p className={cn('mt-1 text-xs font-bold', top ? 'text-brand-bg/80' : 'text-tx-secondary')}>
                      {e.votes!.map((v) => party.nameOf(v)).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Question suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les plus drôles de la soirée." />}
    </PartyShell>
  );
}
