'use client';

import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { normalize, shuffle } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, ChoiceButton, NextStep, PartyShell, PlayerChips, Podium, PromptCard, ScoreList, SetupScreen, Waiting } from './party/ui';

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
    const list: Def[] = Object.entries(fakes)
      .map(([pid, d]) => ({ id: pid, text: String(d?.text || '').trim().slice(0, 140) }))
      // A fake that is the real definition word for word would give it away twice.
      .filter((d) => d.text && normalize(d.text) !== real);
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
    const voters: Record<string, string[]> = {};
    for (const [voter, v] of Object.entries(votes)) {
      const id = v?.id;
      if (!id || id === voter) continue;
      counts[id] = (counts[id] || 0) + 1;
      (voters[id] ||= []).push(voter);
      if (id === REAL) gains[voter] = (gains[voter] || 0) + 200;
      else gains[id] = (gains[id] || 0) + 100;
    }
    await party.setRound({ phase: 'results', card, defs, counts, voters, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  const wrote = !!sentDef || (!!playerId && !!fakes[playerId]);
  const myVote = myPick ?? (playerId ? votes[playerId]?.id : undefined);
  const wordCard = card && (
    <PromptCard eyebrow={card.catLabel ?? 'Le mot'} tone="yellow">
      <span className="text-4xl md:text-6xl">{card.word}</span>
    </PromptCard>
  );

  return (
    <PartyShell party={party} title="Le Dico" maxTime={phase === 'write' ? writeTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="Le Dico"
          tagline="Invente une fausse définition, trouve la vraie."
          icon={BookOpen}
          swatch={SWATCH}
          minPlayers={3}
          onStart={start}
          rules={[
            'Un vrai mot français, rare ou oublié, s’affiche.',
            'Chacun invente une définition crédible, en secret.',
            'Toutes les définitions sont mélangées avec la vraie : vote pour celle que tu crois juste.',
            '200 points si tu trouves la vraie, 100 points par joueur piégé par ta définition.',
          ]}
        />
      )}

      {phase === 'write' && card && (
        <>
          {wordCard}
          {wrote ? (
            <Waiting text="Définition envoyée, on attend les autres…" />
          ) : (
            <AnswerInput
              value={draft}
              onChange={setDraft}
              maxLength={140}
              multiline
              placeholder="Définition inventée, façon dictionnaire…"
              submitLabel="Envoyer"
              onSubmit={() => { markDef(true); party.act('def', { text: draft.trim() }); vibrate(HAPTIC.MEDIUM); }}
            />
          )}
          <PlayerChips party={party} done={Object.keys(fakes)} label="Ont écrit" />
        </>
      )}

      {phase === 'vote' && card && (
        <>
          {wordCard}
          <p className="text-center font-bold text-tx-secondary">Laquelle est la vraie définition ?</p>
          <div className="w-full space-y-3">
            {defs.map((d, i) => {
              const mine = d.id === playerId;
              return (
                <ChoiceButton
                  key={d.id}
                  selected={myVote === d.id}
                  disabled={mine}
                  onClick={() => { markPick(d.id); party.act('vote', { id: d.id }); vibrate(HAPTIC.SOFT); }}
                  className={cn('flex items-start gap-3 text-base md:text-lg', mine && 'opacity-60')}
                >
                  <span className="font-display text-xl">{String.fromCharCode(65 + i)}.</span>
                  <span className="flex-1">
                    {d.text}
                    {mine && <span className="mt-1 block text-xs font-black uppercase tracking-widest opacity-80">Ta définition</span>}
                  </span>
                </ChoiceButton>
              );
            })}
          </div>
          <PlayerChips party={party} done={Object.keys(votes)} label="Ont voté" />
        </>
      )}

      {phase === 'results' && card && (
        <>
          {wordCard}
          <div className="w-full space-y-3">
            {[...defs].sort((a, b) => (a.id === REAL ? -1 : b.id === REAL ? 1 : (round.counts?.[b.id] || 0) - (round.counts?.[a.id] || 0))).map((d) => {
              const n = round.counts?.[d.id] || 0;
              const real = d.id === REAL;
              return (
                <div key={d.id} className={cn('rounded-2xl border-[3px] border-brand-border p-4 shadow-[0_4px_0_#05061A]', real ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner')}>
                  <p className="text-xs font-black uppercase tracking-widest opacity-80">
                    {real ? 'La vraie définition' : <>Inventée par <OgName name={party.nameOf(d.id)} /></>}
                  </p>
                  <p className="mt-1 font-bold text-lg leading-snug">{d.text}</p>
                  <p className="mt-1 text-sm font-bold opacity-80">
                    {n} vote{n > 1 ? 's' : ''}{n > 0 && ` : ${(round.voters?.[d.id] || []).map((v: string) => party.nameOf(v)).join(', ')}`}
                  </p>
                </div>
              );
            })}
          </div>
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Mot suivant'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les plus grands menteurs du dictionnaire." />}
    </PartyShell>
  );
}
