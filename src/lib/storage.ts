import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, addSpend, current, type Balance, type Ledger, type Settings, type SpendKind } from './credits';
import type { Contact, Keys, LookupResult, Profile, ViewState } from './types';

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type LocalSchema = {
  keys: Keys;
  profile: Profile;
  cache: Record<string, LookupResult>;
  saved: Record<string, LookupResult & { savedAt: number }>;
  reveals: Record<string, Pick<Contact, 'lastName' | 'email' | 'emailStatus' | 'linkedin' | 'revealedAt'> & { title?: string }>;
  settings: Settings;
  credits: Ledger;
  balance: Balance;
};

async function getLocal<K extends keyof LocalSchema>(key: K): Promise<LocalSchema[K] | undefined> {
  const out = await browser.storage.local.get(key);
  return out[key] as LocalSchema[K] | undefined;
}

async function setLocal<K extends keyof LocalSchema>(key: K, value: LocalSchema[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export const getKeys = () => getLocal('keys');
export const setKeys = (k: Keys) => setLocal('keys', k);
export const getProfile = () => getLocal('profile');
export const setProfile = (p: Profile) => setLocal('profile', p);

export const getSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...(await getLocal('settings')) });
export const setSettings = (s: Settings) => setLocal('settings', s);

export const getLedger = async () => current(await getLocal('credits'));

// Spends can land concurrently (parallel API calls); queue the read-modify-write so none are lost.
let spendQueue: Promise<unknown> = Promise.resolve();
export function recordSpend(kind: SpendKind, n = 1): Promise<void> {
  const next = spendQueue.then(async () => setLocal('credits', addSpend(await getLocal('credits'), kind, n)));
  spendQueue = next.catch(() => {});
  return next;
}

export const getBalance = () => getLocal('balance');
export const setBalance = (b: Balance) => setLocal('balance', b);

/** Subscribe to changes of some local keys (credits, settings, balance…). */
export function onLocalChange(keys: (keyof LocalSchema)[], cb: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && keys.some((k) => k in changes)) cb();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getCached(domain: string): Promise<LookupResult | null> {
  const hit = (await getLocal('cache'))?.[domain];
  return hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS ? hit : null;
}

export async function putCached(result: LookupResult): Promise<void> {
  const cache = (await getLocal('cache')) ?? {};
  const now = Date.now();
  for (const [d, r] of Object.entries(cache)) if (now - r.fetchedAt >= CACHE_TTL_MS) delete cache[d];
  cache[result.domain] = result;
  await setLocal('cache', cache);
}

export const clearCache = () => setLocal('cache', {});

export const getSaved = async () => (await getLocal('saved')) ?? {};

export async function saveAccount(result: LookupResult): Promise<void> {
  const saved = await getSaved();
  saved[result.domain] = { ...result, savedAt: Date.now() };
  await setLocal('saved', saved);
}

export async function unsaveAccount(domain: string): Promise<void> {
  const saved = await getSaved();
  delete saved[domain];
  await setLocal('saved', saved);
}

export const getReveals = async () => (await getLocal('reveals')) ?? {};

export async function putReveal(personId: string, reveal: LocalSchema['reveals'][string]): Promise<void> {
  const reveals = await getReveals();
  reveals[personId] = reveal;
  await setLocal('reveals', reveals);
}

/** Apply stored reveals to contacts (reveals outlive the 7-day cache). */
export async function withReveals(contacts: Contact[]): Promise<Contact[]> {
  const reveals = await getReveals();
  return contacts.map((c) => (reveals[c.apolloId] ? { ...c, ...reveals[c.apolloId] } : c));
}

/** Per-window view state lives in session storage so the panel can open after work starts. */
const viewKey = (windowId: number) => `view_${windowId}`;

export async function setView(windowId: number, view: ViewState): Promise<void> {
  await browser.storage.session.set({ [viewKey(windowId)]: view });
}

export async function getView(windowId: number): Promise<ViewState> {
  const out = await browser.storage.session.get(viewKey(windowId));
  return (out[viewKey(windowId)] as ViewState | undefined) ?? { status: 'idle' };
}

export function onViewChange(windowId: number, cb: (v: ViewState) => void): () => void {
  const key = viewKey(windowId);
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'session' && changes[key]?.newValue) cb(changes[key].newValue as ViewState);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
