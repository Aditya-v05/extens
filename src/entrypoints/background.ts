import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import * as apollo from '@/lib/apollo';
import { toLookupError, describeError } from '@/lib/errors';
import * as jev from '@/lib/jev';
import type { KeyTest, Message } from '@/lib/messages';
import { refreshBalance, revealContact, runLookup } from '@/lib/pipeline';
import { domainFromUrl } from '@/lib/resolver';
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
    if (domain) runLookup(windowId, domain);
    else setView(windowId, { status: 'not_company', url: tab.url ?? null });
  });

  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Message;
    switch (msg.type) {
      case 'lookup':
        runLookup(msg.windowId, msg.domain, { force: msg.force, allowOverBudget: msg.allowOverBudget });
        sendResponse({ ok: true });
        return false;
      case 'refreshBalance':
        refreshBalance(true).then(() => sendResponse({ ok: true }));
        return true;
      case 'reveal':
        revealContact(msg.windowId, msg.domain, msg.personId)
          .then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ ok: false, error: toLookupError(err) }));
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
