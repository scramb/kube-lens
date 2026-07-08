import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { FluxKindStatus } from './types';

interface FluxStatusCardProps {
  status: FluxKindStatus;
  onClick?: () => void;
}

function accentColor(s: FluxKindStatus): string {
  const total = s.total ?? 0;
  const notReady = s.notReady ?? 0;
  const suspended = s.suspended ?? 0;
  if (notReady > 0) return 'var(--mantine-color-red-6)';
  if (total > 0 && suspended === 0) return 'var(--mantine-color-green-6)';
  return 'var(--mantine-color-gray-6)';
}

export function FluxStatusCard({ status, onClick }: FluxStatusCardProps) {
  const { t } = useTranslation();
  const total = status.total ?? 0;
  const ready = status.ready ?? 0;
  const notReady = status.notReady ?? 0;
  const suspended = status.suspended ?? 0;
  const empty = total === 0;

  return (
    <Card
      withBorder
      padding="sm"
      radius="md"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${accentColor(status)}`,
        opacity: empty ? 0.6 : 1,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={600} truncate title={status.kind}>
            {status.kind}
          </Text>
          <Text size="xs" c="dimmed" truncate title={status.group}>
            {status.group}
          </Text>
        </Stack>
        <Text fw={700} fz={28} lh={1} c={empty ? 'dimmed' : undefined}>
          {total}
        </Text>
      </Group>

      <Group gap="xs" mt="sm">
        {empty ? (
          <Text size="sm" c="dimmed">
            {t('dash.flux.none')}
          </Text>
        ) : (
          <>
            <Badge color="green" variant="light" size="sm">
              {t('dash.status.ready')} {ready}
            </Badge>
            {notReady > 0 && (
              <Badge color="red" variant="light" size="sm">
                {t('dash.status.notReady')} {notReady}
              </Badge>
            )}
            {suspended > 0 && (
              <Badge color="yellow" variant="light" size="sm">
                {t('dash.status.suspended')} {suspended}
              </Badge>
            )}
          </>
        )}
      </Group>
    </Card>
  );
}
