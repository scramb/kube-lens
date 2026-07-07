import { Badge, Card, Table, Title } from '@mantine/core';
import { OverviewProps, age, getPath } from './types';

function statusColor(status?: string): string {
  if (status === 'True') return 'green';
  if (status === 'False') return 'red';
  return 'gray';
}

export function ConditionsTable({ obj }: OverviewProps) {
  const conditions = getPath(obj, ['status', 'conditions']);
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return null;
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Title order={5} mb="sm">
        Conditions
      </Title>
      <Table.ScrollContainer minWidth={600}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th>Message</Table.Th>
              <Table.Th>LastTransitionTime</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {conditions.map((c: Record<string, any>, i: number) => (
              <Table.Tr key={`${c?.type ?? 'cond'}-${i}`}>
                <Table.Td>{c?.type ?? '-'}</Table.Td>
                <Table.Td>
                  <Badge color={statusColor(c?.status)} variant="light" size="sm">
                    {c?.status ?? 'Unknown'}
                  </Badge>
                </Table.Td>
                <Table.Td>{c?.reason ?? '-'}</Table.Td>
                <Table.Td style={{ maxWidth: 320, whiteSpace: 'normal' }}>
                  {c?.message ?? '-'}
                </Table.Td>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                  {c?.lastTransitionTime ? age(c.lastTransitionTime) : '-'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

export default ConditionsTable;
