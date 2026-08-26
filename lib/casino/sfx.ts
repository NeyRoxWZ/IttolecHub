'use client';

// Tiny WebAudio synth — no audio files to ship, no network, works offline.
// AudioContext is created lazily on the first sound (always triggered by a
// click/tap) so browser autoplay policies never block it.

import { getActiveCosmetics, emitOutcome } from './activeCosmetics';

let ctx: AudioContext | null = null;
let muted = false;

/**
 * The equipped sound pack shifts every tone rather than replacing the
 * samples: pitch, waveform and a touch of gain are enough to make the same
 * cue read as arcade, lounge or orchestral.
 */
const PACKS: Record<string, { pitch: number; type?: OscillatorType; gain: number }> = {
  retro: { pitch: 1, type: 'square', gain: 0.95 },
  lounge: { pitch: 0.84, type: 'sine', gain: 0.9 },
  arcade: { pitch: 1.18, type: 'square', gain: 1 },
  space: { pitch: 0.92, type: 'sine', gain: 1.05 },
  western: { pitch: 0.9, type: 'triangle', gain: 0.95 },
  orchestral: { pitch: 1.06, type: 'triangle', gain: 1.1 },
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

function tone({ freq, duration = 0.12, type = 'sine', gain = 0.15, delay = 0, sweepTo }: ToneOptions) {
  const c = getCtx();
  if (!c) return;

  const p = pack();
  if (p) {
    freq *= p.pitch;
    if (sweepTo !== undefined) sweepTo *= p.pitch;
    if (p.type) type = p.type;
    gain *= p.gain;
  }

  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);

  // Quick attack, smooth decay — avoids the click you get from hard cutoffs.
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(env).connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration = 0.2, gain = 0.12) {
  const c = getCtx();
  if (!c) return;
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
