import {
  Badge,
  Card,
  Code,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { OverviewProps, age, getPath } from './types';

function KeyValueRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" w={120} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" style={{ wordBreak: 'break-all' }}>
        {value}
      </Text>
    </Group>
  );
}

const ANNOTATION_TRUNCATE = 80;

export function MetadataCard({ obj }: OverviewProps) {
  const { t } = useTranslation();
  const meta = getPath(obj, ['metadata']) ?? {};

  const name: string | undefined = meta.name;
  const namespace: string | undefined = meta.namespace;
  const uid: string | undefined = meta.uid;
  const creationTimestamp: string | undefined = meta.creationTimestamp;

  const labels: Record<string, string> = meta.labels ?? {};
  const annotations: Record<string, string> = meta.annotations ?? {};
  const ownerRefs: Array<Record<string, any>> = Array.isArray(meta.ownerReferences)
    ? meta.ownerReferences
    : [];

  const labelEntries = Object.entries(labels);
  const annotationEntries = Object.entries(annotations);

  return (
    <Card withBorder radius="md" padding="md">
      <Title order={5} mb="sm">
        {t('detail.metadata')}
      </Title>

      <Stack gap={6}>
        <KeyValueRow label={t('detail.metadata.name')} value={name} />
        <KeyValueRow label={t('detail.metadata.namespace')} value={namespace} />
        <KeyValueRow label={t('detail.metadata.uid')} value={uid ? <Code>{uid}</Code> : undefined} />
        <KeyValueRow
          label={t('detail.metadata.age')}
          value={creationTimestamp ? age(creationTimestamp) : undefined}
        />
      </Stack>

      {labelEntries.length > 0 && (
        <>
          <Text size="sm" c="dimmed" mt="md" mb={4}>
            {t('detail.metadata.labels')}
          </Text>
          <Group gap={6}>
            {labelEntries.map(([k, v]) => (
              <Badge key={k} variant="light" color="blue" size="sm">
                {k}={String(v)}
              </Badge>
            ))}
          </Group>
        </>
      )}

      {annotationEntries.length > 0 && (
        <>
          <Text size="sm" c="dimmed" mt="md" mb={4}>
            {t('detail.metadata.annotations')}
          </Text>
          <Table verticalSpacing={4} horizontalSpacing="sm" fz="xs">
            <Table.Tbody>
              {annotationEntries.map(([k, v]) => {
                const value = String(v);
                const long = value.length > ANNOTATION_TRUNCATE;
                return (
                  <Table.Tr key={k}>
                    <Table.Td style={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <Text size="xs" c="dimmed">
                        {k}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {long ? (
                        <Tooltip
                          label={value}
                          multiline
                          w={360}
                          withArrow
                          position="top-start"
                        >
                          <Code style={{ cursor: 'help' }}>
                            {value.slice(0, ANNOTATION_TRUNCATE)}…
                          </Code>
                        </Tooltip>
                      ) : (
                        <Code>{value}</Code>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </>
      )}

      {ownerRefs.length > 0 && (
        <>
          <Text size="sm" c="dimmed" mt="md" mb={4}>
            {t('detail.metadata.ownerReferences')}
          </Text>
          <Group gap={6}>
            {ownerRefs.map((ref, i) => (
              <Badge key={`${ref.kind}-${ref.name}-${i}`} variant="outline" color="grape" size="sm">
                {ref.kind}/{ref.name}
              </Badge>
            ))}
          </Group>
        </>
      )}
    </Card>
  );
}

export default MetadataCard;
