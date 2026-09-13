'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dices, Crown, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShortNumber } from '@/lib/itollec-clicker/format';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (x: number) => `${Math.round(x * 100)} %`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)} ₶`;

/** Clicker numbers outgrow Intl's compact notation; the game's formatter names them. */
const big = (n: number) => (Math.abs(n) < 1_000_000 ? fmt(n) : formatShortNumber(n));

/**
 * Every figure is the same small tile, so a block reads as one even grid
 * instead of a stack of cards of different sizes.
 */
function Tile({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-3 py-2 min-w-0">
      <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted truncate">{label}</div>
      <div className={cn(
        'font-display text-lg tabular-nums truncate',
        tone === 'up' && 'text-accent-success',
        tone === 'down' && 'text-accent-secondary'
      )}>
        {value}
      </div>
    </div>
  );
}

function Block({ title, icon: Icon, href, children }: {
  title: string; icon: any; href: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-brand-card border-4 border-brand-border rounded-[28px] p-4 sm:p-5 shadow-brutal">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent-primary" /> {title}
        </h3>
        <Link
          href={href}
          className="h-8 px-3 rounded-lg border-[3px] border-brand-border bg-brand-inner font-display text-[10px] flex items-center hover:bg-[#333A80] transition-colors"
        >
          JOUER
        </Link>
      </div>
      {children}
    </section>
  );
}

const GRID = 'grid grid-cols-2 sm:grid-cols-4 gap-2';

export default function ProfileStats({ userId }: { userId: string }) {
  const [data, setData] = useState<{ casino: any; clicker: any } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile/stats?user_id=${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [userId]);

  if (failed) return <p className="text-sm text-tx-secondary">Impossible de charger les statistiques.</p>;
  if (!data) return <div className="h-40 rounded-[28px] border-4 border-brand-border bg-brand-inner animate-pulse" />;

  const { casino: c, clicker: k } = data;

  return (
    <div className="space-y-4">
      <Block title="Casino" icon={Dices} href="/casino">
        {!c ? (
          <p className="text-sm text-tx-secondary">Aucune partie pour l&apos;instant.</p>
        ) : (
          <>
            <div className={GRID}>
              <Tile label="Solde" value={`${fmt(c.balance)} ₶`} />
              <Tile label="Record" value={`${fmt(c.bestBalance)} ₶`} />
              <Tile label="Bilan des mises" value={signed(c.betNet)} tone={c.betNet >= 0 ? 'up' : 'down'} />
              <Tile label="Victoires" value={`${pct(c.winRate)} · ${fmt(c.betsPlaced)} mises`} />
              <Tile label="Plus gros gain" value={`${fmt(c.biggestWin)} ₶`} />
              <Tile label="Meilleur multi." value={`×${c.biggestMultiplier}`} />
              <Tile label="Meilleure série" value={String(c.bestStreak)} />
              <Tile label="Jeux essayés" value={`${c.gamesTried} / ${c.gamesTotal}`} />
              <Tile label="Prestige" value={String(c.prestige)} />
              <Tile label="Succès" value={`${c.achievements} / ${c.achievementsTotal}`} />
              <Tile label="Cosmétiques" value={`${c.cosmetics} / ${c.cosmeticsTotal}`} />
              <Tile label="Jeu préféré" value={c.favouriteGame?.label ?? '—'} />
              <Tile label="Duels" value={`${c.duels.wins} V · ${c.duels.losses} D`} />
              <Tile label="Cagnottes" value={c.syndicates.runs ? signed(c.syndicates.net) : '—'} tone={c.syndicates.runs ? (c.syndicates.net >= 0 ? 'up' : 'down') : undefined} />
              <Tile label="Défi du jour" value={c.challenge.best ? `${fmt(c.challenge.best)} ₶` : '—'} />
              <Tile label="Cadeaux offerts" value={`${fmt(c.gifts.sent)} ₶`} />
            </div>

            {c.games.length > 0 && (
              // Kept, but folded: the detail is there for whoever wants it and
              // out of the way for everyone else.
              <details className="group mt-3">
                <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-tx-muted hover:text-tx-base">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  Détail par jeu
                </summary>
                <div className="mt-2 grid sm:grid-cols-2 gap-x-4">
                  {c.games.map((g: any) => (
                    <div key={g.slug} className="flex items-center gap-2 py-1 border-b border-brand-border/60 text-[12px]">
                      <span className="flex-1 min-w-0 truncate font-bold">{g.label}</span>
                      <span className="text-tx-muted tabular-nums">{fmt(g.plays)} · {pct(g.winRate)}</span>
                      <span className={cn('w-28 text-right font-display font-black tabular-nums', g.net >= 0 ? 'text-accent-success' : 'text-accent-secondary')}>
                        {signed(g.net)}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </Block>

      <Block title="ItollecClicker" icon={Crown} href="/itollec-clicker">
        {!k ? (
          <p className="text-sm text-tx-secondary">Aucune sauvegarde en ligne. Joue une partie connecté pour qu&apos;elle apparaisse ici.</p>
        ) : (
          <div className={GRID}>
            <Tile label="Livres Tournois" value={`${big(k.coins)} ₶`} />
            <Tile label="Produit au total" value={`${big(k.lifetimeProduced)} ₶`} />
            <Tile label="Clics" value={big(k.clicks)} />
            <Tile label="Médailles" value={fmt(k.medals)} />
            <Tile label="Bâtiments" value={fmt(k.buildingsTotal)} />
            <Tile label="Types débloqués" value={`${k.buildingTypes} / ${k.buildingTypesTotal}`} />
            <Tile label="Succès" value={`${k.achievements} / ${k.achievementsTotal}`} />
            <Tile label="Améliorations" value={`${k.upgrades} / ${k.upgradesTotal}`} />
          </div>
        )}
      </Block>
    </div>
  );
}
