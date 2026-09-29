/**
 * Just enough of the extension `browser` API for the side panel to run on a web page:
 * in-memory storage with change events, and no-op messaging. Used only by the landing page demo.
 */
type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
const listeners = new Set<Listener>();

function area(name: 'local' | 'session') {
  const data: Record<string, unknown> = {};
  return {
    async get(keys?: string | string[]) {
      if (keys === undefined) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.map((k) => [k, data[k]]));
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, { newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        data[k] = v;
        changes[k] = { newValue: v };
      }
      listeners.forEach((l) => l(changes, name));
    },
  };
}

export const browser = {
  storage: {
    local: area('local'),
    session: area('session'),
    onChanged: {
      addListener: (l: Listener) => void listeners.add(l),
      removeListener: (l: Listener) => void listeners.delete(l),
    },
  },
  runtime: {
    sendMessage: async () => ({ ok: true }),
    openOptionsPage: () => {},
    getURL: (p: string) => p,
  },
  tabs: { create: async () => ({}), query: async () => [] },
  windows: { getCurrent: async () => ({ id: 1 }) },
} as any;

export type Browser = typeof browser;
