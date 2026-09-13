'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, Newspaper, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { CATEGORIES, CERTAINTY, type KrashNews, type NewsCategory, type Certainty } from '@/lib/krash/newsMeta';
import { FLASH, flashMultiplier, type MarketId } from '@/lib/krash/assets';
import { useKrashFlash, type FlashBet } from '../_lib/useKrashFlash';
import { useKrashWallet } from '../_lib/useKrashWallet';
import { serverNow } from '../_lib/useKrashMarket';

function ago(seconds: number): string {
  if (seconds < 45) return 'à l’instant';
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(minutes / 60)} h`;
}

/** "↑ Luxe 88 %" — which way the headline probably pushes, and how sure it is. */
function HintChip({ label, up, certainty }: { label: string; up: number; certainty: Certainty }) {
  if (certainty === 'pile' || up === 0.5) {
    return <span className="px-1.5 py-0.5 rounded-md border border-brand-border text-[10px] font-bold text-tx-secondary">↕ {label} 50/50</span>;
  }
  const rising = up > 0.5;
  const pct = Math.round((rising ? up : 1 - up) * 100);
  return (
    <span className={cn(
      'px-1.5 py-0.5 rounded-md border text-[10px] font-bold',
      rising ? 'border-accent-success/50 text-accent-success' : 'border-rose-500/50 text-rose-400'
    )}>
      {rising ? '↑' : '↓'} {label} {pct} %
    </span>
  );
}

/** A sound per kind of arrival: an event hits hard, a 50/50 sounds like a coin in the air. */
function playArrival(n: KrashNews) {
  if (n.event && !n.rumour) {
    if (n.event === 'krach') sfx.bust(); else sfx.jackpot();
  } else if (n.rumour) {
    sfx.card();
  } else if (n.certainty === 'pile') {
    sfx.coin();
  } else {
    sfx.reveal();
  }
}

const FLASH_STAKES = [25, 50, 100, 250];
const FLASH_STAKE_KEY = 'krash_flash_stake';

/**
 * The flash bet under a fresh headline: higher or lower one minute after it
 * came out, on its first target. Open for a few seconds only.
 */
function FlashStrip({
  news, now, bet, onPlace,
}: {
  news: KrashNews;
  now: number;
  bet: FlashBet | undefined;
  onPlace: (side: 'up' | 'down', stake: number) => void;
}) {
  const { balance } = useKrashWallet();
  const [stake, setStake] = useState(50);
  useEffect(() => {
    try { const saved = Number(localStorage.getItem(FLASH_STAKE_KEY)); if (FLASH_STAKES.includes(saved)) setStake(saved); } catch {}
  }, []);

  const hint = news.hints[0];
  if (!hint) return null;
  const left = Math.ceil(FLASH.window - (now - news.at));

  if (bet) {
    const verdictIn = Math.max(0, Math.ceil((Date.parse(bet.resolve_at) / 1000) - now));
    return (
      <div className={cn(
        'mt-2 rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-2',
        bet.status === 'won' ? 'border-accent-success text-accent-success' : bet.status === 'lost' ? 'border-rose-500/60 text-rose-400' : 'border-accent-primary/60 text-accent-primary'
      )}>
        <Zap className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          Flash {bet.side === 'up' ? '↑' : '↓'} {hint.label} · {bet.stake} ₶ x{Number(bet.multiplier).toFixed(2)}
        </span>
        <span className="ml-auto shrink-0">
          {bet.status === 'pending' ? (verdictIn > 0 ? `verdict dans ${verdictIn} s` : 'verdict…') : bet.status === 'won' ? `+${bet.payout} ₶` : 'perdu'}
        </span>
      </div>
    );
  }

  if (left <= 0 || news.event) return null;
  const maxStake = Math.floor(balance * FLASH.maxStakePct);
  const upMult = flashMultiplier(hint.up, 'up', news.certainty);
  const downMult = flashMultiplier(hint.up, 'down', news.certainty);
  const pick = (s: number) => { sfx.click(); setStake(s); try { localStorage.setItem(FLASH_STAKE_KEY, String(s)); } catch {} };

  return (
    <div className="mt-2 rounded-lg border-2 border-accent-primary/70 bg-accent-primary/5 p-2">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-accent-primary">
        <Zap className="h-3.5 w-3.5" /> Pari flash sur {hint.label}
        <span className="ml-auto tabular-nums">{left} s</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-brand-border overflow-hidden">
        <div className="h-full bg-accent-primary transition-all duration-1000 ease-linear" style={{ width: `${(left / FLASH.window) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex gap-1">
        {FLASH_STAKES.map((s) => (
          <button
            key={s}
            disabled={s > maxStake}
            onClick={() => pick(s)}
            className={cn('flex-1 h-7 rounded-md border text-[10px] font-black disabled:opacity-30', stake === s ? 'border-accent-primary text-accent-primary' : 'border-brand-border text-tx-muted')}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          disabled={stake > maxStake}
          onClick={() => onPlace('up', stake)}
          className="h-9 rounded-md bg-accent-success text-brand-bg font-display font-black text-[12px] disabled:opacity-40"
        >
          ↑ MONTE · x{upMult.toFixed(2)}
        </button>
        <button
          disabled={stake > maxStake}
          onClick={() => onPlace('down', stake)}
          className="h-9 rounded-md bg-rose-500 text-white font-display font-black text-[12px] disabled:opacity-40"
        >
          ↓ BAISSE · x{downMult.toFixed(2)}
        </button>
      </div>
      <p className="mt-1 text-[10px] text-tx-muted leading-snug">
        Gagné si {hint.label} a bougé dans ton sens {FLASH.horizon} s après la news. Le côté évident rapporte peu, le pari risqué rapporte gros.
      </p>
    </div>
  );
}

/**
 * The headlines. Each one is coloured by kind, says how sure its effect is,
 * and shows the likely direction per target. A fresh one offers a flash bet
 * for a few seconds; a 50/50 one exists only for that bet and leaves the feed
 * once it closes.
 */
export default function NewsFeed({
  news, market, now, className,
}: { news: KrashNews[]; market: MarketId; now: number; className?: string }) {
  const [legend, setLegend] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const flash = useKrashFlash();

  // Countdowns run on the server's clock, not on the feed's last tick, which
  // lags a few seconds behind: a bet placed on the last visible second used to
  // reach the server already too late.
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const tick = () => setClock(serverNow());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  // Flash and sound what arrives after the page is open, not the backlog.
  useEffect(() => {
    if (!news.length) return;
    if (seen.current === null) {
      seen.current = new Set(news.map((n) => n.id));
      return;
    }
    const arrived = news.filter((n) => !seen.current!.has(n.id));
    if (!arrived.length) return;
    arrived.forEach((n) => seen.current!.add(n.id));
    // The loudest one speaks for the batch.
    playArrival(arrived.find((n) => n.event && !n.rumour) ?? arrived[0]);
    const ids = arrived.map((n) => n.id);
    setFresh((prev) => new Set([...Array.from(prev), ...ids]));
    const timer = setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [news]);

  const betByNews = new Map(flash.bets.map((b) => [b.news_id, b]));

  return (
    <section className={cn('bg-brand-card border-4 border-brand-border rounded-[24px] shadow-brutal flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Newspaper className="h-4 w-4 text-rose-400" />
        <h2 className="font-display font-black tracking-wider uppercase">News en direct</h2>
        <button
          onClick={() => { sfx.click(); setLegend((v) => !v); }}
          className={cn(
            'ml-auto h-8 px-2.5 rounded-lg border-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest',
            legend ? 'border-tx-base text-tx-base' : 'border-brand-border text-tx-muted hover:text-tx-base'
          )}
        >
          <Info className="h-3.5 w-3.5" /> Légende
        </button>
      </div>

      {legend && (
        <div className="mx-4 mb-3 rounded-xl border-2 border-brand-border bg-brand-inner p-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {(Object.keys(CATEGORIES) as NewsCategory[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5 text-[11px] text-tx-secondary">
                <span className={cn('h-2.5 w-2.5 rounded-sm', CATEGORIES[c].dot)} /> {CATEGORIES[c].label}
              </span>
            ))}
          </div>
          <div className="space-y-1 border-t border-brand-border pt-2">
            {(Object.keys(CERTAINTY) as Certainty[]).map((c) => (
              <div key={c} className="text-[11px] leading-snug">
                <span className="font-black text-tx-base">{CERTAINTY[c].label}</span>
                <span className="text-tx-muted"> — {CERTAINTY[c].hint}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-tx-muted leading-snug border-t border-brand-border pt-2">
            « ↑ Luxe 88 % » : 88 % de chances que le luxe monte. Le marché sent venir la news, une partie du mouvement est déjà faite quand elle tombe.
            Un <b className="text-rose-400">KRACH</b> ou un <b className="text-accent-success">BULL RUN</b> secoue tous les marchés d’un coup, souvent annoncé par une rumeur quelques minutes avant.
            Le <b className="text-accent-primary">pari flash</b> apparaît {FLASH.window} s sous chaque nouvelle news.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 min-h-0">
        {news.length === 0 && <p className="text-tx-muted text-sm text-center py-8">Le fil se charge…</p>}
        {news.map((n) => {
          const meta = CATEGORIES[n.category];
          const relevant = n.markets.includes(market);
          const big = n.event && !n.rumour;
          const bet = betByNews.get(n.id);
          const flashOpen = !big && clock - n.at < FLASH.window;
          if (n.certainty === 'pile' && !big && !flashOpen && !bet) return null;
          return (
            <article
              key={n.id}
              className={cn(
                // Neutral cards: the category colour lives in the label's dot,
                // not in a thick side stripe the rounded corners bend.
                'rounded-xl border-2 px-3 py-2.5 transition-all duration-700',
                big
                  ? n.event === 'krach'
                    ? 'border-rose-500 bg-rose-500/15'
                    : 'border-accent-success bg-accent-success/10'
                  : 'border-brand-border bg-brand-inner',
                fresh.has(n.id) && 'ring-2 ring-inset ring-rose-400 animate-in fade-in duration-500'
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-black uppercase tracking-widest">
                {big ? (
                  <span className={n.event === 'krach' ? 'text-rose-400' : 'text-accent-success'}>
                    {n.event === 'krach' ? '▼ Krach' : '▲ Bull run'}
                  </span>
                ) : (
                  <span className={cn('flex items-center gap-1.5', meta.text)}>
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                )}
                <span className="text-tx-muted">· {CERTAINTY[n.certainty].label}</span>
                {relevant && !big && <span className="text-accent-primary">· Ton marché</span>}
                {fresh.has(n.id) && <span className="text-rose-400">· Nouveau</span>}
                <span className="ml-auto whitespace-nowrap text-tx-muted normal-case tracking-normal font-bold">{ago(clock - n.at)}</span>
              </div>
              <p className={cn('leading-snug mt-1', big ? 'font-display font-black text-base' : 'text-[13px] font-bold')}>{n.text}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {n.hints.map((h, i) => <HintChip key={i} label={h.label} up={h.up} certainty={n.certainty} />)}
              </div>
              {(flashOpen || bet) && (
                <FlashStrip news={n} now={clock} bet={bet} onPlace={(side, stake) => { void flash.place(n.id, 0, side, stake); }} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
