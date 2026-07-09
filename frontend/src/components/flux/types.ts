export interface FluxProblemResource {
  kind: string;
  group: string;
  version: string;
  resource: string;
  namespace: string;
  name: string;
  status: string;
  reason: string;
  message: string;
  age: string;
  revision: string;
  suspended: boolean;
}

export interface FluxKindStatus {
  kind: string; // z.B. "Kustomization", "HelmRelease", "GitRepository", "ImageRepository"
  group: string; // z.B. "kustomize.toolkit.fluxcd.io"
  version: string; // z.B. "v1"
  resource: string; // Plural, z.B. "kustomizations"
  total: number;
  ready: number;
  notReady: number;
  suspended: number;
}

export const FLUX_CATEGORIES: { label: string; kinds: string[] }[] = [
  { label: 'Appliers', kinds: ['Kustomization', 'HelmRelease'] },
  {
    label: 'Sources',
    kinds: ['GitRepository', 'OCIRepository', 'HelmRepository', 'HelmChart', 'Bucket'],
  },
  {
    label: 'Image Automation',
    kinds: ['ImageRepository', 'ImagePolicy', 'ImageUpdateAutomation'],
  },
  { label: 'Notification', kinds: ['Alert', 'Provider', 'Receiver'] },
];
