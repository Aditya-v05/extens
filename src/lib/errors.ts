import type { LookupError, Service } from './types';

export class ApiError extends Error {
  constructor(
    readonly service: Service,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get invalidKey(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function toLookupError(err: unknown): LookupError {
  if (err instanceof ApiError) {
    return { service: err.service, status: err.status, message: err.message, invalidKey: err.invalidKey };
  }
  return {
    service: 'apollo',
    status: null,
    message: err instanceof Error ? err.message : String(err),
    invalidKey: false,
  };
}

const SERVICE_NAME: Record<Service, string> = { apollo: 'Apollo', jev: 'Jev (TypeSafe)' };

export function describeError(e: LookupError): string {
  const name = SERVICE_NAME[e.service];
  if (e.invalidKey) return `${name} rejected the API key (${e.status}). Check it in Settings.`;
  if (e.status === 429) return `${name} rate limit hit. Wait a moment and retry.`;
  if (e.status === 529 || (e.status && e.status >= 500)) return `${name} is having trouble (${e.status}). Retry shortly.`;
  if (e.status === null) return `Couldn't reach ${name}: ${e.message}`;
  return `${name} error (${e.status}): ${e.message}`;
}

/** fetch() with a timeout, one retry on 429/529, and ApiError on failure. */
export async function request(service: Service, url: string, init: RequestInit, timeoutMs = 15000): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const msg = err instanceof Error && err.name === 'TimeoutError' ? 'request timed out' : String(err);
      throw new ApiError(service, null, msg);
    }
    if ((res.status === 429 || res.status === 529) && attempt === 0) {
      const wait = Number(res.headers.get('retry-after') ?? 1);
      await new Promise((r) => setTimeout(r, Math.min(Math.max(wait, 1), 5) * 1000));
      continue;
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) throw new ApiError(service, res.status, extractMessage(body) ?? res.statusText);
    return body;
  }
}

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? body.slice(0, 200) : null;
  const b = body as Record<string, any>;
  return b.error ?? b.message ?? b.detail?.message ?? (typeof b.detail === 'string' ? b.detail : null);
}
