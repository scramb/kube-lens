import { useEffect, useState } from 'react';
import { Badge, Center, Group, Loader, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { GetResourceMetricsSeries } from '../../../wailsjs/go/main/App';
import { APIResource, ResourceMetricsSeries, ResourceQuantitySummary } from '../../types';
import { SimpleTimeSeriesChart, ReferenceLine } from './SimpleTimeSeriesChart';
import { formatBytes, formatCPU } from './format';

interface Props {
  contextName: string | null;
  resource: APIResource;
  namespace: string;
  name: string;
  quantitySummary?: ResourceQuantitySummary | null;
}

export function ResourceMetricsTab({ contextName, resource, namespace, name, quantitySummary }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState('1h');
  const [data, setData] = useState<ResourceMetricsSeries | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contextName) return;
    setLoading(true);
    setData(null);
    GetResourceMetricsSeries(contextName, resource.kind, namespace, name, range)
      .then((result) => setData(result ?? null))
      .catch(() => setData({ available: false, series: [] }))
      .finally(() => setLoading(false));
  }, [contextName, resource.kind, namespace, name, range]);

  const hasQuantities = !!quantitySummary && (quantitySummary.hasCPURequest || quantitySummary.hasCPULimit || quantitySummary.hasMemRequest || quantitySummary.hasMemLimit);
  const refsForSeries = (seriesName: string, unit: string): ReferenceLine[] => {
    if (!quantitySummary || resource.kind !== 'Pod') return [];
    const lower = seriesName.toLowerCase();
    if (unit === 'cores' || lower.includes('cpu')) {
      return [
        ...(quantitySummary.hasCPURequest ? [{ label: t('dash.metrics.request'), value: quantitySummary.cpuRequest, color: 'var(--mantine-color-blue-4)' }] : []),
        ...(quantitySummary.hasCPULimit ? [{ label: t('dash.metrics.limit'), value: quantitySummary.cpuLimit, color: 'var(--mantine-color-orange-4)' }] : []),
      ];
    }
    if (unit === 'bytes' && lower.includes('memory')) {
      return [
        ...(quantitySummary.hasMemRequest ? [{ label: t('dash.metrics.request'), value: quantitySummary.memoryRequest, color: 'var(--mantine-color-blue-4)' }] : []),
        ...(quantitySummary.hasMemLimit ? [{ label: t('dash.metrics.limit'), value: quantitySummary.memoryLimit, color: 'var(--mantine-color-orange-4)' }] : []),
      ];
    }
    return [];
  };

  return (
    <Stack gap="md" p="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">{t('dash.metrics.prometheus')}</Text>
        <SegmentedControl
          size="xs"
          value={range}
          onChange={setRange}
          data={[
            { value: '1h', label: '1h' },
            { value: '6h', label: '6h' },
            { value: '24h', label: '24h' },
          ]}
        />
      </Group>
      {hasQuantities && quantitySummary && (
        <Group gap="xs">
          {quantitySummary.hasCPURequest && <Badge variant="light">CPU request {formatCPU(quantitySummary.cpuRequest)}</Badge>}
          {quantitySummary.hasCPULimit && <Badge variant="light" color="orange">CPU limit {formatCPU(quantitySummary.cpuLimit)}</Badge>}
          {quantitySummary.hasMemRequest && <Badge variant="light">Memory request {formatBytes(quantitySummary.memoryRequest)}</Badge>}
          {quantitySummary.hasMemLimit && <Badge variant="light" color="orange">Memory limit {formatBytes(quantitySummary.memoryLimit)}</Badge>}
        </Group>
      )}
      {loading ? (
        <Center h={220}><Loader /></Center>
      ) : !data?.available || data.series.length === 0 ? (
        <Center h={180}><Text c="dimmed">{t('dash.metrics.noMetrics')}</Text></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {data.series.map((series) => (
            <SimpleTimeSeriesChart key={series.name} name={series.name} unit={series.unit} points={series.points ?? []} referenceLines={refsForSeries(series.name, series.unit)} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
