'use client';

import { useEffect, useState } from 'react';
import { Crown, HelpCircle, Shield, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { normalize, shuffle, pickOne } from '@/lib/party/text';
import { addScores, numSetting, useHostStep, usePartyGame, type Scores } from './party/usePartyGame';
import {
  AnswerInput, AnswerList, NextStep, PartyShell, Podium, PromptCard, ReadyScreen, RecapPanel, RevealBanner, ScoreList, SecretCard, SetupScreen, VoteScreen, Waiting,
} from './party/ui';

type Role = 'MASTER' | 'INFILTRE' | 'CITIZEN';
type Answer = 'OUI' | 'NON' | 'NSP';
type Card = { secretWord: string; category: string };

const SWATCH = { fill: '#1FB866', shade: '#158A4B' };
const RESULTS_TIME = 15;
const ROLE_LABEL: Record<Role, string> = { MASTER: 'Maître du jeu', INFILTRE: 'Infiltré', CITIZEN: 'Citoyen' };
const ANSWER_LABEL: Record<Answer, string> = { OUI: 'Oui', NON: 'Non', NSP: 'Je ne sais pas' };

export default function Infiltre({ roomCode }: { roomCode: string }) {
  const party = usePartyGame(roomCode, 'infiltre');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid, stage } = party;
  const askTime = numSetting(settings, 'guessTime', 5, 1, 15) * 60;
  const voteTime = numSetting(settings, 'voteTime', 30, 10, 180);

  const card: Card | undefined = round.card;
  const roles: Record<string, Role> = round.roles || {};
  const master = Object.keys(roles).find((id) => roles[id] === 'MASTER');
  const myRole = playerId ? roles[playerId] : undefined;
  const isMaster = myRole === 'MASTER';
  const here = (id: string) => active.some((p) => p.id === id);

  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [gid, roundNo]);

  /* ---------------- data ---------------- */
  const questions = party.movesIn('questions', 'q').map((m) => ({ id: m.id, pid: m.player_id, text: String(m.payload?.text || '').slice(0, 140) }));
  const answers: Record<string, Answer> = {};
  for (const m of party.movesIn('questions', 'a')) if (m.player_id === master && m.payload?.qid) answers[m.payload.qid] = m.payload.answer;
  const found = party.movesIn('questions', 'found').find((m) => m.player_id === master);
  const ready = Object.keys(party.latestBy('ready', 'roles'));
  const voters = Object.keys(roles).filter((id) => id !== master && here(id));
  const votes: Record<string, string> = {};
  for (const [voter, v] of Object.entries(party.latestBy('vote', 'vote', stage))) if (voter !== master && v?.pid) votes[voter] = v.pid;

  const looksLikeWord = (text: string) => {
    if (!card) return false;
    const w = normalize(card.secretWord);
    return normalize(text).split(' ').some((t) => t.length > 2 && (t === w || (w.length > 4 && t.startsWith(w.slice(0, -1)))));
  };

  /* ---------------- host ---------------- */
  const roundOf = (deck: Card[], n: number) => {
    const ids = shuffle(party.active.map((p) => p.id));
    const m = pickOne(ids);
    const rest = ids.filter((id) => id !== m);
    const inf = pickOne(rest);
    const r: Record<string, Role> = {};
    for (const id of ids) r[id] = id === m ? 'MASTER' : id === inf ? 'INFILTRE' : 'CITIZEN';
    return { phase: 'roles', card: deck[n - 1], roles: r, stage: 0 };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', 3, 1, 10);
    const cat = encodeURIComponent(String(settings.category || 'all'));
    const picks = await Promise.all(Array.from({ length: rounds }, () => fetch(`/api/games/infiltre?category=${cat}`).then((r) => r.json()).catch(() => null)));
    const deck: Card[] = picks.filter((c) => c?.secretWord);
    if (!deck.length) { toast.error('Impossible de charger les mots.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const finish = async (winner: 'CITIZENS' | 'INFILTRE' | 'NONE') => {
    const gains: Scores = {};
    for (const [pid, role] of Object.entries(roles)) {
      if (winner === 'CITIZENS') gains[pid] = role === 'CITIZEN' ? 200 : role === 'MASTER' ? 100 : 0;
      if (winner === 'INFILTRE' && role === 'INFILTRE') gains[pid] = 300;
      if (!gains[pid]) delete gains[pid];
    }
    await party.patchRound({ phase: 'results', winner, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  };

  const allReady = Object.keys(roles).filter(here).every((id) => ready.includes(id));
  useHostStep(party, `${gid}:${roundNo}:ready`, phase === 'roles' && Object.keys(roles).length > 0 && allReady, async () => {
    await party.patchRound({ phase: 'questions', ends_at: party.deadline(askTime) });
  });

  useHostStep(party, `${gid}:${roundNo}:questions-end`, phase === 'questions' && (!!found || party.expired), async () => {
    if (!found) return finish('NONE');
    await party.patchRound({ phase: 'vote', finder: found.payload?.pid, stage: stage + 1, lastChance: false, ends_at: party.deadline(voteTime) });
  });

  const allVoted = voters.length > 0 && voters.every((id) => votes[id]);
  useHostStep(party, `${gid}:${roundNo}:${stage}:vote-end`, phase === 'vote' && (party.expired || allVoted), async () => {
    const counts: Record<string, number> = {};
    for (const [voter, target] of Object.entries(votes)) if (target !== voter) counts[target] = (counts[target] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const leaders = Object.keys(counts).filter((id) => counts[id] === max);
    if (max > 0 && leaders.length === 1 && roles[leaders[0]] === 'INFILTRE') return finish('CITIZENS');
    if (!round.lastChance && voters.length > 2) return party.patchRound({ stage: stage + 1, lastChance: true, ends_at: party.deadline(voteTime) });
    await finish('INFILTRE');
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: Card[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  /* ---------------- render ---------------- */
  const secret = myRole && (
    <SecretCard
      label="Ton rôle"
      role={{ text: ROLE_LABEL[myRole], tone: myRole === 'INFILTRE' ? 'bad' : myRole === 'MASTER' ? 'neutral' : 'good' }}
      secret={myRole === 'CITIZEN' ? 'Trouve le mot secret' : card?.secretWord}
    />
  );

  const feed = (
    <ul className="space-y-2">
      {questions.length === 0 && <li className="text-center font-bold text-tx-secondary">Pas encore de question.</li>}
      {[...questions].reverse().map((q) => {
        const a = answers[q.id];
        const hint = isMaster && !a && looksLikeWord(q.text);
        return (
          <li key={q.id} className={cn('rounded-xl border-[3px] px-3 py-2', hint ? 'border-accent-primary bg-brand-card' : 'border-brand-border bg-brand-inner')}>
            <p className="text-xs font-black uppercase tracking-widest text-tx-secondary"><OgName name={party.nameOf(q.pid)} /></p>
            <p className="font-bold [overflow-wrap:anywhere]">{q.text}</p>
            {a ? (
              <span className={cn('mt-1 inline-flex rounded-md border-2 border-brand-border px-2 py-0.5 font-display text-sm', a === 'OUI' ? 'bg-accent-success text-brand-bg' : a === 'NON' ? 'bg-accent-secondary text-white' : 'bg-brand-card')}>{ANSWER_LABEL[a]}</span>
            ) : isMaster && phase === 'questions' ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button onClick={() => party.act('a', { qid: q.id, answer: 'OUI' })} className={cn(BRAWL.green, 'h-11 rounded-xl text-sm')}><ThumbsUp className="h-4 w-4" /> Oui</button>
                <button onClick={() => party.act('a', { qid: q.id, answer: 'NON' })} className={cn(BRAWL.pink, 'h-11 rounded-xl text-sm')}><ThumbsDown className="h-4 w-4" /> Non</button>
                <button onClick={() => party.act('a', { qid: q.id, answer: 'NSP' })} className={cn(BRAWL.dark, 'h-11 rounded-xl text-sm')}><HelpCircle className="h-4 w-4" /> NSP</button>
                {hint && (
                  <button onClick={() => party.act('found', { pid: q.pid })} className={cn(BRAWL.yellow, 'col-span-3 h-11 rounded-xl text-sm')}>
                    <Crown className="h-4 w-4" /> <OgName name={party.nameOf(q.pid)} /> a trouvé le mot
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm font-bold italic text-tx-muted">En attente du maître…</p>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <PartyShell party={party} title="L’Infiltré" maxTime={phase === 'questions' ? askTime : phase === 'vote' ? voteTime : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="L’Infiltré"
          tagline="Démasquez l’intrus parmi vous."
          icon={Shield}
          swatch={SWATCH}
          minPlayers={4}
          onStart={start}
          rules={[
            'Le maître du jeu et l’infiltré connaissent le mot secret. Les citoyens non.',
            'Les citoyens posent des questions, le maître répond par oui, non ou je ne sais pas.',
            'Quand quelqu’un trouve le mot, tout le monde vote pour démasquer l’infiltré (deux essais).',
            'Démasqué : les citoyens gagnent. Sinon, l’infiltré gagne. Personne ne trouve le mot : tout le monde perd.',
          ]}
        />
      )}

      {phase === 'roles' && (
        myRole ? (
          <ReadyScreen party={party} ready={ready} onReady={() => party.act('ready')}>
            <PromptCard eyebrow={`Manche ${roundNo}/${totalRounds} · ${card?.category ?? ''}`}>Découvre ton rôle en secret</PromptCard>
            {secret}
          </ReadyScreen>
        ) : <Waiting text="Tu regardes cette manche." />
      )}

      {phase === 'questions' && (
        <>
          {secret}
          <PromptCard eyebrow={`Maître du jeu : ${party.nameOf(master)}`}>{card?.category ? `Thème : ${card.category}` : 'Trouvez le mot secret'}</PromptCard>
          {isMaster ? (
            <div className={cn(BRAWL.panel, 'w-full p-3')}>
              <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-tx-secondary">Quelqu’un a trouvé le mot ?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.keys(roles).filter((id) => id !== master).map((id) => (
                  <button key={id} onClick={() => party.act('found', { pid: id })} className={cn(BRAWL.dark, 'h-10 rounded-xl px-3 text-sm')}>
                    <Crown className="h-4 w-4 text-accent-primary" /> <OgName name={party.nameOf(id)} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AnswerInput value={draft} onChange={setDraft} maxLength={140} placeholder="Pose une question fermée…" submitLabel="Demander" onSubmit={() => { party.act('q', { text: draft.trim() }); setDraft(''); vibrate(HAPTIC.SOFT); }} />
          )}
          <RecapPanel title="Questions">{feed}</RecapPanel>
        </>
      )}

      {phase === 'vote' && card && (
        <VoteScreen
          party={party}
          title={round.lastChance ? 'Dernière chance : qui est l’infiltré ?' : 'Qui est l’infiltré ?'}
          subtitle={<><OgName name={party.nameOf(round.finder)} /> a trouvé le mot « {card.secretWord} ».</>}
          recap={<RecapPanel title="Questions">{feed}</RecapPanel>}
          candidates={Object.keys(roles).filter((id) => id !== master).map((id) => ({ id, title: <OgName name={party.nameOf(id)} />, subtitle: id === round.finder ? 'A trouvé le mot' : undefined, mine: id === playerId }))}
          myVote={playerId ? votes[playerId] : undefined}
          onVote={!isMaster && myRole ? (pid) => { party.act('vote', { pid }); vibrate(HAPTIC.SOFT); } : undefined}
          votes={votes}
          voters={voters}
          cantVoteText="Le maître du jeu ne vote pas."
        />
      )}

      {phase === 'results' && card && (
        <>
          <RevealBanner
            tone={round.winner === 'CITIZENS' ? 'good' : 'bad'}
            eyebrow="Fin de la manche"
            detail={`Le mot secret : « ${card.secretWord} »`}
          >
            {round.winner === 'CITIZENS' ? 'Victoire des citoyens' : round.winner === 'INFILTRE' ? 'Victoire de l’infiltré' : 'Temps écoulé : personne ne gagne'}
          </RevealBanner>
          <AnswerList party={party} title="Rôles" rows={Object.entries(roles).map(([pid, role]) => ({ pid, answer: ROLE_LABEL[role], ok: !!round.gains?.[pid], points: round.gains?.[pid] }))} />
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les meilleurs enquêteurs." />}
    </PartyShell>
  );
}
