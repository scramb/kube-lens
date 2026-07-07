import { useEffect, useState } from 'react';
import { Badge, Card, Center, Group, Loader, Progress, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { GetClusterOverviewMetrics } from '../../../wailsjs/go/main/App';
import { ClusterOverviewMetrics } from '../../types';
import { formatBytes, formatCPU } from '../metrics/format';

interface Props {
  contextName: string | null;
  refreshToken: number;
}

function percent(used: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (used / total) * 100));
}

function UsageCard({ title, used, total, formatter }: { title: string; used: number; total: number; formatter: (v: number) => string }) {
  const value = percent(used, total);
  return (
    <Card withBorder radius="md" padding="md">
      <Text size="sm" c="dimmed">{title}</Text>
      <Group justify="space-between" mt={4}>
        <Text fw={700} fz={24}>{value.toFixed(0)}%</Text>
        <Text size="sm" c="dimmed">{formatter(used)} / {formatter(total)}</Text>
      </Group>
      <Progress value={value} mt="sm" color={value > 85 ? 'red' : value > 70 ? 'yellow' : 'cyan'} />
    </Card>
  );
}

export function ClusterOverview({ contextName, refreshToken }: Props) {
  const [data, setData] = useState<ClusterOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contextName) return;
    setLoading(true);
    GetClusterOverviewMetrics(contextName)
      .then((result) => setData(result ?? null))
      .catch(() => setData({ available: false } as ClusterOverviewMetrics))
      .finally(() => setLoading(false));
  }, [contextName, refreshToken]);

  if (loading && !data) {
    return <Center h="100%"><Loader /></Center>;
  }
  if (!data?.available) {
    return <Center h="100%"><Text c="dimmed">Keine Cluster-Metriken verfügbar</Text></Center>;
  }

  return (
    <Stack p="lg" gap="lg">
      <Group justify="space-between">
        <Title order={3}>Cluster Overview</Title>
        {data.message && <Badge color="yellow" variant="light">Teilweise Daten</Badge>}
      </Group>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <UsageCard title="CPU Nutzung" used={data.cpuUsage} total={data.cpuCapacity} formatter={formatCPU} />
        <UsageCard title="Memory Nutzung" used={data.memoryUsage} total={data.memoryCapacity} formatter={formatBytes} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Text size="sm" c="dimmed">Nodes</Text>
          <Group mt="sm">
            <Badge color="green" variant="light">Ready {data.nodeReady}</Badge>
            <Badge color={data.nodeNotReady ? 'red' : 'gray'} variant="light">NotReady {data.nodeNotReady}</Badge>
          </Group>
        </Card>
        <Card withBorder radius="md" padding="md">
          <Text size="sm" c="dimmed">Pods</Text>
          <Group mt="sm">
            <Badge color="green" variant="light">Running {data.podsRunning}</Badge>
            <Badge color="yellow" variant="light">Pending {data.podsPending}</Badge>
            <Badge color="red" variant="light">Failed {data.podsFailed}</Badge>
          </Group>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
