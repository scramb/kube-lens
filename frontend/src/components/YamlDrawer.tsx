import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  CopyButton,
  Drawer,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  ScrollArea,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconRotateClockwise,
  IconScale,
  IconTrash,
} from '@tabler/icons-react';
import {
  FluxReconcile,
  FluxReconcileWithSource,
  GetEventsFor,
  GetResourceJSON,
  GetResourceYAML,
  RolloutRestart,
  ScaleResource,
  SetSuspend,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { APIResource, ResourceQuantitySummary } from '../types';
import { getOverviewRenderer, KubeObject } from './detail';
import { ResourceMetricsTab } from './metrics/ResourceMetricsTab';
import { LogsTab } from './logs';
import TerminalTab from './terminal/TerminalTab';
import EnvironmentTab from './env/EnvironmentTab';
import { YamlEditor } from './editor';

interface Props {
  opened: boolean;
  onClose: () => void;
  resource: APIResource | null;
  name: string;
  namespace: string;
  onDelete: () => Promise<void>;
  metricsAvailable: boolean;
  contextName: string | null;
  quantitySummary?: ResourceQuantitySummary | null;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

export default function YamlDrawer({ opened, onClose, resource, name, namespace, onDelete, metricsAvailable, contextName, quantitySummary }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>('overview');

  const [obj, setObj] = useState<KubeObject | null>(null);
  const [objError, setObjError] = useState('');

  const [yaml, setYaml] = useState('');
  const [yamlLoading, setYamlLoading] = useState(false);

  const [events, setEvents] = useState<main.EventInfo[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleReplicas, setScaleReplicas] = useState<number | string>(1);
  const [deleting, setDeleting] = useState(false);
  const [fluxBusy, setFluxBusy] = useState(false);
  const [workloadBusy, setWorkloadBusy] = useState(false);

  const identity = resource
    ? `${resource.group}/${resource.version}/${resource.name}/${namespace}/${name}`
    : '';

  const reqRef = useRef(0);

  const loadObj = useCallback(async () => {
    if (!resource) return;
    const req = reqRef.current;
    try {
      const json = await GetResourceJSON(resource.group, resource.version, resource.name, namespace, name);
      if (reqRef.current === req) setObj(JSON.parse(json));
    } catch (e) {
      if (reqRef.current === req) setObjError(errText(e));
    }
  }, [resource, namespace, name]);

  // Reset + fetch the object as JSON whenever a different resource is opened.
  useEffect(() => {
    if (!opened || !resource) return;
    reqRef.current++;
    setTab('overview');
    setObj(null);
    setObjError('');
    setYaml('');
    setEvents(null);
    setEventsError('');
    loadObj();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, opened]);

  // Lazily load YAML the first time its tab is shown.
  useEffect(() => {
    if (!opened || !resource || tab !== 'yaml' || yaml || yamlLoading) return;
    const req = reqRef.current;
    setYamlLoading(true);
    (async () => {
      try {
        const y = await GetResourceYAML(resource.group, resource.version, resource.name, namespace, name);
        if (reqRef.current === req) setYaml(y);
      } catch (e) {
        if (reqRef.current === req) setYaml(t('detail.yaml.error', { message: errText(e) }));
      } finally {
        if (reqRef.current === req) setYamlLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, opened, identity]);

  // Lazily load events the first time their tab is shown.
  useEffect(() => {
    if (!opened || tab !== 'events' || events !== null || eventsLoading) return;
    const req = reqRef.current;
    setEventsLoading(true);
    setEventsError('');
    const uid = (obj?.metadata?.uid as string) ?? '';
    (async () => {
      try {
        const ev = await GetEventsFor(namespace, name, uid);
        if (reqRef.current === req) setEvents(ev ?? []);
      } catch (e) {
        if (reqRef.current === req) setEventsError(errText(e));
      } finally {
        if (reqRef.current === req) setEventsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, opened, identity]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const isFlux = !!resource?.group.endsWith('.fluxcd.io');
  const isPod = resource?.kind === 'Pod' && resource?.group === '';
  const canRolloutRestart = !!resource && resource.group === 'apps' && resource.version === 'v1' && ['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind);
  const canScale = !!resource && resource.group === 'apps' && resource.version === 'v1' && ['Deployment', 'StatefulSet'].includes(resource.kind);
  const podHasOwner = Array.isArray(obj?.metadata?.ownerReferences) && obj.metadata.ownerReferences.length > 0;
  const metricsSupported = !!resource && (resource.kind === 'Pod' || resource.kind === 'Node');
  const showMetricsTab = metricsAvailable && metricsSupported;
  const suspended = obj?.spec?.suspend === true;

  const runFlux = useCallback(
    async (action: 'reconcile' | 'reconcileSource' | 'suspend' | 'resume', label: string) => {
      if (!resource) return;
      setFluxBusy(true);
      try {
        if (action === 'reconcile') {
          await FluxReconcile(resource.group, resource.version, resource.name, namespace, name);
        } else if (action === 'reconcileSource') {
          await FluxReconcileWithSource(resource.group, resource.version, resource.name, namespace, name);
        } else {
          await SetSuspend(resource.group, resource.version, resource.name, namespace, name, action === 'suspend');
        }
        notifications.show({ message: `${label}: ${name}`, color: 'teal' });
        // Reflect suspend/resume immediately in the overview.
        setTimeout(() => loadObj(), 400);
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      } finally {
        setFluxBusy(false);
      }
    },
    [resource, namespace, name, loadObj]
  );

  const runWorkloadAction = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setWorkloadBusy(true);
      try {
        await fn();
        notifications.show({ message: `${label}: ${name}`, color: 'teal' });
        setTimeout(() => loadObj(), 400);
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      } finally {
        setWorkloadBusy(false);
      }
    },
    [name, loadObj]
  );

  const handleRolloutRestart = useCallback(async () => {
    if (!resource) return;
    await runWorkloadAction(t('detail.notify.rolloutRestarted'), () => RolloutRestart(resource.group, resource.version, resource.name, namespace, name));
    setRestartConfirmOpen(false);
  }, [resource, namespace, name, runWorkloadAction, t]);

  const openScaleDialog = useCallback(async () => {
    if (!resource) return;
    try {
      const json = await GetResourceJSON(resource.group, resource.version, resource.name, namespace, name);
      const fresh = JSON.parse(json) as KubeObject;
      const replicas = fresh?.spec?.replicas;
      setScaleReplicas(typeof replicas === 'number' ? replicas : 1);
      setObj(fresh);
    } catch {
      const replicas = obj?.spec?.replicas;
      setScaleReplicas(typeof replicas === 'number' ? replicas : 1);
    }
    setScaleOpen(true);
  }, [resource, namespace, name, obj]);

  const handleScale = useCallback(async () => {
    if (!resource || typeof scaleReplicas !== 'number') return;
    await runWorkloadAction(t('detail.notify.scaled'), () => ScaleResource(resource.group, resource.version, resource.name, namespace, name, scaleReplicas));
    setScaleOpen(false);
  }, [resource, namespace, name, scaleReplicas, runWorkloadAction, t]);

  useEffect(() => {
    if (tab === 'metrics' && !showMetricsTab) setTab('overview');
  }, [tab, showMetricsTab]);

  const Renderer = resource ? getOverviewRenderer(resource.kind) : null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="60%"
      title={
        <Group gap="xs">
          <Text fw={700}>{resource?.kind}</Text>
          <Text c="dimmed">
            {namespace ? `${namespace} / ` : ''}
            {name}
          </Text>
          {isFlux && suspended && (
            <Badge size="sm" color="orange" variant="light">
              {t('detail.suspended')}
            </Badge>
          )}
        </Group>
      }
    >
      <Group justify="space-between" mb="xs" gap="xs" wrap="nowrap">
        <Group gap="xs">
          {canRolloutRestart && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRotateClockwise size={14} />}
              loading={workloadBusy}
              onClick={() => setRestartConfirmOpen(true)}
            >
              {t('detail.action.restart')}
            </Button>
          )}
          {canScale && (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconScale size={14} />}
              loading={workloadBusy}
              onClick={openScaleDialog}
            >
              {t('detail.action.scale')}
            </Button>
          )}
          {isPod && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconRotateClockwise size={14} />}
              loading={deleting}
              onClick={() => setConfirmOpen(true)}
            >
              {t('detail.action.restart')}
            </Button>
          )}
          {isFlux && (
            <>
              <Button.Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  loading={fluxBusy}
                  onClick={() => runFlux('reconcile', t('detail.notify.reconcileRequested'))}
                >
                  {t('detail.action.reconcile')}
                </Button>
                <Menu position="bottom-start" withinPortal>
                  <Menu.Target>
                    <Button size="xs" variant="light" px={6} disabled={fluxBusy}>
                      <IconChevronDown size={14} />
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconRefresh size={14} />}
                      onClick={() =>
                        runFlux('reconcileSource', t('detail.notify.reconcileWithSourceRequested'))
                      }
                    >
                      {t('detail.action.reconcileWithSource')}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Button.Group>
              {suspended ? (
                <Button
                  size="xs"
                  variant="light"
                  color="teal"
                  leftSection={<IconPlayerPlay size={14} />}
                  loading={fluxBusy}
                  onClick={() => runFlux('resume', t('detail.notify.resumed'))}
                >
                  {t('detail.action.resume')}
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={<IconPlayerPause size={14} />}
                  loading={fluxBusy}
                  onClick={() => runFlux('suspend', t('detail.notify.suspended'))}
                >
                  {t('detail.action.suspend')}
                </Button>
              )}
            </>
          )}
        </Group>
        <Group gap="xs">
          {tab === 'yaml' && (
            <CopyButton value={yaml}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t('detail.yaml.copied') : t('detail.yaml.copy')}>
                  <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          )}
          <Tooltip label={t('detail.delete.tooltip')}>
            <ActionIcon variant="subtle" color="red" onClick={() => setConfirmOpen(true)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Tabs value={tab} onChange={(v) => setTab(v ?? 'overview')} keepMounted={false}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="overview">{t('detail.tab.overview')}</Tabs.Tab>
          <Tabs.Tab value="yaml">{t('detail.tab.yaml')}</Tabs.Tab>
          {isPod && <Tabs.Tab value="logs">{t('detail.tab.logs')}</Tabs.Tab>}
          {isPod && <Tabs.Tab value="terminal">{t('detail.tab.terminal')}</Tabs.Tab>}
          {isPod && <Tabs.Tab value="env">{t('detail.tab.env')}</Tabs.Tab>}
          <Tabs.Tab value="events">{t('detail.tab.events')}</Tabs.Tab>
          {showMetricsTab && <Tabs.Tab value="metrics">{t('detail.tab.metrics')}</Tabs.Tab>}
        </Tabs.List>

        <Tabs.Panel value="overview">
          <ScrollArea h="calc(100vh - 165px)" type="scroll">
            {objError ? (
              <Text c="red" p="md">
                {objError}
              </Text>
            ) : !obj || !Renderer ? (
              <Center h={200}>
                <Loader />
              </Center>
            ) : (
              <Renderer obj={obj} quantitySummary={quantitySummary} />
            )}
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="yaml">
          {yamlLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <YamlEditor
              initialYaml={yaml}
              editable
              height="calc(100vh - 210px)"
              onApplied={() => {
                setYaml('');
                loadObj();
              }}
            />
          )}
        </Tabs.Panel>

        {isPod && (
          <Tabs.Panel value="logs">
            <LogsTab namespace={namespace} pod={name} />
          </Tabs.Panel>
        )}

        {isPod && (
          <Tabs.Panel value="terminal">
            <TerminalTab namespace={namespace} pod={name} />
          </Tabs.Panel>
        )}

        {isPod && (
          <Tabs.Panel value="env">
            <ScrollArea h="calc(100vh - 165px)" type="scroll">
              <EnvironmentTab namespace={namespace} pod={name} />
            </ScrollArea>
          </Tabs.Panel>
        )}

        <Tabs.Panel value="events">
          <ScrollArea h="calc(100vh - 165px)" type="scroll">
            <EventsView events={events} loading={eventsLoading} error={eventsError} />
          </ScrollArea>
        </Tabs.Panel>

        {showMetricsTab && resource && (
          <Tabs.Panel value="metrics">
            <ScrollArea h="calc(100vh - 165px)" type="scroll">
              <ResourceMetricsTab contextName={contextName} resource={resource} namespace={namespace} name={name} quantitySummary={quantitySummary} />
            </ScrollArea>
          </Tabs.Panel>
        )}
      </Tabs>

      <Modal
        opened={restartConfirmOpen}
        onClose={() => setRestartConfirmOpen(false)}
        title={t('detail.restart.title')}
        centered
        zIndex={400}
      >
        <Text size="sm" mb="md">
          {t('detail.restart.confirm', { kind: resource?.kind, name })}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setRestartConfirmOpen(false)}>
            {t('detail.cancel')}
          </Button>
          <Button loading={workloadBusy} leftSection={<IconRotateClockwise size={16} />} onClick={handleRolloutRestart}>
            {t('detail.action.restart')}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={scaleOpen}
        onClose={() => setScaleOpen(false)}
        title={t('detail.scale.title')}
        centered
        zIndex={400}
      >
        <NumberInput
          label={t('detail.scale.replicas')}
          description={obj?.spec?.replicas === undefined ? t('detail.scale.missingReplicas') : undefined}
          min={0}
          allowNegative={false}
          value={scaleReplicas}
          onChange={setScaleReplicas}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setScaleOpen(false)}>
            {t('detail.cancel')}
          </Button>
          <Button loading={workloadBusy} disabled={typeof scaleReplicas !== 'number'} leftSection={<IconScale size={16} />} onClick={handleScale}>
            {t('detail.scale.apply')}
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={isPod ? t('detail.podRestart.title') : t('detail.delete.title')}
        centered
        zIndex={400}
      >
        <Text size="sm" mb="md">
          {isPod
            ? t('detail.podRestart.confirm', { name, namespace })
            : namespace
              ? t('detail.delete.confirmInNamespace', {
                  kind: resource?.kind,
                  name,
                  namespace,
                })
              : t('detail.delete.confirm', { kind: resource?.kind, name })}
        </Text>
        {isPod && !podHasOwner && (
          <Text size="sm" c="red" mb="md">
            {t('detail.podRestart.noOwnerWarning')}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmOpen(false)}>
            {t('detail.cancel')}
          </Button>
          <Button color={isPod ? 'orange' : 'red'} loading={deleting} onClick={handleDelete}>
            {isPod ? t('detail.action.restart') : t('detail.action.delete')}
          </Button>
        </Group>
      </Modal>
    </Drawer>
  );
}

function EventsView({
  events,
  loading,
  error,
}: {
  events: main.EventInfo[] | null;
  loading: boolean;
  error: string;
}) {
  const { t, i18n } = useTranslation();
  if (loading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }
  if (error) {
    return (
      <Text c="red" p="md">
        {error}
      </Text>
    );
  }
  if (!events || events.length === 0) {
    return (
      <Center h={160}>
        <Text c="dimmed">{t('detail.events.none')}</Text>
      </Center>
    );
  }
  return (
    <Table verticalSpacing={6} highlightOnHover withRowBorders={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('detail.events.type')}</Table.Th>
          <Table.Th>{t('detail.events.reason')}</Table.Th>
          <Table.Th>{t('detail.events.message')}</Table.Th>
          <Table.Th>{t('detail.events.count')}</Table.Th>
          <Table.Th>{t('detail.events.last')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {events.map((e, i) => (
          <Table.Tr key={i}>
            <Table.Td>
              <Badge size="sm" variant="light" color={e.type === 'Warning' ? 'red' : 'gray'}>
                {e.type || '—'}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{e.reason}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" style={{ wordBreak: 'break-word' }}>
                {e.message}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{e.count || 1}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {e.lastTimestamp ? new Date(e.lastTimestamp).toLocaleString(i18n.language) : '—'}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
