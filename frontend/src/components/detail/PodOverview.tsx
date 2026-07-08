import { Badge, Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { OverviewProps, age, getPath } from './types';
import { ConditionsTable } from './ConditionsTable';

function phaseColor(phase?: string): string {
  switch (phase) {
    case 'Running':
    case 'Succeeded':
      return 'green';
    case 'Pending':
      return 'yellow';
    case 'Failed':
      return 'red';
    default:
      return 'gray';
  }
}

interface ContainerState {
  key: string;
  reason?: string;
}

/** Erster Key aus status.state (running/waiting/terminated) samt reason. */
function readState(state: Record<string, any> | undefined): ContainerState | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const key = Object.keys(state)[0];
  if (!key) return undefined;
  const inner = state[key] ?? {};
  return { key, reason: inner?.reason };
}

function ContainerRow({
  container,
  status,
  isInit,
}: {
  container: Record<string, any>;
  status?: Record<string, any>;
  isInit: boolean;
}) {
  const resources = container?.resources ?? {};
  const requests = resources.requests ?? {};
  const limits = resources.limits ?? {};

  const ready: boolean | undefined = status?.ready;
  const restarts = status?.restartCount ?? 0;
  const state = readState(status?.state);

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Text size="sm">{container?.name ?? '-'}</Text>
          {isInit && (
            <Badge size="xs" variant="outline" color="gray">
              init
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td style={{ wordBreak: 'break-all' }}>{container?.image ?? '-'}</Table.Td>
      <Table.Td>
        {ready === undefined ? (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ) : (
          <Badge color={ready ? 'green' : 'red'} variant="light" size="sm">
            {ready ? 'Ready' : 'NotReady'}
          </Badge>
        )}
      </Table.Td>
      <Table.Td>{restarts}</Table.Td>
      <Table.Td>
        {state ? (
          <Text size="sm">
            {state.key}
            {state.reason ? ` (${state.reason})` : ''}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {requests.cpu ?? '-'} / {limits.cpu ?? '-'}
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {requests.memory ?? '-'} / {limits.memory ?? '-'}
      </Table.Td>
    </Table.Tr>
  );
}

export function PodOverview({ obj }: OverviewProps) {
  const { t } = useTranslation();
  const phase: string | undefined = getPath(obj, ['status', 'phase']);
  const nodeName: string | undefined = getPath(obj, ['spec', 'nodeName']);
  const qosClass: string | undefined = getPath(obj, ['status', 'qosClass']);
  const podIP: string | undefined = getPath(obj, ['status', 'podIP']);
  const startTime: string | undefined = getPath(obj, ['status', 'startTime']);

  const containers: Array<Record<string, any>> = getPath(obj, ['spec', 'containers']) ?? [];
  const initContainers: Array<Record<string, any>> =
    getPath(obj, ['spec', 'initContainers']) ?? [];
  const containerStatuses: Array<Record<string, any>> =
    getPath(obj, ['status', 'containerStatuses']) ?? [];
  const initContainerStatuses: Array<Record<string, any>> =
    getPath(obj, ['status', 'initContainerStatuses']) ?? [];

  const statusByName = (list: Array<Record<string, any>>) => {
    const map = new Map<string, Record<string, any>>();
    for (const s of Array.isArray(list) ? list : []) {
      if (s?.name) map.set(s.name, s);
    }
    return map;
  };
  const csMap = statusByName(containerStatuses);
  const initCsMap = statusByName(initContainerStatuses);

  const volumes: Array<Record<string, any>> = getPath(obj, ['spec', 'volumes']) ?? [];

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Title order={5} mb="sm">
          {t('detail.pod')}
        </Title>
        <Group gap="lg" wrap="wrap">
          <Group gap={6}>
            <Text size="sm" c="dimmed">
              {t('detail.pod.phase')}
            </Text>
            <Badge color={phaseColor(phase)} variant="light" size="sm">
              {phase ?? 'Unknown'}
            </Badge>
          </Group>
          {nodeName && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                {t('detail.pod.node')}
              </Text>
              <Text size="sm">{nodeName}</Text>
            </Group>
          )}
          {qosClass && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                {t('detail.pod.qos')}
              </Text>
              <Text size="sm">{qosClass}</Text>
            </Group>
          )}
          {podIP && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                {t('detail.pod.podIp')}
              </Text>
              <Text size="sm">{podIP}</Text>
            </Group>
          )}
          {startTime && (
            <Group gap={6}>
              <Text size="sm" c="dimmed">
                {t('detail.pod.start')}
              </Text>
              <Text size="sm">{age(startTime)}</Text>
            </Group>
          )}
        </Group>
      </Card>

      {(containers.length > 0 || initContainers.length > 0) && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.pod.containers')}
          </Title>
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.pod.col.name')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.image')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.ready')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.restarts')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.state')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.cpu')}</Table.Th>
                  <Table.Th>{t('detail.pod.col.mem')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {initContainers.map((c, i) => (
                  <ContainerRow
                    key={`init-${c?.name ?? i}`}
                    container={c}
                    status={c?.name ? initCsMap.get(c.name) : undefined}
                    isInit
                  />
                ))}
                {containers.map((c, i) => (
                  <ContainerRow
                    key={`c-${c?.name ?? i}`}
                    container={c}
                    status={c?.name ? csMap.get(c.name) : undefined}
                    isInit={false}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {volumes.length > 0 && (
        <Card withBorder radius="md" padding="md">
          <Title order={5} mb="sm">
            {t('detail.pod.volumes')}
          </Title>
          <Stack gap={4}>
            {volumes.map((v, i) => {
              const typeKey = Object.keys(v ?? {}).find((k) => k !== 'name');
              return (
                <Group key={`${v?.name ?? 'vol'}-${i}`} gap={8}>
                  <Text size="sm">{v?.name ?? '-'}</Text>
                  <Badge variant="light" color="cyan" size="sm">
                    {typeKey ?? 'unknown'}
                  </Badge>
                </Group>
              );
            })}
          </Stack>
        </Card>
      )}

      <ConditionsTable obj={obj} />
    </Stack>
  );
}

export default PodOverview;
