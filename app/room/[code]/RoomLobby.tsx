'use client';

import { useMemo, useState } from 'react';
import { Gamepad2, Minus, Play, Plus, Settings, Users, X } from 'lucide-react';
import OgName from '@/components/OgName';
import GameIcon from '@/components/GameIcon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';
import { GAME_FAMILIES, GAME_META } from '@/lib/party/lobby';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';

export interface LobbySetting {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'multiselect';
  default: string | number | any[];
  options?: { value: string; label: string; disabled?: boolean }[];
}
export interface LobbyGame { id: string; name: string; description: string; settings: LobbySetting[]; comingSoon?: boolean }
export interface LobbyPlayer { id: string; name: string; isHost: boolean }

/** Multi-choice settings hold numbers (Pokémon generations) or ids (categories). */
export const settingValue = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);

const NO_BAR = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * The room, on one screen: the game picker (filterable, same-size cards that
 * scroll inside their panel), the chosen game's settings with the start
 * button, and the players. On a phone the three panels become tabs.
 */
export default function RoomLobby({
  games, selectedGameId, onSelectGame, isHost, settings, onSettingChange, onStart, players, onKick,
}: {
  games: LobbyGame[]; selectedGameId: string | null; onSelectGame: (id: string) => void; isHost: boolean;
  settings: Record<string, any>; onSettingChange: (id: string, value: any) => void; onStart: () => void;
  players: LobbyPlayer[]; onKick: (id: string, name: string) => void;
}) {
  const [family, setFamily] = useState<string>('all');
  const [tab, setTab] = useState<'games' | 'settings' | 'players'>('games');
  const selected = games.find((g) => g.id === selectedGameId && g.id !== '__placeholder__');
  const shown = useMemo(() => games.filter((g) => family === 'all' || GAME_META[g.id]?.family === family), [games, family]);

  const pick = (id: string) => {
    if (!isHost) return;
    vibrate(HAPTIC.SOFT);
    onSelectGame(id);
    setTab('settings');
  };

  const valueText = (s: LobbySetting) => {
    const v = settings[s.id] ?? s.default;
    if (s.type === 'select') return s.options?.find((o) => o.value === String(v))?.label ?? String(v);
    return String(v);
  };

  const control = (s: LobbySetting) => {
    const value = settings[s.id] ?? s.default;
    if (s.type === 'multiselect' && s.options) {
      const current: any[] = Array.isArray(value) ? value : (s.default as any[]);
      return (
        <div className="flex flex-wrap gap-1.5">
          {s.options.map((o) => {
            const v = settingValue(o.value);
            const on = current.includes(v);
            return (
              <button
                key={o.value}
                type="button"
                disabled={!isHost || o.disabled}
                onClick={() => {
                  const nextVal = on ? current.filter((x) => x !== v) : [...current, v];
                  onSettingChange(s.id, nextVal.length ? nextVal : [v]);
                }}
                className={cn(
                  'rounded-lg border-2 border-brand-border px-2 py-1 text-xs font-bold shadow-none transition-colors disabled:cursor-default',
                  on ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-secondary',
                  isHost && !on && 'hover:text-white',
                  o.disabled && 'opacity-40',
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    if (!isHost) {
      return <div className="rounded-lg border-2 border-brand-border bg-brand-inner px-3 py-2 font-bold [overflow-wrap:anywhere]">{valueText(s)}</div>;
    }
    if (s.type === 'number') {
      const n = Number(value) || 0;
      return (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onSettingChange(s.id, Math.max(1, n - 1))} className={cn(BRAWL.dark, 'h-10 w-10 shrink-0 rounded-lg')} aria-label={`Moins : ${s.label}`}><Minus className="h-4 w-4" /></button>
          <input
            type="number"
            inputMode="numeric"
            value={String(value)}
            onChange={(e) => onSettingChange(s.id, e.target.value === '' ? s.default : Math.max(1, Number(e.target.value)))}
            className="h-10 min-w-0 flex-1 rounded-lg border-2 border-brand-border bg-brand-inner px-2 text-center font-display text-lg text-tx-base outline-none focus:border-accent-success"
          />
          <button type="button" onClick={() => onSettingChange(s.id, n + 1)} className={cn(BRAWL.dark, 'h-10 w-10 shrink-0 rounded-lg')} aria-label={`Plus : ${s.label}`}><Plus className="h-4 w-4" /></button>
        </div>
      );
    }
    if (s.type === 'select' && s.options) {
      return (
        <Select value={String(value)} onValueChange={(v) => onSettingChange(s.id, v)}>
          <SelectTrigger className="h-10 w-full rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold text-tx-base focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-4 border-brand-border bg-brand-card font-bold text-tx-base shadow-brutal">
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled} className="mx-1 my-0.5 cursor-pointer rounded-lg focus:bg-brand-inner">
                {o.label}{o.disabled && ' (bientôt)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <input value={String(value)} onChange={(e) => onSettingChange(s.id, e.target.value)} className="h-10 w-full rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold text-tx-base outline-none focus:border-accent-success" />
    );
  };

  const tabBtn = (id: typeof tab, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn('flex h-10 items-center justify-center gap-1 rounded-xl font-display text-base shadow-none', tab === id ? 'bg-accent-primary text-brand-bg' : 'text-tx-secondary')}
    >
      {label}{count !== undefined && <span className="tabular-nums opacity-80">{count}</span>}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-3 gap-1 rounded-2xl border-[3px] border-brand-border bg-brand-bg p-1 lg:hidden">
        {tabBtn('games', 'Jeux', games.length)}
        {tabBtn('settings', 'Réglages')}
        {tabBtn('players', 'Joueurs', players.length)}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[minmax(0,1fr)_auto]">
        {/* GAMES */}
        <section className={cn(BRAWL.panel, 'min-h-0 flex-col p-3 lg:row-span-2 lg:flex', tab === 'games' ? 'flex' : 'hidden')}>
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <div className={cn(BRAWL.iconTile, 'h-10 w-10 bg-accent-secondary text-white shadow-[inset_0_-4px_0_#C92D63]')}><Gamepad2 className="h-5 w-5" /></div>
            <h2 className="font-display text-2xl leading-none">Choisis un jeu</h2>
            <span className="ml-auto rounded-lg border-2 border-brand-border bg-brand-inner px-2 py-0.5 font-display text-sm tabular-nums">{shown.length} jeux</span>
          </div>
          <div className={cn('mb-2 flex shrink-0 gap-1.5 overflow-x-auto', NO_BAR)}>
            {GAME_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamily(f.id)}
                className={cn('h-9 shrink-0 rounded-xl border-2 border-brand-border px-3 font-display text-sm shadow-none', family === f.id ? 'bg-accent-primary text-brand-bg' : 'bg-brand-inner text-tx-secondary hover:text-white')}
              >
                {f.label} <span className="tabular-nums opacity-70">{f.id === 'all' ? games.length : games.filter((g) => GAME_META[g.id]?.family === f.id).length}</span>
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
            <div className="grid grid-cols-2 content-start gap-2 pb-6 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((g, i) => {
                const on = g.id === selectedGameId;
                const meta = GAME_META[g.id];
                const sw = BRAWL_SWATCHES[i % BRAWL_SWATCHES.length];
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pick(g.id)}
                    disabled={!isHost && !on}
                    title={g.description}
                    className={cn(
                      'flex h-[128px] flex-col items-center gap-1 rounded-2xl border-[3px] border-brand-border p-2 text-center transition-transform disabled:cursor-default',
                      isHost && 'active:translate-y-[3px]',
                      on ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_3px_0_#05061A]' : 'bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_3px_0_#05061A] enabled:hover:bg-[#333A80]',
                      !isHost && !on && 'opacity-80',
                    )}
                  >
                    <span className="shrink-0">
                      <GameIcon game={g.id} className="h-11 w-11" />
                      {!GAME_META[g.id] && <span className="block h-11 w-11 rounded-xl border-2 border-brand-border" style={{ background: sw.fill }} />}
                    </span>
                    <span className="w-full truncate px-0.5 font-display text-[15px] leading-tight">{g.name}</span>
                    <span className={cn('line-clamp-2 text-xs font-bold leading-tight', on ? 'text-brand-bg/80' : 'text-tx-secondary')}>{meta?.short ?? g.description}</span>
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none sticky bottom-0 -mt-6 h-6 bg-gradient-to-t from-brand-card to-transparent" />
          </div>
          {!isHost && <p className="mt-2 shrink-0 text-center text-sm font-bold text-tx-secondary">C’est l’hôte qui choisit le jeu.</p>}
        </section>

        {/* SETTINGS */}
        <section className={cn(BRAWL.panel, 'min-h-0 flex-col p-3 lg:flex', tab === 'settings' ? 'flex' : 'hidden')}>
          {selected ? (
            <>
              <div className="mb-2 flex shrink-0 items-start gap-2">
                <GameIcon game={selected.id} className="h-12 w-12 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-none">{selected.name}</h2>
                  <p className="mt-0.5 text-sm font-bold text-tx-secondary">{selected.description}</p>
                  {GAME_META[selected.id] && <p className="mt-0.5 text-xs font-black uppercase tracking-widest text-accent-success">{GAME_META[selected.id].minPlayers > 1 ? `${GAME_META[selected.id].minPlayers} joueurs minimum` : 'Dès 1 joueur'}</p>}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                {selected.settings.map((s) => (
                  <div key={s.id}>
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-tx-secondary"><Settings className="h-3 w-3" /> {s.label}</p>
                    {control(s)}
                  </div>
                ))}
              </div>
              {isHost ? (
                <button type="button" onClick={onStart} className={cn(BRAWL.green, 'mt-3 hidden h-14 w-full shrink-0 rounded-2xl text-2xl lg:flex')}>
                  <Play className="h-6 w-6 fill-current" /> Lancer la partie
                </button>
              ) : (
                <p className="mt-2 shrink-0 text-center text-sm font-bold text-tx-secondary">Réglages choisis par l’hôte.</p>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Gamepad2 className="h-10 w-10 text-tx-muted" />
              <p className="font-bold text-tx-secondary">{isHost ? 'Choisis un jeu pour voir ses réglages.' : 'L’hôte choisit un jeu…'}</p>
              {isHost && <button type="button" onClick={() => setTab('games')} className={cn(BRAWL.yellow, 'h-11 rounded-xl px-4 lg:hidden')}>Voir les jeux</button>}
            </div>
          )}
        </section>

        {/* PLAYERS */}
        <section className={cn(BRAWL.panel, 'min-h-0 flex-col p-3 lg:flex lg:max-h-[32dvh]', tab === 'players' ? 'flex' : 'hidden')}>
          <div className="mb-2 flex shrink-0 items-center gap-2">
            <div className={cn(BRAWL.iconTile, 'h-9 w-9 bg-accent-success text-brand-bg shadow-[inset_0_-4px_0_#1E9A55]')}><Users className="h-5 w-5" /></div>
            <h2 className="font-display text-xl leading-none">Joueurs</h2>
            <span className="ml-auto rounded-lg border-2 border-brand-border bg-accent-primary px-2 font-display text-brand-bg tabular-nums">{players.length}</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
            {players.map((p, i) => {
              const sw = BRAWL_SWATCHES[i % BRAWL_SWATCHES.length];
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-inner p-1.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-brand-border font-display text-white" style={{ background: sw.fill }}>{p.name.charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate font-display"><OgName name={p.name} /></span>
                  {p.isHost && <span className="shrink-0 rounded-md border-2 border-brand-border bg-accent-primary px-1.5 text-[11px] font-black text-brand-bg">Hôte</span>}
                  {isHost && !p.isHost && (
                    <button type="button" onClick={() => onKick(p.id, p.name)} title="Exclure ce joueur" aria-label={`Exclure ${p.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-brand-border bg-accent-secondary text-white shadow-none">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {isHost && selected && (
        <button type="button" onClick={onStart} className={cn(BRAWL.green, 'h-14 w-full shrink-0 rounded-2xl text-xl lg:hidden')}>
          <Play className="h-5 w-5 fill-current" /> Lancer {selected.name}
        </button>
      )}
    </div>
  );
}
