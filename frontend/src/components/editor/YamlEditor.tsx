import { useEffect, useState } from 'react';
import { Alert, Button, Code, Group, Loader, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconRotate,
} from '@tabler/icons-react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { ApplyResourceYAML } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';

export interface YamlEditorProps {
  initialYaml: string;
  /** false = reiner Betrachter (mit Syntax-Highlight) */
  editable: boolean;
  /** nach erfolgreichem echten Apply */
  onApplied?: (result: main.ApplyResult) => void;
  height?: string;
}

type AlertKind = 'success' | 'error';

interface AlertState {
  kind: AlertKind;
  title: string;
  message: string;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

function isConflict(message: string): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('conflict') || m.includes('409');
}

export function YamlEditor({
  initialYaml,
  editable,
  onApplied,
  height = 'calc(100vh - 220px)',
}: YamlEditorProps) {
  const [text, setText] = useState<string>(initialYaml ?? '');
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [forceLoading, setForceLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    setText(initialYaml ?? '');
    setAlert(null);
    setConflict(false);
  }, [initialYaml]);

  const dirty = text !== (initialYaml ?? '');
  const empty = text.trim().length === 0;
  const busy = dryRunLoading || applyLoading || forceLoading;

  const handleReset = () => {
    setText(initialYaml ?? '');
    setAlert(null);
    setConflict(false);
  };

  const handleDryRun = async () => {
    if (empty) return;
    setDryRunLoading(true);
    setAlert(null);
    setConflict(false);
    try {
      const result = await ApplyResourceYAML(text, true, false);
      if (result.ok) {
        setAlert({
          kind: 'success',
          title: 'Dry-Run erfolgreich',
          message: result.message || 'Die Ressource ist gültig und würde angewendet werden.',
        });
      } else {
        setAlert({
          kind: 'error',
          title: 'Dry-Run fehlgeschlagen',
          message: result.message || 'Unbekannter Fehler.',
        });
      }
    } catch (e) {
      setAlert({ kind: 'error', title: 'Dry-Run fehlgeschlagen', message: errText(e) });
    } finally {
      setDryRunLoading(false);
    }
  };

  const runApply = async (force: boolean) => {
    if (empty) return;
    const setLoading = force ? setForceLoading : setApplyLoading;
    setLoading(true);
    setAlert(null);
    if (!force) setConflict(false);
    try {
      const result = await ApplyResourceYAML(text, false, force);
      if (result.ok) {
        setConflict(false);
        notifications.show({
          color: 'green',
          icon: <IconCheck size={16} />,
          title: 'Angewendet',
          message:
            result.message ||
            `${result.kind || 'Ressource'} ${result.namespace ? result.namespace + '/' : ''}${result.name || ''} erfolgreich angewendet.`,
        });
        onApplied?.(result);
      } else if (!force && isConflict(result.message)) {
        setConflict(true);
        setAlert({
          kind: 'error',
          title: 'Konflikt beim Anwenden',
          message:
            (result.message || 'Es besteht ein Feld-Konflikt.') +
            '\n\nSie können den Konflikt mit "Mit Force anwenden" überschreiben.',
        });
      } else {
        setAlert({
          kind: 'error',
          title: 'Anwenden fehlgeschlagen',
          message: result.message || 'Unbekannter Fehler.',
        });
      }
    } catch (e) {
      setAlert({ kind: 'error', title: 'Anwenden fehlgeschlagen', message: errText(e) });
    } finally {
      setLoading(false);
    }
  };

  const editor = (
    <CodeMirror
      value={text}
      height={height}
      theme="dark"
      editable={editable}
      extensions={[yaml()]}
      onChange={editable ? setText : undefined}
      readOnly={!editable}
    />
  );

  if (!editable) {
    return editor;
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Button
          variant="default"
          leftSection={dryRunLoading ? <Loader size={16} /> : <IconCheck size={16} />}
          onClick={handleDryRun}
          disabled={empty || busy}
        >
          Prüfen (Dry-Run)
        </Button>
        <Button
          leftSection={applyLoading ? <Loader size={16} /> : <IconDeviceFloppy size={16} />}
          onClick={() => runApply(false)}
          disabled={empty || busy}
        >
          Anwenden
        </Button>
        {conflict && (
          <Button
            color="orange"
            leftSection={forceLoading ? <Loader size={16} /> : <IconAlertTriangle size={16} />}
            onClick={() => runApply(true)}
            disabled={empty || busy}
          >
            Mit Force anwenden
          </Button>
        )}
        {dirty && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconRotate size={16} />}
            onClick={handleReset}
            disabled={busy}
          >
            Zurücksetzen
          </Button>
        )}
      </Group>

      {alert && (
        <Alert
          color={alert.kind === 'success' ? 'green' : 'red'}
          icon={alert.kind === 'success' ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          title={alert.title}
          withCloseButton
          onClose={() => setAlert(null)}
        >
          <Code block style={{ whiteSpace: 'pre-wrap' }}>
            {alert.message}
          </Code>
        </Alert>
      )}

      {editor}
    </Stack>
  );
}
