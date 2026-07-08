export interface KubeConfigInfo {
  path: string;
  isDefault: boolean;
  exists: boolean;
  error: string;
}

export interface ContextInfo {
  name: string;
  cluster: string;
  user: string;
  namespace: string;
  source: string;
  active: boolean;
}

export interface APIResource {
  group: string;
  version: string;
  kind: string;
  name: string;
  namespaced: boolean;
}

export interface TableColumn {
  name: string;
  type: string;
  priority: number;
}

export interface TableRow {
  cells: unknown[];
  name: string;
  namespace: string;
}

export interface TableResult {
  columns: TableColumn[];
  rows: TableRow[];
}

export interface CRDGroupRule {
  id: string;
  label: string;
  patterns: string[];
  icon: string;
  enabled: boolean;
}

export interface CRDGroupingSettings {
  rules: CRDGroupRule[];
}

export interface ResourceUISettings {
  favorites: string[];
  collapsedSections: Record<string, boolean>;
  hideEmptyCRDs: boolean;
  crdGrouping: CRDGroupingSettings;
}

export interface PrometheusClusterSelector {
  label: string;
  value: string;
}

export interface PrometheusContextSettings {
  mode: string;
  url: string;
  headers: Record<string, string>;
  clusterSelector: PrometheusClusterSelector;
  target: PrometheusTarget;
}

export interface PrometheusTarget {
  accessMode: string;
  namespace: string;
  service: string;
  portName: string;
  port: number;
  pathPrefix: string;
}

export interface PrometheusTargetCandidate {
  namespace: string;
  service: string;
  portName: string;
  port: number;
  score: number;
  reasons: string[];
}

export interface PrometheusConnectionTestResult {
  ok: boolean;
  mode: string;
  message: string;
  sampleCount: number;
  clusterLabel: string;
  clusterValues: string[];
  proxyForbidden: boolean;
}

export interface MetricsAvailability {
  available: boolean;
  mode: string;
  message: string;
  proxyForbidden: boolean;
}

export interface ResourceListMetric {
  namespace: string;
  name: string;
  cpu: number;
  memory: number;
}

export interface ResourceQuantitySummary {
  cpuRequest: number;
  cpuLimit: number;
  memoryRequest: number;
  memoryLimit: number;
  hasCPURequest: boolean;
  hasCPULimit: boolean;
  hasMemRequest: boolean;
  hasMemLimit: boolean;
}

export interface ResourceQuantityInfo {
  namespace: string;
  name: string;
  summary: ResourceQuantitySummary;
}

export interface TableViewSettings {
  columnOrder: string[];
  hiddenColumns: string[];
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MetricSeries {
  name: string;
  unit: string;
  points: MetricPoint[];
}

export interface ResourceMetricsSeries {
  available: boolean;
  series: MetricSeries[];
}

export interface ClusterOverviewMetrics {
  available: boolean;
  cpuUsage: number;
  cpuCapacity: number;
  memoryUsage: number;
  memoryCapacity: number;
  nodeReady: number;
  nodeNotReady: number;
  podsRunning: number;
  podsPending: number;
  podsFailed: number;
  message: string;
}

export function resourceKey(r: APIResource): string {
  return `${r.group}/${r.version}/${r.name}`;
}
