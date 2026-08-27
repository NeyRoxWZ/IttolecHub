'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, Play, Copy, Check, Trash2, TrendingUp, TrendingDown, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  SYNDICATE_DURATIONS, SYNDICATE_MIN_PLAYERS, SYNDICATE_MAX_PLAYERS,
  SYNDICATE_MIN_BUY_IN, SYNDICATE_ROUND_MS, SYNDICATE_LADDER,
} from '@/lib/casino/syndicate';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

interface State {
  syndicate: any | null;
  members: any[];
  rounds: any[];
  you: any | null;
}

/** Digits only, regrouped with separators, so the field reads like the rest. */
function useAmountField(initial: string) {
  const [draft, setDraft] = useState(initial);
  const value = Number(draft.replace(/\D/g, '')) || 0;
  const onChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setDraft(digits ? Number(digits).toLocaleString('en-US') : '');
  };
  return { draft, value, onChange, reset: () => setDraft(initial) };
}

export default function CagnottePage() {
  const { user } = useAuth();
  const { balance, setBalance, refresh } = useCasinoWallet();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [duration, setDuration] = useState<number>(10);
  const create = useAmountField('2,000');
  const join = useAmountField('2,000');
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/syndicate${qs}`);
    if (res.ok) setState(await res.json());
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const syn = state?.syndicate;
  const running = syn?.status === 'running';

  // A running pot only advances when somebody asks the server for it, so the
  // page has to keep asking — one round at a time, never overlapping.
  const polling = useRef(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try { await load(); } finally { polling.current = false; }
    }, SYNDICATE_ROUND_MS / 2);
    return () => clearInterval(t);
  }, [running, load]);

  // Once the run closes, the payout landed in the wallet server-side.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (running) { wasRunning.current = true; return; }
    if (wasRunning.current && syn?.status === 'done') {
      wasRunning.current = false;
      const share = Number(state?.you?.payout || 0);
      // The share was credited server-side while the run closed, so the
      // wallet has to come back from the server rather than be guessed at.
      void refresh();
      if (share > 0) sfx.bigWin();
      toast[share > 0 ? 'success' : 'error'](
        share > 0 ? `Cagnotte terminée : +${fmt(share)} ₶` : 'Cagnotte terminée : rien à partager.',
      );
    }
  }, [running, syn?.status, state?.you?.payout, refresh]);

  const post = async (body: Record<string, unknown>) => {
    if (!user) { toast.error('Connecte-toi.'); return null; }
    setBusy(true);
    try {
      const res = await fetch('/api/casino/syndicate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return null; }
      if (typeof data.newBalance === 'number') setBalance(data.newBalance);
      await load();
      return data;
    } finally { setBusy(false); }
  };

  const seedPot = Number(syn?.seed_pot || 0);
  const pot = Number(syn?.pot || 0);
  const delta = seedPot > 0 ? pot / seedPot : 1;

  const remaining = useMemo(() => {
    if (!running || !syn?.ends_at) return 0;
    return Math.max(0, Math.floor((new Date(syn.ends_at).getTime() - now) / 1000));
  }, [running, syn?.ends_at, now]);

  const lastRound = state?.rounds?.length ? state.rounds[state.rounds.length - 1] : null;

  return (
    <main className="min-h-screen bg-transparent text-tx-base pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/casino"
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black leading-none">Cagnotte de groupe</h1>
            <p className="text-[11px] text-tx-muted mt-1">
              Vous misez ensemble, la cagnotte joue toute seule, vous partagez ce qu&apos;il en reste.
            </p>
          </div>
          <button
            onClick={() => { sfx.click(); setShowRules((s) => !s); }}
            className="h-11 px-3 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center gap-1.5 text-tx-secondary focus:outline-none"
          >
            <Info className="h-4 w-4" />
            <span className="font-display font-black text-[11px]">RÈGLES</span>
          </button>
        </div>

        {showRules && (
          <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 text-[12px] text-tx-secondary space-y-2">
            <p>
              Chacun met ce qu&apos;il veut ({fmt(SYNDICATE_MIN_BUY_IN)} ₶ minimum, de{' '}
              {SYNDICATE_MIN_PLAYERS} à {SYNDICATE_MAX_PLAYERS} joueurs). L&apos;hôte lance, et
              toutes les {SYNDICATE_ROUND_MS / 1000} secondes la cagnotte mise 8 % d&apos;elle-même.
            </p>
            <p>
              À la fin, chacun récupère sa part au prorata de ce qu&apos;il a mis. Si la cagnotte
              tombe à zéro, la partie s&apos;arrête net et personne ne récupère rien.
            </p>
            <p className="text-tx-muted">
              Ce n&apos;est pas une machine à sous : sur 5 minutes la cagnotte finit en moyenne un
              peu sous la mise, et plus la partie est longue, plus elle peut tout perdre.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SYNDICATE_LADDER.map((t) => (
                <span key={t.multiplier} className="px-2 py-1 rounded-lg border-2 border-brand-border bg-brand-inner text-[10px] font-bold tabular-nums">
                  {Math.round(t.chance * 100)}% → ×{t.multiplier}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- */}
        {/* No pot: create or join                                      */}
        {/* ---------------------------------------------------------- */}
        {(!syn || syn.status === 'done') && (
          <>
            {syn?.status === 'done' && state?.you && (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-1">
                  Dernière cagnotte · {syn.code}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={cn(
                    'font-display text-2xl font-black tabular-nums',
                    Number(state.you.payout) >= Number(state.you.contribution) ? 'text-accent-success' : 'text-accent-secondary'
                  )}>
                    {Number(state.you.payout) >= Number(state.you.contribution) ? '+' : ''}
                    {fmt(Number(state.you.payout) - Number(state.you.contribution))} ₶
                  </span>
                  <span className="text-[11px] text-tx-muted">
                    misé {fmt(Number(state.you.contribution))} · récupéré {fmt(Number(state.you.payout))}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
              <h2 className="font-display font-black">Créer une cagnotte</h2>

              <div className="grid grid-cols-3 gap-2">
                {SYNDICATE_DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => { sfx.click(); setDuration(d); }}
                    className={cn(
                      'h-14 rounded-xl border-2 font-display font-black focus:outline-none',
                      duration === d ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-brand-border bg-brand-inner text-tx-secondary'
                    )}
                  >
                    <div className="text-sm">{d} min</div>
                    <div className="text-[9px] font-bold opacity-70">
                      {d === 5 ? 'prudent' : d === 10 ? 'équilibré' : 'risqué'}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                  Ta mise
                </label>
                <input
                  type="text" inputMode="numeric" value={create.draft}
                  onChange={(e) => create.onChange(e.target.value)}
                  className="mt-1 w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tabular-nums focus:outline-none focus:border-accent-primary"
                />
              </div>

              <button
                onClick={async () => {
                  vibrate(HAPTIC.MEDIUM);
                  const data = await post({
                    action: 'create', duration_min: duration,
                    min_buy_in: SYNDICATE_MIN_BUY_IN, contribution: create.value,
                  });
                  if (data) toast.success(`Cagnotte ${data.code} créée`);
                }}
                disabled={busy || create.value < SYNDICATE_MIN_BUY_IN || create.value > balance}
                className="w-full h-14 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 focus:outline-none"
              >
                CRÉER
              </button>
            </div>

            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
              <h2 className="font-display font-black">Rejoindre avec un code</h2>
              <div className="flex gap-2">
                <input
                  type="text" value={code} maxLength={6} placeholder="ABC123"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="flex-1 min-w-0 h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tracking-[0.2em] uppercase focus:outline-none focus:border-accent-primary"
                />
                <input
                  type="text" inputMode="numeric" value={join.draft}
                  onChange={(e) => join.onChange(e.target.value)}
                  className="w-32 shrink-0 h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tabular-nums focus:outline-none focus:border-accent-primary"
                />
              </div>
              <button
                onClick={async () => {
                  vibrate(HAPTIC.MEDIUM);
                  const data = await post({ action: 'join', code, contribution: join.value });
                  if (data) toast.success('Tu es dans la cagnotte');
                }}
                disabled={busy || code.length !== 6 || join.value < SYNDICATE_MIN_BUY_IN || join.value > balance}
                className="w-full h-14 rounded-2xl border-4 border-brand-border bg-brand-inner font-display font-black tracking-wider text-tx-secondary hover:border-tx-base disabled:opacity-40 focus:outline-none"
              >
                REJOINDRE
              </button>
            </div>
          </>
        )}

        {/* ---------------------------------------------------------- */}
        {/* A live pot                                                  */}
        {/* ---------------------------------------------------------- */}
        {syn && syn.status !== 'done' && (
          <>
            <div className={cn(
              'rounded-2xl border-4 p-5 text-center',
              running
                ? delta >= 1 ? 'border-accent-success bg-accent-success/5' : 'border-accent-secondary bg-accent-secondary/5'
                : 'border-brand-border bg-brand-card'
            )}>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                {running ? 'Cagnotte en jeu' : 'Cagnotte en préparation'}
              </div>
              <div className="font-display text-5xl font-black tabular-nums mt-1">
                {fmt(pot)} <span className="text-2xl">₶</span>
              </div>

              {running && (
                <>
                  <div className={cn(
                    'inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full font-display font-black text-sm tabular-nums',
                    delta >= 1 ? 'bg-accent-success/15 text-accent-success' : 'bg-accent-secondary/15 text-accent-secondary'
                  )}>
                    {delta >= 1 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    ×{delta.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-tx-muted mt-2 tabular-nums">
                    {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} restantes
                    {lastRound && ` · manche ${lastRound.idx}/${syn.rounds}`}
                  </div>
                </>
              )}

              {!running && (
                <div className="text-[11px] text-tx-muted mt-2">
                  Code <span className="font-display font-black tracking-[0.2em] text-tx-base">{syn.code}</span>
                  {' · '}{syn.duration_min} min
                </div>
              )}
            </div>

            {running && state?.rounds?.length ? (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">
                  Dernières manches
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {state.rounds.slice(-14).map((r: any) => (
                    <div
                      key={r.idx}
                      className={cn(
                        'shrink-0 w-14 rounded-lg border-2 py-1.5 text-center',
                        Number(r.multiplier) >= 1
                          ? 'border-accent-success/50 bg-accent-success/10 text-accent-success'
                          : 'border-accent-secondary/50 bg-accent-secondary/10 text-accent-secondary'
                      )}
                    >
                      <div className="font-display font-black text-[13px] tabular-nums">
                        ×{Number(r.multiplier).toFixed(2)}
                      </div>
                      <div className="text-[8px] font-bold opacity-60 tabular-nums">#{r.idx}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-accent-primary" />
                <span className="font-display font-black text-sm">
                  {state?.members.length}/{SYNDICATE_MAX_PLAYERS} joueurs
                </span>
              </div>

              <div className="space-y-1.5">
                {state?.members.map((m: any) => {
                  const share = seedPot > 0 ? Number(m.contribution) / seedPot : 0;
                  return (
                    <div key={m.user_id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate font-bold">
                        {m.pseudo}
                        {m.user_id === syn.host_id && (
                          <span className="ml-1.5 text-[9px] font-black uppercase text-accent-primary">hôte</span>
                        )}
                      </span>
                      <span className="text-[11px] text-tx-muted tabular-nums shrink-0">
                        {Math.round(share * 100)}%
                      </span>
                      <span className="font-display font-black tabular-nums shrink-0 w-24 text-right">
                        {fmt(Math.floor(pot * share))} ₶
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {!running && (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(syn.code);
                    setCopied(true); sfx.click();
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="w-full h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary flex items-center justify-center gap-2 focus:outline-none"
                >
                  {copied ? <Check className="h-4 w-4 text-accent-success" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'CODE COPIÉ' : `PARTAGER LE CODE ${syn.code}`}
                </button>

                {syn.host_id === user?.id && (
                  <>
                    <button
                      onClick={async () => {
                        vibrate(HAPTIC.MEDIUM);
                        const data = await post({ action: 'start' });
                        if (data) sfx.bigWin();
                      }}
                      disabled={busy || (state?.members.length || 0) < SYNDICATE_MIN_PLAYERS}
                      className="w-full h-14 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal flex items-center justify-center gap-2 hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 focus:outline-none"
                    >
                      <Play className="h-5 w-5" />
                      {(state?.members.length || 0) < SYNDICATE_MIN_PLAYERS
                        ? `IL MANQUE ${SYNDICATE_MIN_PLAYERS - (state?.members.length || 0)} JOUEUR`
                        : 'LANCER'}
                    </button>

                    <button
                      onClick={async () => {
                        const data = await post({ action: 'cancel' });
                        if (data) toast.success(`Annulée · ${fmt(data.refund)} ₶ rendus`);
                      }}
                      disabled={busy}
                      className="w-full h-11 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-[11px] tracking-wider text-tx-muted flex items-center justify-center gap-2 focus:outline-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> ANNULER ET REMBOURSER
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
