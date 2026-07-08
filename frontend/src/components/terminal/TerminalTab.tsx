import { useEffect, useRef, useState } from 'react';
import { Group, Select, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ExecResize, ExecWrite, ListPodContainers, StartExec, StopExec } from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';

interface Props {
  namespace: string;
  pod: string;
}

const SHELLS = [
  { value: '/bin/sh', label: '/bin/sh' },
  { value: '/bin/bash', label: '/bin/bash' },
  { value: '/bin/ash', label: '/bin/ash' },
];

export default function TerminalTab({ namespace, pod }: Props) {
  const { t } = useTranslation();
  const [containers, setContainers] = useState<string[]>([]);
  const [container, setContainer] = useState<string>('');
  const [shell, setShell] = useState<string>('/bin/sh');
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ListPodContainers(namespace, pod)
      .then((c) => {
        setContainers(c ?? []);
        setContainer((prev) => prev || (c ?? [])[0] || '');
      })
      .catch(() => setContainers([]));
  }, [namespace, pod]);

  useEffect(() => {
    if (!container || !hostRef.current) return;
    let disposed = false;
    let execID = '';
    let unsub: (() => void) | undefined;

    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      cursorBlink: true,
      theme: { background: '#141517' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    const doFit = () => {
      try {
        fit.fit();
      } catch {
        /* container not measurable yet */
      }
    };
    requestAnimationFrame(doFit);

    term.writeln(`\x1b[90m${t('forms.terminal.connecting', { pod, container })}\x1b[0m`);

    StartExec(namespace, pod, container, shell)
      .then((id) => {
        if (disposed) {
          StopExec(id);
          return;
        }
        execID = id;
        unsub = EventsOn(`exec:data:${id}`, (data: string) => term.write(data));
        EventsOn(`exec:end:${id}`, (msg: string) => {
          term.writeln(`\r\n\x1b[90m${t('forms.terminal.sessionEnded', { detail: msg ? ': ' + msg : '' })}\x1b[0m`);
        });
        term.onData((d) => ExecWrite(id, d));
        term.onResize(({ cols, rows }) => ExecResize(id, cols, rows));
        doFit();
        ExecResize(id, term.cols, term.rows);
        term.focus();
      })
      .catch((e) => term.writeln(`\r\n\x1b[31m${t('forms.terminal.error', { error: String(e) })}\x1b[0m`));

    const onWinResize = () => doFit();
    window.addEventListener('resize', onWinResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onWinResize);
      if (unsub) unsub();
      if (execID) StopExec(execID);
      term.dispose();
    };
  }, [namespace, pod, container, shell]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
      <Group gap="xs" mb="xs">
        <Select
          size="xs"
          w={200}
          label={undefined}
          placeholder={t('forms.logs.container')}
          data={containers.map((c) => ({ value: c, label: c }))}
          value={container || null}
          onChange={(v) => v && setContainer(v)}
        />
        <Select
          size="xs"
          w={140}
          data={SHELLS}
          value={shell}
          onChange={(v) => v && setShell(v)}
          allowDeselect={false}
        />
        <Text size="xs" c="dimmed">
          {t('forms.terminal.shellHint')}
        </Text>
      </Group>
      <div
        ref={hostRef}
        style={{ flex: 1, minHeight: 0, background: '#141517', borderRadius: 8, padding: 6, overflow: 'hidden' }}
      />
    </div>
  );
}
