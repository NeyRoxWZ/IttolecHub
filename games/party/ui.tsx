'use client';

import { ReactNode, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Crown, Loader2, LogOut, RotateCcw, Send } from 'lucide-react';
import GameLayout from '@/games/components/GameLayout';
import VoteToLobby from '@/games/components/VoteToLobby';
import OgName from '@/components/OgName';
import { BRAWL } from '@/lib/ui/brawl';
import { cn } from '@/lib/utils';
import type { Party, Scores } from './usePartyGame';

/** The screen every party game sits in: header with round and clock, lobby vote, reactions. */
export function PartyShell({ party, title, maxTime, children }: { party: Party; title: string; maxTime?: number; children: ReactNode }) {
  const timed = !!party.round.ends_at && party.phase !== 'podium';
  return (
    <GameLayout
      isConnected={party.isConnected}
      gameTitle={title}
      roundCount={Math.min(party.roundNo, party.totalRounds)}
      maxRounds={party.totalRounds}
      timer={timed ? String(party.timeLeft).padStart(2, '0') : '--'}
      timeLeft={timed ? party.timeLeft : 99}
      maxTime={maxTime}
      voteToLobby={<VoteToLobby roomCode={party.roomCode} roomId={party.roomId || ''} playerId={party.playerId || ''} players={party.players} />}
    >
      {/* Bottom padding on phones: the floating lobby and reaction buttons never cover a button. */}
      <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center gap-4 pb-28 md:pb-6">
        {party.loaded ? children : <Loader2 className="h-12 w-12 animate-spin text-accent-primary" />}
      </div>
    </GameLayout>
  );
}

export function Waiting({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center justify-center gap-3 rounded-2xl border-[3px] border-brand-border bg-brand-inner px-5 py-3 font-display text-lg text-tx-base text-center">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent-primary" />
      {text}
    </div>
  );
}

/** Who is still playing, with a check on the ones who already answered. */
export function PlayerChips({ party, done, label, only }: { party: Party; done?: Iterable<string>; label?: string; only?: string[] }) {
  const doneSet = new Set(done ?? []);
  const list = only ? party.active.filter((p) => only.includes(p.id)) : party.active;
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
    <div className={cn(BRAWL.panel, 'w-full max-w-xl p-5 md:p-8 flex flex-col items-center gap-5 text-center animate-in fade-in')}>
      <div
        className="flex h-20 w-20 rotate-3 items-center justify-center rounded-2xl border-4 border-brand-border"
        style={{ background: swatch.fill, boxShadow: `inset 0 -6px 0 ${swatch.shade}` }}
      >
        <Icon className="h-10 w-10 text-white" />
      </div>
      <div>
        <h2 className="font-display text-4xl md:text-5xl leading-none">{title}</h2>
        <p className="mt-2 font-bold text-tx-secondary">{tagline}</p>
      </div>
      <ol className="w-full space-y-2 text-left">
        {rules.map((rule, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2 text-sm font-bold md:text-base">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-primary font-display text-brand-bg">{i + 1}</span>
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
export function PromptCard({ eyebrow, children, tone = 'default', className }: { eyebrow?: ReactNode; children: ReactNode; tone?: 'default' | 'yellow' | 'pink'; className?: string }) {
  return (
    <div
      className={cn(
        'w-full rounded-[22px] border-4 border-brand-border px-4 py-5 md:px-6 text-center shadow-[0_6px_0_#05061A]',
        tone === 'yellow' ? 'bg-accent-primary text-brand-bg' : tone === 'pink' ? 'bg-accent-secondary text-white' : 'bg-brand-card text-tx-base',
        className,
      )}
    >
      {eyebrow && (
        <p className={cn('mb-2 text-xs font-black uppercase tracking-widest', tone === 'default' ? 'text-tx-secondary' : 'opacity-80')}>{eyebrow}</p>
      )}
      <div className="font-display text-2xl leading-tight md:text-4xl [overflow-wrap:anywhere] text-balance">{children}</div>
    </div>
  );
}

const INPUT = 'min-w-0 flex-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-4 text-lg font-bold text-tx-base placeholder:text-tx-muted outline-none focus:border-accent-primary disabled:opacity-60';

/** A text answer with its send button (16px+ text: phones don't zoom in). */
export function AnswerInput({
  value, onChange, onSubmit, placeholder, maxLength = 120, disabled, multiline, submitLabel = 'Valider', autoFocus = true,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; maxLength?: number; disabled?: boolean; multiline?: boolean; submitLabel?: string; autoFocus?: boolean;
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
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          className={cn(INPUT, 'h-14')}
        />
      )}
      <button type="submit" disabled={disabled || !value.trim()} className={cn(BRAWL.yellow, 'shrink-0 rounded-xl px-4 text-lg md:px-6', multiline ? 'self-stretch' : 'h-14')}>
        <Send className="h-5 w-5" />
        <span className="hidden sm:inline">{submitLabel}</span>
      </button>
    </form>
  );
}

/** One option in a vote. */
export function ChoiceButton({ selected, disabled, onClick, children, className }: { selected?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border-[3px] border-brand-border px-4 py-3 text-left font-bold transition-transform active:translate-y-[3px] disabled:active:translate-y-0 disabled:cursor-default [overflow-wrap:anywhere]',
        selected
          ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]'
          : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_4px_0_#05061A] enabled:hover:bg-[#333A80]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Running scores, with what each player just won. */
export function ScoreList({ party, gains, title = 'Scores' }: { party: Party; gains?: Scores; title?: string }) {
  const rows = party.seated
    .map((p) => ({ p, total: party.scores[p.id] || 0, gain: gains?.[p.id] || 0 }))
    .sort((a, b) => b.total - a.total || b.gain - a.gain);
  return (
    <div className={cn(BRAWL.panel, 'w-full p-4')}>
      <h3 className="mb-3 text-center font-display text-xl">{title}</h3>
      <ul className="space-y-2">
        {rows.map(({ p, total, gain }, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2">
            <span className="w-6 font-display text-lg text-tx-secondary tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-display text-lg"><OgName name={p.name} /></span>
            {gain > 0 && <span className="font-display text-lg text-accent-success tabular-nums">+{gain}</span>}
            <span className="w-14 text-right font-display text-xl text-accent-primary tabular-nums">{total}</span>
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
        <button onClick={() => onNext()} className={cn(BRAWL.yellow, 'h-14 w-full max-w-sm rounded-2xl text-xl')}>
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
    <div className={cn(BRAWL.panel, 'w-full max-w-2xl p-5 md:p-8 flex flex-col items-center gap-6 animate-in zoom-in-95')}>
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
