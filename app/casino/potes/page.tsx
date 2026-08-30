'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Swords, Gift, UserPlus, MessageSquare, Copy, Check, Send, Trash2, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';
import {
  GIFT_MIN, GIFT_DAILY_LIMIT, giftCoinCost, GIFT_COIN_FEE,
} from '@/lib/casino/social';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

type Tab = 'duels' | 'cadeaux' | 'parrainage' | 'chat';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'duels', label: 'Duels', icon: Swords },
  { id: 'cadeaux', label: 'Cadeaux', icon: Gift },
  { id: 'parrainage', label: 'Parrainage', icon: UserPlus },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
];

/** Digits only, regrouped, like every other amount field in the casino. */
function useAmountField(initial: string) {
  const [draft, setDraft] = useState(initial);
  const value = Number(draft.replace(/\D/g, '')) || 0;
  return {
    draft, value,
    onChange: (raw: string) => {
      const d = raw.replace(/\D/g, '');
      setDraft(d ? Number(d).toLocaleString('en-US') : '');
    },
  };
}

export default function PotesPage() {
  const { user } = useAuth();
  const { balance, setBalance, refresh } = useCasinoWallet();
  const [tab, setTab] = useState<Tab>('duels');

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
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black leading-none">Entre potes</h1>
            <p className="text-[11px] text-tx-muted mt-1">
              Défie, offre, invite, discute.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { sfx.click(); setTab(t.id); }}
              className={cn(
                'h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 focus:outline-none transition-colors',
                tab === t.id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-brand-border bg-brand-card text-tx-secondary hover:text-tx-base'
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="font-display font-black text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>

        {!user && tab !== 'chat' && <NeedsAccount what="défier, offrir et parrainer" />}

        {user && tab === 'duels' && <Duels user={user} balance={balance} setBalance={setBalance} refresh={refresh} />}
        {user && tab === 'cadeaux' && <Cadeaux user={user} balance={balance} setBalance={setBalance} />}
        {user && tab === 'parrainage' && <Parrainage user={user} refresh={refresh} />}
        {tab === 'chat' && <Chat user={user} />}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Duels                                                               */
/* ------------------------------------------------------------------ */

function Duels({ user, balance, setBalance, refresh }: any) {
  const [state, setState] = useState<any>(null);
  const [game, setGame] = useState('slots');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const amount = useAmountField('1,000');

  const load = useCallback(async () => {
    const res = await fetch(`/api/casino/duel${user ? `?user_id=${user.id}` : ''}`);
    if (res.ok) setState(await res.json());
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // Someone accepting or playing their shot changes the row, not our own act.
  useEffect(() => {
    const ch = supabase.channel('casino_duels_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_duels' }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const post = async (body: any) => {
    if (!user) { toast.error('Connecte-toi.'); return null; }
    setBusy(true);
    try {
      const res = await fetch('/api/casino/duel', {
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

  if (!state) return <Skeleton />;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
        <h2 className="font-display font-black">Lancer un défi</h2>
        <p className="text-[11px] text-tx-muted">
          Même mise, même jeu, un seul tirage chacun. Le plus gros multiplicateur rafle les deux mises.
          Égalité, chacun récupère la sienne.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {state.games.map((g: any) => (
            <button
              key={g.slug}
              onClick={() => { sfx.click(); setGame(g.slug); }}
              className={cn(
                'h-11 rounded-xl border-2 font-display font-black text-[11px] focus:outline-none',
                game === g.slug
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-brand-border bg-brand-inner text-tx-secondary'
              )}
            >
              {g.label.replace('Frenly ', '')}
            </button>
          ))}
        </div>

        <input
          type="text" inputMode="numeric" value={amount.draft}
          onChange={(e) => amount.onChange(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tabular-nums focus:outline-none focus:border-accent-primary"
        />

        <button
          onClick={async () => {
            vibrate(HAPTIC.MEDIUM);
            const d = await post({ action: 'create', game, amount: amount.value });
            if (d) toast.success(`Duel ${d.code} créé`);
          }}
          disabled={busy || amount.value < state.min || amount.value > balance}
          className="w-full h-14 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 focus:outline-none"
        >
          DÉFIER
        </button>
      </div>

      <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-2">
        <h2 className="font-display font-black">Rejoindre avec un code</h2>
        <div className="flex gap-2">
          <input
            type="text" value={code} maxLength={6} placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            className="flex-1 min-w-0 h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tracking-[0.2em] uppercase focus:outline-none focus:border-accent-primary"
          />
          <button
            onClick={async () => {
              const d = await post({ action: 'join', code });
              if (d) { setCode(''); toast.success('Duel accepté'); }
            }}
            disabled={busy || code.length !== 6}
            className="h-12 px-4 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary disabled:opacity-40 focus:outline-none"
          >
            REJOINDRE
          </button>
        </div>
      </div>

      {state.mine.length > 0 && (
        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
          <h2 className="font-display font-black mb-2">Tes duels</h2>
          <div className="space-y-2">
            {state.mine.map((d: any) => (
              <DuelRow
                key={d.id} duel={d} me={user?.id} busy={busy}
                onPlay={async () => {
                  const r = await post({ action: 'play', duel_id: d.id });
                  if (r) { sfx.bigWin(); void refresh(); toast.success(`Ton tirage : ×${r.multiplier}`); }
                }}
                onCancel={async () => {
                  const r = await post({ action: 'cancel', duel_id: d.id });
                  if (r) toast.success(`Annulé · ${fmt(r.refund)} ₶ rendus`);
                }}
                onCopy={() => {
                  void navigator.clipboard.writeText(d.code);
                  setCopied(d.code); setTimeout(() => setCopied(null), 1500);
                }}
                copied={copied === d.code}
              />
            ))}
          </div>
        </div>
      )}

      {state.open.length > 0 && (
        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
          <h2 className="font-display font-black mb-2">Défis ouverts</h2>
          <div className="space-y-2">
            {state.open.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="font-display font-black text-[12px] truncate">{d.challenger_pseudo}</div>
                  <div className="text-[10px] text-tx-muted">{d.game_slug} · {fmt(Number(d.amount))} ₶</div>
                </div>
                <button
                  onClick={async () => { const r = await post({ action: 'join', code: d.code }); if (r) toast.success('Duel accepté'); }}
                  disabled={busy || Number(d.amount) > balance}
                  className="h-9 px-3 shrink-0 rounded-lg bg-accent-primary text-brand-bg font-display font-black text-[10px] tracking-wider disabled:opacity-40 focus:outline-none"
                >
                  RELEVER
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DuelRow({ duel, me, busy, onPlay, onCancel, onCopy, copied }: any) {
  const isChallenger = duel.challenger_id === me;
  const mine = isChallenger ? duel.challenger_multiplier : duel.opponent_multiplier;
  const theirs = isChallenger ? duel.opponent_multiplier : duel.challenger_multiplier;
  const foe = isChallenger ? duel.opponent_pseudo : duel.challenger_pseudo;

  const done = duel.status === 'done';
  const won = done && duel.winner_id === me;
  const draw = done && duel.winner_id === null;

  return (
    <div className={cn(
      'rounded-xl border-2 p-2.5',
      done ? (draw ? 'border-brand-border bg-brand-inner' : won ? 'border-accent-success bg-accent-success/10' : 'border-accent-secondary bg-accent-secondary/10')
           : 'border-brand-border bg-brand-inner'
    )}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display font-black text-[12px] truncate">
            {duel.game_slug} · {fmt(Number(duel.amount))} ₶
          </div>
          <div className="text-[10px] text-tx-muted truncate">
            {duel.status === 'open' ? `Code ${duel.code} · en attente`
              : duel.status === 'cancelled' ? 'Annulé'
              : `contre ${foe || '···'}`}
          </div>
        </div>

        {duel.status === 'open' && (
          <>
            <button onClick={onCopy} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border flex items-center justify-center focus:outline-none">
              {copied ? <Check className="h-3.5 w-3.5 text-accent-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onCancel} disabled={busy} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border flex items-center justify-center text-tx-muted focus:outline-none">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {duel.status === 'playing' && mine === null && (
          <button
            onClick={onPlay}
            disabled={busy}
            className="h-9 px-3 shrink-0 rounded-lg bg-accent-primary text-brand-bg font-display font-black text-[10px] tracking-wider flex items-center gap-1 disabled:opacity-40 focus:outline-none"
          >
            <Play className="h-3 w-3" /> JOUER
          </button>
        )}
      </div>

      {(mine !== null || theirs !== null) && (
        <div className="flex items-center gap-3 mt-2 text-[11px] font-bold tabular-nums">
          <span>Toi <b className="font-display">{mine !== null ? `×${Number(mine).toFixed(2)}` : '···'}</b></span>
          <span className="text-tx-muted">vs</span>
          <span>{foe} <b className="font-display">{theirs !== null ? `×${Number(theirs).toFixed(2)}` : '···'}</b></span>
          {done && (
            <span className={cn('ml-auto font-display font-black', draw ? 'text-tx-muted' : won ? 'text-accent-success' : 'text-accent-secondary')}>
              {draw ? 'ÉGALITÉ' : won ? `+${fmt(Number(duel.amount))} ₶` : `−${fmt(Number(duel.amount))} ₶`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadeaux                                                             */
/* ------------------------------------------------------------------ */

function Cadeaux({ user, balance, setBalance }: any) {
  const [state, setState] = useState<any>(null);
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = useAmountField('1,000');

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/casino/gifts?user_id=${user.id}`);
    if (res.ok) setState(await res.json());
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (!state) return <Skeleton />;

  const cost = giftCoinCost(amount.value);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
        <h2 className="font-display font-black">Offrir des jetons</h2>
        <p className="text-[11px] text-tx-muted">
          Le transfert coûte {Math.round(GIFT_COIN_FEE * 100)} % de frais — sans quoi la même pile
          tournerait en boucle entre vous. {GIFT_DAILY_LIMIT} cadeaux par jour
          ({state.sentToday}/{GIFT_DAILY_LIMIT} aujourd&apos;hui).
        </p>

        <input
          type="text" value={to} placeholder="Pseudo du destinataire"
          onChange={(e) => setTo(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-bold focus:outline-none focus:border-accent-primary"
        />
        <input
          type="text" inputMode="numeric" value={amount.draft}
          onChange={(e) => amount.onChange(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tabular-nums focus:outline-none focus:border-accent-primary"
        />
        <input
          type="text" value={message} maxLength={200} placeholder="Petit mot (facultatif)"
          onChange={(e) => setMessage(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner text-sm focus:outline-none focus:border-accent-primary"
        />

        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className="text-tx-muted">Il reçoit {fmt(amount.value)} ₶</span>
          <span className={cn('tabular-nums', cost > balance ? 'text-accent-secondary' : 'text-tx-base')}>
            Ça te coûte {fmt(cost)} ₶
          </span>
        </div>

        <button
          onClick={async () => {
            if (!user) { toast.error('Connecte-toi.'); return; }
            setBusy(true);
            try {
              const res = await fetch('/api/casino/gifts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, to, amount: amount.value, message }),
              });
              const data = await res.json();
              if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
              setBalance(data.newBalance);
              sfx.bigWin();
              toast.success(`${data.delivered} envoyé à ${to}`);
              setTo(''); setMessage('');
              void load();
            } finally { setBusy(false); }
          }}
          disabled={busy || !to.trim() || amount.value < GIFT_MIN || cost > balance || state.sentToday >= GIFT_DAILY_LIMIT}
          className="w-full h-14 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 focus:outline-none"
        >
          OFFRIR
        </button>
      </div>

      <GiftList title="Reçus" rows={state.received} kind="received" />
      <GiftList title="Envoyés" rows={state.sent} kind="sent" />
    </div>
  );
}

function GiftList({ title, rows, kind }: { title: string; rows: any[]; kind: 'received' | 'sent' }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
      <h2 className="font-display font-black mb-2">{title}</h2>
      <div className="space-y-1.5">
        {rows.map((g, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="flex-1 min-w-0 truncate font-bold">{g.pseudo}</span>
            {g.message && <span className="text-tx-muted truncate max-w-[40%]">« {g.message} »</span>}
            <span className={cn('font-display font-black tabular-nums shrink-0', kind === 'received' ? 'text-accent-success' : 'text-tx-secondary')}>
              {kind === 'received' ? '+' : '−'}{fmt(kind === 'received' ? g.amount : g.cost)} ₶
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parrainage                                                          */
/* ------------------------------------------------------------------ */

function Parrainage({ user, refresh }: any) {
  const [state, setState] = useState<any>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/casino/referral?user_id=${user.id}`);
    if (res.ok) setState(await res.json());
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  if (!state) return <Skeleton />;

  const post = async (body: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/casino/referral', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return null; }
      await load();
      return data;
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
        <h2 className="font-display font-black">Ton code</h2>
        <p className="text-[11px] text-tx-muted">
          Quand ton filleul a misé {fmt(state.goal)} ₶ en tout, tu touches{' '}
          <b className="text-accent-success">{fmt(state.rewardInviter)} ₶</b> et lui{' '}
          <b className="text-accent-success">{fmt(state.rewardNewcomer)} ₶</b>.
        </p>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(state.code || '');
            setCopied(true); sfx.click(); setTimeout(() => setCopied(false), 1600);
          }}
          className="w-full h-14 rounded-xl border-2 border-accent-primary bg-accent-primary/10 font-display font-black text-xl tracking-[0.3em] text-accent-primary flex items-center justify-center gap-3 focus:outline-none"
        >
          {state.code || '······'}
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {!state.referredBy && (
        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-2">
          <h2 className="font-display font-black">Tu as été invité ?</h2>
          <p className="text-[11px] text-tx-muted">Un seul parrain, et c&apos;est définitif.</p>
          <div className="flex gap-2">
            <input
              type="text" value={code} maxLength={6} placeholder="ABC123"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="flex-1 min-w-0 h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tracking-[0.2em] uppercase focus:outline-none focus:border-accent-primary"
            />
            <button
              onClick={async () => { const d = await post({ code }); if (d) toast.success('Parrain enregistré'); }}
              disabled={busy || code.length !== 6}
              className="h-12 px-4 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary disabled:opacity-40 focus:outline-none"
            >
              VALIDER
            </button>
          </div>
        </div>
      )}

      {state.claimable && (
        <button
          onClick={async () => {
            const d = await post({ action: 'claim' });
            if (d) { sfx.bigWin(); void refresh(); toast.success(`+${fmt(d.reward)} ₶`); }
          }}
          disabled={busy}
          className="w-full h-14 rounded-2xl bg-accent-success text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal focus:outline-none"
        >
          RÉCLAMER {fmt(state.rewardNewcomer)} ₶
        </button>
      )}

      {state.invited.length > 0 && (
        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
          <h2 className="font-display font-black mb-2">Tes filleuls</h2>
          <div className="space-y-2">
            {state.invited.map((f: any, i: number) => {
              const pct = Math.min(100, Math.round((f.wagered / f.goal) * 100));
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="truncate">{f.pseudo}</span>
                    <span className={cn('tabular-nums', f.paid ? 'text-accent-success' : 'text-tx-muted')}>
                      {f.paid ? 'payé' : `${pct}%`}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                    <div className={cn('h-full', f.paid ? 'bg-accent-success' : 'bg-accent-primary')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function Chat({ user }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/casino/chat');
    if (res.ok) setMessages((await res.json()).messages);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel('casino_chat_room')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'casino_chat' }, (p) => {
        setMessages((m) => [...m, p.new].slice(-60));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    if (!user) { toast.error('Connecte-toi.'); return; }
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch('/api/casino/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, body: text }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setBody('');
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 flex flex-col">
      <div className="h-[46dvh] overflow-y-auto space-y-1.5 pr-1">
        {messages.length === 0 && <p className="text-[11px] text-tx-muted">Personne n&apos;a encore parlé.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn('text-[12px]', m.user_id === user?.id && 'text-right')}>
            <span className="font-display font-black text-accent-primary">{m.pseudo}</span>
            <span className="text-tx-muted"> · </span>
            <span className="text-tx-secondary break-words">{m.body}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <input
          type="text" value={body} maxLength={300} placeholder="Écris quelque chose…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          className="flex-1 min-w-0 h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner text-sm focus:outline-none focus:border-accent-primary"
        />
        <button
          onClick={send}
          disabled={busy || !body.trim()}
          className="h-12 w-12 shrink-0 rounded-xl bg-accent-primary text-brand-bg flex items-center justify-center disabled:opacity-40 focus:outline-none"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-48 rounded-2xl border-2 border-brand-border bg-brand-inner animate-pulse" />;
}

/**
 * Logged out, none of this has anything to load — without this the panels sat
 * on a skeleton that never resolved, which reads as a broken page rather than
 * as a sign-in prompt.
 */
function NeedsAccount({ what }: { what: string }) {
  return (
    <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-6 text-center">
      <p className="text-sm text-tx-secondary">
        Connecte-toi pour {what}.
      </p>
    </div>
  );
}
