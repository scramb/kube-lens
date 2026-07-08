import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { OverviewProps, getPath } from './types';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Group gap={6} align="flex-start">
      <Text size="sm" c="dimmed" w={140} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" style={{ wordBreak: 'break-all' }}>
        {value}
      </Text>
    </Group>
  );
}

export function ServiceOverview({ obj }: OverviewProps) {
  const { t } = useTranslation();
  const type: string | undefined = getPath(obj, ['spec', 'type']);

  const clusterIP: string | undefined = getPath(obj, ['spec', 'clusterIP']);
  const clusterIPs: string[] = getPath(obj, ['spec', 'clusterIPs']) ?? [];
  const clusterIPText =
    clusterIPs.length > 0 ? clusterIPs.join(', ') : clusterIP;

  const externalIPs: string[] = getPath(obj, ['spec', 'externalIPs']) ?? [];

  const lbIngress: Array<Record<string, any>> =
    getPath(obj, ['status', 'loadBalancer', 'ingress']) ?? [];
  const lbText = lbIngress
    .map((ing) => ing?.ip ?? ing?.hostname)
    .filter(Boolean)
    .join(', ');

  const ports: Array<Record<string, any>> = getPath(obj, ['spec', 'ports']) ?? [];

  const selector: Record<string, string> = getPath(obj, ['spec', 'selector']) ?? {};
  const selectorEntries = Object.entries(selector);

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          {t('detail.service')}
        </Title>
        <Stack gap={6}>
          <InfoRow label={t('detail.service.type')} value={type} />
          <InfoRow label={t('detail.service.clusterIp')} value={clusterIPText} />
          <InfoRow
            label={t('detail.service.externalIps')}
            value={externalIPs.length > 0 ? externalIPs.join(', ') : undefined}
          />
          <InfoRow label={t('detail.service.loadBalancer')} value={lbText || undefined} />
        </Stack>

        {selectorEntries.length > 0 && (
          <>
            <Text size="sm" c="dimmed" mt="md" mb={4}>
              {t('detail.service.selector')}
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

      {ports.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.service.ports')}
          </Title>
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.service.col.name')}</Table.Th>
                  <Table.Th>{t('detail.service.col.port')}</Table.Th>
                  <Table.Th>{t('detail.service.col.targetPort')}</Table.Th>
                  <Table.Th>{t('detail.service.col.protocol')}</Table.Th>
                  <Table.Th>{t('detail.service.col.nodePort')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ports.map((p, i) => (
                  <Table.Tr key={`${p?.name ?? p?.port ?? 'port'}-${i}`}>
                    <Table.Td>{p?.name ?? '-'}</Table.Td>
                    <Table.Td>{p?.port ?? '-'}</Table.Td>
                    <Table.Td>{p?.targetPort ?? '-'}</Table.Td>
                    <Table.Td>{p?.protocol ?? '-'}</Table.Td>
                    <Table.Td>{p?.nodePort ?? '-'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

export default ServiceOverview;
