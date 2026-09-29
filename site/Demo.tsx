import { useEffect, useRef, useState } from 'react';
import App from '@/entrypoints/sidepanel/App';
import type { LookupResult, ViewState } from '@/lib/types';
import icon32 from '../public/icon/32.png';
import { browser } from './browser-stub';
import { acme, acmeRevealed } from './demo-data';

const setView = (v: ViewState) => browser.storage.session.set({ view_1: v });

const partial = (fields: Partial<LookupResult>): LookupResult => ({ ...acme, fit: null, persona: null, contacts: null, whyNow: undefined, ...fields });

/** One lookup, step by step, using the real panel's own loading states. [ms to hold, what to show] */
type Step = { hold: number; open: boolean; pulse?: boolean; view?: ViewState; scrollTo?: 'top' | 'contacts' };
const STEPS: Step[] = [
  { hold: 1500, open: false, pulse: true, view: { status: 'idle' } },
  { hold: 800, open: true, view: { status: 'loading', domain: acme.domain, stage: 'company', partial: null } },
  { hold: 900, open: true, view: { status: 'loading', domain: acme.domain, stage: 'judging', partial: partial({}) } },
  { hold: 1100, open: true, view: { status: 'loading', domain: acme.domain, stage: 'ranking', partial: partial({ fit: acme.fit, persona: acme.persona, contacts: acme.contacts }) } },
  { hold: 2800, open: true, view: { status: 'done', domain: acme.domain, result: acme, cached: false }, scrollTo: 'top' },
  { hold: 1600, open: true, scrollTo: 'contacts' },
  { hold: 3200, open: true, view: { status: 'done', domain: acme.domain, result: acmeRevealed, cached: false } },
  { hold: 700, open: false },
];
const FINAL: Step = { hold: 0, open: true, view: { status: 'done', domain: acme.domain, result: acmeRevealed, cached: false } };

async function seed() {
  await browser.storage.local.set({
    keys: { apollo: 'demo', typesafe: 'demo' },
    settings: { monthlyBudget: 200, fetchJobs: true, scanSite: true },
    credits: { month: new Date().toISOString().slice(0, 7), company: 9, jobs: 9, reveal: 4, search: 1 },
  });
}

export function Demo() {
  const [step, setStep] = useState<Step>(STEPS[0]!);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const show = async (s: Step) => {
      if (s.view) await setView(s.view);
      setStep(s);
      const el = frame.current;
      if (el && s.scrollTo) {
        const target = s.scrollTo === 'contacts' ? (el.querySelector('.contact-list') as HTMLElement | null)?.offsetTop ?? 0 : 0;
        el.scrollTo({ top: Math.max(0, target - 24), behavior: reduced ? 'auto' : 'smooth' });
      }
    };

    const run = async (i: number) => {
      if (cancelled) return;
      if (document.hidden) {
        timer = setTimeout(() => run(i), 500); // pause while the tab isn't visible
        return;
      }
      const s = STEPS[i % STEPS.length]!;
      await show(s);
      timer = setTimeout(() => run(i + 1), s.hold);
    };

    seed().then(() => (reduced ? show(FINAL) : run(0)));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="l-demo" aria-label="Animated demo: Sift looks up Acme and shows its fit, why now and best contacts">
      <div className="l-chrome">
        <span className="l-dots" aria-hidden><i /><i /><i /></span>
        <span className="l-url">acme.example</span>
        <span className={`l-ext ${step.pulse ? 'pulse' : ''} ${step.open ? 'on' : ''}`} title="Sift">
          <img src={icon32} alt="" width="18" height="18" />
        </span>
      </div>
      <div className="l-viewport">
        <FakeSite />
        <div className={`l-panel ${step.open ? 'open' : ''}`} aria-hidden={!step.open}>
          <div className="l-panel-head">
            <img src={icon32} alt="" width="16" height="16" /> Sift
          </div>
          <div className="l-panel-body" ref={frame}>
            <App />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A made-up company homepage, drawn in lines so it reads as "a website" without competing with the panel. */
function FakeSite() {
  return (
    <div className="l-site" aria-hidden>
      <div className="l-site-nav">
        <strong>Acme</strong>
        <span>Product</span><span>Pricing</span><span>Customers</span><span>Careers</span>
      </div>
      <div className="l-site-hero">
        <div className="l-site-title">Support your customers will thank you for</div>
        <div className="l-site-bar w80" />
        <div className="l-site-bar w60" />
        <div className="l-site-cta">Book a demo</div>
      </div>
      <div className="l-site-grid">
        <div /><div /><div />
      </div>
    </div>
  );
}
