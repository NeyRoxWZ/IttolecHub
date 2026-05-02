import { formatShortNumber } from '@/lib/itollec-clicker/format';

export function formatFrancs(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs < 1_000_000) {
    return value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return formatShortNumber(value);
}

export function formatFrancsRate(value: number): string {
  return formatFrancs(value);
}

