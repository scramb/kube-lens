import { FC } from 'react';
import { OverviewProps } from './types';
import { GenericOverview } from './GenericOverview';
import { MetadataCard } from './MetadataCard';
import { ConditionsTable } from './ConditionsTable';
import { PodOverview } from './PodOverview';
import { WorkloadOverview } from './WorkloadOverview';
import { ServiceOverview } from './ServiceOverview';
import { ConfigMapSecretOverview } from './ConfigMapSecretOverview';
import { NodeOverview } from './NodeOverview';

export const detailRenderers: Record<string, FC<OverviewProps>> = {
  Pod: PodOverview,
  Deployment: WorkloadOverview,
  StatefulSet: WorkloadOverview,
  DaemonSet: WorkloadOverview,
  ReplicaSet: WorkloadOverview,
  Service: ServiceOverview,
  ConfigMap: ConfigMapSecretOverview,
  Secret: ConfigMapSecretOverview,
  Node: NodeOverview,
};

export function getOverviewRenderer(kind: string): FC<OverviewProps> {
  return detailRenderers[kind] ?? GenericOverview;
}

export { GenericOverview, MetadataCard, ConditionsTable };
export type { OverviewProps, KubeObject } from './types';
