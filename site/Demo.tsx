import { useEffect, useRef, useState } from 'react';
import App from '@/entrypoints/sidepanel/App';
import type { LookupResult, ViewState } from '@/lib/types';
import icon32 from '../public/icon/32.png';
import { browser } from './browser-stub';
import { acme, acmeRevealed } from './demo-data';

/*
 * The demo is directed, not a slideshow (rules from ferndesk/no-slop-motion):
 *  - actions finish: a cursor travels to the Sift icon and presses it before the panel opens, and presses
 *    "Reveal email" before the email appears. Targets are measured from the DOM, never hard-coded;
 *  - one idea at a time: the page dims while the panel works;
 *  - no hard pops: every part of the panel arrives with a short rise (landing.css), in order;
 *  - burst, then hold: each result gets time to land before the next move;
 *  - eases: power2.inOut for moves, power3.out for arrivals, power2.in for exits. No linear, no overshoot.
 */
const EASE_MOVE = 'cubic-bezier(0.455, 0.03, 0.515, 0.955)'; // power2.inOut
const EASE_OUT = 'cubic-bezier(0.215, 0.61, 0.355, 1)'; // power3.out
const EASE_IN = 'cubic-bezier(0.55, 0.085, 0.68, 0.53)'; // power2.in

const setView = (v: ViewState) => browser.storage.session.set({ view_1: v });
const partial = (fields: Partial<LookupResult>): LookupResult => ({ ...acme, fit: null, persona: null, contacts: null, whyNow: undefined, ...fields });
const done = (result: LookupResult): ViewState => ({ status: 'done', domain: acme.domain, result, cached: false });

async function seed() {
  await browser.storage.local.set({
    keys: { apollo: 'demo', typesafe: 'demo' },
    settings: { monthlyBudget: 200, fetchJobs: true, scanSite: true },
    credits: { month: new Date().toISOString().slice(0, 7), company: 9, jobs: 9, reveal: 4, search: 1 },
  });
}

class Cancelled extends Error {}

export function Demo() {
  const [open, setOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  // The icon is React-rendered, so its pressed look is React state (a classList change would be overwritten).
  const [iconDown, setIconDown] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const ext = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pos = { x: 0, y: 0 };

    /** Wait, pausing while the tab is hidden; throws once the component unmounts. */
    const wait = async (ms: number) => {
      const end = Date.now() + ms;
      while (Date.now() < end || document.hidden) {
        if (cancelled) throw new Cancelled();
        await new Promise((r) => setTimeout(r, Math.min(100, Math.max(16, end - Date.now()))));
      }
      if (cancelled) throw new Cancelled();
    };

    /** Where to aim inside an element, relative to the demo frame. */
    const aim = (el: Element, dx = 0.5) => {
      const box = root.current!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + Math.min(r.width * dx, 36), y: r.top - box.top + r.height / 2 };
    };

    const moveCursor = async (to: { x: number; y: number }, ms: number) => {
      const c = cursor.current!;
      const anim = c.animate(
        [{ transform: `translate(${pos.x}px, ${pos.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }],
        { duration: ms, easing: EASE_MOVE, fill: 'forwards' },
      );
      Object.assign(pos, to);
      await anim.finished;
    };

    const fadeCursor = (to: 0 | 1, ms: number) =>
      cursor.current!.animate([{ opacity: to ? 0 : 1 }, { opacity: to }], { duration: ms, easing: to ? EASE_OUT : EASE_IN, fill: 'forwards' }).finished;

    /** A click that finishes: the target presses, then releases (for elements React won't re-render meanwhile). */
    const press = async (el: HTMLElement | null) => {
      el?.classList.add('l-pressed');
      cursor.current?.classList.add('down');
      await wait(140);
      el?.classList.remove('l-pressed');
      cursor.current?.classList.remove('down');
    };

    const scrollPanel = async (to: 'top' | 'contacts') => {
      const el = body.current!;
      const target = to === 'contacts' ? ((el.querySelector('.contact-list') as HTMLElement | null)?.offsetTop ?? 0) - 24 : 0;
      el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      await wait(700);
    };

    const once = async () => {
      // Hook: the page, and a cursor already on its way.
      setOpen(false);
      await setView({ status: 'idle' });
      body.current!.scrollTo({ top: 0 });
      const start = { x: root.current!.clientWidth * 0.3, y: root.current!.clientHeight * 0.62 };
      cursor.current!.animate([{ transform: `translate(${start.x}px, ${start.y}px)` }], { fill: 'forwards' });
      Object.assign(pos, start);
      await fadeCursor(1, 300);
      await wait(350);

      // Click the Sift icon.
      await moveCursor(aim(ext.current!), 900);
      setIconDown(true);
      cursor.current?.classList.add('down');
      await wait(140);
      setIconDown(false);
      cursor.current?.classList.remove('down');
      setPressed(true);
      await setView({ status: 'loading', domain: acme.domain, stage: 'company', partial: null });
      setOpen(true);
      await wait(900);

      // The lookup builds in the panel's own stages.
      await setView({ status: 'loading', domain: acme.domain, stage: 'judging', partial: partial({}) });
      await wait(800);
      await setView({ status: 'loading', domain: acme.domain, stage: 'ranking', partial: partial({ fit: acme.fit, persona: acme.persona }) });
      await wait(1500); // the fit is the first hit: give it air
      await setView(done(acme));
      await wait(2400);

      // Down to the contacts, then press Reveal on the best one.
      await scrollPanel('contacts');
      await wait(500);
      const reveal = [...body.current!.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Reveal email')) ?? null;
      if (reveal) await moveCursor(aim(reveal, 0.35), 800);
      await press(reveal);
      await setView(done(acmeRevealed));
      await wait(2600);

      // Close and start over.
      await fadeCursor(0, 250);
      setOpen(false);
      setPressed(false);
      await wait(900);
    };

    const loop = async () => {
      await seed();
      if (reduced) {
        await setView(done(acmeRevealed));
        setPressed(true);
        setOpen(true);
        return;
      }
      try {
        for (;;) await once();
      } catch (e) {
        if (!(e instanceof Cancelled)) throw e;
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="l-demo" ref={root} aria-label="Animated demo: Sift looks up Acme and shows its fit, why now and best contacts">
      <div className="l-chrome">
        <span className="l-dots" aria-hidden><i /><i /><i /></span>
        <span className="l-url">acme.example</span>
        <span className={`l-ext ${pressed ? 'on' : ''} ${iconDown ? 'l-pressed' : ''}`} ref={ext} title="Sift">
          <img src={icon32} alt="" width="18" height="18" />
        </span>
      </div>
      <div className={`l-viewport ${open ? 'focus' : ''}`}>
        <FakeSite />
        <div className={`l-panel ${open ? 'open' : ''}`} aria-hidden={!open}>
          <div className="l-panel-head">
            <img src={icon32} alt="" width="16" height="16" /> Sift
          </div>
          <div className="l-panel-body" ref={body}>
            <App />
          </div>
        </div>
      </div>
      <div className="l-cursor" ref={cursor} aria-hidden>
        <svg width="18" height="22" viewBox="0 0 18 22">
          <path d="M1 1 L1 17 L5.2 13.2 L8 20 L11 18.8 L8.3 12.2 L14 12.2 Z" fill="#26282b" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
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
