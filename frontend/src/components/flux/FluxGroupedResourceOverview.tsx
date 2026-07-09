import { useMemo, useState } from 'react';
import { Badge, Center, Group, ScrollArea, Select, Stack, Table, Text, TextInput, Title, ActionIcon, Tooltip } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { FluxProblemResource } from './types';

interface Props {
  resources: FluxProblemResource[];
  loading: boolean;
  titleKey: string;
  subtitleKey: string;
  searchKey: string;
  emptyTitleKey: string;
  emptyTextKey: string;
  noMatchesKey: string;
  countColor: string;
  renderStatus: (resource: FluxProblemResource) => React.ReactNode;
  onRefresh: () => void;
  onOpenResource: (resource: FluxProblemResource) => void;
}

export function defaultProblemStatus(resource: FluxProblemResource) {
  const status = resource.status;
  const color = status === 'False' ? 'red' : status === 'Unknown' ? 'yellow' : 'gray';
  return (
    <Badge color={color} variant="light">
      {resource.reason || status || 'Unknown'}
    </Badge>
  );
}

export function suspendedStatus(resource: FluxProblemResource) {
  return (
    <Group gap={4} wrap="nowrap">
      <Badge color="yellow" variant="light">Suspended</Badge>
      {resource.status ? (
        <Badge color={resource.status === 'True' ? 'green' : resource.status === 'False' ? 'red' : 'gray'} variant="outline">
          {resource.reason || resource.status}
        </Badge>
      ) : null}
    </Group>
  );
}

export default function FluxGroupedResourceOverview({
  resources,
  loading,
  titleKey,
  subtitleKey,
  searchKey,
  emptyTitleKey,
  emptyTextKey,
  noMatchesKey,
  countColor,
  renderStatus,
  onRefresh,
  onOpenResource,
}: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [nsFilter, setNsFilter] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const namespaces = useMemo(
    () => [...new Set(resources.map((p) => p.namespace).filter(Boolean))].sort(),
    [resources]
  );
  const kinds = useMemo(
    () => [...new Set(resources.map((p) => p.kind).filter(Boolean))].sort(),
    [resources]
  );

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const scoped = resources.filter(
      (p) => (!nsFilter || p.namespace === nsFilter) && (!kindFilter || p.kind === kindFilter)
    );
    const list = !needle
      ? scoped
      : scoped.filter((p) => [p.kind, p.namespace, p.name, p.status, p.reason, p.message, p.revision].some((v) => (v ?? '').toLowerCase().includes(needle)));
    const byKind = new Map<string, FluxProblemResource[]>();
    for (const resource of list) {
      const items = byKind.get(resource.kind) ?? [];
      items.push(resource);
      byKind.set(resource.kind, items);
    }
    return [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [resources, filter, nsFilter, kindFilter]);

  return (
    <Stack p="md" gap="md" h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Title order={3}>{t(titleKey)}</Title>
          <Text size="sm" c="dimmed">{t(subtitleKey)}</Text>
        </Stack>
        <Tooltip label={t('dash.flux.refresh')}>
          <ActionIcon variant="default" size="lg" onClick={onRefresh} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          size="sm"
          style={{ flex: 1 }}
          placeholder={t(searchKey)}
          leftSection={<IconSearch size={14} />}
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
        />
        <Select
          size="sm"
          w={200}
          placeholder={t('dash.flux.problems.filterNamespace')}
          data={namespaces}
          value={nsFilter}
          onChange={setNsFilter}
          clearable
          searchable
        />
        <Select
          size="sm"
          w={200}
          placeholder={t('dash.flux.problems.filterKind')}
          data={kinds}
          value={kindFilter}
          onChange={setKindFilter}
          clearable
          searchable
        />
      </Group>

      {resources.length === 0 ? (
        <Center flex={1}>
          <Stack gap="xs" align="center">
            <Text fw={700}>{t(emptyTitleKey)}</Text>
            <Text c="dimmed" size="sm">{t(emptyTextKey)}</Text>
          </Stack>
        </Center>
      ) : filtered.length === 0 ? (
        <Center flex={1}><Text c="dimmed">{t(noMatchesKey)}</Text></Center>
      ) : (
        <ScrollArea flex={1} type="scroll">
          <Stack gap="sm">
            {filtered.map(([kind, items]) => {
              const isCollapsed = collapsed[kind] === true;
              return (
                <Stack key={kind} gap={0}>
                  <Group
                    justify="space-between"
                    px="sm"
                    py={6}
                    bg="var(--mantine-color-default)"
                    style={{ borderRadius: 6, cursor: 'pointer' }}
                    onClick={() => setCollapsed((prev) => ({ ...prev, [kind]: !isCollapsed }))}
                  >
                    <Group gap="xs">
                      {isCollapsed ? <IconChevronRight size={16} /> : <IconChevronDown size={16} />}
                      <Text fw={700}>{kind}</Text>
                      <Badge color={countColor} variant="light">{items.length}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{items[0]?.group}</Text>
                  </Group>
                  {!isCollapsed && (
                    <Table highlightOnHover withRowBorders={false} verticalSpacing={6}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('dash.flux.problems.namespace')}</Table.Th>
                          <Table.Th>{t('dash.flux.problems.name')}</Table.Th>
                          <Table.Th>{t('dash.flux.problems.status')}</Table.Th>
                          <Table.Th>{t('dash.flux.problems.message')}</Table.Th>
                          <Table.Th>{t('dash.flux.problems.revision')}</Table.Th>
                          <Table.Th>{t('dash.flux.problems.age')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {items.map((p) => (
                          <Table.Tr key={`${p.group}/${p.namespace}/${p.name}`} onClick={() => onOpenResource(p)} style={{ cursor: 'pointer' }}>
                            <Table.Td><Text size="sm" c="dimmed">{p.namespace || '—'}</Text></Table.Td>
                            <Table.Td><Text size="sm" fw={600}>{p.name}</Text></Table.Td>
                            <Table.Td>{renderStatus(p)}</Table.Td>
                            <Table.Td>
                              <Text size="sm" lineClamp={2} title={p.message}>{p.message || '—'}</Text>
                            </Table.Td>
                            <Table.Td><Text size="sm" truncate maw={220} title={p.revision}>{p.revision || '—'}</Text></Table.Td>
                            <Table.Td><Text size="sm" c="dimmed">{p.age || '—'}</Text></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
