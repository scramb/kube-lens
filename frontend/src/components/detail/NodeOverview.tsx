import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { OverviewProps, getPath } from './types';
import { ConditionsTable } from './ConditionsTable';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Group gap={6} align="flex-start">
      <Text size="sm" c="dimmed" w={160} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" style={{ wordBreak: 'break-all' }}>
        {value}
      </Text>
    </Group>
  );
}

export function NodeOverview({ obj }: OverviewProps) {
  const { t } = useTranslation();
  const capacity: Record<string, any> = getPath(obj, ['status', 'capacity']) ?? {};
  const allocatable: Record<string, any> = getPath(obj, ['status', 'allocatable']) ?? {};

  const resourceKeys = ['cpu', 'memory', 'pods'];

  const nodeInfo: Record<string, any> = getPath(obj, ['status', 'nodeInfo']) ?? {};
  const kubeletVersion: string | undefined = nodeInfo.kubeletVersion;
  const osImage: string | undefined = nodeInfo.osImage;
  const containerRuntime: string | undefined = nodeInfo.containerRuntimeVersion;

  const taints: Array<Record<string, any>> = getPath(obj, ['spec', 'taints']) ?? [];
  const addresses: Array<Record<string, any>> = getPath(obj, ['status', 'addresses']) ?? [];

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          {t('detail.node.capacity')}
        </Title>
        <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('detail.node.resource')}</Table.Th>
              <Table.Th>{t('detail.node.capacityCol')}</Table.Th>
              <Table.Th>{t('detail.node.allocatable')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resourceKeys.map((key) => (
              <Table.Tr key={key}>
                <Table.Td>{key}</Table.Td>
                <Table.Td>{capacity[key] ?? '-'}</Table.Td>
                <Table.Td>{allocatable[key] ?? '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          {t('detail.node.system')}
        </Title>
        <Stack gap={6}>
          <InfoRow label={t('detail.node.kubeletVersion')} value={kubeletVersion} />
          <InfoRow label={t('detail.node.osImage')} value={osImage} />
          <InfoRow label={t('detail.node.containerRuntime')} value={containerRuntime} />
        </Stack>
      </Card>

      {addresses.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.node.addresses')}
          </Title>
          <Stack gap={6}>
            {addresses.map((a, i) => (
              <InfoRow key={`${a?.type ?? 'addr'}-${i}`} label={a?.type ?? '-'} value={a?.address} />
            ))}
          </Stack>
        </Card>
      )}

      {taints.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.node.taints')}
          </Title>
          <Group gap={6}>
            {taints.map((taint, i) => (
              <Badge key={`${taint?.key ?? 'taint'}-${i}`} variant="light" color="orange" size="sm">
                {taint?.key}
                {taint?.value ? `=${taint.value}` : ''}:{taint?.effect}
              </Badge>
            ))}
          </Group>
        </Card>
      )}

      <ConditionsTable obj={obj} />
    </Stack>
  );
}

export default NodeOverview;
