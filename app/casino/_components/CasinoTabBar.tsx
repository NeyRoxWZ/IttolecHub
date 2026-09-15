'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Dices, Target, Crown, ShoppingBag, LayoutGrid, Backpack, Users, CalendarCheck, Swords, Radio, Award, Trophy,
  Gem, Sparkles, Info, LogOut,
} from 'lucide-react';
import AppTabBar, { type TabBarItem } from '@/components/AppTabBar';
import AppSheet, { SheetTile } from '@/components/AppSheet';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { CASINO_OPEN_EVENT, useNavBadges, type CasinoOpen } from '@/lib/casino/appNav';
import { cn } from '@/lib/utils';
import CasinoControls from './CasinoControls';

/** Pages reached from "Plus". */
const MORE = [
  { href: '/casino/inventaire', label: 'Inventaire', hint: 'objets & cosmétiques', icon: Backpack },
  { href: '/casino/cagnotte', label: 'Cagnotte de groupe', hint: 'misez et partagez', icon: Users },
  { href: '/casino/defi', label: 'Défi du jour', hint: 'mêmes tirages pour tous', icon: CalendarCheck },
  { href: '/casino/potes', label: 'Entre potes', hint: 'duels, cadeaux, chat', icon: Swords },
  { href: '/casino/direct', label: 'En direct', hint: 'gains et pertes', icon: Radio },
  { href: '/casino/achievements', label: 'Succès', hint: 'à débloquer', icon: Award },
  { href: '/casino/leaderboard', label: 'Classement', hint: 'saison en cours', icon: Trophy },
];

/**
 * The bar shows on the hub and the casino's own pages. Inside a game it steps
 * aside, like any game app during a round: the game's header has its way back.
 */
const WITH_BAR = new Set(['/casino', '/casino/pass', '/casino/shop', ...MORE.map((m) => m.href)]);

export default function CasinoTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const badges = useNavBadges();
  const [more, setMore] = useState(false);
  const closeMore = useCallback(() => setMore(false), []);

  if (!pathname || !WITH_BAR.has(pathname)) return null;

  const go = (href: string) => { sfx.click(); setMore(false); if (href !== pathname) router.push(href); };
  // The modals belong to the hub: open them there, from any page.
  const open = (what: CasinoOpen) => {
    sfx.click(); setMore(false);
    if (pathname === '/casino') window.dispatchEvent(new CustomEvent(CASINO_OPEN_EVENT, { detail: what }));
    else router.push(`/casino?open=${what}`);
  };

  const inMore = MORE.some((m) => m.href === pathname);
  const items: TabBarItem[] = [
    { id: 'jeux', label: 'Jeux', icon: Dices, active: pathname === '/casino' && !more, onSelect: () => go('/casino') },
    { id: 'missions', label: 'Missions', icon: Target, badge: badges.missions, onSelect: () => open('missions') },
    { id: 'pass', label: 'Pass', icon: Crown, badge: badges.pass, active: pathname === '/casino/pass' && !more, onSelect: () => go('/casino/pass') },
    { id: 'boutique', label: 'Boutique', icon: ShoppingBag, active: pathname === '/casino/shop' && !more, onSelect: () => go('/casino/shop') },
    { id: 'plus', label: 'Plus', icon: LayoutGrid, active: more || inMore, onSelect: () => { sfx.click(); setMore(true); } },
  ];

  return (
    <>
      <AppTabBar items={items} label="Navigation du casino" />
      <AppSheet open={more} onClose={closeMore} title="Casino">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {MORE.map((m, i) => {
            const swatch = BRAWL_SWATCHES[i % BRAWL_SWATCHES.length];
            return (
              <SheetTile key={m.href} label={m.label} hint={m.hint} icon={m.icon} fill={swatch.fill} shade={swatch.shade}
                active={pathname === m.href} onSelect={() => go(m.href)} />
            );
          })}
          <SheetTile label="Cagnotte" hint="comment la gagner" icon={Gem} fill="#5B8CFF" shade="#2F5BD0" onSelect={() => open('jackpot')} />
          <SheetTile label="Prestige" hint="titres et bonus" icon={Sparkles} fill="#FFC61A" shade="#D98E00" onSelect={() => open('prestige')} />
        </div>

        <div className="mt-4 rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center justify-between gap-3">
          <div className="leading-tight">
            <div className="font-display text-base">Réglages</div>
            <div className="text-[11px] font-bold text-tx-muted">son, turbo, cosmétiques</div>
          </div>
          <CasinoControls />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => open('guide')} className={cn(BRAWL.dark, 'h-12 text-base')}>
            <Info className="h-4 w-4" /> Comment jouer
          </button>
          <button onClick={() => { setMore(false); router.push('/?mode=solo'); }} className={cn(BRAWL.pink, 'h-12 text-base')}>
            <LogOut className="h-4 w-4" /> Quitter
          </button>
        </div>
      </AppSheet>
    </>
  );
}
