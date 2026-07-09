import type { FluxProblemResource } from './types';
import FluxGroupedResourceOverview, { defaultProblemStatus } from './FluxGroupedResourceOverview';

interface Props {
  problems: FluxProblemResource[];
  loading: boolean;
  onRefresh: () => void;
  onOpenResource: (problem: FluxProblemResource) => void;
}

export default function FluxProblemsOverview({ problems, loading, onRefresh, onOpenResource }: Props) {
  return (
    <FluxGroupedResourceOverview
      resources={problems}
      loading={loading}
      titleKey="dash.flux.problems.title"
      subtitleKey="dash.flux.problems.subtitle"
      searchKey="dash.flux.problems.search"
      emptyTitleKey="dash.flux.problems.emptyTitle"
      emptyTextKey="dash.flux.problems.emptyText"
      noMatchesKey="dash.flux.problems.noMatches"
      countColor="red"
      renderStatus={defaultProblemStatus}
      onRefresh={onRefresh}
      onOpenResource={onOpenResource}
    />
  );
}
