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
  ScrollArea,
  Table,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import {
  FluxReconcile,
  FluxReconcileWithSource,
  GetEventsFor,
  GetResourceJSON,
  GetResourceYAML,
  SetSuspend,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { APIResource } from '../types';
import { getOverviewRenderer, KubeObject } from './detail';

interface Props {
  opened: boolean;
  onClose: () => void;
  resource: APIResource | null;
  name: string;
  namespace: string;
  onDelete: () => Promise<void>;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

export default function YamlDrawer({ opened, onClose, resource, name, namespace, onDelete }: Props) {
  const [tab, setTab] = useState<string>('overview');

  const [obj, setObj] = useState<KubeObject | null>(null);
  const [objError, setObjError] = useState('');

  const [yaml, setYaml] = useState('');
  const [yamlLoading, setYamlLoading] = useState(false);

  const [events, setEvents] = useState<main.EventInfo[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fluxBusy, setFluxBusy] = useState(false);

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
        if (reqRef.current === req) setYaml(`Fehler: ${errText(e)}`);
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
              pausiert
            </Badge>
          )}
        </Group>
      }
    >
      <Group justify="space-between" mb="xs" gap="xs" wrap="nowrap">
        <Group gap="xs">
          {isFlux && (
            <>
              <Button.Group>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconRefresh size={14} />}
                  loading={fluxBusy}
                  onClick={() => runFlux('reconcile', 'Reconcile angefordert')}
                >
                  Reconcile
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
                      onClick={() => runFlux('reconcileSource', 'Reconcile mit Source angefordert')}
                    >
                      Reconcile with source
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
                  onClick={() => runFlux('resume', 'Fortgesetzt')}
                >
                  Resume
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={<IconPlayerPause size={14} />}
                  loading={fluxBusy}
                  onClick={() => runFlux('suspend', 'Pausiert')}
                >
                  Suspend
                </Button>
              )}
            </>
          )}
        </Group>
        <Group gap="xs">
          {tab === 'yaml' && (
            <CopyButton value={yaml}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Kopiert' : 'YAML kopieren'}>
                  <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          )}
          <Tooltip label="Ressource löschen">
            <ActionIcon variant="subtle" color="red" onClick={() => setConfirmOpen(true)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Tabs value={tab} onChange={(v) => setTab(v ?? 'overview')} keepMounted={false}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="overview">Übersicht</Tabs.Tab>
          <Tabs.Tab value="yaml">YAML</Tabs.Tab>
          <Tabs.Tab value="events">Events</Tabs.Tab>
          <Tabs.Tab value="metrics">Metriken</Tabs.Tab>
        </Tabs.List>

        <ScrollArea h="calc(100vh - 165px)" type="scroll">
          <Tabs.Panel value="overview">
            {objError ? (
              <Text c="red" p="md">
                {objError}
              </Text>
            ) : !obj || !Renderer ? (
              <Center h={200}>
                <Loader />
              </Center>
            ) : (
              <Renderer obj={obj} />
            )}
          </Tabs.Panel>

          <Tabs.Panel value="yaml">
            {yamlLoading ? (
              <Center h={200}>
                <Loader />
              </Center>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  background: 'var(--mantine-color-dark-8)',
                  borderRadius: 8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {yaml}
              </pre>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="events">
            <EventsView events={events} loading={eventsLoading} error={eventsError} />
          </Tabs.Panel>

          <Tabs.Panel value="metrics">
            <Center h={200}>
              <Text c="dimmed" ta="center" maw={360}>
                Metriken werden mit der Prometheus-Anbindung ergänzt (Milestone B).
              </Text>
            </Center>
          </Tabs.Panel>
        </ScrollArea>
      </Tabs>

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ressource löschen?"
        centered
        zIndex={400}
      >
        <Text size="sm" mb="md">
          {resource?.kind} <b>{name}</b>
          {namespace ? ` im Namespace ${namespace}` : ''} wird endgültig gelöscht.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmOpen(false)}>
            Abbrechen
          </Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>
            Löschen
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
        <Text c="dimmed">Keine Events</Text>
      </Center>
    );
  }
  return (
    <Table verticalSpacing={6} highlightOnHover withRowBorders={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Typ</Table.Th>
          <Table.Th>Grund</Table.Th>
          <Table.Th>Nachricht</Table.Th>
          <Table.Th>Anzahl</Table.Th>
          <Table.Th>Zuletzt</Table.Th>
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
                {e.lastTimestamp ? new Date(e.lastTimestamp).toLocaleString() : '—'}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
