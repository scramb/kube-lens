import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react';
import {
  DiscoverPrometheusTargets,
  GetPrometheusLabelValues,
  GetPrometheusSettings,
  SetPrometheusSettings,
  TestPrometheusConnection,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { PrometheusConnectionTestResult, PrometheusContextSettings, PrometheusTargetCandidate } from '../types';

interface Props {
  opened: boolean;
  onClose: () => void;
  contextName: string | null;
}

interface HeaderRow {
  id: number;
  key: string;
  value: string;
}

const EMPTY_SETTINGS: PrometheusContextSettings = {
  mode: 'off',
  url: '',
  headers: {},
  clusterSelector: { label: '', value: '' },
  target: { accessMode: 'proxy', namespace: '', service: '', portName: '', port: 0, pathPrefix: '' },
};

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

function headersToRows(headers: Record<string, string> | undefined): HeaderRow[] {
  return Object.entries(headers ?? {}).map(([key, value], index) => ({ id: index + 1, key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, row) => {
    const key = row.key.trim();
    if (key) acc[key] = row.value;
    return acc;
  }, {});
}

export default function PrometheusConfigModal({ opened, onClose, contextName }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingValues, setLoadingValues] = useState(false);
  const [settings, setSettings] = useState<PrometheusContextSettings>(EMPTY_SETTINGS);
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [clusterValues, setClusterValues] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<PrometheusConnectionTestResult | null>(null);
  const [loadError, setLoadError] = useState('');
  const [targets, setTargets] = useState<PrometheusTargetCandidate[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  useEffect(() => {
    if (!opened || !contextName) return;
    setLoading(true);
    setLoadError('');
    setTestResult(null);
    setClusterValues([]);
    (async () => {
      try {
        const cfg = await GetPrometheusSettings(contextName);
        const normalized = normalizeSettings(cfg);
        setSettings(normalized);
        setHeaders(headersToRows(normalized.headers));
      } catch (e) {
        setLoadError(errText(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [opened, contextName]);

  const currentSettings = useMemo<PrometheusContextSettings>(
    () => normalizeSettings({ ...settings, headers: rowsToHeaders(headers) }),
    [settings, headers]
  );

  const updateSettings = (patch: Partial<PrometheusContextSettings>) => {
    setSettings((prev) => normalizeSettings({ ...prev, ...patch }));
    setTestResult(null);
  };

  const updateClusterSelector = (patch: Partial<PrometheusContextSettings['clusterSelector']>) => {
    setSettings((prev) => ({
      ...prev,
      clusterSelector: { ...prev.clusterSelector, ...patch },
    }));
    setTestResult(null);
  };

  const addHeader = () => {
    setHeaders((prev) => [...prev, { id: Date.now(), key: '', value: '' }]);
    setTestResult(null);
  };

  const updateHeader = (id: number, patch: Partial<HeaderRow>) => {
    setHeaders((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setTestResult(null);
  };

  const removeHeader = (id: number) => {
    setHeaders((prev) => prev.filter((row) => row.id !== id));
    setTestResult(null);
  };

  const loadClusterValues = async () => {
    if (!contextName || !currentSettings.clusterSelector.label.trim()) return;
    setLoadingValues(true);
    try {
      const values = await GetPrometheusLabelValues(contextName, toWailsSettings(currentSettings), currentSettings.clusterSelector.label);
      setClusterValues(values ?? []);
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setLoadingValues(false);
    }
  };

  const testConnection = async () => {
    if (!contextName) return;
    setTesting(true);
    try {
      const result = await TestPrometheusConnection(contextName, toWailsSettings(currentSettings));
      setTestResult(result);
      if (result.clusterValues?.length) {
        setClusterValues(result.clusterValues);
      }
    } catch (e) {
      setTestResult({
        ok: false,
        mode: currentSettings.mode,
        message: errText(e),
        sampleCount: 0,
        clusterLabel: currentSettings.clusterSelector.label,
        clusterValues: [],
        proxyForbidden: false,
      });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!contextName) return;
    setSaving(true);
    try {
      const saved = await SetPrometheusSettings(contextName, toWailsSettings(currentSettings));
      const normalized = normalizeSettings(saved);
      setSettings(normalized);
      setHeaders(headersToRows(normalized.headers));
      notifications.show({ message: 'Prometheus-Konfiguration gespeichert', color: 'teal' });
      onClose();
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const loadTargets = async () => {
    if (!contextName) return;
    setTargetsLoading(true);
    try {
      setTargets((await DiscoverPrometheusTargets(contextName)) ?? []);
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setTargetsLoading(false);
    }
  };

  const selectTarget = (candidate: PrometheusTargetCandidate) => {
    updateSettings({
      mode: 'auto',
      target: {
        accessMode: 'proxy',
        namespace: candidate.namespace,
        service: candidate.service,
        portName: candidate.portName,
        port: candidate.port,
        pathPrefix: '',
      },
    });
  };

  const labelValues = clusterValues.map((value) => ({ value, label: value }));

  return (
    <Modal opened={opened} onClose={onClose} title="Prometheus konfigurieren" size="lg" centered>
      {!contextName ? (
        <Text c="dimmed" size="sm">
          Kein Kubernetes-Kontext verbunden.
        </Text>
      ) : loadError ? (
        <Alert color="red" title="Konfiguration konnte nicht geladen werden">
          {loadError}
        </Alert>
      ) : (
        <Stack gap="md" opacity={loading ? 0.55 : 1}>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Kontext:
            </Text>
            <Badge variant="light">{contextName}</Badge>
          </Group>

          <Select
            label="Modus"
            description="Auto entdeckt In-Cluster-Prometheus und greift über den API-Server-Proxy zu. Manuell nutzt eine frei konfigurierbare URL."
            data={[
              { value: 'off', label: 'Aus' },
              { value: 'manual', label: 'Manuell' },
              { value: 'auto', label: 'Auto-Discovery' },
            ]}
            value={settings.mode || 'off'}
            onChange={(value) => updateSettings({ mode: value ?? 'off' })}
            disabled={loading}
          />

          {settings.mode === 'auto' && (
            <Stack gap="xs">
              <Alert color="blue" variant="light">
                Auto nutzt den Kubernetes API-Server-Service-Proxy. Bitte einen Discovery-Kandidaten bestätigen.
              </Alert>
              <Group justify="space-between">
                <Text size="sm" fw={500}>Prometheus-Service</Text>
                <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} loading={targetsLoading} onClick={loadTargets}>
                  Kandidaten suchen
                </Button>
              </Group>
              {settings.target.service ? (
                <Badge variant="light" color="teal" w="fit-content">
                  {settings.target.namespace}/{settings.target.service}:{settings.target.portName || settings.target.port}
                </Badge>
              ) : (
                <Text size="xs" c="dimmed">Noch kein Service ausgewählt.</Text>
              )}
              {targets.length > 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                  {targets.map((candidate) => (
                    <Button
                      key={`${candidate.namespace}/${candidate.service}/${candidate.portName || candidate.port}`}
                      variant="light"
                      color={settings.target.namespace === candidate.namespace && settings.target.service === candidate.service ? 'teal' : 'gray'}
                      onClick={() => selectTarget(candidate)}
                    >
                      {candidate.namespace}/{candidate.service}:{candidate.portName || candidate.port}
                    </Button>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          )}

          {settings.mode === 'manual' && (
            <TextInput
              label="Prometheus-kompatible URL"
              placeholder="https://mimir.example.com/prometheus"
              value={settings.url}
              onChange={(event) => updateSettings({ url: event.currentTarget.value })}
              disabled={loading}
            />
          )}

          {settings.mode !== 'off' && (
            <Stack gap="xs">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>
                    HTTP-Header
                  </Text>
                  <Text size="xs" c="dimmed">
                    Freie Key-Value-Liste für Tenant (X-Scope-OrgID), Authorization oder Proxies —
                    werden auch über den API-Server-Proxy weitergereicht.
                  </Text>
                </div>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addHeader}>
                  Header hinzufügen
                </Button>
              </Group>
              {headers.length === 0 ? (
                <Text size="xs" c="dimmed">
                  Keine Header konfiguriert.
                </Text>
              ) : (
                headers.map((row) => (
                  <Group key={row.id} gap="xs" wrap="nowrap" align="flex-end">
                    <TextInput
                      label="Name"
                      placeholder="X-Scope-OrgID"
                      value={row.key}
                      onChange={(event) => updateHeader(row.id, { key: event.currentTarget.value })}
                      style={{ flex: 1 }}
                    />
                    <PasswordInput
                      label="Wert"
                      placeholder="Header-Wert"
                      value={row.value}
                      onChange={(event) => updateHeader(row.id, { value: event.currentTarget.value })}
                      style={{ flex: 1 }}
                    />
                    <Tooltip label="Header entfernen">
                      <ActionIcon color="red" variant="subtle" onClick={() => removeHeader(row.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ))
              )}
            </Stack>
          )}

          <Divider />

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Cluster-Selector
            </Text>
            <Text size="xs" c="dimmed">
              Label leer lassen für Single-Cluster-Prometheus. Der Label-Name ist frei konfigurierbar.
            </Text>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput
                label="Label-Name"
                placeholder="cluster"
                value={settings.clusterSelector.label}
                onChange={(event) => updateClusterSelector({ label: event.currentTarget.value, value: '' })}
                style={{ flex: 1 }}
              />
              <Select
                label="Wert"
                placeholder="Kein Matcher"
                data={labelValues}
                value={settings.clusterSelector.value || null}
                onChange={(value) => updateClusterSelector({ value: value ?? '' })}
                searchable
                clearable
                disabled={!settings.clusterSelector.label.trim()}
                style={{ flex: 1 }}
              />
              <Tooltip label="Label-Werte laden">
                <ActionIcon
                  variant="light"
                  onClick={loadClusterValues}
                  loading={loadingValues}
                  disabled={settings.mode === 'off' || !settings.clusterSelector.label.trim()}
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>

          {testResult && (
            <Alert
              color={testResult.ok ? 'teal' : testResult.mode === 'auto' ? 'blue' : 'yellow'}
              icon={testResult.ok ? <IconCheck size={16} /> : <IconX size={16} />}
              title={testResult.ok ? 'Verbindung erfolgreich' : 'Verbindung nicht aktiv'}
            >
              <Text size="sm">{testResult.message}</Text>
              {testResult.ok && (
                <Text size="xs" c="dimmed" mt={4}>
                  Samples: {testResult.sampleCount}
                  {testResult.clusterLabel ? ` · ${testResult.clusterLabel}: ${testResult.clusterValues.length} Werte` : ''}
                </Text>
              )}
            </Alert>
          )}

          <Group justify="space-between" mt="xs">
            <Button variant="light" onClick={testConnection} loading={testing} disabled={loading}>
              Verbindung testen
            </Button>
            <Group gap="xs">
              <Button variant="default" onClick={onClose} disabled={saving}>
                Abbrechen
              </Button>
              <Button onClick={save} loading={saving} disabled={loading}>
                Speichern
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function normalizeSettings(input?: Partial<PrometheusContextSettings>): PrometheusContextSettings {
  return {
    mode: input?.mode || 'off',
    url: input?.url || '',
    headers: input?.headers ?? {},
    clusterSelector: {
      label: input?.clusterSelector?.label || '',
      value: input?.clusterSelector?.value || '',
    },
    target: {
      accessMode: input?.target?.accessMode || 'proxy',
      namespace: input?.target?.namespace || '',
      service: input?.target?.service || '',
      portName: input?.target?.portName || '',
      port: input?.target?.port || 0,
      pathPrefix: input?.target?.pathPrefix || '',
    },
  };
}

function toWailsSettings(settings: PrometheusContextSettings): main.PrometheusContextSettings {
  return new main.PrometheusContextSettings(settings);
}
