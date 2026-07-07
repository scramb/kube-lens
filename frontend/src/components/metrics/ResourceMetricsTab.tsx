import { useEffect, useState } from 'react';
import { Center, Group, Loader, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { GetResourceMetricsSeries } from '../../../wailsjs/go/main/App';
import { APIResource, ResourceMetricsSeries } from '../../types';
import { SimpleTimeSeriesChart } from './SimpleTimeSeriesChart';

interface Props {
  contextName: string | null;
  resource: APIResource;
  namespace: string;
  name: string;
}

export function ResourceMetricsTab({ contextName, resource, namespace, name }: Props) {
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

  return (
    <Stack gap="md" p="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">Prometheus-Metriken</Text>
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
      {loading ? (
        <Center h={220}><Loader /></Center>
      ) : !data?.available || data.series.length === 0 ? (
        <Center h={180}><Text c="dimmed">Keine Metriken verfügbar</Text></Center>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {data.series.map((series) => (
            <SimpleTimeSeriesChart key={series.name} name={series.name} unit={series.unit} points={series.points ?? []} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
