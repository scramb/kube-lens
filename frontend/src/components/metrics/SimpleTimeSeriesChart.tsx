import { Box, Group, Text } from '@mantine/core';
import { MetricPoint } from '../../types';
import { formatMetricValue } from './format';

interface Props {
  name: string;
  unit: string;
  points: MetricPoint[];
}

export function SimpleTimeSeriesChart({ name, unit, points }: Props) {
  const clean = points.filter((p) => Number.isFinite(p.value));
  const width = 520;
  const height = 130;
  const pad = 16;
  const min = Math.min(...clean.map((p) => p.value), 0);
  const max = Math.max(...clean.map((p) => p.value), 1);
  const span = max - min || 1;
  const path = clean
    .map((p, i) => {
      const x = pad + (i / Math.max(clean.length - 1, 1)) * (width - pad * 2);
      const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const latest = clean.at(-1)?.value ?? 0;

  return (
    <Box p="sm" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 8 }}>
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={600}>{name}</Text>
        <Text size="sm" c="dimmed">{formatMetricValue(latest, unit)}</Text>
      </Group>
      {clean.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="xl">Keine Daten</Text>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={name}>
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--mantine-color-dark-4)" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="var(--mantine-color-dark-4)" />
          <path d={path} fill="none" stroke="var(--mantine-color-cyan-5)" strokeWidth={2} />
        </svg>
      )}
    </Box>
  );
}
