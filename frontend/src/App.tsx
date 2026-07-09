import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  AppShell,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Select,
  useMantineColorScheme,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import {
  IconAlertCircle,
  IconCheck,
  IconFileSettings,
  IconLanguage,
  IconMoon,
  IconSun,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconSettingsCog,
  IconTerminal2,
} from '@tabler/icons-react';
import {
  AddKubeConfigDialog,
  DeleteResource,
  DiscoverResources,
  FluxProblemResources,
  FluxStatus,
  GetMetricsAvailability,
  GetNodeListMetrics,
  GetPodListMetrics,
  GetResourceQuantities,
  GetResourceUISettings,
  GetTableViewSettings,
  InitialContext,
  ListContexts,
  ListKubeConfigs,
  ListNamespaces,
  ListResourceTable,
  RemoveKubeConfig,
  ResourceHasItems,
  SetCRDGroupingSettings,
  SetHideEmptyCRDs,
  SetResourceFavorite,
  SetSectionCollapsed,
  SetTableViewSettings,
  StartResourceWatch,
  StopResourceWatch,
  UseContext,
} from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { main } from '../wailsjs/go/models';
import { APIResource, ContextInfo, CRDGroupingSettings, KubeConfigInfo, ResourceListMetric, ResourceQuantityInfo, ResourceUISettings, TableResult, TableRow, TableViewSettings, resourceKey } from './types';
import { buildCrdNav, buildStandardNav, NavSection, normalizeCRDGroupingSettings } from './resourceCatalog';
import Sidebar from './components/Sidebar';
import ResourceTable, { ExtraTableColumn } from './components/ResourceTable';
import YamlDrawer from './components/YamlDrawer';
import KubeConfigModal from './components/KubeConfigModal';
import PrometheusConfigModal from './components/PrometheusConfigModal';
import CRDGroupingModal from './components/CRDGroupingModal';
import { ClusterOverview } from './components/cluster/ClusterOverview';
import { formatBytes, formatCPU } from './components/metrics/format';
import { FluxOverview, FluxProblemsOverview, FluxProblemResource } from './components/flux';
import FluxRowActions from './components/flux/FluxRowActions';
import { NewResourceModal } from './components/editor';
import TerminalPanel from './components/terminal/TerminalPanel';

// Watch pushes live updates; this slow poll is only a safety net for when the
// watch is unavailable (e.g. forbidden by RBAC).
const WATCH_FALLBACK_INTERVAL_MS = 20000;

const EMPTY_UI_SETTINGS: ResourceUISettings = {
  favorites: [],
  collapsedSections: {},
  hideEmptyCRDs: false,
  crdGrouping: { rules: [] },
};

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

export default function App() {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
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

  const [showFlux, setShowFlux] = useState(false);
  const [showFluxProblems, setShowFluxProblems] = useState(false);
  const [showCluster, setShowCluster] = useState(false);
  const [fluxStatus, setFluxStatus] = useState<main.FluxKindStatus[]>([]);
  const [fluxProblems, setFluxProblems] = useState<FluxProblemResource[]>([]);
  const [fluxLoading, setFluxLoading] = useState(false);
  const [metricsAvailable, setMetricsAvailable] = useState(false);
  const [tableMetrics, setTableMetrics] = useState<Record<string, ResourceListMetric>>({});
  const [tableQuantities, setTableQuantities] = useState<Record<string, ResourceQuantityInfo>>({});
  const [tableViewSettings, setTableViewSettings] = useState<TableViewSettings>({ columnOrder: [], hiddenColumns: [] });
  const [clusterRefreshToken, setClusterRefreshToken] = useState(0);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [prometheusModalOpen, setPrometheusModalOpen] = useState(false);
  const [crdGroupingModalOpen, setCrdGroupingModalOpen] = useState(false);
  const [newResourceOpen, setNewResourceOpen] = useState(false);
  const [terminalPanelOpen, setTerminalPanelOpen] = useState(false);
  const [drawer, setDrawer] = useState<{
    open: boolean;
    resource: APIResource | null;
    name: string;
    namespace: string;
  }>({ open: false, resource: null, name: '', namespace: '' });

  const [resourceUI, setResourceUI] = useState<ResourceUISettings>(EMPTY_UI_SETTINGS);
  const [crdItemPresence, setCrdItemPresence] = useState<Record<string, boolean | undefined>>({});

  const standardNav = useMemo<NavSection[]>(() => buildStandardNav(resources), [resources]);
  const crdNav = useMemo<NavSection[]>(() => buildCrdNav(resources, resourceUI.crdGrouping), [resources, resourceUI.crdGrouping]);
  const fluxAvailable = useMemo(() => crdNav.some((s) => s.label === 'Flux'), [crdNav]);

  const applyResourceUI = useCallback((settings: ResourceUISettings) => {
    setResourceUI({
      favorites: settings.favorites ?? [],
      collapsedSections: settings.collapsedSections ?? {},
      hideEmptyCRDs: settings.hideEmptyCRDs ?? false,
      crdGrouping: normalizeCRDGroupingSettings(settings.crdGrouping),
    });
  }, []);

  const loadFluxStatus = useCallback(async () => {
    setFluxLoading(true);
    try {
      const [status, problems] = await Promise.all([FluxStatus(), FluxProblemResources()]);
      setFluxStatus(status ?? []);
      setFluxProblems((problems ?? []) as FluxProblemResource[]);
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setFluxLoading(false);
    }
  }, []);

  const openFlux = useCallback(() => {
    setShowCluster(false);
    setShowFluxProblems(false);
    setShowFlux(true);
    loadFluxStatus();
  }, [loadFluxStatus]);

  const openFluxProblems = useCallback(() => {
    setShowCluster(false);
    setShowFlux(false);
    setShowFluxProblems(true);
    loadFluxStatus();
  }, [loadFluxStatus]);

  const openCluster = useCallback(() => {
    setShowFlux(false);
    setShowFluxProblems(false);
    setShowCluster(true);
    setClusterRefreshToken((v) => v + 1);
  }, []);

  const selectResource = useCallback((r: APIResource) => {
    setShowFlux(false);
    setShowFluxProblems(false);
    setShowCluster(false);
    setSelected(r);
  }, []);

  const openFluxKind = useCallback(
    (s: main.FluxKindStatus) => {
      const r = resources.find((x) => x.group === s.group && x.name === s.resource);
      if (r) {
        setShowFlux(false);
        setShowFluxProblems(false);
        setShowCluster(false);
        setSelected(r);
      }
    },
    [resources]
  );

  const openFluxProblemResource = useCallback(
    (p: FluxProblemResource) => {
      const r = resources.find((x) => x.group === p.group && x.version === p.version && x.name === p.resource);
      if (!r) return;
      setDrawer({ open: true, resource: r, name: p.name, namespace: p.namespace });
    },
    [resources]
  );

  const refreshConfigsAndContexts = useCallback(async () => {
    setConfigs(await ListKubeConfigs());
    setContexts(await ListContexts());
  }, []);

  const connect = useCallback(async (ctxName: string) => {
    setConnecting(true);
    setConnectError('');
    setTable(null);
    setTableError('');
    setShowFlux(false);
    setShowFluxProblems(false);
    setShowCluster(false);
    setMetricsAvailable(false);
    setTableMetrics({});
    setTableQuantities({});
    setTableViewSettings({ columnOrder: [], hiddenColumns: [] });
    setCrdItemPresence({});
    try {
      await UseContext(ctxName);
      setCurrentContext(ctxName);
      const [ns, res, ui] = await Promise.all([
        ListNamespaces().catch(() => [] as string[]),
        DiscoverResources(),
        GetResourceUISettings(ctxName),
      ]);
      setNamespaces(ns ?? []);
      setResources(res ?? []);
      GetMetricsAvailability(ctxName)
        .then((availability) => setMetricsAvailable(availability?.available ?? false))
        .catch(() => setMetricsAvailable(false));
      applyResourceUI(ui ?? EMPTY_UI_SETTINGS);
      setSelected((prev) => {
        if (prev && (res ?? []).some((r) => r.group === prev.group && r.version === prev.version && r.name === prev.name)) {
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
  }, [applyResourceUI]);

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

  useEffect(() => {
    setCrdItemPresence({});
  }, [namespace]);

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
        setTableMetrics({});
        setTableQuantities({});

        if (currentContext) {
          GetTableViewSettings(currentContext, resourceKey(selected))
            .then((settings) => setTableViewSettings({ columnOrder: settings?.columnOrder ?? [], hiddenColumns: settings?.hiddenColumns ?? [] }))
            .catch(() => setTableViewSettings({ columnOrder: [], hiddenColumns: [] }));
        }

        if (selected.name === 'pods' || (selected.group === 'apps' && ['deployments', 'statefulsets', 'daemonsets', 'replicasets'].includes(selected.name))) {
          try {
            const names = (result.rows ?? []).map((row) => row.name).filter(Boolean);
            const quantities = await GetResourceQuantities(selected.group, selected.version, selected.name, selected.namespaced ? namespace : '', names);
            const mapped: Record<string, ResourceQuantityInfo> = {};
            for (const q of quantities ?? []) {
              mapped[`${q.namespace}/${q.name}`] = q;
              mapped[q.name] = q;
            }
            setTableQuantities(mapped);
          } catch {
            setTableQuantities({});
          }
        }

        if (currentContext && metricsAvailable && selected.group === '' && (selected.name === 'pods' || selected.name === 'nodes')) {
          try {
            const names = (result.rows ?? []).map((row) => row.name).filter(Boolean);
            const metrics = selected.name === 'pods'
              ? await GetPodListMetrics(currentContext, selected.namespaced ? namespace : '', names)
              : await GetNodeListMetrics(currentContext, names);
            const mapped: Record<string, ResourceListMetric> = {};
            for (const metric of metrics ?? []) {
              const key = selected.name === 'pods' ? `${metric.namespace}/${metric.name}` : metric.name;
              mapped[key] = metric;
            }
            setTableMetrics(mapped);
          } catch {
            setTableMetrics({});
          }
        }
      } catch (e) {
        setTableError(errText(e));
      } finally {
        setTableLoading(false);
      }
    },
    [selected, namespace, currentContext, metricsAvailable]
  );

  // Load the active resource table, keep it live via a watch, and fall back to
  // slow polling in case the watch is unavailable (e.g. forbidden by RBAC).
  const loadTableRef = useRef(loadTable);
  loadTableRef.current = loadTable;
  useEffect(() => {
    if (!selected || connectError) return;
    setTable(null);
    setTableError('');
    loadTableRef.current(true);

    let cancelled = false;
    let watchID = '';
    let unsub: (() => void) | undefined;
    const ns = selected.namespaced ? namespace : '';
    StartResourceWatch(selected.group, selected.version, selected.name, ns)
      .then((id) => {
        if (cancelled) {
          StopResourceWatch(id);
          return;
        }
        watchID = id;
        unsub = EventsOn(`watch:changed:${id}`, () => loadTableRef.current(false));
      })
      .catch(() => {
        /* watch unavailable — the fallback poll below keeps the table fresh */
      });

    const timer = setInterval(() => loadTableRef.current(false), WATCH_FALLBACK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (unsub) unsub();
      if (watchID) StopResourceWatch(watchID);
    };
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
        notifications.show({ message: t('shell.toast.kubeconfigAdded', { path }), color: 'teal' });
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

  const toggleFavorite = useCallback(
    async (resource: APIResource, favorite: boolean) => {
      if (!currentContext) return;
      const key = resourceKey(resource);
      setResourceUI((prev) => ({
        ...prev,
        favorites: favorite ? [...prev.favorites.filter((x) => x !== key), key] : prev.favorites.filter((x) => x !== key),
      }));
      try {
        applyResourceUI(await SetResourceFavorite(currentContext, key, favorite));
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
        applyResourceUI(await GetResourceUISettings(currentContext));
      }
    },
    [currentContext, applyResourceUI]
  );

  const updateSectionCollapsed = useCallback(
    async (sectionKey: string, collapsed: boolean) => {
      if (!currentContext) return;
      setResourceUI((prev) => ({
        ...prev,
        collapsedSections: { ...prev.collapsedSections, [sectionKey]: collapsed },
      }));
      try {
        applyResourceUI(await SetSectionCollapsed(currentContext, sectionKey, collapsed));
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      }
    },
    [currentContext, applyResourceUI]
  );

  const updateHideEmptyCRDs = useCallback(
    async (hide: boolean) => {
      setResourceUI((prev) => ({ ...prev, hideEmptyCRDs: hide }));
      try {
        applyResourceUI(await SetHideEmptyCRDs(hide));
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      }
    },
    [applyResourceUI]
  );

  const updateCRDGrouping = useCallback(
    async (settings: CRDGroupingSettings) => {
      setResourceUI((prev) => ({ ...prev, crdGrouping: settings }));
      try {
        applyResourceUI(await SetCRDGroupingSettings(new main.CRDGroupingSettings(settings)));
        setCrdItemPresence({});
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      }
    },
    [applyResourceUI]
  );

  const ensureCrdSectionPresence = useCallback(
    (section: NavSection) => {
      if (!resourceUI.hideEmptyCRDs) return;
      for (const item of section.items) {
        const key = resourceKey(item.resource);
        if (crdItemPresence[key] !== undefined) continue;
        setCrdItemPresence((prev) => ({ ...prev, [key]: undefined }));
        ResourceHasItems(item.resource.group, item.resource.version, item.resource.name, item.resource.namespaced ? namespace : '')
          .then((hasItems) => setCrdItemPresence((prev) => ({ ...prev, [key]: hasItems })))
          .catch(() => setCrdItemPresence((prev) => ({ ...prev, [key]: true })));
      }
    },
    [resourceUI.hideEmptyCRDs, crdItemPresence, namespace]
  );

  const namespaceData = useMemo(
    () => [{ value: '', label: t('shell.select.allNamespaces') }, ...namespaces.map((n) => ({ value: n, label: n }))],
    [namespaces, t]
  );

  const metricColumns = useMemo<ExtraTableColumn[]>(() => {
    if (!metricsAvailable || !selected || selected.group !== '' || (selected.name !== 'pods' && selected.name !== 'nodes')) return [];
    const metricFor = (row: TableRow) => tableMetrics[selected.name === 'pods' ? `${row.namespace}/${row.name}` : row.name];
    return [
      { key: 'metric-cpu', label: 'CPU', render: (row) => <Text size="sm">{formatCPU(metricFor(row)?.cpu)}</Text> },
      { key: 'metric-memory', label: 'Memory', render: (row) => <Text size="sm">{formatBytes(metricFor(row)?.memory)}</Text> },
    ];
  }, [metricsAvailable, selected, tableMetrics]);

  const quantityColumns = useMemo<ExtraTableColumn[]>(() => {
    if (!selected || !(selected.name === 'pods' || (selected.group === 'apps' && ['deployments', 'statefulsets', 'daemonsets', 'replicasets'].includes(selected.name)))) return [];
    const quantityFor = (row: TableRow) => tableQuantities[`${row.namespace}/${row.name}`] ?? tableQuantities[row.name];
    const hasAny = Object.values(tableQuantities).some((q) => q.summary?.hasCPURequest || q.summary?.hasCPULimit || q.summary?.hasMemRequest || q.summary?.hasMemLimit);
    if (!hasAny) return [];
    return [
      { key: 'resource-cpu-request', label: 'CPU Request', render: (row) => <Text size="sm">{quantityFor(row)?.summary?.hasCPURequest ? formatCPU(quantityFor(row).summary.cpuRequest) : '—'}</Text> },
      { key: 'resource-cpu-limit', label: 'CPU Limit', render: (row) => <Text size="sm">{quantityFor(row)?.summary?.hasCPULimit ? formatCPU(quantityFor(row).summary.cpuLimit) : '—'}</Text> },
      { key: 'resource-memory-request', label: 'Memory Request', render: (row) => <Text size="sm">{quantityFor(row)?.summary?.hasMemRequest ? formatBytes(quantityFor(row).summary.memoryRequest) : '—'}</Text> },
      { key: 'resource-memory-limit', label: 'Memory Limit', render: (row) => <Text size="sm">{quantityFor(row)?.summary?.hasMemLimit ? formatBytes(quantityFor(row).summary.memoryLimit) : '—'}</Text> },
    ];
  }, [selected, tableQuantities]);

  const fluxActionColumns = useMemo<ExtraTableColumn[]>(() => {
    if (!selected || !selected.group.endsWith('.fluxcd.io')) return [];
    return [
      {
        key: 'flux-actions',
        label: '',
        render: (row) => (
          <FluxRowActions resource={selected} row={row} onChanged={() => loadTableRef.current(false)} />
        ),
      },
    ];
  }, [selected]);

  const updateTableViewSettings = useCallback(
    async (settings: TableViewSettings) => {
      if (!currentContext || !selected) return;
      setTableViewSettings(settings);
      try {
        const saved = await SetTableViewSettings(currentContext, resourceKey(selected), new main.TableViewSettings(settings));
        setTableViewSettings({ columnOrder: saved?.columnOrder ?? [], hiddenColumns: saved?.hiddenColumns ?? [] });
      } catch (e) {
        notifications.show({ message: errText(e), color: 'red' });
      }
    },
    [currentContext, selected]
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
            placeholder={t('shell.select.context')}
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
            placeholder={t('shell.search')}
            leftSection={<IconSearch size={14} />}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
          />
          <Tooltip label={t('shell.tooltip.newResource')}>
            <ActionIcon
              variant="subtle"
              aria-label={t('shell.tooltip.newResource')}
              onClick={() => setNewResourceOpen(true)}
              disabled={!currentContext || !!connectError}
            >
              <IconPlus size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('shell.terminal.toggle')}>
            <ActionIcon
              variant={terminalPanelOpen ? 'light' : 'subtle'}
              aria-label={t('shell.terminal.toggle')}
              onClick={() => setTerminalPanelOpen((v) => !v)}
            >
              <IconTerminal2 size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('shell.tooltip.refresh')}>
            <ActionIcon
              variant="subtle"
              onClick={() => (showFlux || showFluxProblems ? loadFluxStatus() : showCluster ? setClusterRefreshToken((v) => v + 1) : loadTable(true))}
              disabled={!selected && !showFlux && !showFluxProblems && !showCluster}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label={t('shell.settings')}>
                <IconSettings size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconFileSettings size={16} />} onClick={() => setConfigModalOpen(true)}>
                {t('shell.menu.kubeconfigs')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconSettingsCog size={16} />}
                onClick={() => setPrometheusModalOpen(true)}
                disabled={!currentContext || !!connectError}
              >
                {t('shell.menu.prometheus')}
              </Menu.Item>
              <Menu.Item leftSection={<IconFileSettings size={16} />} onClick={() => setCrdGroupingModalOpen(true)}>
                {t('shell.menu.crdGroups')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('shell.menu.colorScheme')}</Menu.Label>
              <Menu.Item
                leftSection={<IconSun size={16} />}
                rightSection={colorScheme === 'light' ? <IconCheck size={14} /> : undefined}
                onClick={() => setColorScheme('light')}
              >
                {t('shell.colorScheme.light')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconMoon size={16} />}
                rightSection={colorScheme === 'dark' ? <IconCheck size={14} /> : undefined}
                onClick={() => setColorScheme('dark')}
              >
                {t('shell.colorScheme.dark')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                rightSection={colorScheme === 'auto' ? <IconCheck size={14} /> : undefined}
                onClick={() => setColorScheme('auto')}
              >
                {t('shell.colorScheme.system')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>{t('shell.menu.language')}</Menu.Label>
              <Menu.Item
                leftSection={<IconLanguage size={16} />}
                rightSection={i18n.language?.startsWith('de') ? <IconCheck size={14} /> : undefined}
                onClick={() => i18n.changeLanguage('de')}
              >
                {t('shell.lang.de')}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconLanguage size={16} />}
                rightSection={i18n.language?.startsWith('en') ? <IconCheck size={14} /> : undefined}
                onClick={() => i18n.changeLanguage('en')}
              >
                {t('shell.lang.en')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Sidebar
          standard={standardNav}
          crds={crdNav}
          selected={showFlux || showFluxProblems || showCluster ? null : selected}
          favorites={resourceUI.favorites}
          collapsedSections={resourceUI.collapsedSections}
          hideEmptyCRDs={resourceUI.hideEmptyCRDs}
          crdItemPresence={crdItemPresence}
          onSelect={selectResource}
          onToggleFavorite={toggleFavorite}
          onSectionCollapsedChange={updateSectionCollapsed}
          onHideEmptyCRDsChange={updateHideEmptyCRDs}
          onEnsureCrdSectionPresence={ensureCrdSectionPresence}
          fluxAvailable={fluxAvailable}
          fluxActive={showFlux || showFluxProblems}
          onOpenFlux={openFlux}
          metricsAvailable={metricsAvailable}
          clusterActive={showCluster}
          onOpenCluster={openCluster}
        />
      </AppShell.Navbar>

      <AppShell.Main h="100dvh" style={{ display: 'flex', flexDirection: 'column' }}>
        <Box flex={1} mih={0} style={{ overflow: 'hidden' }}>
        {noContexts ? (
          <Center h="100%">
            <div style={{ textAlign: 'center' }}>
              <Text c="dimmed" mb="md">
                {t('shell.empty.noContexts')}
                <br />
                {t('shell.empty.noContextsHint')}
              </Text>
              <Button onClick={addKubeConfig}>{t('shell.addKubeconfig')}</Button>
            </div>
          </Center>
        ) : connecting ? (
          <Center h="100%">
            <Group>
              <Loader size="sm" />
              <Text c="dimmed">{t('shell.connecting', { context: currentContext ?? '' })}</Text>
            </Group>
          </Center>
        ) : connectError ? (
          <Center h="100%" p="xl">
            <Alert
              icon={<IconAlertCircle />}
              title={t('shell.connectFailed')}
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
                {t('shell.retry')}
              </Button>
            </Alert>
          </Center>
        ) : showCluster ? (
          <ClusterOverview contextName={currentContext} refreshToken={clusterRefreshToken} />
        ) : showFlux ? (
          <FluxOverview
            status={fluxStatus}
            loading={fluxLoading}
            onOpenKind={openFluxKind}
            onOpenProblems={openFluxProblems}
            onRefresh={loadFluxStatus}
          />
        ) : showFluxProblems ? (
          <FluxProblemsOverview
            problems={fluxProblems}
            loading={fluxLoading}
            onRefresh={loadFluxStatus}
            onOpenResource={openFluxProblemResource}
          />
        ) : selected ? (
          <ResourceTable
            resource={selected}
            table={table}
            loading={tableLoading}
            error={tableError}
            allNamespaces={namespace === ''}
            filter={filter}
            extraColumns={[...metricColumns, ...quantityColumns, ...fluxActionColumns]}
            viewSettings={tableViewSettings}
            onViewSettingsChange={updateTableViewSettings}
            onRowClick={openDetail}
          />
        ) : (
          <Center h="100%">
            <Text c="dimmed">{t('shell.selectResource')}</Text>
          </Center>
        )}
        </Box>
        <TerminalPanel opened={terminalPanelOpen} currentContext={currentContext} disabled={!!connectError || connecting} />
      </AppShell.Main>

      <YamlDrawer
        opened={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        resource={drawer.resource}
        name={drawer.name}
        namespace={drawer.namespace}
        onDelete={deleteCurrent}
        metricsAvailable={metricsAvailable}
        contextName={currentContext}
        quantitySummary={tableQuantities[`${drawer.namespace}/${drawer.name}`]?.summary ?? tableQuantities[drawer.name]?.summary ?? null}
      />

      <KubeConfigModal
        opened={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        configs={configs}
        onAdd={addKubeConfig}
        onRemove={removeKubeConfig}
      />

      <PrometheusConfigModal
        opened={prometheusModalOpen}
        onClose={() => setPrometheusModalOpen(false)}
        contextName={currentContext}
      />

      <CRDGroupingModal
        opened={crdGroupingModalOpen}
        onClose={() => setCrdGroupingModalOpen(false)}
        settings={resourceUI.crdGrouping}
        resources={resources}
        onSave={updateCRDGrouping}
      />

      <NewResourceModal
        opened={newResourceOpen}
        onClose={() => setNewResourceOpen(false)}
        onCreated={() => loadTableRef.current(false)}
      />
    </AppShell>
  );
}
