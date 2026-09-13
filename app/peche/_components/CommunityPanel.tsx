'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Crown, Radio, Skull, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { RARITIES, VARIANTS, getSpecies, mareeBadge, zoneInfo } from '@/lib/peche/data';
import { fmtBig, fmtKg } from '@/lib/peche/format';
import FishIcon from './FishIcon';
import type { PortPlayer } from './usePort';

interface Community {
  weekly: { userId: string; pseudo: string; points: number; maree: number }[];
  marees: { userId: string; pseudo: string; maree: number; earned: number }[];
  feed: { id: number; pseudo: string; userId: string; speciesId: string; rarity: number; variant: string; weight: number; jackpot: number | null; at: string }[];
  boss: { name: string; maxHp: number; damage: number; defeated: boolean; top: { pseudo: string; damage: number }[]; mine: { damage: number; claimed: boolean }; reward: { coins: number; packs: number; perles: number } };
  jackpot: { value: number; lastWinner: string | null; lastAmount: number | null; lastAt: string | null };
}

export type CommunitySection = 'classement' | 'monstre' | 'jackpot' | 'direct' | 'port';

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function Title({ icon: Icon, children, right }: { icon: typeof Crown; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="font-display text-2xl flex items-center gap-2"><Icon className="h-6 w-6 text-accent-primary" /> {children}</div>
      {right}
    </div>
  );
}

/** One shared corner of the game at a time: each has its own tab. */
export default function CommunityPanel({
  section, userId, api, port, onOpenCard,
}: {
  section: CommunitySection; userId: string; api: Api; port: PortPlayer[]; onOpenCard: (id: string) => void;
}) {
  const [data, setData] = useState<Community | null>(null);
  const [board, setBoard] = useState<'weekly' | 'marees'>('weekly');

  const load = useCallback(() => {
    fetch(`/api/peche?user_id=${userId}&view=community`).then((r) => r.json()).then((d) => d.community && setData(d.community));
  }, [userId]);

  useEffect(() => {
    if (section === 'port') return;
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load, section]);

  if (section === 'port') {
    return (
      <div>
        <Title icon={Users} right={<span className="font-display text-xl text-tx-secondary">{port.length}</span>}>Au port maintenant</Title>
        <p className="text-sm font-bold text-tx-secondary mb-3">Les pêcheurs connectés en ce moment, où ils pêchent et dans quel mode. Au port public, tu vois leurs bateaux et leurs prises sur la scène.</p>
        <div className="space-y-1.5">
          {port.map((p) => {
            const b = mareeBadge(p.maree);
            return (
              <button key={p.userId} onClick={() => onOpenCard(p.userId)} className={cn('w-full flex items-center gap-2 rounded-xl border-2 border-brand-border px-2.5 py-2 text-left', p.userId === userId ? 'bg-[#3A3A20]' : 'bg-brand-card hover:bg-[#2B3170]')}>
                <span className="h-3 w-3 rounded-full bg-accent-success border-2 border-brand-border" />
                <span className="flex-1 min-w-0 truncate font-display text-lg">{p.pseudo}</span>
                <span className={cn('px-1.5 rounded-md border-2 border-brand-border text-xs font-black', p.mode === 'public' ? 'bg-accent-info text-white' : 'bg-brand-bg text-tx-secondary')}>{p.mode === 'public' ? 'Port public' : 'Solo'}</span>
                <span className="text-xs font-bold text-tx-secondary">{zoneInfo(p.zone).name}</span>
                <span className="px-1.5 rounded-md border-2 border-brand-border text-xs font-black" style={{ background: b.fill, color: b.text }}>M{p.maree}</span>
              </button>
            );
          })}
          {port.length === 0 && <p className="text-sm font-bold text-tx-secondary">Personne pour l’instant.</p>}
        </div>
      </div>
    );
  }

  if (!data) return <div className="h-64 rounded-2xl border-[3px] border-brand-border bg-brand-inner animate-pulse" />;

  if (section === 'jackpot') {
    return (
      <div className="space-y-3">
        <Title icon={Sparkles}>Jackpot du Poisson doré</Title>
        <div className="rounded-2xl border-4 border-brand-border p-4 text-brand-bg text-center" style={{ background: '#FFC61A', boxShadow: 'inset 0 -6px 0 #D98E00, 0 6px 0 #05061A' }}>
          <div className="text-sm font-black">Cagnotte actuelle</div>
          <div className="font-display text-5xl leading-tight tabular-nums">{fmtBig(data.jackpot.value)} ₶</div>
        </div>
        <p className="text-sm font-bold text-tx-secondary">Une petite part de chaque vente de tous les joueurs part dans la cagnotte. Le premier qui attrape un poisson doré, n’importe où, rafle tout, et la cagnotte repart.</p>
        {data.jackpot.lastWinner && (
          <div className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2 font-bold">
            Dernier gagnant : <span className="font-display text-accent-primary">{data.jackpot.lastWinner}</span>
            {data.jackpot.lastAmount ? ` · ${fmtBig(data.jackpot.lastAmount)} ₶` : ''}{data.jackpot.lastAt ? ` · il y a ${ago(data.jackpot.lastAt)}` : ''}
          </div>
        )}
      </div>
    );
  }

  if (section === 'monstre') {
    const boss = data.boss;
    const hpLeft = Math.max(0, boss.maxHp - boss.damage);
    return (
      <div className="space-y-3">
        <Title icon={Skull} right={boss.defeated ? <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-success text-brand-bg font-display">Vaincu</span> : undefined}>{boss.name}</Title>
        <p className="text-sm font-bold text-tx-secondary">Le monstre de la semaine. Chaque poisson attrapé par n’importe qui lui inflige ses points de rareté en dégâts. Vaincu, il récompense tous ceux qui ont participé.</p>
        <div className="h-7 rounded-full bg-brand-bg border-4 border-brand-border overflow-hidden">
          <div className="h-full bg-accent-secondary transition-[width] duration-700" style={{ width: `${(hpLeft / boss.maxHp) * 100}%` }} />
        </div>
        <div className="flex justify-between font-black text-tx-secondary tabular-nums">
          <span>{fmtBig(hpLeft)} / {fmtBig(boss.maxHp)} PV</span>
          <span>Tes dégâts : {fmtBig(boss.mine.damage)}</span>
        </div>
        <button
          onClick={async () => { const r = await api('boss'); if (r) { sfx.jackpot(); toast.success(`+${fmtBig(r.coins)} ₶, ${r.packs} coffres et ${r.perles} Perles`); load(); } }}
          disabled={!boss.defeated || boss.mine.damage <= 0 || boss.mine.claimed}
          className={cn(BRAWL.green, 'w-full h-12 text-lg')}
        >
          {boss.mine.claimed ? 'Récompense récupérée' : `Récompense : ${fmtBig(boss.reward.coins)} ₶ + ${boss.reward.packs} coffres + ${boss.reward.perles} Perles`}
        </button>
        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
          <div className="font-display text-lg mb-1">Ceux qui tapent le plus</div>
          {boss.top.length === 0 ? <p className="text-sm font-bold text-tx-secondary">Personne pour l’instant.</p> : boss.top.map((t, i) => (
            <div key={t.pseudo} className="flex items-center gap-2 font-bold py-0.5">
              <span className={cn('w-5 font-display', i < 3 ? 'text-accent-primary' : 'text-tx-secondary')}>{i + 1}</span>
              <span className="flex-1 truncate">{t.pseudo}</span>
              <span className="tabular-nums text-tx-secondary">{fmtBig(t.damage)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'classement') {
    const rows = board === 'weekly' ? data.weekly : data.marees;
    return (
      <div className="space-y-3">
        <Title icon={Crown}>Classement</Title>
        <div className="grid grid-cols-2 gap-1 rounded-[18px] border-[3px] border-brand-border bg-brand-bg p-1">
          {(['weekly', 'marees'] as const).map((b) => (
            <button key={b} onClick={() => setBoard(b)} className={cn('h-10 rounded-xl font-display', board === b ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-3px_0_#D98E00]' : 'text-tx-secondary')}>
              {b === 'weekly' ? 'Points de la semaine' : 'Marées'}
            </button>
          ))}
        </div>
        {board === 'weekly' && (
          <p className="text-xs font-bold text-tx-secondary">Les points ne dépendent que de la rareté des poissons : un nouveau pêcheur peut battre un ancien. Remise à zéro le lundi.</p>
        )}
        <div className="space-y-1.5">
          {rows.map((r, i) => {
            const b = mareeBadge(r.maree);
            return (
              <button key={r.userId} onClick={() => onOpenCard(r.userId)}
                className={cn('w-full flex items-center gap-2 rounded-xl border-2 border-brand-border px-2.5 py-2 text-left', r.userId === userId ? 'bg-[#3A3A20]' : 'bg-brand-card hover:bg-[#2B3170]')}>
                <span className={cn('w-7 font-display text-lg', i < 3 ? 'text-accent-primary' : 'text-tx-secondary')}>{i + 1}</span>
                <span className="flex-1 min-w-0 truncate font-display text-lg">{r.pseudo}</span>
                <span className="px-1.5 rounded-md border-2 border-brand-border text-xs font-black" style={{ background: b.fill, color: b.text }}>M{r.maree}</span>
                <span className="font-display tabular-nums">{board === 'weekly' ? `${fmtBig((r as { points: number }).points)} pts` : `${fmtBig((r as { earned: number }).earned)} ₶`}</span>
              </button>
            );
          })}
          {rows.length === 0 && <p className="text-sm font-bold text-tx-secondary">Personne pour l’instant.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Title icon={Radio}>En direct</Title>
      <p className="text-sm font-bold text-tx-secondary">Les légendaires, mythiques, variantes et jackpots de tout le monde, au fil de l’eau.</p>
      {data.feed.map((f) => {
        const sp = getSpecies(f.speciesId);
        if (!sp) return null;
        return (
          <div key={f.id} className={cn('flex items-center gap-2 rounded-xl border-2 border-brand-border px-2 py-1.5', f.jackpot ? 'bg-[#4A3F1E]' : 'bg-brand-card')}>
            <FishIcon color={sp.color} rarity={sp.rarity} size={42} variant={f.variant} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-sm font-bold truncate">
                <button onClick={() => onOpenCard(f.userId)} className="font-display hover:text-accent-primary">{f.pseudo}</button>
                {' · '}<span style={{ color: RARITIES[f.rarity].color }}>{sp.name}{f.variant ? ` ${VARIANTS[f.variant as keyof typeof VARIANTS].label.toLowerCase()}` : ''}</span>
              </div>
              <div className="text-[11px] font-bold text-tx-secondary">{fmtKg(f.weight)}{f.jackpot ? ` · JACKPOT +${fmtBig(f.jackpot)} ₶` : ''}</div>
            </div>
            <span className="text-[11px] font-bold text-tx-secondary shrink-0">{ago(f.at)}</span>
          </div>
        );
      })}
      {data.feed.length === 0 && <p className="text-sm font-bold text-tx-secondary">Aucune belle prise pour l’instant.</p>}
    </div>
  );
}
