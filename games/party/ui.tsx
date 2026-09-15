'use client';

import { ReactNode, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Crown, Eye, EyeOff, Loader2, LogOut, RotateCcw, Send, X } from 'lucide-react';
import GameLayout from '@/games/components/GameLayout';
import VoteToLobby from '@/games/components/VoteToLobby';
import OgName from '@/components/OgName';
import { BRAWL } from '@/lib/ui/brawl';
import { cn } from '@/lib/utils';
import type { Party } from './usePartyGame';
import { useFitBox } from './useFitBox';

/*
 * The screens every multiplayer game is built from. One look and one way of
 * working for all of them, and every screen fits the window: long lists
 * scroll inside their own panel, the page itself never scrolls.
 * Primary actions are green (the multiplayer colour); yellow marks what is
 * being played for (a word, a letter).
 */

const NO_BAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/** The frame: header with icon, round and clock; lobby vote; reactions. */
export function PartyShell({ party, title, maxTime, children }: { party: Party; title: string; maxTime?: number; children: ReactNode; wide?: boolean }) {
  const timed = !!party.round.ends_at && party.phase !== 'podium';
  return (
    <GameLayout
      isConnected={party.isConnected}
      gameTitle={title}
      gameId={party.gameType}
      roundCount={Math.min(party.roundNo, party.totalRounds)}
      maxRounds={party.totalRounds}
      timer={timed ? String(party.timeLeft).padStart(2, '0') : '--'}
      timeLeft={timed ? party.timeLeft : 99}
      maxTime={maxTime}
      voteToLobby={<VoteToLobby roomCode={party.roomCode} roomId={party.roomId || ''} playerId={party.playerId || ''} players={party.players} onAllVoted={party.backToLobby} />}
    >
      {party.loaded ? children : <div className="flex flex-1 items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-accent-success" /></div>}
    </GameLayout>
  );
}

/** A game screen: fills the space under the header. */
export function Screen({ children, center, className }: { children: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={cn('flex min-h-0 w-full flex-1 flex-col gap-2 animate-in fade-in sm:gap-3', center && 'items-center justify-center', className)}>
      {children}
    </div>
  );
}

/** Two columns side by side on a large screen, stacked on a phone. */
export function Columns({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid min-h-0 flex-1 grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2', className)}>{children}</div>;
}

export function Column({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-0 flex-col gap-2 sm:gap-3', className)}>{children}</div>;
}

/** The only place something may scroll: inside its own box. */
export function Scroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar', className)}>{children}</div>;
}

export function Waiting({ text, className }: { text: ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex items-center justify-center gap-2 self-center rounded-2xl border-[3px] border-brand-border bg-brand-inner px-4 py-2 text-center font-display text-base text-tx-base sm:text-lg', className)}>
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-success" />
      {text}
    </div>
  );
}

/** Who is playing, on one line, with a check on the ones who already acted. */
export function PlayerChips({ party, done, label, only }: { party: Party; done?: Iterable<string>; label?: string; only?: string[] }) {
  const doneSet = new Set(done ?? []);
  const list = only ? party.active.filter((p) => only.includes(p.id)) : party.active;
  if (!list.length) return null;
  return (
    <div className={cn('flex shrink-0 items-center gap-1.5 overflow-x-auto', NO_BAR)}>
      {label && <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-tx-secondary">{label} {Array.from(doneSet).filter((id) => list.some((p) => p.id === id)).length}/{list.length}</span>}
      {list.map((p) => (
        <span
          key={p.id}
          className={cn(
            'inline-flex h-8 max-w-[10rem] shrink-0 items-center gap-1 rounded-lg border-[3px] border-brand-border px-2 font-display text-sm',
            doneSet.has(p.id) ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary',
          )}
        >
          {doneSet.has(p.id) && <Check className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate"><OgName name={p.name} /></span>
        </span>
      ))}
    </div>
  );
}

export interface Swatch { fill: string; shade: string }

/** Start screen: rules, who is here, and the host's start button. */
export function SetupScreen({
  party, title, tagline, icon: Icon, swatch, rules, minPlayers, onStart, note,
}: {
  party: Party; title: string; tagline: string; icon: LucideIcon; swatch: Swatch; rules: string[]; minPlayers: number; onStart: () => Promise<unknown>; note?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const enough = party.active.length >= minPlayers;
  return (
    <Screen center>
      <div className={cn(BRAWL.panel, 'flex max-h-full min-h-0 w-full max-w-xl flex-col gap-3 p-3 sm:p-5')}>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] border-brand-border" style={{ background: swatch.fill, boxShadow: `inset 0 -5px 0 ${swatch.shade}` }}>
            <Icon className="h-7 w-7 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl leading-none sm:text-4xl">{title}</h2>
            <p className="mt-1 text-sm font-bold text-tx-secondary sm:text-base">{tagline}</p>
          </div>
        </div>
        <Scroll className="flex-initial">
          <ol className="space-y-1.5">
            {rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2.5 py-1.5 text-sm font-bold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-success font-display text-brand-bg">{i + 1}</span>
                <span className="pt-0.5">{rule}</span>
              </li>
            ))}
          </ol>
        </Scroll>
        {note}
        <PlayerChips party={party} label="Joueurs" done={party.active.map((p) => p.id)} />
        {party.isHost ? (
          <>
            <button
              disabled={busy || !enough}
              onClick={async () => { setBusy(true); try { await onStart(); } finally { setBusy(false); } }}
              className={cn(BRAWL.green, 'h-14 w-full shrink-0 rounded-2xl text-2xl')}
            >
              {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Lancer la partie'}
            </button>
            {!enough && <p className="text-center text-sm font-bold text-accent-secondary">Il faut au moins {minPlayers} joueurs présents.</p>}
          </>
        ) : (
          <Waiting text="L’hôte va lancer la partie…" />
        )}
      </div>
    </Screen>
  );
}

/** The big line of a round: the question, the word, the challenge. */
export function PromptCard({ eyebrow, children, tone = 'default', className }: { eyebrow?: ReactNode; children: ReactNode; tone?: 'default' | 'yellow' | 'pink' | 'green'; className?: string }) {
  return (
    <div
      className={cn(
        'w-full shrink-0 rounded-[18px] border-[3px] border-brand-border px-3 py-2 text-center shadow-[0_4px_0_#05061A] sm:py-3',
        tone === 'yellow' ? 'bg-accent-primary text-brand-bg' : tone === 'pink' ? 'bg-accent-secondary text-white' : tone === 'green' ? 'bg-accent-success text-brand-bg' : 'bg-brand-card text-tx-base',
        className,
      )}
    >
      {eyebrow && <p className={cn('text-[11px] font-black uppercase tracking-widest', tone === 'default' ? 'text-tx-secondary' : 'opacity-80')}>{eyebrow}</p>}
      <div className="text-balance font-display text-xl leading-tight [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">{children}</div>
    </div>
  );
}

/** A result that closes a round: found or not, caught or not. */
export function RevealBanner({ tone, eyebrow, children, detail }: { tone: 'good' | 'bad' | 'neutral'; eyebrow?: ReactNode; children: ReactNode; detail?: ReactNode }) {
  return (
    <div className={cn('w-full shrink-0 rounded-[18px] border-[3px] border-brand-border px-3 py-2 text-center shadow-[0_4px_0_#05061A] animate-in zoom-in-95 sm:py-3', tone === 'good' ? 'bg-accent-success text-brand-bg' : tone === 'bad' ? 'bg-accent-secondary text-white' : 'bg-brand-card text-tx-base')}>
      {eyebrow && <p className="text-[11px] font-black uppercase tracking-widest opacity-80">{eyebrow}</p>}
      <div className="font-display text-xl leading-tight [overflow-wrap:anywhere] sm:text-2xl lg:text-3xl">{children}</div>
      {detail && <div className="mt-0.5 text-sm font-bold">{detail}</div>}
    </div>
  );
}

/** A picture, poster or map, framed the same way in every game. It takes the room it is given. */
export function MediaFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-[18px] border-[3px] border-brand-border bg-brand-inner shadow-[0_4px_0_#05061A]', className)}>{children}</div>;
}

/** A framed picture of a fixed shape, as large as the space allows (square flag, 3:2 flag…). */
export function FitFrame({ ratio, children, className }: { ratio: number; children: ReactNode; className?: string }) {
  const fit = useFitBox(ratio);
  // The measured box takes its size from the layout only: the picture sits in an
  // absolute layer, so it can never push the box bigger and feed the measure again.
  return (
    <div ref={fit.ref} className="relative h-full min-h-0 w-full min-w-0 flex-1 self-stretch">
      <div className="absolute inset-0 flex items-center justify-center">
        <MediaFrame className={cn(!fit.size.w && 'invisible', className)}>
          <div style={{ width: fit.size.w || 1, height: fit.size.h || 1 }}>{children}</div>
        </MediaFrame>
      </div>
    </div>
  );
}

/** A secret (word, role) shown only while held down: nobody reads it over a shoulder. */
export function SecretCard({ label = 'Ton mot', secret, role, className }: { label?: ReactNode; secret: ReactNode; role?: { text: string; tone: 'good' | 'bad' | 'neutral' }; className?: string }) {
  const [shown, setShown] = useState(false);
  const hide = () => setShown(false);
  return (
    <button
      type="button"
      onPointerDown={() => setShown(true)}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
      className={cn('w-full shrink-0 select-none touch-none rounded-[18px] border-[3px] border-brand-border px-3 py-2 text-center shadow-[0_4px_0_#05061A]', shown ? 'bg-accent-primary text-brand-bg' : 'bg-brand-card text-tx-base hover:bg-[#252B66]', className)}
    >
      <p className={cn('text-[11px] font-black uppercase tracking-widest', shown ? 'opacity-80' : 'text-tx-secondary')}>{label}</p>
      {shown ? (
        <span className="flex flex-wrap items-center justify-center gap-2">
          {role && <span className={cn('rounded-md border-2 border-brand-border px-1.5 font-display text-sm', role.tone === 'good' ? 'bg-accent-success text-brand-bg' : role.tone === 'bad' ? 'bg-accent-secondary text-white' : 'bg-white text-brand-bg')}>{role.text}</span>}
          <span className="font-display text-2xl leading-tight [overflow-wrap:anywhere]">{secret}</span>
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2 font-display text-lg text-tx-secondary"><EyeOff className="h-5 w-5" /> Maintiens pour voir</span>
      )}
    </button>
  );
}

/** Before the round: everyone reads their secret, then says they are ready. */
export function ReadyScreen({ party, ready, onReady, children }: { party: Party; ready: string[]; onReady: () => void; children: ReactNode }) {
  const me = !!party.playerId && ready.includes(party.playerId);
  return (
    <Screen center>
      <div className="flex w-full max-w-xl flex-col gap-3">
        {children}
        <button onClick={onReady} disabled={me} className={cn(me ? BRAWL.dark : BRAWL.green, 'h-14 w-full rounded-2xl text-xl')}>
          {me ? <><Check className="h-6 w-6" /> Prêt</> : <><Eye className="h-6 w-6" /> J’ai vu, je suis prêt</>}
        </button>
        <PlayerChips party={party} done={ready} label="Prêts" />
      </div>
    </Screen>
  );
}

const INPUT = 'min-w-0 flex-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 text-lg font-bold text-tx-base placeholder:text-tx-muted outline-none focus:border-accent-success disabled:opacity-60';

/** A text answer with its send button (16px+ text: phones don't zoom in). */
export function AnswerInput({
  value, onChange, onSubmit, placeholder, maxLength = 120, disabled, multiline, submitLabel = 'Valider', autoFocus = true, numeric, prefix,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; maxLength?: number; disabled?: boolean; multiline?: boolean; submitLabel?: string; autoFocus?: boolean; numeric?: boolean; prefix?: ReactNode;
}) {
  const send = () => { if (value.trim() && !disabled) onSubmit(); };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex w-full shrink-0 items-stretch gap-2">
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={2}
          className={cn(INPUT, 'resize-none py-2 leading-snug')}
        />
      ) : (
        <div className="relative flex min-w-0 flex-1">
          {prefix && <span className="pointer-events-none absolute left-3 top-0 flex h-12 items-center text-tx-secondary">{prefix}</span>}
          <input
            value={value}
            onChange={(e) => onChange((numeric ? e.target.value.replace(/[^\d\s]/g, '') : e.target.value).slice(0, maxLength))}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            inputMode={numeric ? 'numeric' : undefined}
            className={cn(INPUT, 'h-12 w-full', prefix && 'pl-11')}
          />
        </div>
      )}
      <button type="submit" disabled={disabled || !value.trim()} className={cn(BRAWL.green, 'shrink-0 rounded-xl px-4 text-lg', multiline ? 'self-stretch' : 'h-12')}>
        <Send className="h-5 w-5" />
        <span className="hidden sm:inline">{submitLabel}</span>
      </button>
    </form>
  );
}

/** One option in a vote or a choice. */
export function ChoiceButton({ selected, disabled, onClick, children, className }: { selected?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border-[3px] border-brand-border px-3 py-2 text-left font-bold transition-transform [overflow-wrap:anywhere] active:translate-y-[3px] disabled:cursor-default disabled:active:translate-y-0',
        selected ? 'bg-accent-success text-brand-bg shadow-[inset_0_-4px_0_#1E9A55,0_3px_0_#05061A]' : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] enabled:hover:bg-[#333A80]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** What the round was about, kept in view (clues, answers, a drawing). Scrolls inside. */
export function RecapPanel({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 flex-col p-2 sm:p-3', className)}>
      <p className="mb-1 shrink-0 text-center text-[11px] font-black uppercase tracking-widest text-tx-secondary">{title}</p>
      <Scroll>{children}</Scroll>
    </div>
  );
}

export interface VoteCandidate { id: string; title: ReactNode; subtitle?: ReactNode; disabled?: boolean; mine?: boolean }

/**
 * The vote, identical in every game: the question, the round kept in view,
 * a card per choice with who picked it, and who still has to vote.
 * `hideMine` leaves the player out of the choices (you never vote for yourself).
 */
export function VoteScreen({
  party, title, subtitle, recap, candidates, myVote, onVote, votes, voted, voters, hideMine, cantVoteText = 'Tu ne votes pas cette fois.',
}: {
  party: Party; title: ReactNode; subtitle?: ReactNode; recap?: ReactNode; candidates: VoteCandidate[]; myVote?: string; onVote?: (id: string) => void;
  votes: Record<string, string | undefined>; voted?: string[]; voters?: string[]; hideMine?: boolean; cantVoteText?: string;
}) {
  const shown = hideMine ? candidates.filter((c) => !c.mine) : candidates;
  return (
    <Screen>
      <PromptCard eyebrow="Vote" tone="green">{title}</PromptCard>
      {subtitle && <p className="shrink-0 text-center text-sm font-bold text-tx-secondary">{subtitle}</p>}
      <div className={cn('grid min-h-0 flex-1 gap-2 sm:gap-3', recap && 'grid-rows-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-cols-2 lg:grid-rows-1')}>
        {recap && <div className="flex min-h-0 flex-col">{recap}</div>}
        <Scroll className="grid content-start gap-2 sm:grid-cols-2">
          {shown.map((c) => {
            const by = Object.entries(votes).filter(([, target]) => target === c.id).map(([voter]) => voter);
            return (
              <ChoiceButton key={c.id} selected={myVote === c.id} disabled={!onVote || c.disabled || c.mine} onClick={() => onVote?.(c.id)} className={cn('flex min-h-[56px] flex-col justify-center gap-0.5', (c.disabled || c.mine) && 'opacity-60')}>
                <span className="font-display text-lg leading-snug">{c.title}</span>
                {c.subtitle && <span className="text-sm font-bold opacity-85">{c.subtitle}</span>}
                {c.mine && <span className="text-[11px] font-black uppercase tracking-widest opacity-80">C’est la tienne</span>}
                {by.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {by.map((v) => <span key={v} className="rounded-md border-2 border-brand-border bg-brand-bg px-1.5 text-[11px] font-black text-white">{party.nameOf(v)}</span>)}
                  </span>
                )}
              </ChoiceButton>
            );
          })}
        </Scroll>
      </div>
      {!onVote && <Waiting text={cantVoteText} />}
      <PlayerChips party={party} only={voters} done={voted ?? Object.keys(votes).filter((k) => votes[k])} label="Ont voté" />
    </Screen>
  );
}

export interface RoundRow { answer?: ReactNode; ok?: boolean; note?: ReactNode }

/**
 * End of a round, one table for every game: each player's answer, what it was
 * worth, and the running total, best first.
 */
export function RoundTable({ party, rows = {}, title = 'Manche', only }: { party: Party; rows?: Record<string, RoundRow>; title?: string; only?: string[] }) {
  const gains: Record<string, number> = party.round.gains || {};
  const list = party.seated
    .filter((p) => !only || only.includes(p.id))
    .map((p) => ({ p, gain: gains[p.id] || 0, total: party.scores[p.id] || 0, row: rows[p.id] }))
    .sort((a, b) => b.total - a.total || b.gain - a.gain);
  return (
    <div className={cn(BRAWL.panel, 'flex min-h-0 flex-1 flex-col p-2 sm:p-3')}>
      <div className="mb-1 flex shrink-0 items-center justify-between px-1 text-[11px] font-black uppercase tracking-widest text-tx-secondary">
        <span>{title}</span><span>Points · Total</span>
      </div>
      <Scroll>
        <ul className="space-y-1.5">
          {list.map(({ p, gain, total, row }, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1.5">
              <span className="w-5 text-center font-display text-tx-secondary tabular-nums">{i + 1}</span>
              {row?.ok !== undefined && (
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-brand-border', row.ok ? 'bg-accent-success text-brand-bg' : 'bg-accent-secondary text-white')}>
                  {row.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display leading-tight"><OgName name={p.name} /></span>
                {(row?.answer !== undefined || row?.note) && (
                  <span className="block truncate text-xs font-bold text-tx-secondary">{row?.answer}{row?.answer !== undefined && row?.note ? ' · ' : ''}{row?.note}</span>
                )}
              </span>
              <span className={cn('w-12 text-right font-display tabular-nums', gain ? 'text-accent-success' : 'text-tx-muted')}>{gain ? `+${gain}` : '0'}</span>
              <span className="w-14 text-right font-display text-lg text-accent-primary tabular-nums">{total}</span>
            </li>
          ))}
        </ul>
      </Scroll>
    </div>
  );
}

/** Whose turn it is, in order, on one line. */
export function TurnStrip({ party, order, current, colorOf, out }: { party: Party; order: string[]; current?: string; colorOf?: (pid: string) => string; out?: string[] }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-1.5 overflow-x-auto', NO_BAR)}>
      {order.map((pid) => (
        <span key={pid} className={cn('inline-flex h-8 max-w-[10rem] shrink-0 items-center gap-1 rounded-lg border-[3px] border-brand-border px-2 font-display text-sm', current === pid ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary', out?.includes(pid) && 'line-through opacity-50')}>
          {colorOf && <span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-border" style={{ background: colorOf(pid) }} />}
          <span className="truncate"><OgName name={party.nameOf(pid)} /></span>
        </span>
      ))}
    </div>
  );
}

/** Between rounds: the countdown, and a button for the host to skip it. */
export function NextStep({ party, onNext, label = 'Continuer' }: { party: Party; onNext: () => unknown; label?: string }) {
  return party.isHost ? (
    <button onClick={() => onNext()} className={cn(BRAWL.green, 'h-12 w-full shrink-0 rounded-2xl text-lg')}>
      {label}{party.round.ends_at ? ` (${party.timeLeft})` : ''}
    </button>
  ) : (
    <p className="shrink-0 text-center font-bold text-tx-secondary">Suite dans {party.timeLeft} s…</p>
  );
}

/**
 * Results screen: what the round was (reveal, picture) on one side, the round
 * table and the next button on the other. Stacked on a phone, still one screen.
 */
export function ResultsScreen({ party, reveal, media, rows, onNext, nextLabel, only }: {
  party: Party; reveal: ReactNode; media?: ReactNode; rows?: Record<string, RoundRow>; onNext: () => unknown; nextLabel: string; only?: string[];
}) {
  return (
    <Screen>
      <Columns className={cn(media ? 'grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1' : '')}>
        <Column>
          {reveal}
          {/* A set height on a phone: the column there is only as tall as its content. */}
          {media && <div className="flex h-[24dvh] min-h-0 shrink-0 lg:h-auto lg:flex-1">{media}</div>}
        </Column>
        <Column>
          <RoundTable party={party} rows={rows} only={only} />
          <NextStep party={party} onNext={onNext} label={nextLabel} />
        </Column>
      </Columns>
    </Screen>
  );
}

/** End of the game: podium, full ranking, replay with the same players. */
export function Podium({ party, onReplay, flavor }: { party: Party; onReplay: () => Promise<unknown>; flavor?: string }) {
  const [busy, setBusy] = useState(false);
  const ranking = party.seated.map((p) => ({ ...p, score: party.scores[p.id] || 0 })).sort((a, b) => b.score - a.score);
  const steps = [
    { r: ranking[1], place: 2, h: 'h-14 sm:h-20', fill: 'bg-[#C2C9F0]' },
    { r: ranking[0], place: 1, h: 'h-20 sm:h-28', fill: 'bg-accent-primary' },
    { r: ranking[2], place: 3, h: 'h-10 sm:h-14', fill: 'bg-[#FF8A1F]' },
  ];
  return (
    <Screen center>
      <div className={cn(BRAWL.panel, 'flex max-h-full min-h-0 w-full max-w-2xl flex-col items-center gap-3 p-3 animate-in zoom-in-95 sm:p-5')}>
        <div className="shrink-0 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">Fin de la partie</h2>
          {flavor && <p className="text-sm font-bold text-tx-secondary">{flavor}</p>}
        </div>
        <div className="grid w-full max-w-md shrink-0 grid-cols-3 items-end gap-2">
          {steps.map(({ r, place, h, fill }) => (
            <div key={place} className="flex min-w-0 flex-col items-center gap-1">
              {r ? (
                <>
                  {place === 1 && <Crown className="h-7 w-7 text-accent-primary" />}
                  <span className="w-full truncate text-center font-display"><OgName name={r.name} /></span>
                  <span className="font-display text-sm text-accent-primary tabular-nums">{r.score} pts</span>
                </>
              ) : <span className="h-5" />}
              <div className={cn('flex w-full items-start justify-center rounded-t-xl border-[3px] border-b-0 border-brand-border pt-1 font-display text-2xl text-brand-bg', h, fill)}>{place}</div>
            </div>
          ))}
        </div>
        {ranking.length > 3 && (
          <Scroll className="w-full">
            <ul className="space-y-1.5">
              {ranking.slice(3).map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1.5">
                  <span className="w-5 font-display text-tx-secondary">{i + 4}</span>
                  <span className="min-w-0 flex-1 truncate font-display"><OgName name={p.name} /></span>
                  <span className="font-display text-accent-primary tabular-nums">{p.score} pts</span>
                </li>
              ))}
            </ul>
          </Scroll>
        )}
        {party.isHost ? (
          <div className="grid w-full shrink-0 gap-2 sm:grid-cols-2">
            <button disabled={busy} onClick={async () => { setBusy(true); try { await onReplay(); } finally { setBusy(false); } }} className={cn(BRAWL.green, 'h-12 rounded-2xl text-lg')}>
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><RotateCcw className="h-5 w-5" /> Rejouer</>}
            </button>
            <button onClick={() => party.backToLobby()} className={cn(BRAWL.dark, 'h-12 rounded-2xl text-lg')}>
              <LogOut className="h-5 w-5" /> Retour au salon
            </button>
          </div>
        ) : (
          <Waiting text="L’hôte choisit la suite…" />
        )}
      </div>
    </Screen>
  );
}
