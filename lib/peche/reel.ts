/**
 * The reeling mini-game as a pure simulation, shared by the browser (which
 * draws it and reads the player's hold) and the server (which replays it).
 *
 * The browser used to run it with Math.random and frame-length steps, then
 * just told the server "perfect": nothing stopped a player from claiming it
 * without playing. Now the fish moves from a seed the server picked at cast
 * time, the simulation advances in fixed steps, and the browser only reports
 * on which steps the player pressed or released. The server replays exactly
 * the same steps and decides the outcome itself.
 */

export const REEL_DT = 1 / 60;
/** Seconds at the start where the fish holds still and nothing drains. */
export const REEL_GRACE = 1.5;
export const REEL_START_PROGRESS = 0.4;
export const REEL_MAX_SECONDS = 25;
export const REEL_MAX_STEPS = Math.ceil(REEL_MAX_SECONDS / REEL_DT) + 1;

export type ReelResult = 'perfect' | 'good' | 'fail';

export interface ReelParams {
  green: number;
  speed: number;
  fill: number;
  drain: number;
  seed: number;
}

export interface ReelState {
  cursor: number;
  vel: number;
  zone: number;
  zoneVel: number;
  target: number;
  progress: number;
  perfect: boolean;
  t: number;
  step: number;
  rng: number;
  done: boolean;
  result: ReelResult | null;
}

/** mulberry32: small, fast, and identical in every JS engine. */
function nextRandom(st: ReelState): number {
  st.rng = (st.rng + 0x6d2b79f5) | 0;
  let x = st.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function newReel(params: ReelParams): ReelState {
  return {
    cursor: 0.5, vel: 0, zone: 0.5, zoneVel: 0, target: 0.5,
    progress: REEL_START_PROGRESS, perfect: true, t: 0, step: 0,
    rng: params.seed | 0, done: false, result: null,
  };
}

/** Advances one fixed step with the player holding or not. */
export function stepReel(st: ReelState, p: ReelParams, holding: boolean): void {
  if (st.done) return;
  const dt = REEL_DT;
  st.t += dt;
  st.step += 1;
  const started = st.t > REEL_GRACE;

  if (started) {
    if (nextRandom(st) < dt * (0.5 + p.speed * 2)) st.target = 0.15 + nextRandom(st) * 0.7;
    st.zoneVel += (st.target - st.zone) * dt * 5 * p.speed;
    st.zoneVel *= 0.9;
    st.zone = Math.max(p.green / 2, Math.min(1 - p.green / 2, st.zone + st.zoneVel * dt * 3));
  }

  st.vel += (holding ? 1.6 : -1.3) * dt;
  st.vel = Math.max(-0.8, Math.min(0.8, st.vel));
  st.cursor += st.vel * dt;
  if (st.cursor < 0) { st.cursor = 0; st.vel = 0; }
  if (st.cursor > 1) { st.cursor = 1; st.vel = 0; }

  const inside = Math.abs(st.cursor - st.zone) <= p.green / 2;
  if (started) {
    if (!inside) st.perfect = false;
    st.progress += (inside ? p.fill : -p.drain) * dt;
  } else if (inside) {
    st.progress += 0.12 * dt;
  }

  if (st.progress >= 1 || st.progress <= 0 || st.t > REEL_MAX_SECONDS) {
    st.done = true;
    st.result = st.progress >= 1 ? (st.perfect ? 'perfect' : 'good') : 'fail';
  }
}

export function isInside(st: ReelState, p: ReelParams): boolean {
  return Math.abs(st.cursor - st.zone) <= p.green / 2;
}

/**
 * Replays a whole reel from the steps where the hold toggled (the player
 * starts not holding). Returns the outcome and the step it ended on, or null
 * when the input is malformed.
 */
export function replayReel(params: ReelParams, toggles: unknown): { result: ReelResult; steps: number } | null {
  if (!Array.isArray(toggles) || toggles.length > REEL_MAX_STEPS) return null;
  let previous = -1;
  for (const s of toggles) {
    if (!Number.isInteger(s) || (s as number) <= previous || (s as number) > REEL_MAX_STEPS) return null;
    previous = s as number;
  }
  const st = newReel(params);
  let holding = false;
  let next = 0;
  while (!st.done && st.step < REEL_MAX_STEPS) {
    // A toggle recorded at step n applies to the step that moves the state from n to n + 1.
    while (next < toggles.length && (toggles[next] as number) <= st.step) {
      holding = !holding;
      next += 1;
    }
    stepReel(st, params, holding);
  }
  return st.result ? { result: st.result, steps: st.step } : null;
}

/** A 31-bit seed for a new cast. */
export function newReelSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 0x7fffffff;
}
