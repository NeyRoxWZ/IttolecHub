'use client';

import { ReactNode, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Crown, Eye, EyeOff, Loader2, LogOut, RotateCcw, Send, X } from 'lucide-react';
import GameLayout from '@/games/components/GameLayout';
import VoteToLobby from '@/games/components/VoteToLobby';
import OgName from '@/components/OgName';
import { BRAWL } from '@/lib/ui/brawl';
import { cn } from '@/lib/utils';
import type { Party, Scores } from './usePartyGame';

/*
 * The screens every multiplayer game is built from. One look and one way of
 * working for all of them: start screen, prompt, answer bar, secret card,
 * vote, round results, podium. Primary actions are green (the multiplayer
 * colour); yellow marks what is being played for (a word, a letter).
 */

/** The frame: header with icon, round and clock; lobby vote; reactions. */
export function PartyShell({ party, title, maxTime, children, wide }: { party: Party; title: string; maxTime?: number; children: ReactNode; wide?: boolean }) {
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
      voteToLobby={<VoteToLobby roomCode={party.roomCode} roomId={party.roomId || ''} playerId={party.playerId || ''} players={party.players} />}
    >
      <div className={cn('flex w-full flex-1 flex-col items-center justify-center gap-4', wide ? 'max-w-5xl' : 'max-w-3xl')}>
        {party.loaded ? children : <Loader2 className="h-12 w-12 animate-spin text-accent-success" />}
      </div>
    </GameLayout>
  );
}

export function Waiting({ text }: { text: ReactNode }) {
  return (
    <div className="inline-flex items-center justify-center gap-3 rounded-2xl border-[3px] border-brand-border bg-brand-inner px-5 py-3 text-center font-display text-lg text-tx-base">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-success" />
      {text}
    </div>
  );
}

/** Who is still playing, with a check on the ones who already acted. */
export function PlayerChips({ party, done, label, only }: { party: Party; done?: Iterable<string>; label?: string; only?: string[] }) {
  const doneSet = new Set(done ?? []);
  const list = only ? party.active.filter((p) => only.includes(p.id)) : party.active;
  if (!list.length) return null;
  return (
    <div className="w-full">
      {label && <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-tx-secondary">{label}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        {list.map((p) => (
          <span
            key={p.id}
            className={cn(
              'inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-2.5 font-display text-sm',
              doneSet.has(p.id) ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary',
            )}
          >
            {doneSet.has(p.id) && <Check className="h-4 w-4 shrink-0" />}
            <span className="truncate"><OgName name={p.name} /></span>
            {p.id === party.playerId && <span className="opacity-70">(toi)</span>}
          </span>
        ))}
      </div>
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
    <div className={cn(BRAWL.panel, 'flex w-full max-w-xl flex-col items-center gap-5 p-5 text-center animate-in fade-in md:p-8')}>
      <div
        className="flex h-20 w-20 rotate-3 items-center justify-center rounded-2xl border-4 border-brand-border"
        style={{ background: swatch.fill, boxShadow: `inset 0 -6px 0 ${swatch.shade}` }}
      >
        <Icon className="h-10 w-10 text-white" />
      </div>
      <div>
        <h2 className="font-display text-4xl leading-none md:text-5xl">{title}</h2>
        <p className="mt-2 font-bold text-tx-secondary">{tagline}</p>
      </div>
      <ol className="w-full space-y-2 text-left">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2 text-sm font-bold md:text-base">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-success font-display text-brand-bg">{i + 1}</span>
            <span className="pt-0.5">{rule}</span>
          </li>
        ))}
      </ol>
      {note}
      <PlayerChips party={party} label={`${party.active.length} joueur${party.active.length > 1 ? 's' : ''} dans la partie`} />
      {party.isHost ? (
        <>
          <button
            disabled={busy || !enough}
            onClick={async () => {
              setBusy(true);
              try { await onStart(); } finally { setBusy(false); }
            }}
            className={cn(BRAWL.green, 'h-16 w-full rounded-2xl text-2xl')}
          >
            {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Lancer la partie'}
          </button>
          {!enough && <p className="text-sm font-bold text-accent-secondary">Il faut au moins {minPlayers} joueurs présents.</p>}
        </>
      ) : (
        <Waiting text="L’hôte va lancer la partie…" />
      )}
    </div>
  );
}

/** The big line of a round: the question, the word, the challenge. */
export function PromptCard({ eyebrow, children, tone = 'default', className }: { eyebrow?: ReactNode; children: ReactNode; tone?: 'default' | 'yellow' | 'pink' | 'green'; className?: string }) {
  return (
    <div
      className={cn(
        'w-full rounded-[22px] border-4 border-brand-border px-4 py-5 text-center shadow-[0_6px_0_#05061A] md:px-6',
        tone === 'yellow' ? 'bg-accent-primary text-brand-bg'
          : tone === 'pink' ? 'bg-accent-secondary text-white'
            : tone === 'green' ? 'bg-accent-success text-brand-bg'
              : 'bg-brand-card text-tx-base',
        className,
      )}
    >
      {eyebrow && <p className={cn('mb-2 text-xs font-black uppercase tracking-widest', tone === 'default' ? 'text-tx-secondary' : 'opacity-80')}>{eyebrow}</p>}
      <div className="text-balance font-display text-2xl leading-tight [overflow-wrap:anywhere] md:text-4xl">{children}</div>
    </div>
  );
}

/** A result that closes a round: found or not, caught or not. */
export function RevealBanner({ tone, eyebrow, children, detail }: { tone: 'good' | 'bad' | 'neutral'; eyebrow?: ReactNode; children: ReactNode; detail?: ReactNode }) {
  return (
    <div
      className={cn(
        'w-full rounded-[22px] border-4 border-brand-border p-4 text-center shadow-[0_6px_0_#05061A] animate-in zoom-in-95 md:p-5',
        tone === 'good' ? 'bg-accent-success text-brand-bg' : tone === 'bad' ? 'bg-accent-secondary text-white' : 'bg-brand-card text-tx-base',
      )}
    >
      {eyebrow && <p className="text-xs font-black uppercase tracking-widest opacity-80">{eyebrow}</p>}
      <div className="font-display text-2xl leading-tight [overflow-wrap:anywhere] md:text-4xl">{children}</div>
      {detail && <div className="mt-2 font-bold">{detail}</div>}
    </div>
  );
}

/** A picture, poster or map, framed the same way in every game. */
export function MediaFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative w-full overflow-hidden rounded-[22px] border-4 border-brand-border bg-brand-inner shadow-[0_6px_0_#05061A]', className)}>
      {children}
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
      className={cn(
        'w-full select-none touch-none rounded-[22px] border-4 border-brand-border px-4 py-4 text-center shadow-[0_6px_0_#05061A] transition-colors',
        shown ? 'bg-accent-primary text-brand-bg' : 'bg-brand-card text-tx-base hover:bg-[#252B66]',
        className,
      )}
    >
      <p className={cn('text-xs font-black uppercase tracking-widest', shown ? 'opacity-80' : 'text-tx-secondary')}>{label}</p>
      {shown ? (
        <div className="mt-1 flex flex-col items-center gap-2">
          {role && (
            <span className={cn('rounded-lg border-[3px] border-brand-border px-2 py-0.5 font-display text-sm', role.tone === 'good' ? 'bg-accent-success text-brand-bg' : role.tone === 'bad' ? 'bg-accent-secondary text-white' : 'bg-white text-brand-bg')}>
              {role.text}
            </span>
          )}
          <span className="font-display text-3xl leading-tight [overflow-wrap:anywhere] md:text-4xl">{secret}</span>
        </div>
      ) : (
        <span className="mt-1 flex items-center justify-center gap-2 font-display text-xl text-tx-secondary">
          <EyeOff className="h-5 w-5" /> Maintiens pour voir
        </span>
      )}
    </button>
  );
}

/** Before the round: everyone reads their secret, then says they are ready. */
export function ReadyScreen({ party, ready, onReady, children }: { party: Party; ready: string[]; onReady: () => void; children: ReactNode }) {
  const me = !!party.playerId && ready.includes(party.playerId);
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      {children}
      <button onClick={onReady} disabled={me} className={cn(me ? BRAWL.dark : BRAWL.green, 'h-16 w-full rounded-2xl text-2xl')}>
        {me ? <><Check className="h-6 w-6" /> Prêt</> : <><Eye className="h-6 w-6" /> J’ai vu, je suis prêt</>}
      </button>
      <PlayerChips party={party} done={ready} label="Prêts" />
    </div>
  );
}

const INPUT = 'min-w-0 flex-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-4 text-lg font-bold text-tx-base placeholder:text-tx-muted outline-none focus:border-accent-success disabled:opacity-60';

/** A text answer with its send button (16px+ text: phones don't zoom in). */
export function AnswerInput({
  value, onChange, onSubmit, placeholder, maxLength = 120, disabled, multiline, submitLabel = 'Valider', autoFocus = true, numeric, prefix,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; maxLength?: number; disabled?: boolean; multiline?: boolean; submitLabel?: string; autoFocus?: boolean; numeric?: boolean; prefix?: ReactNode;
}) {
  const send = () => { if (value.trim() && !disabled) onSubmit(); };
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex w-full items-stretch gap-2">
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={3}
          className={cn(INPUT, 'resize-none py-3 leading-snug')}
        />
      ) : (
        <div className="relative flex min-w-0 flex-1">
          {prefix && <span className="pointer-events-none absolute left-3 top-0 flex h-14 items-center text-tx-secondary">{prefix}</span>}
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
            className={cn(INPUT, 'h-14 w-full', prefix && 'pl-11')}
          />
        </div>
      )}
      <button type="submit" disabled={disabled || !value.trim()} className={cn(BRAWL.green, 'shrink-0 rounded-xl px-4 text-lg md:px-6', multiline ? 'self-stretch' : 'h-14')}>
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
        'w-full rounded-2xl border-[3px] border-brand-border px-4 py-3 text-left font-bold transition-transform [overflow-wrap:anywhere] active:translate-y-[3px] disabled:cursor-default disabled:active:translate-y-0',
        selected
          ? 'bg-accent-success text-brand-bg shadow-[inset_0_-4px_0_#1E9A55,0_4px_0_#05061A]'
          : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_4px_0_#05061A] enabled:hover:bg-[#333A80]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** What the round was about, kept in view while voting (clues, answers, a drawing). */
export function RecapPanel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className={cn(BRAWL.panel, 'w-full p-3 md:p-4')}>
      <p className="mb-2 text-center text-xs font-black uppercase tracking-widest text-tx-secondary">{title}</p>
      <div className="max-h-[34vh] overflow-y-auto pr-1 custom-scrollbar">{children}</div>
    </div>
  );
}

export interface VoteCandidate { id: string; title: ReactNode; subtitle?: ReactNode; disabled?: boolean; mine?: boolean }

/**
 * The vote, identical in every game: the question, the round kept in view,
 * a card per choice with who picked it, and who still has to vote.
 */
export function VoteScreen({
  party, title, subtitle, recap, candidates, myVote, onVote, votes, voted, voters, cantVoteText = 'Tu ne votes pas cette fois.',
}: {
  party: Party; title: ReactNode; subtitle?: ReactNode; recap?: ReactNode; candidates: VoteCandidate[]; myVote?: string; onVote?: (id: string) => void;
  /** Who picked what, shown on the cards. Leave empty for a secret vote and pass `voted` instead. */
  votes: Record<string, string | undefined>; voted?: string[]; voters?: string[]; cantVoteText?: string;
}) {
  return (
    <>
      <PromptCard eyebrow="Vote" tone="green">{title}</PromptCard>
      {subtitle && <p className="text-center font-bold text-tx-secondary">{subtitle}</p>}
      {recap}
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {candidates.map((c) => {
          const by = Object.entries(votes).filter(([, target]) => target === c.id).map(([voter]) => voter);
          return (
            <ChoiceButton
              key={c.id}
              selected={myVote === c.id}
              disabled={!onVote || c.disabled || c.mine}
              onClick={() => onVote?.(c.id)}
              className={cn('flex min-h-[72px] flex-col justify-center gap-1', (c.disabled || c.mine) && 'opacity-60')}
            >
              <span className="font-display text-xl leading-snug">{c.title}</span>
              {c.subtitle && <span className="text-sm font-bold opacity-85">{c.subtitle}</span>}
              {c.mine && <span className="text-xs font-black uppercase tracking-widest opacity-80">C’est toi</span>}
              {by.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {by.map((v) => (
                    <span key={v} className="rounded-md border-2 border-brand-border bg-brand-bg px-1.5 py-0.5 text-[11px] font-black text-white">{party.nameOf(v)}</span>
                  ))}
                </span>
              )}
            </ChoiceButton>
          );
        })}
      </div>
      {!onVote && <Waiting text={cantVoteText} />}
      <PlayerChips party={party} only={voters} done={voted ?? Object.keys(votes).filter((k) => votes[k])} label="Ont voté" />
    </>
  );
}

/** Each player's answer in a round, with what it was worth. */
export function AnswerList({ party, rows, title = 'Réponses' }: { party: Party; title?: string; rows: { pid: string; answer?: ReactNode; ok?: boolean; points?: number; note?: ReactNode }[] }) {
  if (!rows.length) return null;
  return (
    <div className={cn(BRAWL.panel, 'w-full p-3 md:p-4')}>
      <h3 className="mb-2 text-center font-display text-xl">{title}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.pid} className="flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
            {r.ok !== undefined && (
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-brand-border', r.ok ? 'bg-accent-success text-brand-bg' : 'bg-accent-secondary text-white')}>
                {r.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display"><OgName name={party.nameOf(r.pid)} /></span>
              {r.answer !== undefined && <span className="block truncate text-sm font-bold text-tx-secondary">{r.answer}</span>}
              {r.note && <span className="block text-xs font-bold text-tx-muted">{r.note}</span>}
            </span>
            {!!r.points && <span className="shrink-0 font-display text-lg text-accent-success tabular-nums">+{r.points}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Whose turn it is, in order. */
export function TurnStrip({ party, order, current, colorOf, out }: { party: Party; order: string[]; current?: string; colorOf?: (pid: string) => string; out?: string[] }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-2">
      {order.map((pid) => (
        <span
          key={pid}
          className={cn(
            'inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-2.5 font-display text-sm',
            current === pid ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary',
            out?.includes(pid) && 'line-through opacity-50',
          )}
        >
          {colorOf && <span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-border" style={{ background: colorOf(pid) }} />}
          <span className="truncate"><OgName name={party.nameOf(pid)} /></span>
        </span>
      ))}
    </div>
  );
}

/** Running scores, with what each player just won. */
export function ScoreList({ party, gains, title = 'Scores' }: { party: Party; gains?: Scores; title?: string }) {
  const rows = party.seated
    .map((p) => ({ p, total: party.scores[p.id] || 0, gain: gains?.[p.id] || 0 }))
    .sort((a, b) => b.total - a.total || b.gain - a.gain);
  return (
    <div className={cn(BRAWL.panel, 'w-full p-3 md:p-4')}>
      <h3 className="mb-2 text-center font-display text-xl">{title}</h3>
      <ul className="space-y-2">
        {rows.map(({ p, total, gain }, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
            <span className="w-6 font-display text-lg text-tx-secondary tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-display text-lg"><OgName name={p.name} /></span>
            {gain > 0 && <span className="font-display text-lg text-accent-success tabular-nums">+{gain}</span>}
            <span className="w-16 text-right font-display text-xl text-accent-primary tabular-nums">{total}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Between rounds: the countdown, and a button for the host to skip it. */
export function NextStep({ party, onNext, label = 'Continuer' }: { party: Party; onNext: () => unknown; label?: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {party.isHost ? (
        <button onClick={() => onNext()} className={cn(BRAWL.green, 'h-14 w-full max-w-sm rounded-2xl text-xl')}>
          {label}{party.round.ends_at ? ` (${party.timeLeft})` : ''}
        </button>
      ) : (
        <p className="font-bold text-tx-secondary">Suite dans {party.timeLeft} s…</p>
      )}
    </div>
  );
}

/** End of the game: podium, full ranking, replay with the same players. */
export function Podium({ party, onReplay, flavor }: { party: Party; onReplay: () => Promise<unknown>; flavor?: string }) {
  const [busy, setBusy] = useState(false);
  const ranking = party.seated.map((p) => ({ ...p, score: party.scores[p.id] || 0 })).sort((a, b) => b.score - a.score);
  const steps = [
    { r: ranking[1], place: 2, h: 'h-20', fill: 'bg-[#C2C9F0]' },
    { r: ranking[0], place: 1, h: 'h-28', fill: 'bg-accent-primary' },
    { r: ranking[2], place: 3, h: 'h-14', fill: 'bg-[#FF8A1F]' },
  ];
  return (
    <div className={cn(BRAWL.panel, 'flex w-full max-w-2xl flex-col items-center gap-6 p-5 animate-in zoom-in-95 md:p-8')}>
      <div className="text-center">
        <h2 className="font-display text-4xl md:text-5xl">Fin de la partie</h2>
        {flavor && <p className="mt-1 font-bold text-tx-secondary">{flavor}</p>}
      </div>
      <div className="grid w-full max-w-md grid-cols-3 items-end gap-2">
        {steps.map(({ r, place, h, fill }) => (
          <div key={place} className="flex min-w-0 flex-col items-center gap-2">
            {r ? (
              <>
                {place === 1 && <Crown className="h-8 w-8 text-accent-primary" />}
                <span className="w-full truncate text-center font-display text-base md:text-lg"><OgName name={r.name} /></span>
                <span className="font-display text-accent-primary tabular-nums">{r.score} pts</span>
              </>
            ) : <span className="h-6" />}
            <div className={cn('flex w-full items-start justify-center rounded-t-xl border-[3px] border-b-0 border-brand-border pt-2 font-display text-3xl text-brand-bg', h, fill)}>{place}</div>
          </div>
        ))}
      </div>
      {ranking.length > 3 && (
        <ul className="w-full space-y-2">
          {ranking.slice(3).map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
              <span className="w-6 font-display text-tx-secondary">{i + 4}</span>
              <span className="min-w-0 flex-1 truncate font-display"><OgName name={p.name} /></span>
              <span className="font-display text-accent-primary tabular-nums">{p.score} pts</span>
            </li>
          ))}
        </ul>
      )}
      {party.isHost ? (
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onReplay(); } finally { setBusy(false); } }}
            className={cn(BRAWL.green, 'h-14 rounded-2xl text-xl')}
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><RotateCcw className="h-5 w-5" /> Rejouer</>}
          </button>
          <button onClick={() => party.backToLobby()} className={cn(BRAWL.dark, 'h-14 rounded-2xl text-xl')}>
            <LogOut className="h-5 w-5" /> Retour au salon
          </button>
        </div>
      ) : (
        <Waiting text="L’hôte choisit la suite…" />
      )}
    </div>
  );
}
