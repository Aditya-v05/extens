import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import * as apollo from '@/lib/apollo';
import { toLookupError, describeError } from '@/lib/errors';
import * as jev from '@/lib/jev';
import type { KeyTest, Message } from '@/lib/messages';
import { refreshBalance, revealContacts, runDiscover, runLookup, runProfileLookup } from '@/lib/pipeline';
import { domainFromUrl, linkedinProfile } from '@/lib/resolver';
import { setView } from '@/lib/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.runtime.openOptionsPage();
  });

  // Clicking the icon grants activeTab, so tab.url is readable here without the "tabs" permission.
  browser.action.onClicked.addListener((tab) => {
    const windowId = tab.windowId;
    // Must be called synchronously inside the user gesture.
    browser.sidePanel.open({ windowId });
    const domain = domainFromUrl(tab.url);
    const profile = domain ? null : linkedinProfile(tab.url);
    if (domain) runLookup(windowId, domain, { tabId: tab.id });
    else if (profile) runProfileLookup(windowId, profile);
    else setView(windowId, { status: 'not_company', url: tab.url ?? null });
  });

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Message;
    switch (msg.type) {
      case 'lookup':
        // The active tab may still hold the activeTab grant (e.g. Refresh); the scan checks its host.
        browser.tabs
          .query({ active: true, windowId: msg.windowId })
          .then(([tab]) =>
            msg.profileUrl
              ? runProfileLookup(msg.windowId, msg.profileUrl, { force: msg.force, allowOverBudget: msg.allowOverBudget })
              : runLookup(msg.windowId, msg.domain, { force: msg.force, allowOverBudget: msg.allowOverBudget, tabId: tab?.id }),
          );
        sendResponse({ ok: true });
        return false;
      case 'refreshAccount':
        // From My Accounts: no side panel and no tab, so it runs headless (no website signals).
        runLookup(null, msg.domain, { force: true, allowOverBudget: msg.allowOverBudget }).then(sendResponse);
        return true;
      case 'discover':
        runDiscover({ more: msg.more, fresh: msg.fresh, allowOverBudget: msg.allowOverBudget }).then(sendResponse);
        return true;
      case 'refreshBalance':
        refreshBalance(true).then(() => sendResponse({ ok: true }));
        return true;
      case 'reveal':
        revealContacts(msg.windowId, msg.domain, msg.personIds)
          .then(sendResponse)
          .catch((err) => sendResponse({ revealed: 0, noEmail: 0, failed: msg.personIds.length, error: toLookupError(err) }));
        return true;
      case 'testKeys':
        Promise.all([
          test(() => apollo.checkKey(msg.keys.apollo), 'Apollo key not recognized'),
          test(() => jev.checkKey(msg.keys.typesafe), 'TypeSafe key not recognized'),
        ]).then(([a, t]) => {
          sendResponse({ apollo: a, typesafe: t });
          if (a.ok) refreshBalance(true);
        });
        return true;
    }
  });
});

async function test(fn: () => Promise<boolean>, failMessage: string): Promise<KeyTest> {
  try {
    return (await fn()) ? { ok: true, message: 'Connected' } : { ok: false, message: failMessage };
  } catch (err) {
    return { ok: false, message: describeError(toLookupError(err)) };
  }
}
