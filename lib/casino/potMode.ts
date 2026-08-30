/**
 * Pot mode: the arena is playing with the group's money, not the player's.
 *
 * This is deliberately a small module-level flag rather than something baked
 * into the wallet. An earlier version made the pot *replace* the balance
 * everywhere in the casino, which made a player's own 600 000 ₶ look like it
 * had turned into 4 000 — their money appeared to vanish. The pot is a mode
 * you are inside, not a change to who owns what: it exists only while the
 * cagnotte arena is mounted, and everything outside it keeps showing the
 * player's real balance.
 *
 * The games read it through useCasinoWallet, so none of them needed to learn
 * about syndicates. The server never trusts it — it re-checks membership of a
 * running run before letting a bet touch the pot.
 */

export interface PotMode {
  active: boolean;
  pot: number;
  seedPot: number;
  endsAt: string | null;
  code: string | null;
}

const IDLE: PotMode = { active: false, pot: 0, seedPot: 0, endsAt: null, code: null };

let state: PotMode = IDLE;
const listeners = new Set<() => void>();

export function potMode(): PotMode {
  return state;
}

export function enterPotMode(next: Omit<PotMode, 'active'>): void {
  state = { ...next, active: true };
  listeners.forEach((l) => l());
}

/** The pot moved — a bet of ours, or somebody else's arriving over the table. */
export function setPot(pot: number): void {
  if (!state.active || state.pot === pot) return;
  state = { ...state, pot };
  listeners.forEach((l) => l());
}

export function leavePotMode(): void {
  if (!state.active) return;
  state = IDLE;
  listeners.forEach((l) => l());
}

export function subscribePotMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * How a game gets out of the arena.
 *
 * The twenty games are page components that GameShell wires to a back link
 * pointing at /casino. Inside the arena there is no leaving, so the arena
 * parks its own handler here and GameShell uses it instead of the link.
 */
let backToGrid: (() => void) | null = null;

export function setArenaBack(fn: (() => void) | null): void {
  backToGrid = fn;
}

export function arenaBack(): (() => void) | null {
  return backToGrid;
}

/** Stable reference for useSyncExternalStore's server snapshot. */
export function potModeServer(): PotMode {
  return IDLE;
}
