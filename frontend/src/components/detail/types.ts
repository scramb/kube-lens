import type { ResourceQuantitySummary } from '../../types';

export type KubeObject = Record<string, any>;

export interface OverviewProps {
  obj: KubeObject;
  /** Requests/Limits-Summary (bei Workloads: PodTemplate-Werte pro Pod). */
  quantitySummary?: ResourceQuantitySummary | null;
}

/**
 * Sicheres verschachteltes Lesen. Gibt undefined zurück, sobald ein
 * Zwischenschritt fehlt oder kein Objekt ist.
 */
export function getPath(obj: KubeObject | undefined | null, path: string[]): any {
  let cur: any = obj;
  for (const key of path) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return undefined;
    }
    cur = cur[key];
  }
  return cur;
}

/**
 * Kompaktes Alter relativ zu jetzt, z.B. "3d", "5h", "12m", "45s".
 * Gibt "-" zurück, wenn kein/ungültiger Timestamp vorliegt.
 */
export function age(creationTimestamp?: string): string {
  if (!creationTimestamp) return '-';
  const then = new Date(creationTimestamp).getTime();
  if (Number.isNaN(then)) return '-';

  let diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 0) diff = 0;

  const days = Math.floor(diff / 86400);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600);
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / 60);
  if (minutes > 0) return `${minutes}m`;
  return `${diff}s`;
}
