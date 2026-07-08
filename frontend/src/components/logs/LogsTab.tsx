import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconDownload, IconSearch, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ListPodContainers, StartPodLogs, StopPodLogs } from '../../../wailsjs/go/main/App';
import { main } from '../../../wailsjs/go/models';
import { EventsOff, EventsOn } from '../../../wailsjs/runtime/runtime';

interface Props {
  namespace: string;
  pod: string;
}

/** Maximale Anzahl gepufferter Zeilen; ältere werden abgeschnitten. */
const MAX_LINES = 5000;

const TAIL_OPTIONS = [
  { value: '100', label: '100' },
  { value: '500', label: '500' },
  { value: '1000', label: '1000' },
  { value: '5000', label: '5000' },
];

export default function LogsTab({ namespace, pod }: Props) {
  const { t } = useTranslation();
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [previous, setPrevious] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [tailLines, setTailLines] = useState(1000);
  const [filter, setFilter] = useState('');
  const [lines, setLines] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Aktive streamID; späte Events alter Streams werden hierüber ignoriert.
  const activeStreamRef = useRef<string | null>(null);
  // Scroll-Container-Referenz für Auto-Scroll.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Ob der Nutzer manuell hochgescrollt hat (pausiert Auto-Scroll).
  const userScrolledUpRef = useRef(false);

  // Container beim Mount / Pod-Wechsel laden.
  useEffect(() => {
    let cancelled = false;
    setContainers([]);
    setSelectedContainer(null);
    ListPodContainers(namespace, pod)
      .then((list) => {
        if (cancelled) return;
        const safe = Array.isArray(list) ? list.filter((c) => typeof c === 'string') : [];
        setContainers(safe);
        setSelectedContainer(safe.length > 0 ? safe[0] : null);
      })
      .catch((err) => {
        if (cancelled) return;
        setContainers([]);
        setSelectedContainer(null);
        setErrorMsg(t('forms.logs.containersLoadFailed', { error: String(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [namespace, pod]);

  // Log-Stream-Lifecycle.
  useEffect(() => {
    if (!selectedContainer) return;

    let disposed = false;
    let streamID: string | null = null;
    const unsubscribers: Array<() => void> = [];

    setLines([]);
    setErrorMsg(null);
    setLoading(true);
    setStreaming(false);
    userScrolledUpRef.current = false;

    const opts = main.LogStreamOptions.createFrom({
      container: selectedContainer,
      tailLines,
      previous,
      timestamps,
      sinceSeconds: 0,
    });

    StartPodLogs(namespace, pod, opts)
      .then((id) => {
        if (disposed) {
          // Effect wurde bereits aufgeräumt; Stream sofort stoppen.
          StopPodLogs(id).catch(() => undefined);
          return;
        }
        streamID = id;
        activeStreamRef.current = id;
        setLoading(false);
        setStreaming(true);

        const onData = (batch: unknown) => {
          if (disposed || activeStreamRef.current !== id) return;
          const arr = Array.isArray(batch) ? (batch as unknown[]) : [];
          const strs = arr.map((l) => String(l));
          if (strs.length === 0) return;
          setLines((prev) => {
            const next = prev.concat(strs);
            return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
          });
        };

        const onEnd = (payload: unknown) => {
          if (disposed || activeStreamRef.current !== id) return;
          setStreaming(false);
          const msg = typeof payload === 'string' ? payload : '';
          if (msg) setErrorMsg(msg);
        };

        const onErr = (payload: unknown) => {
          if (disposed || activeStreamRef.current !== id) return;
          setStreaming(false);
          setErrorMsg(typeof payload === 'string' && payload ? payload : t('forms.logs.unknownStreamError'));
        };

        unsubscribers.push(EventsOn(`logs:data:${id}`, onData));
        unsubscribers.push(EventsOn(`logs:end:${id}`, onEnd));
        unsubscribers.push(EventsOn(`logs:error:${id}`, onErr));
      })
      .catch((err) => {
        if (disposed) return;
        setLoading(false);
        setStreaming(false);
        setErrorMsg(t('forms.logs.streamStartFailed', { error: String(err) }));
      });

    return () => {
      disposed = true;
      unsubscribers.forEach((off) => {
        try {
          off();
        } catch {
          /* ignore */
        }
      });
      if (streamID) {
        const idToStop = streamID;
        // Zusätzlich per Eventname abmelden (defensiv).
        EventsOff(`logs:data:${idToStop}`, `logs:end:${idToStop}`, `logs:error:${idToStop}`);
        if (activeStreamRef.current === idToStop) {
          activeStreamRef.current = null;
        }
        StopPodLogs(idToStop).catch(() => undefined);
      }
    };
  }, [namespace, pod, selectedContainer, follow, previous, timestamps, tailLines]);

  // Sichtbare (gefilterte) Zeilen.
  const visibleLines = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => l.toLowerCase().includes(q));
  }, [lines, filter]);

  // Erkennen, ob der Nutzer manuell hochgescrollt hat.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Toleranz von 24px, damit kleine Rundungen nicht als Hochscrollen zählen.
    userScrolledUpRef.current = distanceFromBottom > 24;
  }, []);

  // Auto-Scroll ans Ende bei follow, sofern der Nutzer nicht hochgescrollt hat.
  useEffect(() => {
    if (!follow) return;
    if (userScrolledUpRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleLines, follow]);

  const handleClear = useCallback(() => {
    setLines([]);
    userScrolledUpRef.current = false;
  }, []);

  const handleDownload = useCallback(() => {
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeContainer = selectedContainer ?? 'container';
    a.download = `${pod}_${safeContainer}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [lines, pod, selectedContainer]);

  const containerOptions = useMemo(
    () => containers.map((c) => ({ value: c, label: c })),
    [containers],
  );

  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Select
          label={t('forms.logs.container')}
          data={containerOptions}
          value={selectedContainer}
          onChange={setSelectedContainer}
          disabled={containers.length === 0}
          placeholder={containers.length === 0 ? t('forms.logs.noContainers') : undefined}
          w={220}
          allowDeselect={false}
          searchable
        />
        <Select
          label={t('forms.logs.lines')}
          data={TAIL_OPTIONS}
          value={String(tailLines)}
          onChange={(v) => {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) setTailLines(n);
          }}
          w={110}
          allowDeselect={false}
        />
        <TextInput
          label={t('forms.logs.filter')}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          placeholder={t('forms.logs.filterPlaceholder')}
          w={200}
        />
        <Switch
          label={t('forms.logs.follow')}
          checked={follow}
          onChange={(e) => setFollow(e.currentTarget.checked)}
        />
        <Switch
          label={t('forms.logs.timestamps')}
          checked={timestamps}
          onChange={(e) => setTimestamps(e.currentTarget.checked)}
        />
        <Switch
          label={t('forms.logs.previous')}
          checked={previous}
          onChange={(e) => setPrevious(e.currentTarget.checked)}
        />
        <Switch
          label={t('forms.logs.wrap')}
          checked={wrap}
          onChange={(e) => setWrap(e.currentTarget.checked)}
        />
        <Button
          variant="default"
          leftSection={<IconTrash size={16} />}
          onClick={handleClear}
        >
          {t('forms.logs.clear')}
        </Button>
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          onClick={handleDownload}
          disabled={lines.length === 0}
        >
          {t('forms.logs.download')}
        </Button>
      </Group>

      {errorMsg && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title={t('forms.logs.errorTitle')}>
          {errorMsg}
        </Alert>
      )}

      <Group gap="xs" h={20}>
        {loading && <Loader size="xs" />}
        <Text size="xs" c="dimmed">
          {loading
            ? t('forms.logs.connecting')
            : streaming
              ? visibleLines.length !== lines.length
                ? t('forms.logs.liveFiltered', { visible: visibleLines.length, total: lines.length })
                : t('forms.logs.live', { count: lines.length })
              : t('forms.logs.paused', { count: lines.length })}
        </Text>
      </Group>

      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          height: 'calc(100vh - 260px)',
          overflow: 'auto',
          backgroundColor: 'var(--mantine-color-dark-8)',
          color: 'var(--mantine-color-gray-2)',
          borderRadius: 'var(--mantine-radius-sm)',
          padding: '8px 12px',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {visibleLines.length === 0 ? (
          <Text size="xs" c="dimmed">
            {filter.trim() ? t('forms.logs.noFilterMatch') : t('forms.logs.noLines')}
          </Text>
        ) : (
          visibleLines.map((line, i) => (
            <div
              key={i}
              style={{
                whiteSpace: wrap ? 'pre-wrap' : 'pre',
                wordBreak: wrap ? 'break-word' : 'normal',
              }}
            >
              {line === '' ? ' ' : line}
            </div>
          ))
        )}
      </Box>
    </Stack>
  );
}
