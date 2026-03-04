'use client';

// Helper pour déclencher des vibrations sur mobile
export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Patterns prédéfinis
export const HAPTIC = {
  SOFT: 10,
  MEDIUM: 30,
  HEAVY: 50,
  SUCCESS: [20, 30, 20],
  ERROR: [50, 50, 50],
  WARNING: [30, 10, 30],
  TICK: 5, // Pour le timer
};
