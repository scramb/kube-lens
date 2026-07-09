type Handler = (...args: unknown[]) => void;

interface CallResponse {
  result?: unknown;
  error?: string;
}

const TOKEN_KEY = 'kube-lens-server-token';
const isWailsRuntime = typeof window !== 'undefined' && !!(window as any).go?.main?.App;

function serverToken(): string {
  let token = sessionStorage.getItem(TOKEN_KEY) ?? '';
  if (!token && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
    token = window.prompt('Kube Lens server auth token') ?? '';
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

function installServerBridge() {
  const handlers = new Map<string, Set<Handler>>();
  let token = serverToken();

  const promptForToken = () => {
    const next = window.prompt('Kube Lens server auth token') ?? '';
    token = next;
    if (next) sessionStorage.setItem(TOKEN_KEY, next);
    return next;
  };

  const call = async (method: string, args: unknown[], retried = false): Promise<unknown> => {
    const response = await fetch('/api/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ method, args }),
    });
    const payload = (await response.json().catch(() => ({}))) as CallResponse;
    if (response.status === 401 && !retried && promptForToken()) {
      return call(method, args, true);
    }
    if (!response.ok || payload.error) throw new Error(payload.error || response.statusText);
    return payload.result;
  };

  (window as any).go = {
    main: {
      App: new Proxy({}, {
        get: (_target, method) => {
          if (typeof method !== 'string') return undefined;
          return (...args: unknown[]) => call(method, args);
        },
      }),
    },
  };

  const emitLocal = (event: string, data: unknown[]) => {
    for (const handler of handlers.get(event) ?? []) {
      handler(...data);
    }
  };

  const connect = () => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    const ws = new WebSocket(`${protocol}//${location.host}/api/events${query}`);
    ws.onmessage = (message) => {
      try {
        const frame = JSON.parse(message.data) as { event: string; data?: unknown[] };
        emitLocal(frame.event, frame.data ?? []);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => window.setTimeout(connect, 1000);
  };
  connect();

  (window as any).runtime = {
    EventsOnMultiple(eventName: string, callback: Handler, maxCallbacks: number) {
      let count = 0;
      const wrapped: Handler = (...args) => {
        callback(...args);
        count += 1;
        if (maxCallbacks > 0 && count >= maxCallbacks) {
          handlers.get(eventName)?.delete(wrapped);
        }
      };
      const set = handlers.get(eventName) ?? new Set<Handler>();
      set.add(wrapped);
      handlers.set(eventName, set);
      return () => set.delete(wrapped);
    },
    EventsOn(eventName: string, callback: Handler) {
      return (window as any).runtime.EventsOnMultiple(eventName, callback, -1);
    },
    EventsOnce(eventName: string, callback: Handler) {
      return (window as any).runtime.EventsOnMultiple(eventName, callback, 1);
    },
    EventsOff(...eventNames: string[]) {
      for (const eventName of eventNames) handlers.delete(eventName);
    },
    EventsOffAll() {
      handlers.clear();
    },
    LogPrint: console.log,
    LogTrace: console.debug,
    LogDebug: console.debug,
    LogInfo: console.info,
    LogWarning: console.warn,
    LogError: console.error,
    LogFatal: console.error,
  };
}

if (!isWailsRuntime) installServerBridge();
