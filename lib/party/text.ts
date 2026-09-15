/**
 * Text helpers shared by the party games: comparing typed answers to the
 * expected one without punishing accents, capitals, articles or a typo.
 */

/** Lower case, no accents, no punctuation, single spaces. */
export function fold(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** fold() without the leading articles and filler words: « Les Misérables » and « miserables » are the same answer. */
export function normalize(s: string): string {
  return fold(s)
    .replace(/\b(le|la|les|l|un|une|des|du|de|d|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** A typed answer matches: exact once normalized, or one typo per ~6 letters. */
export function isCloseEnough(guess: string, answer: string): boolean {
  const g = normalize(guess);
  const a = normalize(answer);
  if (!g || !a) return false;
  if (g === a) return true;
  const tolerance = a.length <= 3 ? 0 : a.length <= 6 ? 1 : a.length <= 12 ? 2 : 3;
  return levenshtein(g, a) <= tolerance;
}

/** Song titles without « (feat. …) », « [Remastered] » or « - Radio Edit ». */
export function cleanTitle(title: string): string {
  return String(title ?? '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();
}

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const pickOne = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
