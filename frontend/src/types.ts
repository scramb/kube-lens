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

export function resourceKey(r: APIResource): string {
  return `${r.group}/${r.version}/${r.name}`;
}
