'use client';

import { ReactNode, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './usePartyGame';
import { AnswerInput, AnswerList, NextStep, PartyShell, PlayerChips, Podium, RevealBanner, ScoreList, SetupScreen, type Swatch } from './ui';

/**
 * Estimate a number, closest wins: BudgetGuessr (a film's budget),
 * RentGuessr (a flat's rent). An estimate can be changed until the clock
 * runs out; points go by how close it lands, with a bonus for being quick.
 */

export interface EstimateCard { id: string | number; value: number; [key: string]: unknown }

export interface EstimateConfig {
  gameType: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  swatch: Swatch;
  rules: string[];
  defaultTime: number;
  defaultRounds: number;
  flavor: string;
  placeholder: string;
  prefix: ReactNode;
  /** What the player types, in the unit shown (millions of dollars, euros). */
  unitOf: (typed: number) => number;
  format: (value: number) => string;
  loadDeck: (settings: Record<string, any>, rounds: number) => Promise<EstimateCard[]>;
  renderCard: (card: EstimateCard, revealed: boolean) => ReactNode;
}

const RESULTS_TIME = 12;

export function closenessPoints(diffPercent: number, sec: number) {
  let pts = diffPercent < 5 ? 1000 : diffPercent < 15 ? 700 : diffPercent < 30 ? 400 : diffPercent < 50 ? 200 : 0;
  if (pts > 0 && sec <= 10) pts += 200;
  return pts;
}

export default function EstimateGame({ roomCode, config }: { roomCode: string; config: EstimateConfig }) {
  const party = usePartyGame(roomCode, config.gameType);
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const time = numSetting(settings, 'time', config.defaultTime, 5, 300);
  const card: EstimateCard | undefined = round.card;
  const startedAt: number = round.started_at || 0;

  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [gid, roundNo]);
  const [sent, markSent] = useSent<number>(party, 'estimate');

  const estimates: Record<string, { value: number; at: string }> = {};
  for (const m of party.movesIn('estimate', 'estimate')) {
    const v = Number(m.payload?.value);
    if (Number.isFinite(v) && v > 0) estimates[m.player_id] = { value: v, at: m.created_at };
  }
  const mine = sent ?? (playerId ? estimates[playerId]?.value : undefined);

  const roundOf = (deck: EstimateCard[], n: number) => {
    const now = party.serverTime();
    return { phase: 'estimate', card: deck[n - 1], started_at: now, ends_at: now + time * 1000 };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', config.defaultRounds, 1, 30);
    let deck: EstimateCard[] = [];
    try { deck = await config.loadDeck(settings, rounds); } catch { deck = []; }
    if (!deck.length) { toast.error('Impossible de charger la partie. Réessaie.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const submit = () => {
    const typed = Number(draft.replace(/\s/g, ''));
    if (!Number.isFinite(typed) || typed <= 0) return;
    const value = config.unitOf(typed);
    markSent(value);
    party.act('estimate', { value });
    vibrate(HAPTIC.MEDIUM);
    setDraft('');
  };

  const allIn = active.length > 0 && active.every((p) => estimates[p.id]);
  useHostStep(party, `${gid}:${roundNo}:estimate-end`, phase === 'estimate' && (party.expired || allIn), async () => {
    if (!card) return;
    const gains: Scores = {};
    const results = Object.entries(estimates).map(([pid, e]) => {
      const diff = (Math.abs(e.value - card.value) / card.value) * 100;
      const sec = Math.max(0, (Date.parse(e.at) - startedAt) / 1000);
      const pts = closenessPoints(diff, sec);
      if (pts) gains[pid] = pts;
      return { pid, value: e.value, diff: Math.round(diff * 10) / 10 };
    }).sort((a, b) => a.diff - b.diff);
    await party.setRound({ phase: 'results', card, started_at: startedAt, results, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: EstimateCard[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  const results: { pid: string; value: number; diff: number }[] = round.results || [];

  return (
    <PartyShell party={party} title={config.title} maxTime={phase === 'estimate' ? time : RESULTS_TIME} wide>
      {phase === 'setup' && (
        <SetupScreen party={party} title={config.title} tagline={config.tagline} icon={config.icon} swatch={config.swatch} minPlayers={1} onStart={start} rules={config.rules} />
      )}

      {phase === 'estimate' && card && (
        <>
          {config.renderCard(card, false)}
          <div className="w-full max-w-xl space-y-2">
            <AnswerInput value={draft} onChange={setDraft} onSubmit={submit} placeholder={config.placeholder} maxLength={12} numeric prefix={config.prefix} submitLabel={mine ? 'Changer' : 'Valider'} autoFocus={false} />
            {mine !== undefined && <p className="text-center font-bold text-accent-success">Ton estimation : {config.format(mine)} (tu peux la changer)</p>}
          </div>
          <PlayerChips party={party} done={Object.keys(estimates)} label="Ont estimé" />
        </>
      )}

      {phase === 'results' && card && (
        <>
          {config.renderCard(card, true)}
          <RevealBanner tone={results.length && results[0].diff < 15 ? 'good' : 'neutral'} eyebrow="La vraie réponse">{config.format(card.value)}</RevealBanner>
          <AnswerList
            party={party}
            title="Estimations"
            rows={results.map((r) => ({ pid: r.pid, answer: config.format(r.value), ok: r.diff < 30, note: `écart de ${r.diff} %`, points: round.gains?.[r.pid] }))}
          />
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor={config.flavor} />}
    </PartyShell>
  );
}
