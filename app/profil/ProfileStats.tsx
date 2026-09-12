'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dices, Crown, Trophy, Target, Users, Flame, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatShortNumber } from '@/lib/itollec-clicker/format';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Clicker numbers go far past what Intl's compact notation can name — it stops
 * at trillions and prints the rest as a wall of digits. The game's own
 * formatter is used instead, so the profile reads the same as the game.
 */
function big(n: number): string {
  if (Math.abs(n) < 1_000_000) return fmt(n);
  return formatShortNumber(n);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)} ₶`;

function Card({ title, icon: Icon, children, action }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="bg-brand-card border-4 border-brand-border rounded-[32px] p-5 sm:p-6 shadow-brutal">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="font-display text-2xl leading-none flex items-center gap-3">
          <span className="rounded-lg border-2 border-brand-border bg-brand-inner p-2">
            <Icon className="h-5 w-5 text-accent-primary" />
          </span>
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Hero({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className={cn(
      'rounded-2xl border-2 p-3',
      tone === 'up' ? 'border-accent-success/60 bg-accent-success/5'
        : tone === 'down' ? 'border-accent-secondary/60 bg-accent-secondary/5'
        : 'border-brand-border bg-brand-inner'
    )}>
      <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">{label}</div>
      <div className={cn(
        'font-display font-black text-xl sm:text-2xl tabular-nums truncate mt-0.5',
        tone === 'up' && 'text-accent-success',
        tone === 'down' && 'text-accent-secondary'
      )}>
        {value}
      </div>
    </div>
  );
}

function Group({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />} {title}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5 min-w-0">
      <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted truncate">{label}</div>
      <div className="font-display font-black text-sm tabular-nums truncate">{value}</div>
      {sub && <div className="text-[10px] font-bold text-tx-muted truncate">{sub}</div>}
    </div>
  );
}

/** A labelled share of a total, with its bar. */
function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
        <span className="text-tx-secondary">{label}</span>
        <span className="tabular-nums">{fmt(done)} / {fmt(total)}</span>
      </div>
      <div className="h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
        <div className="h-full bg-accent-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export default function ProfileStats({ userId }: { userId: string }) {
  const router = useRouter();
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

  if (failed) {
    return <p className="text-sm text-tx-secondary">Impossible de charger les statistiques.</p>;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-72 rounded-[32px] border-4 border-brand-border bg-brand-inner animate-pulse" />
        <div className="h-56 rounded-[32px] border-4 border-brand-border bg-brand-inner animate-pulse" />
      </div>
    );
  }

  const { casino: c, clicker: k } = data;

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ */}
      {/* Casino                                                        */}
      {/* ------------------------------------------------------------ */}
      <Card
        title="Casino"
        icon={Dices}
        action={
          <button
            onClick={() => router.push('/casino')}
            className="h-10 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
          >
            JOUER
          </button>
        }
      >
        {!c ? (
          <p className="text-sm text-tx-secondary">Aucune partie de casino pour l&apos;instant.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Hero label="Solde" value={`${fmt(c.balance)} ₶`} />
              <Hero label="Record de solde" value={`${fmt(c.bestBalance)} ₶`} />
              <Hero label="Bilan des mises" value={signed(c.betNet)} tone={c.betNet >= 0 ? 'up' : 'down'} />
              <Hero label="Taux de victoire" value={pct(c.winRate)} />
            </div>

            <Group title="Jeu" icon={Flame}>
              <Stat label="Mises posées" value={fmt(c.betsPlaced)} sub={`${fmt(c.winsCount)} gagnées`} />
              <Stat label="Total misé" value={`${fmt(c.wagered)} ₶`} />
              <Stat label="Plus gros gain" value={`${fmt(c.biggestWin)} ₶`} />
              <Stat label="Meilleur multi." value={`×${c.biggestMultiplier}`} />
              <Stat label="Meilleure série" value={`${c.bestStreak} victoires`} />
              <Stat label="Pire série" value={`${c.worstStreak} défaites`} />
              <Stat label="Jeux essayés" value={`${c.gamesTried} / ${c.gamesTotal}`} />
              <Stat label="Jackpots" value={fmt(c.jackpots)} />
            </Group>

            <Group title="Progression" icon={Sparkles}>
              <Stat label="Prestige" value={String(c.prestige)} />
              <Stat label="Paliers de pass" value={fmt(c.passTiersTotal)} sub="cumulés" />
              <Stat label="Missions" value={fmt(c.missionsDone)} />
              <Stat label="Caisses ouvertes" value={fmt(c.cratesOpened)} />
              <Stat label="Connexion" value={`${c.dailyStreak} j`} sub="d'affilée" />
              <Stat label="Coffre 7 jours" value={`case ${c.chestDay}`} />
            </Group>

            <div className="grid sm:grid-cols-2 gap-3">
              <Progress label="Succès" done={c.achievements} total={c.achievementsTotal} />
              <Progress label="Cosmétiques" done={c.cosmetics} total={c.cosmeticsTotal} />
            </div>

            {c.games.length > 0 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex items-center gap-1.5">
                  <Trophy className="h-3 w-3" /> Par jeu
                </div>

                <div className="grid sm:grid-cols-3 gap-2 mb-2">
                  {c.favouriteGame && (
                    <Stat label="Jeu préféré" value={c.favouriteGame.label} sub={`${fmt(c.favouriteGame.plays)} parties`} />
                  )}
                  {c.bestGame && (
                    <Stat label="Le plus rentable" value={c.bestGame.label} sub={signed(c.bestGame.net)} />
                  )}
                  {c.worstGame && (
                    <Stat label="Le plus coûteux" value={c.worstGame.label} sub={signed(c.worstGame.net)} />
                  )}
                </div>

                <div className="rounded-2xl border-2 border-brand-border bg-brand-inner overflow-x-auto">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-widest text-tx-muted">
                        <th className="text-left px-3 py-2">Jeu</th>
                        <th className="text-right px-3 py-2">Parties</th>
                        <th className="text-right px-3 py-2">Victoires</th>
                        <th className="text-right px-3 py-2">Bilan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.games.map((g: any) => (
                        <tr key={g.slug} className="border-t border-brand-border">
                          <td className="px-3 py-1.5 font-bold truncate">{g.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(g.plays)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{pct(g.winRate)}</td>
                          <td className={cn(
                            'px-3 py-1.5 text-right font-display font-black tabular-nums',
                            g.net >= 0 ? 'text-accent-success' : 'text-accent-secondary'
                          )}>
                            {signed(g.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Group title="Entre potes" icon={Users}>
              <Stat
                label="Duels"
                value={`${c.duels.wins} V · ${c.duels.losses} D`}
                sub={c.duels.draws ? `${c.duels.draws} égalité${c.duels.draws > 1 ? 's' : ''}` : undefined}
              />
              <Stat
                label="Défi du jour"
                value={c.challenge.best ? `${fmt(c.challenge.best)} ₶` : '—'}
                sub={`${c.challenge.runs} run${c.challenge.runs > 1 ? 's' : ''} · ${c.challenge.podiums} podium${c.challenge.podiums > 1 ? 's' : ''}`}
              />
              <Stat
                label="Cagnottes"
                value={c.syndicates.runs ? signed(c.syndicates.net) : '—'}
                sub={`${c.syndicates.runs} partie${c.syndicates.runs > 1 ? 's' : ''}`}
              />
              <Stat
                label="Cadeaux"
                value={`${fmt(c.gifts.sent)} ₶ offerts`}
                sub={`${fmt(c.gifts.received)} ₶ reçus`}
              />
            </Group>
          </>
        )}
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* ItollecClicker                                                */}
      {/* ------------------------------------------------------------ */}
      <Card
        title="ItollecClicker"
        icon={Crown}
        action={
          <button
            onClick={() => router.push('/itollec-clicker')}
            className="h-10 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
          >
            JOUER
          </button>
        }
      >
        {!k ? (
          <p className="text-sm text-tx-secondary">
            Aucune sauvegarde en ligne. Joue une partie connecté pour qu&apos;elle apparaisse ici.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Hero label="Livres Tournois" value={`${big(k.coins)} ₶`} />
              <Hero label="Produit au total" value={`${big(k.lifetimeProduced)} ₶`} />
              <Hero label="Clics" value={big(k.clicks)} />
              <Hero label="Médailles" value={fmt(k.medals)} />
            </div>

            <Group title="Empire" icon={Target}>
              <Stat label="Bâtiments" value={fmt(k.buildingsTotal)} />
              <Stat label="Types débloqués" value={`${k.buildingTypes} / ${k.buildingTypesTotal}`} />
              <Stat label="Dépensé" value={`${big(k.totalSpent)} ₶`} />
              <Stat label="Dernière partie" value={new Date(k.lastPlayed).toLocaleDateString('fr-FR')} />
              <Stat label="Cent-Jours" value={`niveau ${k.centJoursLevel}`} />
              <Stat label="Sainte-Hélène" value={`niveau ${k.sainteHeleneLevel}`} />
            </Group>

            <div className="grid sm:grid-cols-2 gap-3">
              <Progress label="Succès" done={k.achievements} total={k.achievementsTotal} />
              <Progress label="Améliorations" done={k.upgrades} total={k.upgradesTotal} />
            </div>

            {k.buildings.length > 0 && (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Tes bâtiments</div>
                <div className="flex flex-wrap gap-1.5">
                  {k.buildings.map((b: any) => (
                    <span
                      key={b.id}
                      className="px-2.5 py-1 rounded-lg border-2 border-brand-border bg-brand-inner text-[11px] font-bold"
                    >
                      {b.name} <b className="font-display tabular-nums text-accent-primary">×{b.owned}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

