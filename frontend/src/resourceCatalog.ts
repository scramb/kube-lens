import { APIResource, CRDGroupRule, CRDGroupingSettings } from './types';

export interface NavItem {
  label: string;
  resource: APIResource;
}

export interface NavSection {
  id?: string;
  label: string;
  icon?: string;
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
      section = { id: `standard:${w.section}`, label: w.section, items: [] };
      byLabel.set(w.section, section);
      sections.push(section);
    }
    section.items.push({ label: w.label, resource: r });
  }
  return sections;
}

export const DEFAULT_CRD_GROUP_RULES: CRDGroupRule[] = [
  { id: 'flux', label: 'Flux', patterns: ['*.fluxcd.io'], icon: 'tabler:bolt', enabled: true },
  { id: 'prometheus-operator', label: 'Prometheus Operator', patterns: ['monitoring.coreos.com'], icon: 'tabler:activity-heartbeat', enabled: true },
  { id: 'istio', label: 'Istio', patterns: ['*.istio.io'], icon: 'tabler:mesh', enabled: true },
  { id: 'cert-manager', label: 'Cert-Manager', patterns: ['cert-manager.io', '*.cert-manager.io'], icon: 'tabler:certificate', enabled: true },
  { id: 'kyverno', label: 'Kyverno', patterns: ['kyverno.io', '*.kyverno.io', 'wgpolicyk8s.io'], icon: 'tabler:shield-check', enabled: true },
  { id: 'external-secrets', label: 'External Secrets', patterns: ['external-secrets.io', 'generators.external-secrets.io'], icon: 'tabler:key', enabled: true },
  { id: 'gateway-api', label: 'Gateway API', patterns: ['gateway.networking.k8s.io'], icon: 'tabler:route', enabled: true },
];

export function normalizeCRDGroupRule(input: Partial<CRDGroupRule>, index = 0): CRDGroupRule {
  const label = (input.label ?? '').trim();
  return {
    id: sanitizeRuleId(input.id || label || `custom-${index + 1}`),
    label: label || 'Custom Group',
    patterns: (input.patterns ?? []).map((p) => p.trim()).filter(Boolean),
    icon: (input.icon ?? '').trim(),
    enabled: input.enabled !== false,
  };
}

export function sanitizeRuleId(value: string): string {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id || 'custom-group';
}

export function normalizeCRDGroupingSettings(input?: Partial<CRDGroupingSettings>): CRDGroupingSettings {
  return { rules: (input?.rules ?? []).map((r, index) => normalizeCRDGroupRule(r, index)) };
}

function matchesPattern(group: string, pattern: string): boolean {
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

export function validateCRDGroupRule(rule: CRDGroupRule): string[] {
  const errors: string[] = [];
  if (!rule.label.trim()) errors.push('Label is required.');
  if (!rule.patterns.length) errors.push('At least one pattern is required.');
  for (const pattern of rule.patterns) {
    if (!pattern.trim()) errors.push('Patterns must not be empty.');
    if (/\s/.test(pattern)) errors.push(`Pattern "${pattern}" must not contain whitespace.`);
  }
  if (rule.icon.length > 8192) errors.push('Icon is too large.');
  return errors;
}

export function sanitizeCustomSvg(svg: string): string | null {
  const trimmed = svg.trim();
  if (!trimmed) return null;
  if (trimmed.length > 8192) return null;
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  if (/<script[\s>]/i.test(trimmed)) return null;
  if (/\son[a-z]+\s*=/i.test(trimmed)) return null;
  if (/\s(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|javascript:|data:)/i.test(trimmed)) return null;
  if (/<(?:iframe|object|embed|foreignObject)\b/i.test(trimmed)) return null;
  return trimmed;
}

interface MatchedGroup {
  id: string;
  label: string;
  icon: string;
}

function enabledRules(rules: CRDGroupRule[]): CRDGroupRule[] {
  return rules.map((r, index) => normalizeCRDGroupRule(r, index)).filter((r) => r.enabled && r.patterns.length > 0);
}

function matchGroup(group: string, settings?: CRDGroupingSettings): MatchedGroup {
  const userRules = enabledRules(settings?.rules ?? []);
  const defaultRules = enabledRules(DEFAULT_CRD_GROUP_RULES);
  for (const rule of [...userRules, ...defaultRules]) {
    if (rule.patterns.some((pattern) => matchesPattern(group, pattern))) {
      return { id: rule.id, label: rule.label, icon: rule.icon };
    }
  }
  return { id: `raw:${group}`, label: group, icon: '' };
}

// Maps a custom-resource API group to a product section name. Kept for existing callers/tests.
export function productForGroup(group: string, settings?: CRDGroupingSettings): string {
  return matchGroup(group, settings).label;
}

// buildCrdNav groups every non-standard resource by configurable product section.
export function buildCrdNav(resources: APIResource[], settings?: CRDGroupingSettings): NavSection[] {
  const byGroup = new Map<string, { meta: MatchedGroup; resources: APIResource[] }>();
  for (const r of resources) {
    if (STANDARD_GROUPS.has(r.group)) continue;
    const meta = matchGroup(r.group, settings);
    const existing = byGroup.get(meta.id) ?? { meta, resources: [] };
    existing.resources.push(r);
    byGroup.set(meta.id, existing);
  }

  return [...byGroup.values()]
    .sort((a, b) => a.meta.label.localeCompare(b.meta.label))
    .map(({ meta, resources: list }) => {
      // Count kind occurrences so we only disambiguate on real collisions.
      const kindCounts = new Map<string, number>();
      for (const r of list) kindCounts.set(r.kind, (kindCounts.get(r.kind) ?? 0) + 1);

      const items: NavItem[] = list.map((r) => ({
        label: (kindCounts.get(r.kind) ?? 0) > 1 ? `${r.kind} (${r.group})` : r.kind,
        resource: r,
      }));

      return {
        id: meta.id,
        label: meta.label,
        icon: meta.icon,
        items: items.sort((a, b) => a.label.localeCompare(b.label)),
      };
    });
}
