import { Modal, Stack, Text } from '@mantine/core';
import { YamlEditor } from './YamlEditor';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated?: () => void;
  initialKind?: string;
}

const SKELETON = `apiVersion: v1
kind: ConfigMap
metadata:
  name: example
  namespace: default
data:
  key: value
`;

export default function NewResourceModal({ opened, onClose, onCreated }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Neue Ressource" size="xl">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Bearbeiten Sie das YAML und wenden Sie es an (Server-Side Apply). Erforderlich sind{' '}
          <Text span fw={600}>
            apiVersion
          </Text>
          ,{' '}
          <Text span fw={600}>
            kind
          </Text>{' '}
          und{' '}
          <Text span fw={600}>
            metadata.name
          </Text>
          .
        </Text>
        <YamlEditor
          initialYaml={SKELETON}
          editable
          height="calc(100vh - 320px)"
          onApplied={() => {
            onCreated?.();
            onClose();
          }}
        />
      </Stack>
    </Modal>
  );
}
