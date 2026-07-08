import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useElementSize } from '@mantine/hooks';
import { IconPlayerPlay, IconPlus, IconTerminal2, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  LocalTerminalResize,
  LocalTerminalWrite,
  StartLocalTerminal,
  StopLocalTerminal,
} from '../../../wailsjs/go/main/App';
import { EventsOff, EventsOn } from '../../../wailsjs/runtime/runtime';
import { main } from '../../../wailsjs/go/models';

const MAX_TERMINALS = 12;
const STORAGE_HEIGHT = 'kube-lens-terminal-panel-height';
const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 620;

interface Props {
  opened: boolean;
  currentContext: string | null;
  disabled?: boolean;
}

interface TerminalTabState {
  clientID: string;
  backendID: string | null;
  contextName: string;
  shell: string;
  status: 'starting' | 'running' | 'ended' | 'error';
  endMessage: string;
  restartToken: number;
}

function clampHeight(value: number) {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
}

function initialHeight() {
  const stored = Number(localStorage.getItem(STORAGE_HEIGHT));
  return Number.isFinite(stored) && stored > 0 ? clampHeight(stored) : DEFAULT_HEIGHT;
}

function errText(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

function TerminalInstance({ tab, active, onUpdateBackendID, onEnded }: {
  tab: TerminalTabState;
  active: boolean;
  onUpdateBackendID: (clientID: string, info: main.LocalTerminalInfo) => void;
  onEnded: (clientID: string, message: string, error?: boolean) => void;
}) {
  const { t } = useTranslation();
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const backendIDRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const host = document.getElementById(`terminal-host-${tab.clientID}`);
    if (!host) return undefined;

    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      cursorBlink: true,
      theme: { background: '#101113' },
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    term.open(host);
    term.writeln(`\x1b[90m${t('shell.terminal.starting', { context: tab.contextName })}\x1b[0m`);

    const doFit = () => {
      try {
        fit.fit();
        const id = backendIDRef.current;
        if (id) LocalTerminalResize(id, term.cols, term.rows).catch(() => undefined);
      } catch {
        /* not measurable yet */
      }
    };
    requestAnimationFrame(doFit);

    const disposables = [
      term.onData((data) => {
        const id = backendIDRef.current;
        if (id) LocalTerminalWrite(id, data).catch(() => undefined);
      }),
      term.onResize(({ cols, rows }) => {
        const id = backendIDRef.current;
        if (id) LocalTerminalResize(id, cols, rows).catch(() => undefined);
      }),
    ];

    const unsubs: Array<() => void> = [];
    StartLocalTerminal(tab.contextName)
      .then((info) => {
        if (disposed) {
          StopLocalTerminal(info.id).catch(() => undefined);
          return;
        }
        backendIDRef.current = info.id;
        onUpdateBackendID(tab.clientID, info);
        unsubs.push(EventsOn(`term:data:${info.id}`, (data: string) => term.write(data)));
        unsubs.push(EventsOn(`term:end:${info.id}`, (message: string) => {
          backendIDRef.current = null;
          onEnded(tab.clientID, message || '');
          term.writeln(`\r\n\x1b[90m${t('shell.terminal.ended', { detail: message ? ': ' + message : '' })}\x1b[0m`);
        }));
        doFit();
        term.focus();
      })
      .catch((e) => {
        if (disposed) return;
        const msg = errText(e);
        onEnded(tab.clientID, msg, true);
        term.writeln(`\r\n\x1b[31m${t('shell.terminal.error', { error: msg })}\x1b[0m`);
      });

    return () => {
      disposed = true;
      const id = backendIDRef.current;
      unsubs.forEach((off) => {
        try { off(); } catch { /* ignore */ }
      });
      if (id) {
        EventsOff(`term:data:${id}`, `term:end:${id}`);
        StopLocalTerminal(id).catch(() => undefined);
      }
      disposables.forEach((d) => d.dispose());
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      backendIDRef.current = null;
    };
  }, [tab.clientID, tab.contextName, tab.restartToken, onEnded, onUpdateBackendID]);

  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    const id = backendIDRef.current;
    if (!term || !fit || width <= 0 || height <= 0) return;
    try {
      fit.fit();
      if (id) LocalTerminalResize(id, term.cols, term.rows).catch(() => undefined);
      if (active) term.focus();
    } catch {
      /* not measurable yet */
    }
  }, [width, height, active]);

  return (
    <Box
      ref={ref}
      id={`terminal-host-${tab.clientID}`}
      h="100%"
      style={{ display: active ? 'block' : 'none', background: '#101113', overflow: 'hidden' }}
    />
  );
}

export default function TerminalPanel({ opened, currentContext, disabled = false }: Props) {
  const { t } = useTranslation();
  const [tabs, setTabs] = useState<TerminalTabState[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [height, setHeight] = useState(initialHeight);
  const dragStart = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_HEIGHT, String(height));
  }, [height]);

  const startTerminal = useCallback(() => {
    if (!currentContext || disabled) return;
    if (tabs.length >= MAX_TERMINALS) {
      notifications.show({ message: t('shell.terminal.maxReached', { max: MAX_TERMINALS }), color: 'yellow' });
      return;
    }
    const clientID = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setTabs((prev) => [
      ...prev,
      { clientID, backendID: null, contextName: currentContext, shell: t('shell.terminal.shell'), status: 'starting', endMessage: '', restartToken: 0 },
    ]);
    setActive(clientID);
  }, [currentContext, disabled, tabs.length, t]);

  const closeTerminal = useCallback((clientID: string) => {
    setTabs((prev) => {
      const closing = prev.find((tab) => tab.clientID === clientID);
      if (closing?.backendID) StopLocalTerminal(closing.backendID).catch(() => undefined);
      const next = prev.filter((tab) => tab.clientID !== clientID);
      setActive((cur) => (cur === clientID ? (next.at(-1)?.clientID ?? null) : cur));
      return next;
    });
  }, []);

  const restartTerminal = useCallback((clientID: string) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.clientID !== clientID) return tab;
      if (tab.backendID) StopLocalTerminal(tab.backendID).catch(() => undefined);
      return { ...tab, backendID: null, status: 'starting', endMessage: '', restartToken: tab.restartToken + 1 };
    }));
    setActive(clientID);
  }, []);

  const updateBackendID = useCallback((clientID: string, info: main.LocalTerminalInfo) => {
    setTabs((prev) => prev.map((tab) => (
      tab.clientID === clientID
        ? { ...tab, backendID: info.id, shell: info.shell || tab.shell, contextName: info.contextName || tab.contextName, status: 'running' }
        : tab
    )));
  }, []);

  const markEnded = useCallback((clientID: string, message: string, error = false) => {
    setTabs((prev) => prev.map((tab) => (
      tab.clientID === clientID
        ? { ...tab, backendID: null, status: error ? 'error' : 'ended', endMessage: message }
        : tab
    )));
  }, []);

  const beginDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStart.current = { y: event.clientY, height };
    const onMove = (move: MouseEvent) => {
      if (!dragStart.current) return;
      setHeight(clampHeight(dragStart.current.height + (dragStart.current.y - move.clientY)));
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height]);

  if (!opened) return null;

  const activeTab = tabs.find((tab) => tab.clientID === active) ?? tabs[0] ?? null;
  const addDisabled = disabled || !currentContext || tabs.length >= MAX_TERMINALS;
  const addTooltip = !currentContext || disabled
    ? t('shell.terminal.noContext')
    : tabs.length >= MAX_TERMINALS
      ? t('shell.terminal.maxReached', { max: MAX_TERMINALS })
      : t('shell.terminal.new');

  return (
    <Box
      h={height}
      style={{
        borderTop: '1px solid var(--mantine-color-dark-4)',
        background: 'var(--mantine-color-dark-8)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: MIN_HEIGHT,
      }}
    >
      <Box h={6} style={{ cursor: 'ns-resize', borderTop: '1px solid transparent' }} onMouseDown={beginDrag} />
      <Group px="xs" py={4} gap="xs" wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
        <IconTerminal2 size={16} color="var(--mantine-color-cyan-4)" />
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: 0.6 }}>
          {t('shell.terminal.panel')}
        </Text>
        <ScrollArea flex={1} scrollbarSize={4} type="hover">
          <Tabs value={activeTab?.clientID ?? null} onChange={setActive} variant="pills">
            <Tabs.List style={{ flexWrap: 'nowrap' }}>
              {tabs.map((tab) => (
                <Tabs.Tab
                  key={tab.clientID}
                  value={tab.clientID}
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      aria-label={t('shell.terminal.close')}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTerminal(tab.clientID);
                      }}
                    >
                      <IconX size={12} />
                    </ActionIcon>
                  }
                >
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs">{tab.shell}</Text>
                    <Badge size="xs" variant="light" color={tab.status === 'error' ? 'red' : tab.status === 'ended' ? 'gray' : 'cyan'}>
                      {tab.contextName}
                    </Badge>
                  </Group>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        </ScrollArea>
        <Tooltip label={addTooltip}>
          <ActionIcon variant="light" size="sm" onClick={startTerminal} disabled={addDisabled} aria-label={t('shell.terminal.new')}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Box flex={1} mih={0} p={6}>
        {tabs.length === 0 ? (
          <Center h="100%">
            <Stack align="center" gap="xs">
              <IconTerminal2 size={28} color="var(--mantine-color-dark-2)" />
              <Text size="sm" c="dimmed">{t('shell.terminal.empty')}</Text>
              <Tooltip label={addTooltip}>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={startTerminal} disabled={addDisabled}>
                  {t('shell.terminal.new')}
                </Button>
              </Tooltip>
            </Stack>
          </Center>
        ) : (
          <>
            {tabs.map((tab) => (
              <Box key={tab.clientID} h="100%" style={{ display: tab.clientID === activeTab?.clientID ? 'block' : 'none', position: 'relative' }}>
                <TerminalInstance
                  tab={tab}
                  active={tab.clientID === activeTab?.clientID}
                  onUpdateBackendID={updateBackendID}
                  onEnded={markEnded}
                />
                {(tab.status === 'ended' || tab.status === 'error') && tab.clientID === activeTab?.clientID ? (
                  <Group pos="absolute" right={16} bottom={12} gap="xs">
                    {tab.endMessage ? <Text size="xs" c={tab.status === 'error' ? 'red.3' : 'dimmed'}>{tab.endMessage}</Text> : null}
                    <Button size="compact-xs" variant="light" leftSection={<IconPlayerPlay size={12} />} onClick={() => restartTerminal(tab.clientID)}>
                      {t('shell.terminal.restart')}
                    </Button>
                  </Group>
                ) : null}
              </Box>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}
