import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Center, CopyButton, Group, Highlight, Loader, PasswordInput, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCopy, IconEye, IconEyeOff, IconSearch, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { GetPodEnvironment, RevealPodEnvironmentSecret } from '../../../wailsjs/go/main/App';
import { PodEnvironment, PodEnvironmentEntry } from '../../types';

interface Props {
  namespace: string;
  pod: string;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

function scoreEntry(entry: PodEnvironmentEntry, query: string, revealed: Record<string, string>): number {
  if (!query) return 1;
  const value = entry.sensitive ? revealed[secretKey(entry)] ?? '' : entry.value;
  const haystack = [entry.name, value, entry.container, entry.source, entry.refName, entry.refKey, entry.status].join(' ').toLowerCase();
  let idx = 0;
  let score = 0;
  for (const ch of query.toLowerCase()) {
    const found = haystack.indexOf(ch, idx);
    if (found < 0) return 0;
    score += found === idx ? 2 : 1;
    idx = found + 1;
  }
  return score;
}

function secretKey(entry: PodEnvironmentEntry): string {
  return `${entry.containerType}/${entry.container}/${entry.name}/${entry.refName}/${entry.refKey}`;
}

export default function EnvironmentTab({ namespace, pod }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<PodEnvironment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [revealError, setRevealError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setData(null);
    setRevealed({});
    setRevealError('');
    GetPodEnvironment(namespace, pod)
      .then((result) => setData(result ?? { entries: [], warnings: [] }))
      .catch((e) => setError(errText(e)))
      .finally(() => setLoading(false));
  }, [namespace, pod]);

  const grouped = useMemo(() => {
    const query = filter.trim();
    const scored = (data?.entries ?? [])
      .map((entry) => ({ entry, score: scoreEntry(entry, query, revealed) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
    const groups = new Map<string, PodEnvironmentEntry[]>();
    for (const { entry } of scored) {
      const key = `${entry.containerType}:${entry.container}`;
      const list = groups.get(key) ?? [];
      list.push(entry);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [data, filter, revealed]);

  const reveal = async (entry: PodEnvironmentEntry) => {
    const key = secretKey(entry);
    if (revealed[key]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setRevealing((prev) => ({ ...prev, [key]: true }));
    try {
      const value = await RevealPodEnvironmentSecret(namespace, entry.refName, entry.refKey);
      setRevealed((prev) => ({ ...prev, [key]: value }));
      setRevealError('');
    } catch (e) {
      setRevealError(errText(e));
    } finally {
      setRevealing((prev) => ({ ...prev, [key]: false }));
    }
  };

  const displayValue = (entry: PodEnvironmentEntry) => {
    if (!entry.sensitive) return entry.value || '—';
    return revealed[secretKey(entry)] ?? '••••••••';
  };

  if (loading) return <Center h={200}><Loader /></Center>;
  if (error) return <Alert color="red">{error}</Alert>;
  if (!data) return null;

  return (
    <Stack gap="md" p="xs">
      {data.warnings?.length > 0 && (
        <Alert color="yellow" title={t('detail.env.warnings')}>
          {data.warnings.map((warning) => <Text key={warning} size="sm">{warning}</Text>)}
        </Alert>
      )}
      {revealError && (
        <Alert color="red" title={t('detail.env.revealFailed')} withCloseButton onClose={() => setRevealError('')}>
          {revealError}
        </Alert>
      )}
      <TextInput
        placeholder={t('detail.env.search')}
        leftSection={<IconSearch size={14} />}
        rightSection={
          filter ? (
            <Tooltip label={t('detail.env.clearSearch')}>
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setFilter('')}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          ) : undefined
        }
        value={filter}
        onChange={(event) => setFilter(event.currentTarget.value)}
      />
      {filter.trim() !== '' && (
        <Text size="xs" c="dimmed">
          {t('detail.env.matches', { count: grouped.reduce((n, [, entries]) => n + entries.length, 0) })}
        </Text>
      )}
      {grouped.length === 0 ? (
        <Center h={160}><Text c="dimmed">{t('detail.env.empty')}</Text></Center>
      ) : grouped.map(([group, entries]) => {
        const [type, name] = group.split(':');
        return (
          <Stack key={group} gap="xs">
            <Group gap="xs">
              <Text tt="uppercase" fw={700} size="xs" c="dimmed">{type}</Text>
              <Text fw={700}>{name}</Text>
              <Badge variant="light">{entries.length}</Badge>
            </Group>
            <Table highlightOnHover withRowBorders={false} verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('detail.env.name')}</Table.Th>
                  <Table.Th>{t('detail.env.value')}</Table.Th>
                  <Table.Th>{t('detail.env.source')}</Table.Th>
                  <Table.Th>{t('detail.env.reference')}</Table.Th>
                  <Table.Th>{t('detail.env.status')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map((entry) => {
                  const value = displayValue(entry);
                  const isRevealed = !!revealed[secretKey(entry)];
                  return (
                    <Table.Tr key={secretKey(entry)}>
                      <Table.Td><Highlight highlight={filter.trim()} size="sm" fw={600}>{entry.name}</Highlight></Table.Td>
                      <Table.Td>
                        {entry.sensitive && !isRevealed ? (
                          <PasswordInput value={value} readOnly variant="unstyled" size="xs" />
                        ) : (
                          <Highlight highlight={filter.trim()} size="sm" lineClamp={3} title={value} style={{ wordBreak: 'break-word' }}>{value}</Highlight>
                        )}
                      </Table.Td>
                      <Table.Td><Badge variant="light">{entry.source}</Badge></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{[entry.refName, entry.refKey].filter(Boolean).join(' / ') || '—'}</Text></Table.Td>
                      <Table.Td><Text size="sm" c={entry.status === 'resolved' || entry.status === 'masked' ? 'dimmed' : 'yellow'}>{entry.status}</Text></Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          {entry.revealable && (
                            <Tooltip label={isRevealed ? t('detail.env.hideSecret') : t('detail.env.revealSecret')}>
                              <ActionIcon size="sm" variant="subtle" loading={revealing[secretKey(entry)]} onClick={() => reveal(entry)}>
                                {isRevealed ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {(!entry.sensitive || isRevealed) && (
                            <CopyButton value={value}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? t('detail.yaml.copied') : t('detail.env.copy')}>
                                  <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                                    <IconCopy size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </CopyButton>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        );
      })}
      {Object.keys(revealed).length > 0 && <Button size="xs" variant="light" onClick={() => setRevealed({})}>{t('detail.env.hideAllSecrets')}</Button>}
    </Stack>
  );
}
