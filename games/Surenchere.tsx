'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Gavel, Minus, Plus, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import OgName from '@/components/OgName';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { normalize } from '@/lib/party/text';
import { addScores, listSetting, numSetting, useHostStep, usePartyGame, useSent, type Scores } from './party/usePartyGame';
import { AnswerInput, Column, Columns, PartyShell, PlayerChips, Podium, PromptCard, RecapPanel, ResultsScreen, RevealBanner, Screen, SetupScreen, Waiting, type RoundRow } from './party/ui';

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
  const proveMoves = party.movesIn('prove');
  const liveItems = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of proveMoves) {
      if (m.action_type !== 'item' || m.player_id !== bidder) continue;
      const text = String(m.payload?.text || '').trim().slice(0, 60);
      const key = normalize(text);
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
    return out;
  }, [proveMoves, bidder]);
  const bidderDone = proveMoves.some((m) => m.action_type === 'done' && m.player_id === bidder);

  const items: string[] = round.items || [];
  const reviewMoves = party.movesIn('review');
  const vetoes = useMemo(() => {
    const byPlayer: Record<string, Record<number, boolean>> = {};
    for (const m of reviewMoves) {
      if (m.action_type !== 'veto' || m.player_id === bidder) continue;
      (byPlayer[m.player_id] ||= {})[Number(m.payload?.i)] = !!m.payload?.on;
    }
    return byPlayer;
  }, [reviewMoves, bidder]);
  const okBy = new Set(reviewMoves.filter((m) => m.action_type === 'ok' && m.player_id !== bidder).map((m) => m.player_id));
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

  const bidderGone = phase === 'prove' && !!bidder && !party.seated.some((p) => p.id === bidder);
  useHostStep(party, `${gid}:${roundNo}:prove-end`, phase === 'prove' && (party.expired || bidderDone || bidderGone), async () => {
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
    await party.setRound({ phase: 'results', card, bidder, bid, bids: round.bids, items, rejected, valid, success, gains, scores: addScores(party.scores, gains), ends_at: party.deadline(RESULTS_TIME) });
  });

  const next = useHostStep(party, `${gid}:${roundNo}:next`, phase === 'results' && party.expired, async () => {
    if (roundNo >= totalRounds) return party.endGame();
    await party.goToRound(roundNo + 1, firstOf(party.deck || [], roundNo + 1));
  });

  const announced = myBid ?? (playerId ? bids[playerId]?.n : undefined);
  const challenge = card && <PromptCard eyebrow={card.catLabel ?? 'Le défi'}>{card.text}</PromptCard>;
  const itemList = (list: string[], rejected?: boolean[]) => (
    <ol className="grid gap-1.5 sm:grid-cols-2">
      {list.map((t, i) => (
        <li key={i} className={cn('rounded-lg border-[3px] border-brand-border bg-brand-inner px-2 py-1 font-bold [overflow-wrap:anywhere]', rejected?.[i] && 'text-tx-muted line-through')}>
          <span className="text-tx-secondary">{i + 1}.</span> {t}
        </li>
      ))}
      {!list.length && <li className="text-center text-sm font-bold text-tx-secondary sm:col-span-2">Aucune réponse pour l’instant.</li>}
    </ol>
  );

  return (
    <PartyShell party={party} title="Surenchère" maxTime={phase === 'bid' ? bidTime : phase === 'prove' ? proveTime : phase === 'review' ? REVIEW_TIME : RESULTS_TIME}>
      {phase === 'setup' && (
        <SetupScreen
          party={party} title="Surenchère" tagline="Annonce combien tu peux en citer, puis prouve-le." icon={Gavel} swatch={SWATCH} minPlayers={2} onStart={start}
          rules={['Un défi s’affiche, par exemple « Des pays d’Afrique ».', 'Chacun annonce en secret combien il peut en citer.', 'La plus grosse annonce doit tenir parole, en direct, avant la fin du chrono.', 'Les autres refusent les réponses fausses. Promesse tenue : 100 points par réponse annoncée. Sinon, 100 points pour chacun des autres.']}
        />
      )}

      {phase === 'bid' && card && (
        <Screen center>
          <div className="flex w-full max-w-xl flex-col gap-3">
            {challenge}
            <div className={cn(BRAWL.panel, 'flex flex-col items-center gap-3 p-3')}>
              <p className="text-center text-sm font-bold text-tx-secondary">Combien tu peux en citer en {proveTime} s ?</p>
              <div className="flex items-center gap-4">
                <button onClick={() => setAmount((a) => Math.max(1, a - 1))} className={cn(BRAWL.dark, 'h-12 w-12 rounded-2xl')} aria-label="Moins"><Minus className="h-6 w-6" /></button>
                <span className="w-20 text-center font-display text-5xl tabular-nums">{amount}</span>
                <button onClick={() => setAmount((a) => Math.min(MAX_BID, a + 1))} className={cn(BRAWL.dark, 'h-12 w-12 rounded-2xl')} aria-label="Plus"><Plus className="h-6 w-6" /></button>
              </div>
              <button onClick={() => { markBid(amount); party.act('bid', { n: amount }); vibrate(HAPTIC.MEDIUM); }} className={cn(BRAWL.green, 'h-12 w-full rounded-2xl text-lg')}>
                {announced ? `Changer pour ${amount}` : `J’annonce ${amount}`}
              </button>
              {announced !== undefined && <p className="font-bold text-accent-success">Ton annonce : {announced}</p>}
            </div>
            <PlayerChips party={party} done={Object.keys(bids)} label="Annoncé" />
          </div>
        </Screen>
      )}

      {phase === 'prove' && card && (
        <Screen>
          <Columns className="grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1">
            <Column className="lg:justify-center">
              {challenge}
              <RevealBanner tone="neutral" eyebrow={isBidder ? 'À toi de prouver' : <><OgName name={party.nameOf(bidder)} /> doit en citer {bid}</>}>
                {liveItems.length} / {bid}
              </RevealBanner>
              {isBidder && !bidderDone ? (
                <>
                  <AnswerInput value={draft} onChange={setDraft} maxLength={60} placeholder="Une réponse, puis Entrée…" submitLabel="Ajouter" onSubmit={() => { party.act('item', { text: draft.trim() }); setDraft(''); vibrate(HAPTIC.SOFT); }} />
                  <button onClick={() => party.act('done')} className={cn(BRAWL.dark, 'h-11 shrink-0 rounded-2xl text-base')}><Check className="h-5 w-5" /> J’ai fini</button>
                </>
              ) : !isBidder ? <Waiting text="Vérifie ses réponses…" /> : null}
            </Column>
            <Column><RecapPanel title="Réponses">{itemList(liveItems)}</RecapPanel></Column>
          </Columns>
        </Screen>
      )}

      {phase === 'review' && card && (
        <Screen>
          {challenge}
          <p className="shrink-0 text-center text-sm font-bold text-tx-secondary">{isBidder ? 'Les autres vérifient tes réponses…' : 'Refuse les réponses fausses, puis valide.'}</p>
          <RecapPanel title={`Réponses de ${party.nameOf(bidder)} (${items.length}/${bid})`}>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {items.map((t, i) => {
                const mine = !!playerId && !!vetoes[playerId]?.[i];
                const n = rejectCount(i);
                return (
                  <li key={i} className={cn('flex items-center gap-2 rounded-lg border-[3px] border-brand-border px-2 py-1', n > reviewers.length / 2 ? 'bg-accent-secondary/30' : 'bg-brand-inner')}>
                    <span className="min-w-0 flex-1 font-bold [overflow-wrap:anywhere]">{t}</span>
                    {n > 0 && <span className="shrink-0 text-xs font-bold text-accent-secondary">{n} refus</span>}
                    {!isBidder && (
                      <button onClick={() => { party.act('veto', { i, on: !mine }); vibrate(HAPTIC.SOFT); }} className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[3px] border-brand-border shadow-none', mine ? 'bg-accent-secondary text-white' : 'bg-[#2B3170] text-white')} aria-label={mine ? 'Annuler le refus' : 'Refuser'}>
                        <ThumbsDown className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
              {!items.length && <li className="text-center font-bold text-tx-secondary sm:col-span-2">Aucune réponse…</li>}
            </ul>
          </RecapPanel>
          {!isBidder && (okBy.has(playerId || '') ? <Waiting text="Validé, on attend les autres…" /> : (
            <button onClick={() => party.act('ok')} className={cn(BRAWL.green, 'h-12 w-full shrink-0 rounded-2xl text-lg')}><Check className="h-5 w-5" /> J’ai vérifié</button>
          ))}
          <PlayerChips party={party} only={reviewers.map((p) => p.id)} done={Array.from(okBy)} label="Vérifié" />
        </Screen>
      )}

      {phase === 'results' && card && (
        <ResultsScreen
          party={party}
          reveal={round.skipped ? (
            <RevealBanner tone="bad" eyebrow={card.text}>Personne n’a rien annoncé</RevealBanner>
          ) : (
            <RevealBanner tone={round.success ? 'good' : 'bad'} eyebrow={round.success ? 'Pari tenu !' : 'Pari perdu !'} detail={card.text}>
              <OgName name={party.nameOf(bidder)} /> : {round.valid} / {bid}
            </RevealBanner>
          )}
          media={items.length ? <RecapPanel title="Réponses">{itemList(items, round.rejected)}</RecapPanel> : undefined}
          rows={Object.fromEntries(Object.entries((round.bids || {}) as Record<string, number>).map(([pid, n]) => [pid, { answer: `a annoncé ${n}`, ok: pid === bidder ? !!round.success : !round.success } as RoundRow]))}
          onNext={next}
          nextLabel={roundNo >= totalRounds ? 'Voir le podium' : 'Défi suivant'}
        />
      )}

      {phase === 'podium' && <Podium party={party} onReplay={start} flavor="Les rois de l’annonce." />}
    </PartyShell>
  );
}
