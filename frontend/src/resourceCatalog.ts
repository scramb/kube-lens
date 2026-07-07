import { APIResource } from './types';

export interface NavItem {
  label: string;
  resource: APIResource;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

interface WellKnown {
  section: string;
  group: string;
  name: string;
  label: string;
}

const WELL_KNOWN: WellKnown[] = [
  { section: 'Cluster', group: '', name: 'nodes', label: 'Nodes' },
  { section: 'Cluster', group: '', name: 'namespaces', label: 'Namespaces' },
  { section: 'Cluster', group: '', name: 'events', label: 'Events' },
  { section: 'Workloads', group: '', name: 'pods', label: 'Pods' },
  { section: 'Workloads', group: 'apps', name: 'deployments', label: 'Deployments' },
  { section: 'Workloads', group: 'apps', name: 'daemonsets', label: 'DaemonSets' },
  { section: 'Workloads', group: 'apps', name: 'statefulsets', label: 'StatefulSets' },
  { section: 'Workloads', group: 'apps', name: 'replicasets', label: 'ReplicaSets' },
  { section: 'Workloads', group: 'batch', name: 'jobs', label: 'Jobs' },
  { section: 'Workloads', group: 'batch', name: 'cronjobs', label: 'CronJobs' },
  { section: 'Konfiguration', group: '', name: 'configmaps', label: 'ConfigMaps' },
  { section: 'Konfiguration', group: '', name: 'secrets', label: 'Secrets' },
  { section: 'Konfiguration', group: '', name: 'resourcequotas', label: 'ResourceQuotas' },
  { section: 'Konfiguration', group: '', name: 'limitranges', label: 'LimitRanges' },
  { section: 'Konfiguration', group: 'autoscaling', name: 'horizontalpodautoscalers', label: 'HorizontalPodAutoscalers' },
  { section: 'Konfiguration', group: 'policy', name: 'poddisruptionbudgets', label: 'PodDisruptionBudgets' },
  { section: 'Netzwerk', group: '', name: 'services', label: 'Services' },
  { section: 'Netzwerk', group: 'discovery.k8s.io', name: 'endpointslices', label: 'EndpointSlices' },
  { section: 'Netzwerk', group: 'networking.k8s.io', name: 'ingresses', label: 'Ingresses' },
  { section: 'Netzwerk', group: 'networking.k8s.io', name: 'ingressclasses', label: 'IngressClasses' },
  { section: 'Netzwerk', group: 'networking.k8s.io', name: 'networkpolicies', label: 'NetworkPolicies' },
  { section: 'Storage', group: '', name: 'persistentvolumeclaims', label: 'PersistentVolumeClaims' },
  { section: 'Storage', group: '', name: 'persistentvolumes', label: 'PersistentVolumes' },
  { section: 'Storage', group: 'storage.k8s.io', name: 'storageclasses', label: 'StorageClasses' },
  { section: 'Zugriffskontrolle', group: '', name: 'serviceaccounts', label: 'ServiceAccounts' },
  { section: 'Zugriffskontrolle', group: 'rbac.authorization.k8s.io', name: 'roles', label: 'Roles' },
  { section: 'Zugriffskontrolle', group: 'rbac.authorization.k8s.io', name: 'rolebindings', label: 'RoleBindings' },
  { section: 'Zugriffskontrolle', group: 'rbac.authorization.k8s.io', name: 'clusterroles', label: 'ClusterRoles' },
  { section: 'Zugriffskontrolle', group: 'rbac.authorization.k8s.io', name: 'clusterrolebindings', label: 'ClusterRoleBindings' },
];

// API groups that ship with Kubernetes itself — everything outside this set
// is treated as a custom resource group.
const STANDARD_GROUPS = new Set([
  '',
  'apps',
  'batch',
  'autoscaling',
  'policy',
  'networking.k8s.io',
  'discovery.k8s.io',
  'storage.k8s.io',
  'rbac.authorization.k8s.io',
  'events.k8s.io',
  'apiextensions.k8s.io',
  'apiregistration.k8s.io',
  'coordination.k8s.io',
  'node.k8s.io',
  'scheduling.k8s.io',
  'certificates.k8s.io',
  'flowcontrol.apiserver.k8s.io',
  'admissionregistration.k8s.io',
  'authentication.k8s.io',
  'authorization.k8s.io',
  'metrics.k8s.io',
  'resource.k8s.io',
  'storagemigration.k8s.io',
  'internal.apiserver.k8s.io',
]);

export function buildStandardNav(resources: APIResource[]): NavSection[] {
  const byKey = new Map<string, APIResource>();
  for (const r of resources) byKey.set(`${r.group}/${r.name}`, r);

  const sections: NavSection[] = [];
  const byLabel = new Map<string, NavSection>();
  for (const w of WELL_KNOWN) {
    const r = byKey.get(`${w.group}/${w.name}`);
    if (!r) continue;
    let section = byLabel.get(w.section);
    if (!section) {
      section = { label: w.section, items: [] };
      byLabel.set(w.section, section);
      sections.push(section);
    }
    section.items.push({ label: w.label, resource: r });
  }
  return sections;
}

// buildCrdNav groups every non-standard resource by its API group.
export function buildCrdNav(resources: APIResource[]): NavSection[] {
  const byGroup = new Map<string, NavItem[]>();
  for (const r of resources) {
    if (STANDARD_GROUPS.has(r.group)) continue;
    const items = byGroup.get(r.group) ?? [];
    items.push({ label: r.kind, resource: r });
    byGroup.set(r.group, items);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({
      label: group,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
}
