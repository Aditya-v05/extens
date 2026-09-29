/*
 * The real side panel, embedded by the landing page's scroll story (an iframe keeps its demo state apart
 * from the hero demo's). The parent page says which step is showing; the panel jumps to that part.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/components/styles.css';
import App from '@/entrypoints/sidepanel/App';
import type { LookupResult, ViewState } from '@/lib/types';
import { browser } from './browser-stub';
import { acme, acmeRevealed } from './demo-data';
import './panel-embed.css';

export type Step = 'fit' | 'why' | 'who' | 'linkedin';

const done = (result: LookupResult): ViewState => ({ status: 'done', domain: acme.domain, result, cached: true });
const fromProfile: LookupResult = {
  ...acmeRevealed,
  profile: { apolloId: 'p2', url: 'https://www.linkedin.com/in/jonas-berg' },
  contacts: acmeRevealed.contacts!.map((c) =>
    c.apolloId === 'p2' ? { ...c, lastName: 'Berg', headline: 'Head of Support at Acme', email: 'jonas.berg@acme.example', emailStatus: 'verified', revealedAt: Date.now() } : c,
  ),
};

const VIEWS: Record<Step, { view: ViewState; scroll: string | null }> = {
  fit: { view: done(acme), scroll: null },
  why: { view: done(acme), scroll: '.section' },
  who: { view: done(acmeRevealed), scroll: '.contact-list' },
  linkedin: { view: done(fromProfile), scroll: null },
};

let current: Step | null = null;
async function show(step: Step) {
  if (step === current) return;
  current = step;
  const { view, scroll } = VIEWS[step];
  await browser.storage.session.set({ view_1: view });
  requestAnimationFrame(() => {
    const el = scroll ? (document.querySelector(scroll) as HTMLElement | null) : null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el ? el.offsetTop - 20 : 0, behavior: reduced ? 'auto' : 'smooth' });
  });
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const step = e.data?.siftStep as Step | undefined;
  if (step && step in VIEWS) show(step);
});

(async () => {
  await browser.storage.local.set({
    keys: { apollo: 'demo', typesafe: 'demo' },
    settings: { monthlyBudget: 200, fetchJobs: true, scanSite: true },
    credits: { month: new Date().toISOString().slice(0, 7), company: 9, jobs: 9, reveal: 4, search: 1 },
  });
  await show('fit');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
})();
