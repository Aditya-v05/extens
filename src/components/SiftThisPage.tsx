import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { send } from '@/lib/messages';
import * as store from '@/lib/storage';

/*
 * Sifting the page you're on without going back to the toolbar icon.
 *
 * Chrome only shows an extension a tab's address after its icon is clicked. From the panel we ask once for
 * the optional "tabs" permission instead, at the moment the button is pressed, and read the active tab's
 * address only then. Nothing is read when you merely switch tabs: the panel only notices that the active
 * tab is a different one (tab ids need no permission).
 */

/** Must be called straight from the click: Chrome only shows the permission prompt inside a user gesture. */
export async function siftActiveTab(windowId: number): Promise<boolean> {
  const granted = await browser.permissions.request({ permissions: ['tabs'] }).catch(() => false);
  if (granted) await send({ type: 'siftTab', windowId });
  return granted;
}

export function SiftThisPage({ windowId, className = 'primary', label = 'Sift this page' }: {
  windowId: number | null;
  className?: string;
  label?: string;
}) {
  const [denied, setDenied] = useState(false);
  return (
    <>
      <button
        className={className}
        disabled={windowId === null}
        title="Look up the site in the current tab"
        onClick={() => windowId !== null && siftActiveTab(windowId).then((ok) => setDenied(!ok))}
      >
        {label}
      </button>
      {denied && <p className="small muted">Without that permission, click the Sift icon in the toolbar (Alt+Shift+S) instead.</p>}
    </>
  );
}

/**
 * True once the active tab in this window is no longer the tab the panel's result was sifted from, or that
 * tab has since loaded another page. The background records the tab on every sift (icon, shortcut, button).
 */
export function useTabSwitched(windowId: number | null): boolean {
  const [viewTab, setViewTab] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [navigated, setNavigated] = useState(false);
  const viewTabRef = useRef<number | null>(null);

  useEffect(() => {
    if (windowId === null) return;
    const take = (v: store.ViewTab | null) => {
      viewTabRef.current = v?.tabId ?? null;
      setViewTab(v?.tabId ?? null);
      setNavigated(false);
    };
    let changed = false;
    const offTab = store.onViewTabChange(windowId, (v) => ((changed = true), take(v)));
    store.getViewTab(windowId).then((v) => !changed && take(v));
    browser.tabs.query({ active: true, windowId }).then(([tab]) => setActive(tab?.id ?? null));

    const onActivated = (info: { tabId: number; windowId: number }) => {
      if (info.windowId === windowId) setActive(info.tabId);
    };
    const onUpdated = (tabId: number, change: { status?: string }) => {
      if (tabId === viewTabRef.current && change.status === 'loading') setNavigated(true);
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      offTab();
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [windowId]);

  return viewTab !== null && active !== null && (active !== viewTab || navigated);
}
