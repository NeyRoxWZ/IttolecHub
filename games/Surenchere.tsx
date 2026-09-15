'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gavel, Minus, Plus, ThumbsDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { normalize } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, NextStep, PartyShell, PlayerChips, Podium, PromptCard, ScoreList, SetupScreen, Waiting } from './party/ui';

const SWATCH = { fill: '#3B6BFF', shade: '#2A4FC4' };
const REVIEW_TIME = 30;
const RESULTS_TIME = 12;
const MAX_BID = 40;

type Card = { text: string; catLabel?: string };

export default function Surenchere({ params }: { params: { code: string } }) {
  const party = usePartyGame(params.code, 'surenchere');
  const { round, phase, settings, playerId, active, roundNo, totalRounds, gid } = party;
  const bidTime = numSetting(settings, 'bidTime', 20, 5, 120);
  const proveTime = numSetting(settings, 'proveTime', 45, 10, 300);

  const card: Card | undefined = round.card;
  const bidder: string | undefined = round.bidder;
  const bid: number = round.bid || 0;
  const isBidder = !!playerId && playerId === bidder;
  const reviewers = active.filter((p) => p.id !== bidder);

  const [amount, setAmount] = useState(5);
  const [draft, setDraft] = useState('');
  useEffect(() => { setAmount(5); setDraft(''); }, [gid, roundNo]);
  const [myBid, markBid] = useSent<number>(party, 'bid');

  const bids = party.latestBy('bid', 'bid');

  // The bidder's list, live, without repeats.
  const proveMoves = party.movesIn('prove');
  const liveItems = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of proveMoves) {
      if (m.action_type !== 'item' || m.player_id !== bidder) continue;
      const text = String(m.payload?.text || '').trim().slice(0, 60);
      const key = normalize(text);
      if (!text || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }, [proveMoves, bidder]);
  const bidderDone = proveMoves.some((m) => m.action_type === 'done' && m.player_id === bidder);

  const items: string[] = round.items || [];
  const vetoes = useMemo(() => {
    const byPlayer: Record<string, Record<number, boolean>> = {};
    for (const m of party.movesIn('review', 'veto')) {
      if (m.player_id === bidder) continue;
      (byPlayer[m.player_id] ||= {})[Number(m.payload?.i)] = !!m.payload?.on;
    }
    return byPlayer;
  }, [party, bidder]);
  const okBy = new Set(party.movesIn('review', 'ok').map((m) => m.player_id));
  const rejectCount = (i: number) => Object.values(vetoes).filter((v) => v[i]).length;

  const firstOf = (deck: Card[], n: number) => ({ phase: 'bid', card: deck[n - 1] ?? deck[0], ends_at: party.deadline(bidTime) });

  const start = async () => {
    const wanted = numSetting(settings, 'rounds', 6, 1, 50);
    const cats = listSetting(settings, 'categories').join(',');
    const data = await fetch(`/api/games/deck?game=surenchere&count=${wanted}&categories=${cats}`).then((r) => r.json()).catch(() => null);
    const deck: Card[] = data?.items || [];
    if (!deck.length) { toast.error('Impossible de charger les défis.'); return; }
    await party.startGame(deck, firstOf(deck, 1), deck.length);
  };

  // Highest bid wins; on a tie, whoever announced it first.
  const allBid = active.length > 0 && active.every((p) => bids[p.id]);
  useHostStep(party, `${gid}:${roundNo}:bid-end`, phase === 'bid' && (party.expired || allBid), async () => {
    const latest: Record<string, { n: number; at: string }> = {};
    for (const m of party.movesIn('bid', 'bid')) latest[m.player_id] = { n: Math.min(MAX_BID, Math.max(0, Number(m.payload?.n) || 0)), at: m.created_at };
    const ranked = Object.entries(latest).filter(([, b]) => b.n > 0).sort((a, b) => b[1].n - a[1].n || a[1].at.localeCompare(b[1].at));
    if (!ranked.length) {
      await party.setRound({ phase: 'results', card, skipped: true, gains: {}, ends_at: party.deadline(8) });
      return;
    }
    const [winner, top] = ranked[0];
    await party.setRound({ phase: 'prove', card, bidder: winner, bid: top.n, bids: Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.n])), ends_at: party.deadline(proveTime) });
  });

  useHostStep(party, `${gid}:${roundNo}:prove-end`, phase === 'prove' && (party.expired || bidderDone), async () => {
    await party.setRound({ phase: 'review', card, bidder, bid, bids: round.bids, items: liveItems, ends_at: party.deadline(REVIEW_TIME) });
  });

  const allReviewed = reviewers.length === 0 || reviewers.every((p) => okBy.has(p.id));
  useHostStep(party, `${gid}:${roundNo}:review-end`, phase === 'review' && (party.expired || allReviewed), async () => {
    const half = reviewers.length / 2;
    const rejected = items.map((_, i) => rejectCount(i) > half);
    const valid = rejected.filter((r) => !r).length;
    const success = !!bidder && valid >= bid;
    const gains: Scores = {};
    if (success && bidder) gains[bidder] = bid * 100;
    else for (const p of reviewers) gains[p.id] = 100;
    await party.setRound({ phase: 'results', card, bidder, bid, items, rejected, valid, success, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  const announced = myBid ?? (playerId ? bids[playerId]?.n : undefined);
  const challenge = card && <PromptCard eyebrow={card.catLabel ?? 'Le défi'}>{card.text}</PromptCard>;

  return (
    <PartyShell party={party} title="Surenchère" maxTime={phase === 'bid' ? bidTime : phase === 'prove' ? proveTime : phase === 'review' ? REVIEW_TIME : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party}
          title="Surenchère"
          tagline="Annonce combien tu peux en citer, puis prouve-le."
          icon={Gavel}
          swatch={SWATCH}
          minPlayers={2}
          onStart={start}
          rules={[
            'Un défi s’affiche, par exemple « Des pays d’Afrique ».',
            'Chacun annonce en secret combien il peut en citer.',
            'La plus grosse annonce doit tenir parole, en direct, avant la fin du chrono.',
            'Les autres refusent les réponses fausses. Promesse tenue : 100 points par réponse annoncée. Sinon, 100 points pour chacun des autres.',
          ]}
        />
      )}

      {phase === 'bid' && card && (
        <>
          {challenge}
          <div className={cn(BRAWL.panel, 'w-full max-w-md p-5 flex flex-col items-center gap-4')}>
            <p className="font-bold text-tx-secondary">Combien tu peux en citer en {proveTime} s ?</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setAmount((a) => Math.max(1, a - 1))} className={cn(BRAWL.dark, 'h-14 w-14 rounded-2xl')} aria-label="Moins"><Minus className="h-6 w-6" /></button>
              <span className="w-24 text-center font-display text-6xl tabular-nums">{amount}</span>
              <button onClick={() => setAmount((a) => Math.min(MAX_BID, a + 1))} className={cn(BRAWL.dark, 'h-14 w-14 rounded-2xl')} aria-label="Plus"><Plus className="h-6 w-6" /></button>
            </div>
            <button
              onClick={() => { markBid(amount); party.act('bid', { n: amount }); vibrate(HAPTIC.MEDIUM); }}
              className={cn(BRAWL.yellow, 'h-14 w-full rounded-2xl text-xl')}
            >
              {announced ? `Changer pour ${amount}` : `J’annonce ${amount}`}
            </button>
            {announced !== undefined && <p className="font-bold text-accent-success">Ton annonce : {announced}</p>}
          </div>
          <PlayerChips party={party} done={Object.keys(bids)} label="Ont annoncé" />
        </>
      )}

      {phase === 'prove' && card && (
        <>
          {challenge}
          <div className="w-full rounded-2xl border-[3px] border-brand-border bg-accent-secondary px-4 py-3 text-center text-white">
            <p className="font-display text-2xl">
              {isBidder ? `À toi : cite-en ${bid} !` : <><OgName name={party.nameOf(bidder)} /> doit en citer {bid}</>}
            </p>
            <p className="font-display text-4xl tabular-nums">{liveItems.length} / {bid}</p>
          </div>
          {isBidder && !bidderDone && (
            <AnswerInput
              value={draft}
              onChange={setDraft}
              maxLength={60}
              placeholder="Une réponse, puis Entrée…"
              submitLabel="Ajouter"
              onSubmit={() => { party.act('item', { text: draft.trim() }); setDraft(''); vibrate(HAPTIC.SOFT); }}
            />
          )}
          <ol className="grid w-full gap-2 sm:grid-cols-2">
            {liveItems.map((t, i) => (
              <li key={i} className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2 font-bold"><span className="text-tx-secondary">{i + 1}.</span> {t}</li>
            ))}
          </ol>
          {isBidder && !bidderDone && (
            <button onClick={() => party.act('done')} className={cn(BRAWL.green, 'h-12 px-6 rounded-2xl text-lg')}>
              <Check className="h-5 w-5" /> J’ai fini
            </button>
          )}
        </>
      )}

      {phase === 'review' && card && (
        <>
          {challenge}
          <p className="text-center font-bold text-tx-secondary">
            {isBidder ? 'Les autres vérifient tes réponses…' : 'Refuse les réponses fausses, puis valide.'}
          </p>
          <ul className="w-full space-y-2">
            {items.map((t, i) => {
              const mine = !!playerId && !!vetoes[playerId]?.[i];
              const n = rejectCount(i);
              return (
                <li key={i} className={cn('flex items-center gap-3 rounded-xl border-[3px] border-brand-border px-3 py-2', n > reviewers.length / 2 ? 'bg-accent-secondary/30' : 'bg-brand-inner')}>
                  <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{t}</span>
                  {n > 0 && <span className="shrink-0 text-sm font-bold text-accent-secondary">{n} refus</span>}
                  {!isBidder && (
                    <button
                      onClick={() => { party.act('veto', { i, on: !mine }); vibrate(HAPTIC.SOFT); }}
                      className={cn('shrink-0 h-10 w-10 rounded-xl border-[3px] border-brand-border flex items-center justify-center', mine ? 'bg-accent-secondary text-white' : 'bg-[#2B3170] text-white')}
                      aria-label={mine ? 'Annuler le refus' : 'Refuser'}
                    >
                      <ThumbsDown className="h-5 w-5" />
                    </button>
                  )}
                </li>
              );
            })}
            {!items.length && <li className="text-center font-bold text-tx-secondary">Aucune réponse…</li>}
          </ul>
          {!isBidder && (
            okBy.has(playerId || '') ? <Waiting text="Validé, on attend les autres…" /> : (
              <button onClick={() => party.act('ok')} className={cn(BRAWL.green, 'h-14 w-full max-w-sm rounded-2xl text-xl')}>
                <Check className="h-5 w-5" /> J’ai vérifié
              </button>
            )
          )}
        </>
      )}

      {phase === 'results' && card && (
        <>
          {challenge}
          {round.skipped ? (
            <p className="font-bold text-tx-secondary">Personne n’a rien annoncé.</p>
          ) : (
            <div className={cn('w-full rounded-[22px] border-4 border-brand-border p-5 text-center shadow-[0_6px_0_#05061A]', round.success ? 'bg-accent-success text-brand-bg' : 'bg-accent-secondary text-white')}>
              <p className="text-xs font-black uppercase tracking-widest opacity-80">{round.success ? 'Pari tenu !' : 'Pari perdu !'}</p>
              <p className="font-display text-3xl"><OgName name={party.nameOf(bidder)} /> : {round.valid} / {bid}</p>
            </div>
          )}
          {items.length > 0 && (
            <ul className="flex w-full flex-wrap justify-center gap-2">
              {items.map((t, i) => (
                <li key={i} className={cn('rounded-xl border-[3px] border-brand-border px-3 py-1.5 font-bold', round.rejected?.[i] ? 'bg-brand-inner text-tx-muted line-through' : 'bg-brand-inner')}>{t}</li>
              ))}
            </ul>
          )}
          <ScoreList party={party} gains={round.gains} />
          <NextStep party={party} onNext={next} label={roundNo >= totalRounds ? 'Voir le podium' : 'Défi suivant'} />
        </>
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les rois de l’annonce." />}
    </PartyShell>
  );
}
