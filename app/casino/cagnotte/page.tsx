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
  SYNDICATE_MIN_BUY_IN,
} from '@/lib/casino/syndicate';
import Arena from './Arena';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

interface State {
  syndicate: any | null;
  members: any[];
  feed: any[];
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
  const { balance, walletBalance, syndicate: live, setBalance, refresh } = useCasinoWallet();
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

  // The pot itself arrives over the table, so this only refreshes the parts
  // that do not: who is in, and what everyone has been betting.
  const polling = useRef(false);
  useEffect(() => {
    if (!syn || syn.status === 'done') return;
    const t = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try { await load(); } finally { polling.current = false; }
    }, 3000);
    return () => clearInterval(t);
  }, [syn, load]);

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

  const seedPot = Number(live?.seedPot ?? syn?.seed_pot ?? 0);
  const pot = Number(live?.pot ?? syn?.pot ?? 0);
  const delta = seedPot > 0 ? pot / seedPot : 1;

  const endsAt = live?.endsAt ?? syn?.ends_at;
  const remaining = useMemo(() => {
    if (!running || !endsAt) return 0;
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  }, [running, endsAt, now]);

  // The run ends on the clock, and nothing server-side is watching it — so the
  // page that notices asks for the split.
  useEffect(() => {
    if (running && remaining === 0) void load();
  }, [running, remaining, load]);

  // A run in progress takes over the whole screen: from here until the split,
  // this is the only page there is.
  if (running && syn) {
    return (
      <Arena
        code={syn.code}
        pot={pot}
        seedPot={seedPot}
        remaining={remaining}
        members={state?.members || []}
        feed={state?.feed || []}
        walletBalance={walletBalance}
        hostPseudo={state?.members.find((m: any) => m.user_id === syn.host_id)?.pseudo}
      />
    );
  }

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
              Vous misez ensemble, vous jouez avec la cagnotte, vous partagez ce qu&apos;il en reste.
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
              pendant toute la durée choisie <b className="text-tx-base">vous jouez tous avec la
              cagnotte au lieu de votre argent</b> : vos mises sortent d&apos;elle, vos gains y
              retournent, et tout le monde voit le même total bouger en direct.
            </p>
            <p>
              À la fin du temps, la cagnotte est partagée au prorata de ce que chacun a mis au
              départ. Si elle tombe à zéro, la partie s&apos;arrête net et personne ne récupère
              rien.
            </p>
            <p className="text-tx-muted">
              Les jeux gardent leur redistribution habituelle, entre 93 % et 98 %. La cagnotte
              s&apos;érode donc doucement d&apos;elle-même : c&apos;est une bonne série qui la fait
              monter, pas le temps qui passe.
            </p>
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
        {/* A pot waiting to start                                      */}
        {/* ---------------------------------------------------------- */}
        {syn && syn.status === 'open' && (
          <>
            <div className="rounded-2xl border-4 border-brand-border bg-brand-card p-5 text-center">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                Cagnotte en préparation
              </div>
              <div className="font-display text-5xl font-black tabular-nums mt-1">
                {fmt(pot)} <span className="text-2xl">₶</span>
              </div>
              <div className="text-[11px] text-tx-muted mt-2">
                Code <span className="font-display font-black tracking-[0.2em] text-tx-base">{syn.code}</span>
                {' · '}{syn.duration_min} min
              </div>
              <div className="text-[11px] text-accent-primary font-bold mt-2">
                Une fois lancée, vous restez tous dedans jusqu&apos;à la fin.
              </div>
            </div>

            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-accent-primary" />
                <span className="font-display font-black text-sm">
                  {state?.members.length}/{SYNDICATE_MAX_PLAYERS} joueurs
                </span>
              </div>
              <div className="space-y-1.5">
                {state?.members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 min-w-0 truncate font-bold">
                      {m.pseudo}
                      {m.user_id === syn.host_id && (
                        <span className="ml-1.5 text-[9px] font-black uppercase text-accent-primary">hôte</span>
                      )}
                    </span>
                    <span className="text-[11px] text-tx-muted tabular-nums shrink-0">
                      {seedPot > 0 ? Math.round((Number(m.contribution) / seedPot) * 100) : 0}%
                    </span>
                    <span className="font-display font-black tabular-nums shrink-0 w-24 text-right">
                      {fmt(Number(m.contribution))} ₶
                    </span>
                  </div>
                ))}
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
