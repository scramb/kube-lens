import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { OverviewProps, getPath } from './types';
import { ConditionsTable } from './ConditionsTable';

function StatNumber({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  if (value === undefined || value === null) return null;
  return (
    <Group gap={6}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Badge variant="light" color={color ?? 'blue'} size="sm">
        {value}
      </Badge>
    </Group>
  );
}

export function WorkloadOverview({ obj }: OverviewProps) {
  const { t } = useTranslation();
  const kind: string | undefined = obj?.kind;
  const status = getPath(obj, ['status']) ?? {};
  const spec = getPath(obj, ['spec']) ?? {};

  const isDaemonSet = kind === 'DaemonSet';

  const desired = isDaemonSet ? status.desiredNumberScheduled : spec.replicas;
  const ready = isDaemonSet ? status.numberReady : status.readyReplicas;
  const available = isDaemonSet ? status.numberAvailable : status.availableReplicas;
  const updated = isDaemonSet ? status.updatedNumberScheduled : status.updatedReplicas;

  const strategy: string | undefined =
    getPath(obj, ['spec', 'strategy', 'type']) ??
    getPath(obj, ['spec', 'updateStrategy', 'type']);

  const matchLabels: Record<string, string> =
    getPath(obj, ['spec', 'selector', 'matchLabels']) ?? {};
  const selectorEntries = Object.entries(matchLabels);

  const templateContainers: Array<Record<string, any>> =
    getPath(obj, ['spec', 'template', 'spec', 'containers']) ?? [];

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          {kind ?? t('detail.workload')}
        </Title>
        <Group gap="lg" wrap="wrap">
          <StatNumber label={t('detail.workload.desired')} value={desired ?? 0} color="gray" />
          <StatNumber label={t('detail.workload.ready')} value={ready ?? 0} color="green" />
          <StatNumber label={t('detail.workload.available')} value={available ?? 0} color="teal" />
          <StatNumber label={t('detail.workload.updated')} value={updated ?? 0} color="blue" />
        </Group>

        {strategy && (
          <Group gap={6} mt="md">
            <Text size="sm" c="dimmed">
              {t('detail.workload.strategy')}
            </Text>
            <Text size="sm">{strategy}</Text>
          </Group>
        )}

        {selectorEntries.length > 0 && (
          <>
            <Text size="sm" c="dimmed" mt="md" mb={4}>
              {t('detail.workload.selector')}
            </Text>
            <Group gap={6}>
              {selectorEntries.map(([k, v]) => (
                <Badge key={k} variant="light" color="indigo" size="sm">
                  {k}={String(v)}
                </Badge>
              ))}
            </Group>
          </>
        )}
      </Card>

      {templateContainers.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.workload.containerImages')}
          </Title>
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.workload.col.name')}</Table.Th>
                  <Table.Th>{t('detail.workload.col.image')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {templateContainers.map((c, i) => (
                  <Table.Tr key={`${c?.name ?? 'c'}-${i}`}>
                    <Table.Td>{c?.name ?? '-'}</Table.Td>
                    <Table.Td style={{ wordBreak: 'break-all' }}>{c?.image ?? '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <ConditionsTable obj={obj} />
    </Stack>
  );
}

export default WorkloadOverview;
