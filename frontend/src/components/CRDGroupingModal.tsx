import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconArrowDown, IconArrowUp, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { APIResource, CRDGroupRule, CRDGroupingSettings } from '../types';
import {
  DEFAULT_CRD_GROUP_RULES,
  normalizeCRDGroupingSettings,
  normalizeCRDGroupRule,
  sanitizeCustomSvg,
  validateCRDGroupRule,
} from '../resourceCatalog';

interface Props {
  opened: boolean;
  onClose: () => void;
  settings: CRDGroupingSettings;
  resources: APIResource[];
  onSave: (settings: CRDGroupingSettings) => Promise<void>;
}

const ICON_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'tabler:puzzle', label: 'Puzzle' },
  { value: 'tabler:bolt', label: 'Bolt' },
  { value: 'tabler:activity-heartbeat', label: 'Activity' },
  { value: 'tabler:certificate', label: 'Certificate' },
  { value: 'tabler:key', label: 'Key' },
  { value: 'tabler:mesh', label: 'Mesh' },
  { value: 'tabler:route', label: 'Route' },
  { value: 'tabler:shield-check', label: 'Shield' },
  { value: 'emoji:📦', label: 'Emoji: 📦' },
  { value: 'emoji:🚀', label: 'Emoji: 🚀' },
];

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

function patternMatches(group: string, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase();
  const g = group.toLowerCase();
  if (!normalized) return false;
  if (normalized === '*') return true;
  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(1);
    return g.endsWith(suffix) && g.length > suffix.length;
  }
  if (normalized.includes('*')) {
    const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(g);
  }
  return g === normalized;
}

function matchesForRule(rule: CRDGroupRule, resources: APIResource[]): string[] {
  const groups = new Set(resources.map((r) => r.group).filter(Boolean));
  return [...groups]
    .filter((group) => rule.patterns.some((pattern) => patternMatches(group, pattern)))
    .sort((a, b) => a.localeCompare(b));
}

export default function CRDGroupingModal({ opened, onClose, settings, resources, onSave }: Props) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<CRDGroupRule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (opened) setRules(normalizeCRDGroupingSettings(settings).rules);
  }, [opened, settings]);

  const validation = useMemo(() => {
    const messages: string[] = [];
    const seen = new Set<string>();
    for (const rule of rules) {
      for (const error of validateCRDGroupRule(rule)) messages.push(`${rule.label || rule.id}: ${error}`);
      if (seen.has(rule.id)) messages.push(`Duplicate rule id: ${rule.id}`);
      seen.add(rule.id);
      if (rule.icon.startsWith('svg:') && !sanitizeCustomSvg(rule.icon.slice(4))) {
        messages.push(`${rule.label}: Custom SVG is not safe or valid.`);
      }
    }
    return messages;
  }, [rules]);

  const addRule = () => {
    const next = normalizeCRDGroupRule({ label: 'Custom Group', patterns: ['example.com'], icon: '', enabled: true }, rules.length);
    const ids = new Set(rules.map((r) => r.id));
    let id = next.id;
    let i = 2;
    while (ids.has(id)) id = `${next.id}-${i++}`;
    setRules((prev) => [...prev, { ...next, id }]);
  };

  const updateRule = (index: number, patch: Partial<CRDGroupRule>) => {
    setRules((prev) => prev.map((rule, i) => (i === index ? normalizeCRDGroupRule({ ...rule, ...patch }, index) : rule)));
  };

  const moveRule = (index: number, delta: number) => {
    setRules((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeRule = (index: number) => setRules((prev) => prev.filter((_, i) => i !== index));

  const resetDefaults = () => setRules([]);

  const save = async () => {
    if (validation.length) return;
    setSaving(true);
    try {
      await onSave({ rules });
      notifications.show({ message: t('forms.crdGroups.saved'), color: 'teal' });
      onClose();
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('forms.crdGroups.title')} size="80%" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('forms.crdGroups.description')}
        </Text>

        {validation.length > 0 && (
          <Alert color="red" title={t('forms.crdGroups.validationTitle')}>
            <Stack gap={2}>
              {validation.map((message) => (
                <Text key={message} size="xs">
                  {message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Group justify="space-between">
          <Group gap="xs">
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addRule}>
              {t('forms.crdGroups.addRule')}
            </Button>
            <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={resetDefaults}>
              {t('forms.crdGroups.resetDefaults')}
            </Button>
          </Group>
          <Badge variant="light">{t('forms.crdGroups.defaultFallback', { count: DEFAULT_CRD_GROUP_RULES.length })}</Badge>
        </Group>

        <Table verticalSpacing="sm" withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={70}>{t('forms.crdGroups.enabled')}</Table.Th>
              <Table.Th>{t('forms.crdGroups.label')}</Table.Th>
              <Table.Th>{t('forms.crdGroups.patterns')}</Table.Th>
              <Table.Th>{t('forms.crdGroups.icon')}</Table.Th>
              <Table.Th>{t('forms.crdGroups.preview')}</Table.Th>
              <Table.Th w={120}>{t('forms.crdGroups.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center">
                    {t('forms.crdGroups.onlyDefaults')}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rules.map((rule, index) => {
                const matches = matchesForRule(rule, resources);
                return (
                  <Table.Tr key={`${rule.id}-${index}`}>
                    <Table.Td>
                      <Switch checked={rule.enabled} onChange={(event) => updateRule(index, { enabled: event.currentTarget.checked })} />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        value={rule.label}
                        onChange={(event) => updateRule(index, { label: event.currentTarget.value })}
                        placeholder="Flux"
                      />
                      <Text size="10px" c="dimmed" mt={2}>
                        {rule.id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Textarea
                        size="xs"
                        autosize
                        minRows={2}
                        value={rule.patterns.join('\n')}
                        onChange={(event) => updateRule(index, { patterns: event.currentTarget.value.split('\n') })}
                        placeholder="*.example.com"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={ICON_OPTIONS}
                        value={rule.icon.startsWith('svg:') ? '' : rule.icon}
                        onChange={(value) => updateRule(index, { icon: value ?? '' })}
                        mb={4}
                      />
                      <Textarea
                        size="xs"
                        autosize
                        minRows={1}
                        placeholder={t('forms.crdGroups.customSvgPlaceholder')}
                        value={rule.icon.startsWith('svg:') ? rule.icon.slice(4) : ''}
                        onChange={(event) => updateRule(index, { icon: event.currentTarget.value.trim() ? `svg:${event.currentTarget.value}` : '' })}
                      />
                    </Table.Td>
                    <Table.Td>
                      {matches.length ? (
                        <Text size="xs" lineClamp={4} title={matches.join(', ')}>
                          {matches.join(', ')}
                        </Text>
                      ) : (
                        <Text size="xs" c="dimmed">
                          {t('forms.crdGroups.noMatches')}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label={t('forms.crdGroups.moveUp')}>
                          <ActionIcon size="sm" variant="subtle" disabled={index === 0} onClick={() => moveRule(index, -1)}>
                            <IconArrowUp size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('forms.crdGroups.moveDown')}>
                          <ActionIcon size="sm" variant="subtle" disabled={index === rules.length - 1} onClick={() => moveRule(index, 1)}>
                            <IconArrowDown size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('forms.common.remove')}>
                          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeRule(index)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('forms.common.cancel')}
          </Button>
          <Button onClick={save} loading={saving} disabled={validation.length > 0}>
            {t('forms.common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
