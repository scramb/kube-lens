import { useEffect, useState } from 'react';
import { Alert, Button, Code, Group, Loader, Stack, useComputedColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
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
  beforeApply?: () => Promise<boolean>;
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
  beforeApply,
  height = 'calc(100vh - 220px)',
}: YamlEditorProps) {
  const { t } = useTranslation();
  const computedColorScheme = useComputedColorScheme('dark', { getInitialValueInEffect: true });
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
          title: t('forms.editor.dryRunOkTitle'),
          message: result.message || t('forms.editor.dryRunOkMessage'),
        });
      } else {
        setAlert({
          kind: 'error',
          title: t('forms.editor.dryRunFailedTitle'),
          message: result.message || t('forms.editor.unknownError'),
        });
      }
    } catch (e) {
      setAlert({ kind: 'error', title: t('forms.editor.dryRunFailedTitle'), message: errText(e) });
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
      if (beforeApply) {
        const proceed = await beforeApply();
        if (!proceed) return;
      }
      const result = await ApplyResourceYAML(text, false, force);
      if (result.ok) {
        setConflict(false);
        notifications.show({
          color: 'green',
          icon: <IconCheck size={16} />,
          title: t('forms.editor.appliedTitle'),
          message:
            result.message ||
            t('forms.editor.appliedMessage', {
              kind: result.kind || t('forms.editor.resourceFallback'),
              name: `${result.namespace ? result.namespace + '/' : ''}${result.name || ''}`,
            }),
        });
        onApplied?.(result);
      } else if (!force && isConflict(result.message)) {
        setConflict(true);
        setAlert({
          kind: 'error',
          title: t('forms.editor.conflictTitle'),
          message:
            (result.message || t('forms.editor.conflictDefault')) +
            t('forms.editor.conflictHint'),
        });
      } else {
        setAlert({
          kind: 'error',
          title: t('forms.editor.applyFailedTitle'),
          message: result.message || t('forms.editor.unknownError'),
        });
      }
    } catch (e) {
      setAlert({ kind: 'error', title: t('forms.editor.applyFailedTitle'), message: errText(e) });
    } finally {
      setLoading(false);
    }
  };

  const editor = (
    <CodeMirror
      value={text}
      height={height}
      theme={computedColorScheme}
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
          {t('forms.editor.dryRun')}
        </Button>
        <Button
          leftSection={applyLoading ? <Loader size={16} /> : <IconDeviceFloppy size={16} />}
          onClick={() => runApply(false)}
          disabled={empty || busy}
        >
          {t('forms.editor.apply')}
        </Button>
        {conflict && (
          <Button
            color="orange"
            leftSection={forceLoading ? <Loader size={16} /> : <IconAlertTriangle size={16} />}
            onClick={() => runApply(true)}
            disabled={empty || busy}
          >
            {t('forms.editor.applyForce')}
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
            {t('forms.editor.reset')}
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
