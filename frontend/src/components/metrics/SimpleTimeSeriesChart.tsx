import { Box, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { MetricPoint } from '../../types';
import { formatMetricValue } from './format';

export interface ReferenceLine {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  name: string;
  unit: string;
  points: MetricPoint[];
  referenceLines?: ReferenceLine[];
}

interface ChartPoint {
  timestamp: string;
  value: number;
  timeMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function niceStepBase10(range: number, targetTicks: number): number {
  const roughStep = range / Math.max(targetTicks - 1, 1);
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / 10 ** exponent;

  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * 10 ** exponent;
}

function niceStepBinary(range: number, targetTicks: number): number {
  const roughStep = range / Math.max(targetTicks - 1, 1);
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;

  const exponent = Math.floor(Math.log2(roughStep));
  const base = 2 ** exponent;
  const multipliers = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  for (const multiplier of multipliers) {
    const candidate = base * multiplier;
    if (candidate >= roughStep) return candidate;
  }

  return base * 1024;
}

function computeYTicks(rawMin: number, rawMax: number, unit: string): number[] {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return [0, 1];

  let min = rawMin;
  let max = rawMax;

  if (min >= 0 && max > 0) min = 0;
  if (max <= 0 && min < 0) max = 0;

  if (min === max) {
    const delta = Math.max(Math.abs(min) * 0.1, 1);
    min -= delta;
    max += delta;
  }

  const range = max - min;
  const isBinaryUnit = unit === 'bytes' || unit === 'bytes/s';
  let step = isBinaryUnit ? niceStepBinary(range, 4) : niceStepBase10(range, 4);

  if (!Number.isFinite(step) || step <= 0) step = 1;

  let ticks: number[] = [];
  let tries = 0;
  while (tries < 4) {
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;

    ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.5 && ticks.length < 16; v += step) {
      const normalized = Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(10));
      ticks.push(normalized);
    }

    if (ticks.length >= 3 && ticks.length <= 6) break;

    step *= isBinaryUnit ? 2 : 2;
    tries += 1;
  }

  if (ticks.length < 2) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return [lo, hi === lo ? lo + 1 : hi];
  }

  return ticks;
}

function evenTickIndices(length: number, target: number): number[] {
  if (length <= 0) return [];
  if (length === 1) return [0];

  const count = clamp(target, 2, Math.min(4, length));
  const indices = new Set<number>();

  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i / (count - 1)) * (length - 1));
    indices.add(idx);
  }

  return [...indices].sort((a, b) => a - b);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function SimpleTimeSeriesChart({ name, unit, points, referenceLines = [] }: Props) {
  const { t, i18n } = useTranslation();

  const clean: ChartPoint[] = points
    .map((p) => ({
      timestamp: p.timestamp,
      value: p.value,
      timeMs: Date.parse(p.timestamp),
    }))
    .filter((p) => Number.isFinite(p.value));

  const width = 520;
  const height = 150;
  const rightPad = 12;
  const topPad = 12;
  const bottomPad = 36;

  const latest = clean.at(-1)?.value ?? 0;

  if (clean.length === 0) {
    return (
      <Box p="sm" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 8 }}>
        <Group justify="space-between" mb={4}>
          <Text size="sm" fw={600}>{name}</Text>
          <Text size="sm" c="dimmed">{formatMetricValue(latest, unit)}</Text>
        </Group>
        <Text size="sm" c="dimmed" ta="center" py="xl">{t('dash.metrics.noData')}</Text>
      </Box>
    );
  }

  const validReferenceLines = referenceLines.filter((line) => Number.isFinite(line.value));
  const referenceValues = validReferenceLines.map((line) => line.value);
  const minValue = Math.min(...clean.map((p) => p.value), ...referenceValues);
  const maxValue = Math.max(...clean.map((p) => p.value), ...referenceValues);
  const yTicks = computeYTicks(minValue, maxValue, unit);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const ySpan = yMax - yMin || 1;

  const yLabels = yTicks.map((tick) => formatMetricValue(tick, unit));
  const maxLabelChars = Math.max(...yLabels.map((label) => label.length), 1);
  const leftPad = clamp(12 + maxLabelChars * 7, 40, 96);

  const plotWidth = Math.max(1, width - leftPad - rightPad);
  const plotHeight = Math.max(1, height - topPad - bottomPad);

  const allTimesValid = clean.every((p) => Number.isFinite(p.timeMs));
  const timeMin = allTimesValid ? Math.min(...clean.map((p) => p.timeMs)) : 0;
  const timeMax = allTimesValid ? Math.max(...clean.map((p) => p.timeMs)) : 0;
  const timeSpan = timeMax - timeMin;
  const useTimeScale = allTimesValid && timeSpan > 0;

  const xForPoint = (point: ChartPoint, index: number) => {
    if (useTimeScale) {
      return leftPad + ((point.timeMs - timeMin) / timeSpan) * plotWidth;
    }
    return leftPad + (index / Math.max(clean.length - 1, 1)) * plotWidth;
  };

  const yForValue = (value: number) => topPad + ((yMax - value) / ySpan) * plotHeight;

  const path = clean
    .map((point, index) => {
      const x = xForPoint(point, index);
      const y = yForValue(point.value);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const xTickIndices = evenTickIndices(clean.length, 4);
  const locale = i18n.resolvedLanguage || i18n.language || undefined;
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
  });
  const showDayMarkers = useTimeScale && timeSpan >= 20 * 60 * 60 * 1000;

  let previousDay: string | null = null;
  const xTicks = xTickIndices.map((index) => {
    const point = clean[index];
    const x = xForPoint(point, index);
    const date = Number.isFinite(point.timeMs) ? new Date(point.timeMs) : null;
    const timeLabel = date ? timeFormatter.format(date) : '';

    let marker: string | null = null;
    if (date) {
      const currentDay = dayKey(date);
      if (showDayMarkers && (previousDay === null || currentDay !== previousDay)) {
        marker = dayFormatter.format(date);
      }
      previousDay = currentDay;
    }

    return { x, timeLabel, marker, key: `${index}-${point.timestamp}` };
  });

  return (
    <Box p="sm" style={{ border: '1px solid var(--mantine-color-dark-4)', borderRadius: 8 }}>
      <Group justify="space-between" mb={4}>
        <Text size="sm" fw={600}>{name}</Text>
        <Text size="sm" c="dimmed">{formatMetricValue(latest, unit)}</Text>
      </Group>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={name}>
        {yTicks.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                stroke="var(--mantine-color-dark-4)"
                strokeOpacity={0.45}
              />
              <text
                x={leftPad - 6}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--mantine-color-dimmed)"
              >
                {formatMetricValue(tick, unit)}
              </text>
            </g>
          );
        })}

        <line x1={leftPad} y1={topPad} x2={leftPad} y2={height - bottomPad} stroke="var(--mantine-color-dark-4)" />
        <line x1={leftPad} y1={height - bottomPad} x2={width - rightPad} y2={height - bottomPad} stroke="var(--mantine-color-dark-4)" />

        {xTicks.map((tick) => (
          <g key={`x-${tick.key}`}>
            <line
              x1={tick.x}
              y1={height - bottomPad}
              x2={tick.x}
              y2={height - bottomPad + 4}
              stroke="var(--mantine-color-dark-4)"
            />
            {tick.marker ? (
              <text
                x={tick.x}
                y={height - 18}
                textAnchor="middle"
                fontSize={9}
                fill="var(--mantine-color-dimmed)"
              >
                {tick.marker}
              </text>
            ) : null}
            <text
              x={tick.x}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="var(--mantine-color-dimmed)"
            >
              {tick.timeLabel}
            </text>
          </g>
        ))}

        {validReferenceLines.map((line) => {
          const y = yForValue(line.value);
          return (
            <g key={`ref-${line.label}-${line.value}`}>
              <line
                x1={leftPad}
                y1={y}
                x2={width - rightPad}
                y2={y}
                stroke={line.color ?? 'var(--mantine-color-orange-4)'}
                strokeDasharray="4 3"
                strokeWidth={1.5}
              />
              <text
                x={width - rightPad - 4}
                y={y - 3}
                textAnchor="end"
                fontSize={10}
                fill={line.color ?? 'var(--mantine-color-orange-4)'}
              >
                {line.label} {formatMetricValue(line.value, unit)}
              </text>
            </g>
          );
        })}

        {clean.length === 1 ? (
          <circle
            cx={xForPoint(clean[0], 0)}
            cy={yForValue(clean[0].value)}
            r={2.5}
            fill="var(--mantine-color-cyan-5)"
          />
        ) : null}

        {clean.length > 1 ? (
          <path d={path} fill="none" stroke="var(--mantine-color-cyan-5)" strokeWidth={2} />
        ) : null}
      </svg>
    </Box>
  );
}
