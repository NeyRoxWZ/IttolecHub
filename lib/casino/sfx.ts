'use client';

// Tiny WebAudio synth — no audio files to ship, no network, works offline.
// AudioContext is created lazily on the first sound (always triggered by a
// click/tap) so browser autoplay policies never block it.

import { getActiveCosmetics, emitOutcome } from './activeCosmetics';

let ctx: AudioContext | null = null;
let muted = false;

/**
 * The equipped sound pack reshapes every cue. A small pitch and waveform
 * nudge was all it used to do, and players could not hear any difference, so
 * each pack now has its own character on top of that:
 *  - length: notes held longer (lounge, orchestral) or clipped short (arcade)
 *  - echo: repeats of each note, quieter each time (lounge, space)
 *  - vibrato: a wobble on the pitch (space, western)
 *  - layer: a second voice a fifth or an octave above (orchestral, arcade)
 *  - slide: notes bend down into place (western) or step like a chiptune (retro)
 */
interface Pack {
  pitch: number;
  type: OscillatorType;
  gain: number;
  length: number;
  echo?: { delay: number; repeats: number };
  vibrato?: { rate: number; depth: number };
  layer?: { ratio: number; type: OscillatorType; gain: number };
  slide?: 'down' | 'steps';
}

const PACKS: Record<string, Pack> = {
  retro: { pitch: 1, type: 'square', gain: 0.8, length: 0.8, slide: 'steps' },
  lounge: { pitch: 0.7, type: 'sine', gain: 1.1, length: 2.2, echo: { delay: 0.16, repeats: 2 } },
  arcade: { pitch: 1.5, type: 'square', gain: 0.75, length: 0.55, layer: { ratio: 2, type: 'square', gain: 0.35 } },
  space: { pitch: 1.2, type: 'sine', gain: 1.1, length: 1.8, echo: { delay: 0.28, repeats: 3 }, vibrato: { rate: 7, depth: 0.03 } },
  western: { pitch: 0.8, type: 'sawtooth', gain: 0.7, length: 1.3, slide: 'down', vibrato: { rate: 5, depth: 0.015 } },
  orchestral: { pitch: 0.9, type: 'triangle', gain: 1.1, length: 1.9, layer: { ratio: 1.5, type: 'sine', gain: 0.55 } },
};

function pack() {
  const key = getActiveCosmetics().sound?.params.pack;
  return (key && PACKS[key]) || null;
}

const MUTE_KEY = 'itollec_casino_muted';

export function isMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch {}
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (muted || isMuted()) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOptions {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

/** One oscillator note with its envelope; the building block of every cue. */
function voice(
  c: AudioContext,
  { freq, duration, type, gain, start, sweepTo, p }: {
    freq: number; duration: number; type: OscillatorType; gain: number; start: number; sweepTo?: number; p: Pack | null;
  },
) {
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  if (p?.slide === 'down' && sweepTo === undefined) {
    // A twang: start a little sharp and bend down onto the note.
    osc.frequency.setValueAtTime(freq * 1.25, start);
    osc.frequency.exponentialRampToValueAtTime(freq, start + Math.min(0.08, duration * 0.5));
  } else if (p?.slide === 'steps' && sweepTo !== undefined) {
    // Chiptune: the sweep jumps in four hard steps instead of gliding.
    for (let i = 0; i < 4; i++) {
      osc.frequency.setValueAtTime(freq + ((sweepTo - freq) * i) / 3, start + (duration * i) / 4);
    }
  } else {
    osc.frequency.setValueAtTime(freq, start);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);
  }

  if (p?.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = p.vibrato.rate;
    depth.gain.value = freq * p.vibrato.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + duration + 0.05);
  }

  // Quick attack, smooth decay — avoids the click you get from hard cutoffs.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function tone({ freq, duration = 0.12, type = 'sine', gain = 0.15, delay = 0, sweepTo }: ToneOptions) {
  const c = getCtx();
  if (!c) return;

  const p = pack();
  if (p) {
    freq *= p.pitch;
    if (sweepTo !== undefined) sweepTo *= p.pitch;
    type = p.type;
    gain *= p.gain;
    duration *= p.length;
  }

  const start = c.currentTime + delay;
  voice(c, { freq, duration, type, gain, start, sweepTo, p });

  if (p?.layer) {
    voice(c, {
      freq: freq * p.layer.ratio,
      duration,
      type: p.layer.type,
      gain: gain * p.layer.gain,
      start,
      sweepTo: sweepTo !== undefined ? sweepTo * p.layer.ratio : undefined,
      p,
    });
  }

  if (p?.echo) {
    for (let i = 1; i <= p.echo.repeats; i++) {
      voice(c, { freq, duration, type, gain: gain * Math.pow(0.4, i), start: start + p.echo.delay * i, sweepTo, p });
    }
  }
}

/** Plays a short phrase in a pack, for the "listen" button on sound cosmetics. */
export function previewPack(key: string) {
  const c = getCtx();
  const p = PACKS[key];
  if (!c || !p) return;
  const t0 = c.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const freq = f * p.pitch;
    const duration = 0.2 * p.length;
    const gain = 0.12 * p.gain;
    const start = t0 + i * 0.1;
    voice(c, { freq, duration, type: p.type, gain, start, p });
    if (p.layer) voice(c, { freq: freq * p.layer.ratio, duration, type: p.layer.type, gain: gain * p.layer.gain, start, p });
    if (p.echo) for (let e = 1; e <= p.echo.repeats; e++) voice(c, { freq, duration, type: p.type, gain: gain * Math.pow(0.4, e), start: start + p.echo.delay * e, p });
  });
}

function noise(duration = 0.2, gain = 0.12) {
  const c = getCtx();
  if (!c) return;

  // The pack colours the noise bursts too, otherwise a card flip or a bust
  // sounds identical whatever is equipped.
  const p = pack();
  if (p) {
    gain *= p.gain;
    duration *= p.pitch > 1 ? 0.85 : 1.15;
  }
  const frames = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  const env = c.createGain();
  env.gain.value = gain;
  src.buffer = buffer;
  src.connect(env).connect(c.destination);
  src.start();
}

export const sfx = {
  click: () => tone({ freq: 420, duration: 0.05, type: 'square', gain: 0.06 }),
  select: () => tone({ freq: 660, duration: 0.07, type: 'triangle', gain: 0.09 }),
  bet: () => { tone({ freq: 520, duration: 0.08, type: 'triangle', gain: 0.12 }); tone({ freq: 780, duration: 0.1, type: 'triangle', gain: 0.09, delay: 0.05 }); },
  tick: () => tone({ freq: 1200, duration: 0.03, type: 'square', gain: 0.05 }),
  card: () => noise(0.09, 0.07),
  reveal: () => tone({ freq: 880, duration: 0.1, type: 'sine', gain: 0.1, sweepTo: 1320 }),
  step: (n = 0) => tone({ freq: 440 + n * 55, duration: 0.09, type: 'triangle', gain: 0.11 }),
  // Every game already calls these on settling, so they double as the
  // outcome signal the cosmetic overlays listen to.
  win: () => {
    emitOutcome('win');
    [523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f, duration: 0.22, type: 'triangle', gain: 0.13, delay: i * 0.07 }));
  },
  bigWin: () => {
    emitOutcome('win');
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, duration: 0.3, type: 'triangle', gain: 0.14, delay: i * 0.08 }));
  },
  jackpot: () => {
    emitOutcome('win');
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => tone({ freq: f, duration: 0.35, type: 'square', gain: 0.1, delay: i * 0.09 }));
  },
  lose: () => { emitOutcome('lose'); tone({ freq: 320, duration: 0.22, type: 'sawtooth', gain: 0.1, sweepTo: 150 }); },
  bust: () => { emitOutcome('lose'); noise(0.28, 0.16); tone({ freq: 220, duration: 0.35, type: 'sawtooth', gain: 0.12, sweepTo: 70 }); },
  cashout: () => { [659.25, 880].forEach((f, i) => tone({ freq: f, duration: 0.18, type: 'sine', gain: 0.13, delay: i * 0.06 })); },
  coin: () => { tone({ freq: 1046, duration: 0.07, type: 'square', gain: 0.08 }); tone({ freq: 1568, duration: 0.09, type: 'square', gain: 0.07, delay: 0.04 }); },

  /* ---- crate opening ---- */

  /** The lid, right before the reel starts rolling. */
  crateOpen: () => {
    noise(0.18, 0.1);
    tone({ freq: 180, duration: 0.22, type: 'sawtooth', gain: 0.1, sweepTo: 90 });
    tone({ freq: 520, duration: 0.14, type: 'triangle', gain: 0.09, delay: 0.06, sweepTo: 780 });
  },
  /** One notch of the reel passing the marker; pitch rises as it slows. */
  reelTick: (progress = 0) => tone({
    freq: 900 + progress * 500,
    duration: 0.025,
    type: 'square',
    gain: 0.045,
  }),
  /** The reel coming to rest, coloured by what it landed on. */
  reelStop: (rarity: 'commun' | 'rare' | 'epique' | 'legendaire' = 'commun') => {
    const chords: Record<string, number[]> = {
      commun: [440, 554],
      rare: [523, 659, 784],
      epique: [587, 740, 880, 1109],
      legendaire: [659, 831, 988, 1319, 1661],
    };
    noise(0.12, 0.08);
    chords[rarity].forEach((f, i) => tone({
      freq: f,
      duration: rarity === 'legendaire' ? 0.5 : 0.3,
      type: rarity === 'commun' ? 'triangle' : 'square',
      gain: 0.12,
      delay: i * 0.05,
    }));
  },
};
