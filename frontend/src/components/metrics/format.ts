export function formatCPU(value?: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  if (value < 1) return `${Math.round(value * 1000)}m`;
  return `${value.toFixed(value < 10 ? 2 : 1)}`;
}

export function formatBytes(value?: number): string {
  if (!value || !Number.isFinite(value)) return '—';
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti'];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : v < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatRate(value?: number): string {
  const bytes = formatBytes(value);
  return bytes === '—' ? bytes : `${bytes}/s`;
}

export function formatMetricValue(value: number, unit: string): string {
  if (unit === 'bytes') return formatBytes(value);
  if (unit === 'bytes/s') return formatRate(value);
  if (unit === 'cores') return formatCPU(value);
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}
