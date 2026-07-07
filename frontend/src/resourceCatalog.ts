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

// Maps a custom-resource API group to a product section name. Rules are
// checked in order; the first match wins, falling back to the raw group.
interface ProductRule {
  test: (g: string) => boolean;
  product: string;
}

const PRODUCT_RULES: ProductRule[] = [
  { test: (g) => g.endsWith('.fluxcd.io'), product: 'Flux' },
  { test: (g) => g === 'monitoring.coreos.com', product: 'Prometheus Operator' },
  { test: (g) => g.endsWith('.istio.io'), product: 'Istio' },
  { test: (g) => g === 'cert-manager.io' || g.endsWith('.cert-manager.io'), product: 'Cert-Manager' },
  { test: (g) => g === 'kyverno.io' || g.endsWith('.kyverno.io') || g === 'wgpolicyk8s.io', product: 'Kyverno' },
  { test: (g) => g === 'external-secrets.io' || g === 'generators.external-secrets.io', product: 'External Secrets' },
  { test: (g) => g === 'gateway.networking.k8s.io', product: 'Gateway API' },
];

export function productForGroup(group: string): string {
  for (const rule of PRODUCT_RULES) {
    if (rule.test(group)) return rule.product;
  }
  return group;
}

// buildCrdNav groups every non-standard resource by its product section.
export function buildCrdNav(resources: APIResource[]): NavSection[] {
  const byProduct = new Map<string, APIResource[]>();
  for (const r of resources) {
    if (STANDARD_GROUPS.has(r.group)) continue;
    const product = productForGroup(r.group);
    const list = byProduct.get(product) ?? [];
    list.push(r);
    byProduct.set(product, list);
  }

  return [...byProduct.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([product, list]) => {
      // Count kind occurrences so we only disambiguate on real collisions.
      const kindCounts = new Map<string, number>();
      for (const r of list) kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);

      const items: NavItem[] = list.map((r) => ({
        label: (kindCounts.get(r.kind) ?? 0) > 1 ? `${r.kind} (${r.group})` : r.kind,
        resource: r,
      }));

      return {
        label: product,
        items: items.sort((a, b) => a.label.localeCompare(b.label)),
      };
    });
}
