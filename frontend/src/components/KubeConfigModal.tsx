import { ActionIcon, Badge, Button, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { KubeConfigInfo } from '../types';

interface Props {
  opened: boolean;
  onClose: () => void;
  configs: KubeConfigInfo[];
  onAdd: () => void;
  onRemove: (path: string) => void;
}

export default function KubeConfigModal({ opened, onClose, configs, onAdd, onRemove }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Kubeconfig-Dateien" size="lg" centered>
      <Stack gap="xs">
        {configs.map((c) => (
          <Group key={c.path} justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0 }}>
              <Text size="sm" truncate title={c.path}>
                {c.path}
              </Text>
              <Group gap={6}>
                {c.isDefault && (
                  <Badge size="xs" variant="light">
                    Standard
                  </Badge>
                )}
                {!c.exists && (
                  <Badge size="xs" variant="light" color="yellow">
                    nicht vorhanden
                  </Badge>
                )}
                {c.error && (
                  <Badge size="xs" variant="light" color="red" title={c.error}>
                    fehlerhaft
                  </Badge>
                )}
              </Group>
            </div>
            {!c.isDefault && (
              <Tooltip label="Entfernen">
                <ActionIcon variant="subtle" color="red" onClick={() => onRemove(c.path)}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ))}
        <Button leftSection={<IconPlus size={16} />} variant="light" onClick={onAdd} mt="sm">
          Kubeconfig hinzufügen
        </Button>
        <Text size="xs" c="dimmed">
          ~/.kube/config wird immer geladen. Zusätzliche Dateien werden gespeichert und beim
          nächsten Start automatisch eingelesen.
        </Text>
      </Stack>
    </Modal>
  );
}
