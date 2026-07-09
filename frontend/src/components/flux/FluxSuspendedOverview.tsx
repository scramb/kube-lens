import type { FluxProblemResource } from './types';
import FluxGroupedResourceOverview, { suspendedStatus } from './FluxGroupedResourceOverview';

interface Props {
  resources: FluxProblemResource[];
  loading: boolean;
  onRefresh: () => void;
  onOpenResource: (resource: FluxProblemResource) => void;
}

export default function FluxSuspendedOverview({ resources, loading, onRefresh, onOpenResource }: Props) {
  return (
    <FluxGroupedResourceOverview
      resources={resources}
      loading={loading}
      titleKey="dash.flux.suspended.title"
      subtitleKey="dash.flux.suspended.subtitle"
      searchKey="dash.flux.suspended.search"
      emptyTitleKey="dash.flux.suspended.emptyTitle"
      emptyTextKey="dash.flux.suspended.emptyText"
      noMatchesKey="dash.flux.suspended.noMatches"
      countColor="yellow"
      renderStatus={suspendedStatus}
      onRefresh={onRefresh}
      onOpenResource={onOpenResource}
    />
  );
}
