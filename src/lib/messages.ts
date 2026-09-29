import { browser } from 'wxt/browser';
import type { Keys, LookupError } from './types';

export type Message =
  | { type: 'lookup'; windowId: number; domain: string; force?: boolean; allowOverBudget?: boolean }
  | { type: 'refreshBalance' }
  | { type: 'reveal'; windowId: number; domain: string; personId: string }
  | { type: 'testKeys'; keys: Keys };

export type KeyTest = { ok: boolean; message: string };

export type Reply<M extends Message> = M extends { type: 'lookup' }
  ? { ok: true }
  : M extends { type: 'refreshBalance' }
    ? { ok: true }
  : M extends { type: 'reveal' }
    ? { ok: true } | { ok: false; error: LookupError }
    : { apollo: KeyTest; typesafe: KeyTest };

/** All API calls go through the background worker (CORS doesn't apply there). */
export function send<M extends Message>(msg: M): Promise<Reply<M>> {
  return browser.runtime.sendMessage(msg) as Promise<Reply<M>>;
}
