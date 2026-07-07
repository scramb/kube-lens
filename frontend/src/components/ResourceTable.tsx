import { ReactNode, useMemo } from 'react';
import { Badge, Center, Loader, ScrollArea, Table, Text } from '@mantine/core';
import { APIResource, TableResult, TableRow } from '../types';

export interface ExtraTableColumn {
  key: string;
  label: string;
  render: (row: TableRow) => ReactNode;
}

interface Props {
  resource: APIResource;
  table: TableResult | null;
  loading: boolean;
  error: string;
  allNamespaces: boolean;
  filter: string;
  extraColumns?: ExtraTableColumn[];
  onRowClick: (row: TableRow) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Running: 'green',
  Active: 'green',
  Ready: 'green',
  Bound: 'green',
  Available: 'green',
  Completed: 'blue',
  Succeeded: 'blue',
  Pending: 'yellow',
  ContainerCreating: 'yellow',
  PodInitializing: 'yellow',
  Terminating: 'orange',
  Failed: 'red',
  Error: 'red',
  CrashLoopBackOff: 'red',
  ImagePullBackOff: 'red',
  ErrImagePull: 'red',
  Evicted: 'red',
  OOMKilled: 'red',
  NotReady: 'red',
};

function renderCell(value: unknown, columnName: string) {
  const text = value === null || value === undefined ? '' : String(value);
  if (columnName === 'Status' && STATUS_COLORS[text]) {
    return (
      <Badge variant="light" color={STATUS_COLORS[text]} size="sm">
        {text}
      </Badge>
    );
  }
  return (
    <Text size="sm" truncate maw={420} title={text}>
      {text}
    </Text>
  );
}

export default function ResourceTable({
  resource,
  table,
  loading,
  error,
  allNamespaces,
  filter,
  extraColumns = [],
  onRowClick,
}: Props) {
  const showNamespace = resource.namespaced && allNamespaces;

  const columns = useMemo(
    () => (table?.columns ?? []).filter((c) => c.priority === 0),
    [table]
  );
  const columnIndexes = useMemo(
    () =>
      (table?.columns ?? [])
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.priority === 0)
        .map(({ i }) => i),
    [table]
  );

  const rows = useMemo(() => {
    const all = table?.rows ?? [];
    if (!filter) return all;
    const f = filter.toLowerCase();
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(f) ||
        r.namespace.toLowerCase().includes(f) ||
        r.cells.some((c) => String(c ?? '').toLowerCase().includes(f))
    );
  }, [table, filter]);

  if (loading && !table) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%" p="xl">
        <Text c="red" ta="center">
          {error}
        </Text>
      </Center>
    );
  }

  if (!table) return null;

  return (
    <ScrollArea h="100%" type="scroll">
      <Table stickyHeader highlightOnHover withRowBorders={false} verticalSpacing={6}>
        <Table.Thead>
          <Table.Tr>
            {showNamespace && <Table.Th>Namespace</Table.Th>}
            {columns.map((c) => (
              <Table.Th key={c.name}>{c.name}</Table.Th>
            ))}
            {extraColumns.map((c) => (
              <Table.Th key={c.key}>{c.label}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, ri) => (
            <Table.Tr
              key={`${row.namespace}/${row.name}/${ri}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onRowClick(row)}
            >
              {showNamespace && (
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {row.namespace}
                  </Text>
                </Table.Td>
              )}
              {columnIndexes.map((ci) => (
                <Table.Td key={ci}>{renderCell(row.cells[ci], table.columns[ci].name)}</Table.Td>
              ))}
              {extraColumns.map((c) => (
                <Table.Td key={c.key}>{c.render(row)}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Center p="xl">
          <Text c="dimmed">Keine {resource.kind}-Ressourcen gefunden</Text>
        </Center>
      )}
    </ScrollArea>
  );
}
