import { useState } from 'react';
import {
  ActionIcon,
  Card,
  Code,
  Group,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { OverviewProps, getPath } from './types';
import { MetadataCard } from './MetadataCard';

/** Dekodiert base64 defensiv; bei Fehler roher Wert. */
function decodeBase64(value: string): { text: string; decoded: boolean } {
  try {
    return { text: atob(value), decoded: true };
  } catch {
    return { text: value, decoded: false };
  }
}

export function ConfigMapSecretOverview({ obj }: OverviewProps) {
  const kind: string | undefined = obj?.kind;
  const isSecret = kind === 'Secret';

  const data: Record<string, string> = getPath(obj, ['data']) ?? {};
  const entries = Object.entries(data);

  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const toggleRow = (key: string) =>
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Stack gap="md">
      <MetadataCard obj={obj} />

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" mb="sm">
          <Title order={5}>Daten</Title>
          {entries.length > 0 && (
            <Tooltip label={revealAll ? 'Alle verbergen' : 'Alle anzeigen'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setRevealAll((v) => !v)}
                aria-label="Alle Werte anzeigen"
              >
                {revealAll ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            Keine Daten vorhanden.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={480}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 200 }}>Key</Table.Th>
                  <Table.Th>Wert</Table.Th>
                  <Table.Th style={{ width: 48 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {entries.map(([key, rawValue]) => {
                  const show = revealAll || revealed[key];
                  const raw = String(rawValue ?? '');
                  const { text, decoded } = isSecret
                    ? decodeBase64(raw)
                    : { text: raw, decoded: false };

                  return (
                    <Table.Tr key={key}>
                      <Table.Td style={{ verticalAlign: 'top', wordBreak: 'break-all' }}>
                        <Text size="sm" fw={500}>
                          {key}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {show ? (
                          <Stack gap={2}>
                            <Code
                              block
                              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                            >
                              {text}
                            </Code>
                            {isSecret && decoded && (
                              <Text size="xs" c="dimmed">
                                (base64-dekodiert)
                              </Text>
                            )}
                          </Stack>
                        ) : (
                          <Text size="sm" c="dimmed">
                            ••••••••
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td style={{ verticalAlign: 'top' }}>
                        <Tooltip label={show ? 'Verbergen' : 'Anzeigen'}>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            onClick={() => toggleRow(key)}
                            aria-label="Wert umschalten"
                          >
                            {show ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </Stack>
  );
}

export default ConfigMapSecretOverview;
