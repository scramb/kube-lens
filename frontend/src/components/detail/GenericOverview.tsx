import { Stack } from '@mantine/core';
import { OverviewProps } from './types';
import { MetadataCard } from './MetadataCard';
import { ConditionsTable } from './ConditionsTable';

export function GenericOverview({ obj }: OverviewProps) {
  return (
    <Stack gap="md">
      <MetadataCard obj={obj} />
      <ConditionsTable obj={obj} />
    </Stack>
  );
}

export default GenericOverview;
