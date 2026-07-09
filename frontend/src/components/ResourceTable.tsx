import { ReactNode, useMemo, useState } from 'react';
import { ActionIcon, Badge, Center, Group, Loader, ScrollArea, Table, Text, Tooltip } from '@mantine/core';
import { IconGripVertical, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { APIResource, TableResult, TableRow, TableViewSettings } from '../types';

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
  viewSettings?: TableViewSettings;
  onViewSettingsChange?: (settings: TableViewSettings) => void;
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

type DisplayColumn =
  | { key: string; label: string; kind: 'namespace' }
  | { key: string; label: string; kind: 'server'; cellIndex: number; columnName: string }
  | { key: string; label: string; kind: 'extra'; extra: ExtraTableColumn };

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

function mergeColumnOrder(columns: DisplayColumn[], order: string[] | undefined): DisplayColumn[] {
  if (!order?.length) return columns;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const used = new Set<string>();
  const ordered: DisplayColumn[] = [];
  for (const key of order) {
    const column = byKey.get(key);
    if (!column) continue;
    ordered.push(column);
    used.add(key);
  }
  for (const column of columns) {
    if (!used.has(column.key)) ordered.push(column);
  }
  return ordered;
}

export default function ResourceTable({
  resource,
  table,
  loading,
  error,
  allNamespaces,
  filter,
  extraColumns = [],
  viewSettings,
  onViewSettingsChange,
  onRowClick,
}: Props) {
  const { t } = useTranslation();
  const [dragKey, setDragKey] = useState<string | null>(null);
  const showNamespace = resource.namespaced && allNamespaces;

  const baseColumns = useMemo<DisplayColumn[]>(() => {
    const cols: DisplayColumn[] = [];
    if (showNamespace) cols.push({ key: 'system:namespace', label: t('detail.table.namespace'), kind: 'namespace' });
    (table?.columns ?? []).forEach((c, i) => {
      if (c.priority === 0) cols.push({ key: `server:${c.name}`, label: c.name, kind: 'server', cellIndex: i, columnName: c.name });
    });
    for (const extra of extraColumns) cols.push({ key: `extra:${extra.key}`, label: extra.label, kind: 'extra', extra });
    return cols;
  }, [table, extraColumns, showNamespace, t]);

  const visibleColumns = useMemo(
    () => mergeColumnOrder(baseColumns, viewSettings?.columnOrder).filter((c) => !(viewSettings?.hiddenColumns ?? []).includes(c.key)),
    [baseColumns, viewSettings]
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

  const persistOrder = (nextColumns: DisplayColumn[]) => {
    onViewSettingsChange?.({
      columnOrder: nextColumns.map((c) => c.key),
      hiddenColumns: viewSettings?.hiddenColumns ?? [],
    });
  };

  const resetColumns = () => {
    onViewSettingsChange?.({ columnOrder: [], hiddenColumns: [] });
  };

  const onDropHeader = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    const current = [...visibleColumns];
    const from = current.findIndex((c) => c.key === dragKey);
    const to = current.findIndex((c) => c.key === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    persistOrder(current);
    setDragKey(null);
  };

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
            {visibleColumns.map((c) => (
              <Table.Th
                key={c.key}
                draggable
                onDragStart={() => setDragKey(c.key)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropHeader(c.key)}
                style={{ cursor: 'grab', userSelect: 'none' }}
              >
                <Group gap={4} wrap="nowrap">
                  <IconGripVertical size={12} color="var(--mantine-color-dimmed)" />
                  <span>{c.label}</span>
                </Group>
              </Table.Th>
            ))}
            {onViewSettingsChange && (
              <Table.Th w={34}>
                <Tooltip label={t('detail.table.resetColumns')}>
                  <ActionIcon size="xs" variant="subtle" onClick={resetColumns} aria-label={t('detail.table.resetColumns')}>
                    <IconRefresh size={13} />
                  </ActionIcon>
                </Tooltip>
              </Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, ri) => (
            <Table.Tr
              key={`${row.namespace}/${row.name}/${ri}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onRowClick(row)}
            >
              {visibleColumns.map((column) => {
                if (column.kind === 'namespace') {
                  return (
                    <Table.Td key={column.key}>
                      <Text size="sm" c="dimmed">
                        {row.namespace}
                      </Text>
                    </Table.Td>
                  );
                }
                if (column.kind === 'server') {
                  return <Table.Td key={column.key}>{renderCell(row.cells[column.cellIndex], column.columnName)}</Table.Td>;
                }
                return <Table.Td key={column.key}>{column.extra.render(row)}</Table.Td>;
              })}
              {onViewSettingsChange && <Table.Td />}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {rows.length === 0 && (
        <Center p="xl">
          <Text c="dimmed">{t('detail.table.empty', { kind: resource.kind })}</Text>
        </Center>
      )}
    </ScrollArea>
  );
}
