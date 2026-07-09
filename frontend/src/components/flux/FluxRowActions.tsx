import { useState, type MouseEvent } from 'react';
import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlayerPause, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { FluxReconcile, SetSuspend } from '../../../wailsjs/go/main/App';
import { APIResource, TableRow } from '../../types';

interface Props {
  resource: APIResource;
  row: TableRow;
  onChanged?: () => void;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

/**
 * Inline-Schnellaktionen für Flux-Zeilen (C3): Reconcile und Suspend/Resume
 * direkt aus der Tabelle, ohne den Detail-Drawer zu öffnen. Der Suspend-Zustand
 * ist aus der Server-Side-Table-Zeile nicht ablesbar, daher werden Suspend und
 * Resume als getrennte, idempotente Aktionen angeboten.
 */
export default function FluxRowActions({ resource, row, onChanged }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = async (
    event: MouseEvent,
    action: 'reconcile' | 'suspend' | 'resume',
    label: string
  ) => {
    event.stopPropagation();
    setBusy(true);
    try {
      if (action === 'reconcile') {
        await FluxReconcile(resource.group, resource.version, resource.name, row.namespace, row.name);
      } else {
        await SetSuspend(resource.group, resource.version, resource.name, row.namespace, row.name, action === 'suspend');
      }
      notifications.show({ message: `${label}: ${row.name}`, color: 'teal' });
      if (action !== 'reconcile') setTimeout(() => onChanged?.(), 400);
    } catch (e) {
      notifications.show({ message: errText(e), color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group gap={2} wrap="nowrap" onClick={(event) => event.stopPropagation()}>
      <Tooltip label={t('detail.action.reconcile')}>
        <ActionIcon
          size="sm"
          variant="subtle"
          loading={busy}
          onClick={(event) => run(event, 'reconcile', t('detail.notify.reconcileRequested'))}
        >
          <IconRefresh size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('detail.action.suspend')}>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="orange"
          loading={busy}
          onClick={(event) => run(event, 'suspend', t('detail.notify.suspended'))}
        >
          <IconPlayerPause size={14} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('detail.action.resume')}>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="teal"
          loading={busy}
          onClick={(event) => run(event, 'resume', t('detail.notify.resumed'))}
        >
          <IconPlayerPlay size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
