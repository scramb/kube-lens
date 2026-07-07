import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  AppShell,
  Button,
  Center,
  Group,
  Loader,
  Select,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconRefresh,
  IconSearch,
  IconSettings,
} from '@tabler/icons-react';
import {
  AddKubeConfigDialog,
  DeleteResource,
  DiscoverResources,
  InitialContext,
  ListContexts,
  ListKubeConfigs,
  ListNamespaces,
  ListResourceTable,
  RemoveKubeConfig,
  UseContext,
} from '../wailsjs/go/main/App';
import { APIResource, ContextInfo, KubeConfigInfo, TableResult, TableRow } from './types';
import { buildCrdNav, buildStandardNav, NavSection } from './resourceCatalog';
import Sidebar from './components/Sidebar';
import ResourceTable from './components/ResourceTable';
import YamlDrawer from './components/YamlDrawer';
import KubeConfigModal from './components/KubeConfigModal';

const REFRESH_INTERVAL_MS = 5000;

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

export default function App() {
  const [configs, setConfigs] = useState<KubeConfigInfo[]>([]);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState(''); // '' = alle Namespaces
  const [resources, setResources] = useState<APIResource[]>([]);
  const [selected, setSelected] = useState<APIResource | null>(null);

  const [table, setTable] = useState<TableResult | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState('');
  const [filter, setFilter] = useState('');

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    resource: APIResource | null;
    name: string;
    namespace: string;
  }>({ open: false, resource: null, name: '', namespace: '' });

  const standardNav = useMemo<NavSection[]>(() => buildStandardNav(resources), [resources]);
  const crdNav = useMemo<NavSection[]>(() => buildCrdNav(resources), [resources]);

  const refreshConfigsAndContexts = useCallback(async () => {
    setConfigs(await ListKubeConfigs());
    setContexts(await ListContexts());
  }, []);

  const connect = useCallback(async (ctxName: string) => {
    setConnecting(true);
    setConnectError('');
    setTable(null);
    setTableError('');
    try {
      await UseContext(ctxName);
      setCurrentContext(ctxName);
      const [ns, res] = await Promise.all([
        ListNamespaces().catch(() => [] as string[]),
        DiscoverResources(),
      ]);
      setNamespaces(ns ?? []);
      setResources(res ?? []);
      setSelected((prev) => {
        if (prev && (res ?? []).some((r) => r.group === prev.group && r.name === prev.name)) {
          return prev;
        }
        return (res ?? []).find((r) => r.group === '' && r.name === 'pods') ?? null;
      });
    } catch (e) {
      setConnectError(errText(e));
      setCurrentContext(ctxName);
    } finally {
      setConnecting(false);
    }
  }, []);

  // Initial load: kubeconfigs, contexts, auto-connect to last/current context.
  useEffect(() => {
    (async () => {
      try {
        await refreshConfigsAndContexts();
        const initial = await InitialContext();
        if (initial) await connect(initial);
      } catch (e) {
        setConnectError(errText(e));
      }
    })();
  }, [refreshConfigsAndContexts, connect]);

  const loadTable = useCallback(
    async (showSpinner: boolean) => {
      if (!selected) return;
      if (showSpinner) setTableLoading(true);
      try {
        const result = await ListResourceTable(
          selected.group,
          selected.version,
          selected.name,
          selected.namespaced ? namespace : ''
        );
        setTable(result);
        setTableError('');
      } catch (e) {
        setTableError(errText(e));
      } finally {
        setTableLoading(false);
      }
    },
    [selected, namespace]
  );

  // Load + poll the active resource table.
  const loadTableRef = useRef(loadTable);
  loadTableRef.current = loadTable;
  useEffect(() => {
    if (!selected || connectError) return;
    setTable(null);
    setTableError('');
    loadTableRef.current(true);
    const timer = setInterval(() => loadTableRef.current(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [selected, namespace, currentContext, connectError]);

  const openDetail = useCallback(
    (row: TableRow) => {
      if (!selected) return;
      setDrawer({ open: true, resource: selected, name: row.name, namespace: row.namespace });
    },
    [selected]
  );

  const deleteCurrent = useCallback(async () => {
    const res = drawer.resource;
    if (!res) return;
    try {
      await DeleteResource(res.group, res.version, res.name, drawer.namespace, drawer.name);
      notifications.show({ message: `${res.kind} „${drawer.name}" wird gelöscht`, color: 'teal' });
      loadTableRef.current(false);
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
      throw e;
    }
  }, [drawer.resource, drawer.name, drawer.namespace]);

  const addKubeConfig = useCallback(async () => {
    try {
      const path = await AddKubeConfigDialog();
      if (path) {
        notifications.show({ message: `${path} hinzugefügt`, color: 'teal' });
        await refreshConfigsAndContexts();
      }
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    }
  }, [refreshConfigsAndContexts]);

  const removeKubeConfig = useCallback(
    async (path: string) => {
      await RemoveKubeConfig(path);
      await refreshConfigsAndContexts();
    },
    [refreshConfigsAndContexts]
  );

  const namespaceData = useMemo(
    () => [{ value: '', label: 'Alle Namespaces' }, ...namespaces.map((n) => ({ value: n, label: n }))],
    [namespaces]
  );

  const noContexts = contexts.length === 0;

  return (
    <AppShell header={{ height: 52 }} navbar={{ width: 240, breakpoint: 0 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Title order={4} c="cyan.4" style={{ whiteSpace: 'nowrap' }}>
            Kube Lens
          </Title>
          <Select
            size="xs"
            w={260}
            placeholder="Kontext wählen"
            data={contexts.map((c) => ({ value: c.name, label: c.name }))}
            value={currentContext}
            onChange={(v) => v && connect(v)}
            searchable
            disabled={noContexts}
          />
          <Select
            size="xs"
            w={220}
            data={namespaceData}
            value={namespace}
            onChange={(v) => setNamespace(v ?? '')}
            searchable
            disabled={!selected?.namespaced || !!connectError}
          />
          <TextInput
            size="xs"
            flex={1}
            placeholder="Suchen …"
            leftSection={<IconSearch size={14} />}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
          />
          <Tooltip label="Aktualisieren">
            <ActionIcon variant="subtle" onClick={() => loadTable(true)} disabled={!selected}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Kubeconfigs verwalten">
            <ActionIcon variant="subtle" onClick={() => setConfigModalOpen(true)}>
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Sidebar standard={standardNav} crds={crdNav} selected={selected} onSelect={setSelected} />
      </AppShell.Navbar>

      <AppShell.Main h="100dvh">
        {noContexts ? (
          <Center h="100%">
            <div style={{ textAlign: 'center' }}>
              <Text c="dimmed" mb="md">
                Keine Kubernetes-Kontexte gefunden.
                <br />
                Lege eine ~/.kube/config an oder füge eine kubeconfig-Datei hinzu.
              </Text>
              <Button onClick={addKubeConfig}>Kubeconfig hinzufügen</Button>
            </div>
          </Center>
        ) : connecting ? (
          <Center h="100%">
            <Group>
              <Loader size="sm" />
              <Text c="dimmed">Verbinde mit {currentContext} …</Text>
            </Group>
          </Center>
        ) : connectError ? (
          <Center h="100%" p="xl">
            <Alert
              icon={<IconAlertCircle />}
              title="Verbindung fehlgeschlagen"
              color="red"
              maw={600}
            >
              <Text size="sm" style={{ wordBreak: 'break-word' }}>
                {connectError}
              </Text>
              <Button
                mt="md"
                size="xs"
                variant="light"
                onClick={() => currentContext && connect(currentContext)}
              >
                Erneut versuchen
              </Button>
            </Alert>
          </Center>
        ) : selected ? (
          <ResourceTable
            resource={selected}
            table={table}
            loading={tableLoading}
            error={tableError}
            allNamespaces={namespace === ''}
            filter={filter}
            onRowClick={openDetail}
          />
        ) : (
          <Center h="100%">
            <Text c="dimmed">Ressource in der Sidebar auswählen</Text>
          </Center>
        )}
      </AppShell.Main>

      <YamlDrawer
        opened={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        resource={drawer.resource}
        name={drawer.name}
        namespace={drawer.namespace}
        onDelete={deleteCurrent}
      />

      <KubeConfigModal
        opened={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        configs={configs}
        onAdd={addKubeConfig}
        onRemove={removeKubeConfig}
      />
    </AppShell>
  );
}
