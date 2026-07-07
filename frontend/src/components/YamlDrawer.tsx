import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Center,
  CopyButton,
  Drawer,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconCopy, IconTrash } from '@tabler/icons-react';
import { APIResource } from '../types';

interface Props {
  opened: boolean;
  onClose: () => void;
  resource: APIResource | null;
  name: string;
  namespace: string;
  yaml: string;
  loading: boolean;
  onDelete: () => Promise<void>;
}

export default function YamlDrawer({
  opened,
  onClose,
  resource,
  name,
  namespace,
  yaml,
  loading,
  onDelete,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="55%"
      title={
        <Group gap="xs">
          <Text fw={700}>{resource?.kind}</Text>
          <Text c="dimmed">{namespace ? `${namespace} / ` : ''}{name}</Text>
        </Group>
      }
    >
      <Group justify="flex-end" mb="sm" gap="xs">
        <CopyButton value={yaml}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Kopiert' : 'YAML kopieren'}>
              <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
        <Tooltip label="Ressource löschen">
          <ActionIcon variant="subtle" color="red" onClick={() => setConfirmOpen(true)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {loading ? (
        <Center h={200}>
          <Loader />
        </Center>
      ) : (
        <ScrollArea h="calc(100vh - 130px)" type="scroll">
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.5,
              fontFamily: 'var(--mantine-font-family-monospace)',
              background: 'var(--mantine-color-dark-8)',
              borderRadius: 8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {yaml}
          </pre>
        </ScrollArea>
      )}

      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Ressource löschen?"
        centered
        zIndex={400}
      >
        <Text size="sm" mb="md">
          {resource?.kind} <b>{name}</b>
          {namespace ? ` im Namespace ${namespace}` : ''} wird endgültig gelöscht.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmOpen(false)}>
            Abbrechen
          </Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>
            Löschen
          </Button>
        </Group>
      </Modal>
    </Drawer>
  );
}
