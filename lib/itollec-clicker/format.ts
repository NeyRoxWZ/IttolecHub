export function formatShortNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs < 1000) {
    const v = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0);
    return `${sign}${v}`;
  }

  const units = [
    { suffix: 'K', value: 1e3 },
    { suffix: 'M', value: 1e6 },
    { suffix: 'B', value: 1e9 },
    { suffix: 'T', value: 1e12 },
    { suffix: 'Qa', value: 1e15 },
    { suffix: 'Qi', value: 1e18 },
    { suffix: 'Sx', value: 1e21 },
    { suffix: 'Sp', value: 1e24 },
    { suffix: 'Oc', value: 1e27 },
    { suffix: 'No', value: 1e30 },
    { suffix: 'Dc', value: 1e33 },
  ];

  const unit = [...units].reverse().find((u) => abs >= u.value) ?? units[0];
  const scaled = abs / unit.value;
  const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return `${sign}${scaled.toFixed(decimals)}${unit.suffix}`;
}

export function formatSecondsAgo(lastSync: Date | null): string {
  if (!lastSync) return 'Jamais';
  const seconds = Math.max(0, Math.floor((Date.now() - lastSync.getTime()) / 1000));
  if (seconds < 60) return `Il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `Il y a ${hours}h`;
}

