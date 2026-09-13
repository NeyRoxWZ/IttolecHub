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
import type { PortPlayer } from './usePresence';

interface Community {
  weekly: { userId: string; pseudo: string; points: number; maree: number }[];
  marees: { userId: string; pseudo: string; maree: number; earned: number }[];
  feed: { id: number; pseudo: string; userId: string; speciesId: string; rarity: number; variant: string; weight: number; jackpot: number | null; at: string }[];
  boss: { name: string; maxHp: number; damage: number; defeated: boolean; top: { pseudo: string; damage: number }[]; mine: { damage: number; claimed: boolean }; reward: { coins: number; packs: number; perles: number } };
  jackpot: { value: number; lastWinner: string | null; lastAmount: number | null; lastAt: string | null };
}

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function Box({ title, icon: Icon, children, right }: { title: string; icon: typeof Crown; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-display text-xl flex items-center gap-1.5"><Icon className="h-5 w-5 text-accent-primary" /> {title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** The shared side of the game: jackpot, weekly monster, leaderboards, live catches, who is here. */
export default function CommunityPanel({ userId, api, port, onOpenCard }: { userId: string; api: Api; port: PortPlayer[]; onOpenCard: (id: string) => void }) {
  const [data, setData] = useState<Community | null>(null);
  const [board, setBoard] = useState<'weekly' | 'marees'>('weekly');

  const load = useCallback(() => {
    fetch(`/api/peche?user_id=${userId}&view=community`).then((r) => r.json()).then((d) => d.community && setData(d.community));
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="h-64 rounded-2xl border-[3px] border-brand-border bg-brand-inner animate-pulse" />;
  const boss = data.boss;
  const hpLeft = Math.max(0, boss.maxHp - boss.damage);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-[3px] border-brand-border p-3 text-brand-bg" style={{ background: '#FFC61A', boxShadow: 'inset 0 -5px 0 #D98E00' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-display text-xl flex items-center gap-1.5"><Sparkles className="h-5 w-5" /> Jackpot du Poisson doré</div>
        </div>
        <div className="font-display text-4xl leading-tight tabular-nums">{fmtBig(data.jackpot.value)} ₶</div>
        <p className="text-xs font-black">
          Une part de chaque vente de tous les joueurs le remplit. Attrape un poisson doré pour tout rafler.
          {data.jackpot.lastWinner && data.jackpot.lastAmount ? ` Dernier gagnant : ${data.jackpot.lastWinner}.` : ''}
        </p>
      </div>

      <Box title={`${boss.name} de la semaine`} icon={Skull} right={boss.defeated ? <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-success text-brand-bg font-display text-sm">Vaincu</span> : undefined}>
        <p className="text-xs font-bold text-tx-secondary mb-2">Chaque poisson attrapé par n’importe qui lui inflige des points de dégâts (plus il est rare, plus ça tape). Vaincu, il récompense tous ceux qui ont participé.</p>
        <div className="h-5 rounded-full bg-brand-bg border-[3px] border-brand-border overflow-hidden">
          <div className="h-full bg-accent-secondary transition-[width] duration-700" style={{ width: `${(hpLeft / boss.maxHp) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs font-black text-tx-secondary tabular-nums">
          <span>{fmtBig(hpLeft)} / {fmtBig(boss.maxHp)} PV</span>
          <span>Tes dégâts : {fmtBig(boss.mine.damage)}</span>
        </div>
        {boss.top.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {boss.top.slice(0, 5).map((t, i) => (
              <div key={t.pseudo} className="flex items-center gap-2 text-sm font-bold">
                <span className="w-4 text-tx-secondary">{i + 1}</span>
                <span className="flex-1 truncate">{t.pseudo}</span>
                <span className="tabular-nums text-tx-secondary">{fmtBig(t.damage)}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={async () => { const r = await api('boss'); if (r) { sfx.jackpot(); toast.success(`+${fmtBig(r.coins)} ₶, ${r.packs} coffres et ${r.perles} Perles`); load(); } }}
          disabled={!boss.defeated || boss.mine.damage <= 0 || boss.mine.claimed}
          className={cn(BRAWL.green, 'mt-2 w-full h-11 text-base')}
        >
          {boss.mine.claimed ? 'Récompense récupérée' : `Récupérer · ${fmtBig(boss.reward.coins)} ₶ + ${boss.reward.packs} coffres`}
        </button>
      </Box>

      <Box title="Classements" icon={Crown}>
        <div className="grid grid-cols-2 gap-1 mb-2 rounded-xl border-[3px] border-brand-border bg-brand-bg p-1">
          {(['weekly', 'marees'] as const).map((b) => (
            <button key={b} onClick={() => setBoard(b)} className={cn('h-9 rounded-lg font-display text-sm', board === b ? 'bg-accent-primary text-brand-bg' : 'text-tx-secondary')}>
              {b === 'weekly' ? 'Points de la semaine' : 'Marées'}
            </button>
          ))}
        </div>
        {board === 'weekly' && (
          <p className="text-[11px] font-bold text-tx-secondary mb-1.5">Les points ne dépendent que de la rareté du poisson : un nouveau pêcheur peut battre un ancien. Remise à zéro le lundi.</p>
        )}
        <div className="space-y-1">
          {(board === 'weekly' ? data.weekly : data.marees).map((r, i) => {
            const b = mareeBadge(r.maree);
            return (
              <button key={r.userId} onClick={() => onOpenCard(r.userId)}
                className={cn('w-full flex items-center gap-2 rounded-xl border-2 border-brand-border px-2 py-1.5 text-left', r.userId === userId ? 'bg-[#3A3A20]' : 'bg-brand-card hover:bg-[#2B3170]')}>
                <span className={cn('w-6 font-display', i < 3 ? 'text-accent-primary' : 'text-tx-secondary')}>{i + 1}</span>
                <span className="flex-1 min-w-0 truncate font-display">{r.pseudo}</span>
                <span className="px-1.5 rounded-md border-2 border-brand-border text-xs font-black" style={{ background: b.fill, color: b.text }}>M{r.maree}</span>
                <span className="font-display tabular-nums">{board === 'weekly' ? `${fmtBig((r as { points: number }).points)} pts` : `${fmtBig((r as { earned: number }).earned)} ₶`}</span>
              </button>
            );
          })}
          {(board === 'weekly' ? data.weekly : data.marees).length === 0 && <p className="text-sm font-bold text-tx-secondary">Personne pour l’instant.</p>}
        </div>
      </Box>

      <Box title="Au port maintenant" icon={Users} right={<span className="font-display text-tx-secondary">{port.length}</span>}>
        <div className="flex flex-wrap gap-1.5">
          {port.map((p) => (
            <button key={p.userId} onClick={() => onOpenCard(p.userId)} className="flex items-center gap-1.5 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1 hover:bg-[#2B3170]">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-success" />
              <span className="font-display text-sm">{p.pseudo}</span>
              <span className="text-[11px] font-bold text-tx-secondary">{zoneInfo(p.zone).name}</span>
            </button>
          ))}
          {port.length === 0 && <p className="text-sm font-bold text-tx-secondary">Personne d’autre pour l’instant.</p>}
        </div>
      </Box>

      <Box title="En direct" icon={Radio}>
        <p className="text-[11px] font-bold text-tx-secondary mb-1.5">Les légendaires, mythiques et variantes de tout le monde.</p>
        <div className="space-y-1.5">
          {data.feed.map((f) => {
            const sp = getSpecies(f.speciesId);
            if (!sp) return null;
            return (
              <div key={f.id} className={cn('flex items-center gap-2 rounded-xl border-2 border-brand-border px-2 py-1', f.jackpot ? 'bg-[#4A3F1E]' : 'bg-brand-card')}>
                <FishIcon color={sp.color} rarity={sp.rarity} size={38} variant={f.variant} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-sm font-bold truncate">
                    <button onClick={() => onOpenCard(f.userId)} className="font-display hover:text-accent-primary">{f.pseudo}</button>
                    {' · '}<span style={{ color: RARITIES[f.rarity].color }}>{sp.name}{f.variant ? ` ${VARIANTS[f.variant as keyof typeof VARIANTS].label.toLowerCase()}` : ''}</span>
                  </div>
                  <div className="text-[11px] font-bold text-tx-secondary">
                    {fmtKg(f.weight)}{f.jackpot ? ` · JACKPOT +${fmtBig(f.jackpot)} ₶` : ''}
                  </div>
                </div>
                <span className="text-[11px] font-bold text-tx-secondary shrink-0">{ago(f.at)}</span>
              </div>
            );
          })}
          {data.feed.length === 0 && <p className="text-sm font-bold text-tx-secondary">Aucune belle prise pour l’instant.</p>}
        </div>
      </Box>
    </div>
  );
}
