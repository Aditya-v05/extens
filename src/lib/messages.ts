import { browser } from 'wxt/browser';
import type { DiscoverOutcome, RevealOutcome } from './pipeline';
import type { Keys, ViewState } from './types';

export type Message =
  | { type: 'lookup'; windowId: number; domain: string; force?: boolean; allowOverBudget?: boolean; profileUrl?: string }
  | { type: 'refreshBalance' }
  | { type: 'discover'; more?: boolean; fresh?: boolean; allowOverBudget?: boolean }
  | { type: 'reveal'; windowId: number | null; domain: string; personIds: string[] }
  | { type: 'refreshAccount'; domain: string; allowOverBudget?: boolean }
  | { type: 'testKeys'; keys: Keys };

export type KeyTest = { ok: boolean; message: string };

export type Reply<M extends Message> = M extends { type: 'lookup' }
  ? { ok: true }
  : M extends { type: 'refreshBalance' }
    ? { ok: true }
  : M extends { type: 'discover' }
    ? DiscoverOutcome
  : M extends { type: 'refreshAccount' }
    ? ViewState
  : M extends { type: 'reveal' }
    ? RevealOutcome
    : { apollo: KeyTest; typesafe: KeyTest };

/** All API calls go through the background worker (CORS doesn't apply there). */
export function openAccounts(): Promise<unknown> {
  return browser.tabs.create({ url: browser.runtime.getURL('/accounts.html') });
}

export function send<M extends Message>(msg: M): Promise<Reply<M>> {
  return browser.runtime.sendMessage(msg) as Promise<Reply<M>>;
}
