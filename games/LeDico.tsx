'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { normalize, shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, PartyShell, PlayerChips, Podium, PromptCard, ResultsScreen, RevealBanner, Screen, SetupScreen, VoteScreen, Waiting, type RoundRow } from './party/ui';

const SWATCH = { fill: '#1FB866', shade: '#158A4B' };
const RESULTS_TIME = 15;
const REAL = 'real';

type Card = { word: string; def: string; catLabel?: string };
type Def = { id: string; text: string };

export default function LeDico({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'ledico');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const writeTime = numSetting(settings, 'writeTime', 60, 15, 300);
  const voteTime = numSetting(settings, 'voteTime', 40, 10, 180);

  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [gid, roundNo]);
  const [sentDef, markDef] = useSent(party, 'write');
  const [myPick, markPick] = useSent<string>(party, 'vote');

  const card: Card | undefined = round.card;
  const fakes = party.latestBy('def', 'write');
  const votes = party.latestBy('vote', 'vote');
  const defs: Def[] = round.defs || [];

  const firstOf = (deck: Card[], n: number) => ({ phase: 'write', card: deck[n - 1] ?? deck[0], ends_at: party.deadline(writeTime) });

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 6, 1, 50);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=ledico&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: Card[] = data?.items || [];
    if (!deck.length) { toast.error('Impossible de charger les mots.'); return; }
    await party.startGame(deck, firstOf(deck, 1), deck.length);
  };

  const allWritten = active.length > 0 && active.every((p) => fakes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:write-end`, phase === 'write' && (party.expired || allWritten), async () => {
    if (!card) return;
    const real = normalize(card.def);
    const list: Def[] = Object.entries(fakes).map(([pid, d]) => ({ id: pid, text: String(d?.text || '').trim().slice(0, 140) })).filter((d) => d.text && normalize(d.text) !== real);
    if (!list.length) {
      await party.setRound({ phase: 'results', card, defs: [{ id: REAL, text: card.def }], counts: {}, voters: {}, gains: {}, ends_at: party.deadline(10) });
      return;
    }
    await party.setRound({ phase: 'vote', card, defs: shuffle([...list, { id: REAL, text: card.def }]), ends_at: party.deadline(voteTime) });
  });

  const allVoted = active.length > 0 && active.every((p) => votes[p.id]);
  useHostStep(party, `${gid}:${roundNo}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const gains: Scores = {};
    const counts: Record<string, number> = {};
    const picked: Record<string, string> = {};
    for (const [voter, v] of Object.entries(votes)) {
      const id = v?.id;
      if (!id || id === voter) continue;
      picked[voter] = id;
      counts[id] = (counts[id] || 0) + 1;
      if (id === REAL) gains[voter] = (gains[voter] || 0) + 200;
      else gains[id] = (gains[id] || 0) + 100;
    }
    await party.setRound({ phase: 'results', card, defs, counts, picked, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  const wrote = !!sentDef || (!!playerId && !!fakes[playerId]);
  const myVote = myPick ?? (playerId ? votes[playerId]?.id : undefined);
  const picked: Record<string, string> = round.picked || {};

  return (
    <PartyShell party={party} title="Le Dico" maxTime={phase === 'write' ? writeTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Le Dico" tagline="Invente une fausse définition, trouve la vraie." icon={BookOpen} swatch={SWATCH} minPlayers={3} onStart={start}
          rules={['Un vrai mot français, rare ou oublié, s’affiche.', 'Chacun invente une définition crédible, en secret.', 'Les définitions sont mélangées avec la vraie : vote pour celle que tu crois juste.', '200 points si tu trouves la vraie, 100 points par joueur piégé par la tienne.']}
        />
      )}

      {phase === 'write' && card && (
        <Screen center>
          <div className="flex w-full max-w-2xl flex-col gap-3">
            <PromptCard eyebrow={card.catLabel ?? 'Le mot'} tone="yellow"><span className="text-3xl sm:text-5xl">{card.word}</span></PromptCard>
            {wrote ? <Waiting text="Définition envoyée, on attend les autres…" /> : (
              <AnswerInput value={draft} onChange={setDraft} maxLength={140} multiline placeholder="Une définition inventée, façon dictionnaire…" submitLabel="Envoyer" onSubmit={() => { markDef(true); party.act('def', { text: draft.trim() }); vibrate(HAPTIC.MEDIUM); }} />
            )}
            <PlayerChips party={party} done={Object.keys(fakes)} label="Écrit" />
          </div>
        </Screen>
      )}

      {phase === 'vote' && card && (
        <VoteScreen
          party={party}
          title={card.word}
          subtitle="Laquelle est la vraie définition ?"
          candidates={defs.map((d, i) => ({ id: d.id, title: <span className="font-sans text-base font-bold">{String.fromCharCode(65 + i)}. {d.text}</span>, mine: d.id === playerId }))}
          myVote={myVote}
          onVote={(id) => { markPick(id); party.act('vote', { id }); vibrate(HAPTIC.SOFT); }}
          votes={{}}
          voted={Object.keys(votes)}
          voters={active.map((p) => p.id)}
        />
      )}

      {phase === 'results' && card && (
        <ResultsScreen
          party={party}
          reveal={<RevealBanner tone="good" eyebrow={`La vraie définition de « ${card.word} »`}><span className="text-lg sm:text-2xl">{card.def}</span></RevealBanner>}
          rows={Object.fromEntries(party.seated.map((p) => {
            const mine = defs.find((d) => d.id === p.id);
            const fooled = round.counts?.[p.id] || 0;
            return [p.id, { ok: picked[p.id] === REAL, answer: mine ? `« ${mine.text} »` : 'pas de définition', note: `${fooled} piégé${fooled > 1 ? 's' : ''}` } as RoundRow];
          }))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Mot suivant'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les plus grands menteurs du dictionnaire." />}
    </PartyShell>
  );
}
