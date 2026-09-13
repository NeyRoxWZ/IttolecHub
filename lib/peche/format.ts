/**
 * Big numbers, French style: 12 450, 3,2 k, 45 M, 1,8 Md, then Bn, Bd, Tn…
 * and letter pairs (aa, ab…) past the named ones, so there is no ceiling.
 */
const NAMED = ['', 'k', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td', 'Qa', 'Qd', 'Qi', 'Qid', 'Sx', 'Sxd', 'Sp', 'Spd', 'Oc', 'Ocd', 'No', 'Nod', 'De'];

function suffix(tier: number): string {
  if (tier < NAMED.length) return NAMED[tier];
  const n = tier - NAMED.length;
  const a = String.fromCharCode(97 + Math.floor(n / 26) % 26);
  const b = String.fromCharCode(97 + (n % 26));
  return a + b;
}

export function fmtBig(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  if (v < 10_000) return sign + Math.floor(v).toLocaleString('fr-FR');
  const tier = Math.floor(Math.log10(v) / 3);
  const scaled = v / Math.pow(10, tier * 3);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${sign}${scaled.toFixed(digits).replace('.', ',')} ${suffix(tier)}`;
}

export function fmtKg(kg: number): string {
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  if (kg < 1000) return `${kg.toFixed(kg < 10 ? 2 : 1).replace('.', ',')} kg`;
  return `${(kg / 1000).toFixed(2).replace('.', ',')} t`;
}
