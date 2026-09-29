import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, addSpend, current, type Balance, type Ledger, type Settings, type SpendKind } from './credits';
import { EMPTY_META, type AccountMeta } from './accounts';
import type { ProfileMatch } from './apollo';
import type { DiscoverResult } from './discover';
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
  accountMeta: Record<string, AccountMeta>;
  discover: DiscoverResult;
  dismissed: string[];
  profileMatches: Record<string, ProfileMatch & { fetchedAt: number }>;
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

/** All unexpired cached lookups ("recently viewed"). */
export async function getAllCached(): Promise<Record<string, LookupResult>> {
  const cache = (await getLocal('cache')) ?? {};
  const now = Date.now();
  return Object.fromEntries(Object.entries(cache).filter(([, r]) => now - r.fetchedAt < CACHE_TTL_MS));
}

export const getSaved = async () => (await getLocal('saved')) ?? {};

/** Save (or update) an account's snapshot. Re-saving keeps the original savedAt. */
export async function saveAccount(result: LookupResult): Promise<void> {
  const saved = await getSaved();
  saved[result.domain] = { ...result, savedAt: saved[result.domain]?.savedAt ?? Date.now() };
  await setLocal('saved', saved);
}

/** LinkedIn profile → person and company, kept 30 days so revisiting a profile costs nothing. */
const PROFILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getProfileMatch(url: string): Promise<ProfileMatch | null> {
  const hit = (await getLocal('profileMatches'))?.[url];
  return hit && Date.now() - hit.fetchedAt < PROFILE_TTL_MS ? hit : null;
}

export async function putProfileMatch(url: string, match: ProfileMatch): Promise<void> {
  const all = (await getLocal('profileMatches')) ?? {};
  const now = Date.now();
  for (const [k, v] of Object.entries(all)) if (now - v.fetchedAt >= PROFILE_TTL_MS) delete all[k];
  all[url] = { ...match, fetchedAt: now };
  await setLocal('profileMatches', all);
}

export const getDiscover = () => getLocal('discover');
export const setDiscover = (d: DiscoverResult) => setLocal('discover', d);
export const getDismissed = async () => (await getLocal('dismissed')) ?? [];

/** Hide a Discover suggestion now and exclude it from future searches. */
export async function dismissCandidate(domain: string): Promise<void> {
  await setLocal('dismissed', [...new Set([...(await getDismissed()), domain])]);
  const d = await getDiscover();
  if (d) await setDiscover({ ...d, candidates: d.candidates.filter((c) => c.domain !== domain) });
}

export const getAccountMeta = async () => (await getLocal('accountMeta')) ?? {};

export async function updateAccountMeta(domain: string, patch: Partial<Omit<AccountMeta, 'updatedAt'>>): Promise<void> {
  const all = await getAccountMeta();
  all[domain] = { ...EMPTY_META, ...all[domain], ...patch, updatedAt: Date.now() };
  await setLocal('accountMeta', all);
}

export async function unsaveAccount(domain: string): Promise<void> {
  const saved = await getSaved();
  delete saved[domain];
  await setLocal('saved', saved);
}

export const getReveals = async () => (await getLocal('reveals')) ?? {};

export async function putReveals(batch: LocalSchema['reveals']): Promise<void> {
  await setLocal('reveals', { ...(await getReveals()), ...batch });
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

/** Which tab the window's current result was sifted from (icon, shortcut, or "Sift this page"). */
const viewTabKey = (windowId: number) => `viewTab_${windowId}`;
export type ViewTab = { tabId: number; at: number };

export async function setViewTab(windowId: number, tabId: number): Promise<void> {
  await browser.storage.session.set({ [viewTabKey(windowId)]: { tabId, at: Date.now() } satisfies ViewTab });
}

export async function getViewTab(windowId: number): Promise<ViewTab | null> {
  const out = await browser.storage.session.get(viewTabKey(windowId));
  return (out[viewTabKey(windowId)] as ViewTab | undefined) ?? null;
}

export function onViewTabChange(windowId: number, cb: (v: ViewTab) => void): () => void {
  const key = viewTabKey(windowId);
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'session' && changes[key]?.newValue) cb(changes[key].newValue as ViewTab);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
