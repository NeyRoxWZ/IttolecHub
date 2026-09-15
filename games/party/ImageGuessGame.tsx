'use client';

import { ReactNode, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { isCloseEnough } from '@/lib/party/text';
import { addScores, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './usePartyGame';
import { AnswerInput, AnswerList, NextStep, PartyShell, PlayerChips, Podium, RevealBanner, ScoreList, SetupScreen, type Swatch } from './ui';

/**
 * Guess what the picture shows, typed, as fast as possible: PokéGuessr,
 * FlagGuessr, LogoGuessr. Wrong guesses cost nothing; the sooner you find it,
 * the more you score, and the first to find it gets a bonus.
 */

export interface GuessCard {
  id: string | number;
  /** Every accepted answer (a Pokémon in several languages). */
  answers: string[];
  /** The answer shown at the end of the round. */
  reveal: string;
  detail?: string;
  [key: string]: unknown;
}

export interface ImageGuessConfig {
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
  loadDeck: (settings: Record<string, any>, rounds: number) => Promise<GuessCard[]>;
  renderMedia: (card: GuessCard, state: { playing: boolean; progress: number; settings: Record<string, any> }) => ReactNode;
}

const RESULTS_TIME = 8;
const FIRST_BONUS = 100;

/** 1000 points in the first two seconds, down to 100 at the buzzer. */
export const speedPoints = (sec: number, total: number) =>
  Math.max(100, Math.round(1000 - 900 * Math.min(1, Math.max(0, sec - 2) / Math.max(1, total - 2))));

export default function ImageGuessGame({ roomCode, config }: { roomCode: string; config: ImageGuessConfig }) {
  const party = usePartyGame(roomCode, config.gameType);
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const time = numSetting(settings, 'time', config.defaultTime, 5, 300);

  const card: GuessCard | undefined = round.card;
  const startedAt: number = round.started_at || 0;
  const progress = phase === 'guess' && round.ends_at ? Math.min(1, Math.max(0, 1 - (round.ends_at - party.serverTime()) / (time * 1000))) : 1;

  const [draft, setDraft] = useState('');
  const [misses, setMisses] = useState(0);
  useEffect(() => { setDraft(''); setMisses(0); }, [gid, roundNo]);
  const [foundLocal, markFound] = useSent(party, 'guess');

  const foundAt: Record<string, string> = {};
  for (const m of party.movesIn('guess', 'found')) if (!foundAt[m.player_id]) foundAt[m.player_id] = m.created_at;
  const iFound = !!foundLocal || (!!playerId && !!foundAt[playerId]);

  const roundOf = (deck: GuessCard[], n: number) => {
    const now = party.serverTime();
    return { phase: 'guess', card: deck[n - 1], started_at: now, ends_at: now + time * 1000 };
  };

  const start = async () => {
    const rounds = numSetting(settings, 'rounds', config.defaultRounds, 1, 50);
    let deck: GuessCard[] = [];
    try { deck = await config.loadDeck(settings, rounds); } catch { deck = []; }
    if (!deck.length) { toast.error('Impossible de charger la partie. Réessaie.'); return; }
    await party.startGame(deck, roundOf(deck, 1), deck.length);
  };

  const guess = () => {
    if (!card || iFound) return;
    const ok = card.answers.some((a) => isCloseEnough(draft, a));
    setDraft('');
    if (!ok) { setMisses((n) => n + 1); vibrate(HAPTIC.ERROR); return; }
    markFound(true);
    party.act('found');
    vibrate(HAPTIC.SUCCESS);
  };

  const allFound = active.length > 0 && active.every((p) => foundAt[p.id]);
  useHostStep(party, `${gid}:${roundNo}:guess-end`, phase === 'guess' && (party.expired || allFound), async () => {
    const gains: Scores = {};
    const finds: { pid: string; sec: number }[] = [];
    Object.entries(foundAt)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([pid, at], i) => {
        const sec = Math.max(0, (Date.parse(at) - startedAt) / 1000);
        gains[pid] = speedPoints(sec, time) + (i === 0 ? FIRST_BONUS : 0);
        finds.push({ pid, sec: Math.round(sec * 10) / 10 });
      });
    await party.setRound({ phase: 'results', card, started_at: startedAt, finds, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    const deck: GuessCard[] = party.deck || [];
    if (roundNo >= totalRounds || !deck[roundNo]) return party.endGame();
    await party.goToRound(roundNo + 1, roundOf(deck, roundNo + 1));
  });

  const finds: { pid: string; sec: number }[] = round.finds || [];

  return (
    <PartyShell party={party} title={config.title} maxTime={phase === 'guess' ? time : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen party={party} title={config.title} tagline={config.tagline} icon={config.icon} swatch={config.swatch} minPlayers={1} onStart={start} rules={config.rules} />
      )}

      {phase === 'guess' && card && (
        <>
          {config.renderMedia(card, { playing: true, progress, settings })}
          {iFound ? (
            <RevealBanner tone="good" eyebrow="Bien joué">Trouvé !</RevealBanner>
          ) : (
            <div className="w-full space-y-2">
              <AnswerInput value={draft} onChange={setDraft} onSubmit={guess} placeholder={config.placeholder} maxLength={60} submitLabel="Proposer" />
              {misses > 0 && <p key={misses} className="text-center font-bold text-accent-secondary animate-in fade-in">Raté, essaie encore</p>}
            </div>
          )}
          <PlayerChips party={party} done={Object.keys(foundAt)} label="Ont trouvé" />
        </>
      )}

      {phase === 'results' && card && (
        <>
          {config.renderMedia(card, { playing: false, progress: 1, settings })}
          <RevealBanner tone={finds.length ? 'good' : 'bad'} eyebrow="C’était" detail={card.detail}>{card.reveal}</RevealBanner>
          <AnswerList
            party={party}
            title="Qui a trouvé"
            rows={party.seated.map((p) => {
              const f = finds.find((x) => x.pid === p.id);
              return { pid: p.id, ok: !!f, note: f ? `en ${f.sec} s` : 'pas trouvé', points: round.gains?.[p.id] };
            })}
          />
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Manche suivante'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor={config.flavor} />}
    </PartyShell>
  );
}
