import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { GetFluxOwnership, SetSuspend } from '../../../wailsjs/go/main/App';
import type { main } from '../../../wailsjs/go/models';

export interface FluxGuardResourceRef {
  group: string;
  version: string;
  resource: string;
  namespace: string;
  name: string;
  kind: string;
}

interface PendingDecision {
  ref: FluxGuardResourceRef;
  ownership: main.FluxOwnership;
  resolve: (value: boolean) => void;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

export function useFluxSuspendGuard(ref: FluxGuardResourceRef | null, cacheKey: string) {
  const { t } = useTranslation();
  const cacheRef = useRef<Map<string, main.FluxOwnership>>(new Map());
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [suspending, setSuspending] = useState(false);

  useEffect(() => {
    cacheRef.current.clear();
    setPending(null);
    setSuspending(false);
  }, [cacheKey]);

  const confirmFluxSuspendIfManaged = useCallback(async (): Promise<boolean> => {
    if (!ref) return true;
    const key = `${ref.group}/${ref.version}/${ref.resource}/${ref.namespace}/${ref.name}`;
    let ownership = cacheRef.current.get(key);
    if (!ownership) {
      try {
        ownership = await GetFluxOwnership(ref.group, ref.version, ref.resource, ref.namespace, ref.name);
        cacheRef.current.set(key, ownership);
      } catch (e) {
        notifications.show({ message: t('detail.fluxGuard.checkFailed', { error: errText(e) }), color: 'red' });
        return false;
      }
    }

    if (!ownership?.managed || ownership.ownerSuspended) return true;

    return new Promise<boolean>((resolve) => {
      setPending({ ref, ownership, resolve });
    });
  }, [ref, t]);

  const closeWith = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const suspendAndContinue = useCallback(async () => {
    if (!pending) return;
    setSuspending(true);
    try {
      await SetSuspend(
        pending.ownership.ownerGroup,
        pending.ownership.ownerVersion,
        pending.ownership.ownerResource,
        pending.ownership.ownerNamespace,
        pending.ownership.ownerName,
        true,
      );
      notifications.show({
        color: 'teal',
        message: t('detail.fluxGuard.suspendedNotice', {
          ownerKind: pending.ownership.ownerKind,
          ownerName: pending.ownership.ownerName,
        }),
      });
      cacheRef.current.clear();
      closeWith(true);
    } catch (e) {
      notifications.show({ message: t('detail.fluxGuard.suspendFailed', { error: errText(e) }), color: 'red' });
      closeWith(false);
    } finally {
      setSuspending(false);
    }
  }, [pending, closeWith, t]);

  const modal = (
    <Modal
      opened={!!pending}
      onClose={() => closeWith(false)}
      title={t('detail.fluxGuard.title')}
      centered
      zIndex={450}
    >
      {pending ? (
        <>
          <Text size="sm" mb="sm">
            {t('detail.fluxGuard.message', {
              kind: pending.ref.kind,
              name: pending.ref.name,
              ownerKind: pending.ownership.ownerKind,
              ownerNamespace: pending.ownership.ownerNamespace,
              ownerName: pending.ownership.ownerName,
            })}
          </Text>
          {!pending.ownership.ownerFound ? (
            <Text size="sm" c="orange" mb="md">
              {t('detail.fluxGuard.ownerNotReadable')}
            </Text>
          ) : (
            <Text size="sm" c="dimmed" mb="md">
              {t('detail.fluxGuard.suspendHint')}
            </Text>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => closeWith(false)} disabled={suspending}>
              {t('detail.cancel')}
            </Button>
            <Button variant="light" onClick={() => closeWith(true)} disabled={suspending}>
              {t('detail.fluxGuard.continueWithoutSuspend')}
            </Button>
            {pending.ownership.ownerFound && pending.ownership.ownerGroup && pending.ownership.ownerVersion && pending.ownership.ownerResource ? (
              <Button color="orange" loading={suspending} onClick={suspendAndContinue}>
                {t('detail.fluxGuard.suspendAndContinue')}
              </Button>
            ) : null}
          </Group>
        </>
      ) : null}
    </Modal>
  );

  return { confirmFluxSuspendIfManaged, fluxSuspendGuardModal: modal };
}
