import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { ContactPicker } from '@/components/ContactPicker';
import { FitCard, ProfileCard, WhyNowCard } from '@/entrypoints/sidepanel/App';
import type { LookupResult } from '@/lib/types';
import icon48 from '../public/icon/48.png';
import { Demo } from './Demo';
import { acme, acmeRevealed } from './demo-data';

const REPO = 'https://github.com/Aditya-v05/extens';
const INSTALL = `${REPO}#install`;
const PRIVACY = `${REPO}/blob/main/PRIVACY.md`;
const LOG = `${REPO}/blob/main/log.md`;
const MAKER = 'https://github.com/Aditya-v05';
const ISSUES = `${REPO}/issues`;

// three.js is most of the page's script; load it after the text has painted.
const fx = () => import('./fx');
const LazyVortex = lazy(() => fx().then((m) => ({ default: m.Vortex })));
const LazyBlinds = lazy(() => fx().then((m) => ({ default: m.Blinds })));
const LazySlats = lazy(() => fx().then((m) => ({ default: m.Slats })));

/** Sections fade up as they enter the viewport, once. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -12% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  useReveal();
  return (
    <div className="l-page">
      <Nav />
      <main id="top">
        <Hero />
        <section className="l-demo-wrap l-wrap" data-reveal>
          <Eyebrow label="Watch it read a homepage" />
          <Demo />
        </section>
        <Answers />
        <After />
        <Costs />
        <Privacy />
        <Faq />
      </main>
      <End />
    </div>
  );
}

/** Section label: the sieve glyph, the question, and (for the answers) the score the card below shows. */
function Eyebrow({ label, score, dark }: { label: string; score?: string; dark?: boolean }) {
  return (
    <p className={`l-eyebrow ${dark ? 'dark' : ''}`}>
      <i className="l-glyph" aria-hidden /> {label}
      {score && <b>{score}</b>}
    </p>
  );
}

// ---------- nav: a full-width bar; a mint line reads how far down the page you are ----------

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const line = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.6);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      line.current?.style.setProperty('transform', `scaleX(${max > 0 ? window.scrollY / max : 0})`);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`l-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="l-nav-in">
        <a className="l-brand" href="#top">
          <img src={icon48} alt="" width="24" height="24" />
          Sift
        </a>
        <nav>
          <a href="#answers">How it works</a>
          <a href="#costs">Costs</a>
          <a href="#privacy">Privacy</a>
          <a href={REPO}>GitHub</a>
        </nav>
        <a className="l-pill" href={INSTALL}>Install</a>
      </div>
      <span className="l-progress" ref={line} aria-hidden />
    </header>
  );
}

// ---------- hero: the vortex, big and centred; the headline under it ----------

/** The outline wordmark behind the swirl, and the selection point where the few worth your time end up. */
const Core = () => (
  <>
    <div className="l-wordmark" aria-hidden>SIFT</div>
    <div className="l-core" aria-hidden />
  </>
);

function Hero() {
  return (
    <section className="l-hero">
      <Suspense fallback={<div className="l-vortex"><Core /></div>}>
        <LazyVortex><Core /></LazyVortex>
      </Suspense>
      <div className="l-hero-copy">
        <h1>
          Know who's worth <em>talking to.</em>
        </h1>
        <p className="l-lede">
          Sift qualifies any company you visit, finds why they matter now, and surfaces the right person to contact. One click,
          on your own Apollo and Jev keys.
        </p>
        <div className="l-ctas">
          <a className="l-btn mint" href={INSTALL}>Install from GitHub</a>
          <a className="l-btn glass" href="#answers">See how it works</a>
        </div>
      </div>
    </section>
  );
}

// ---------- the four answers, each shown with the real panel part ----------

const fromProfile: LookupResult = {
  ...acmeRevealed,
  profile: { apolloId: 'p2', url: 'https://www.linkedin.com/in/jonas-berg' },
  contacts: acmeRevealed.contacts!.map((c) =>
    c.apolloId === 'p2' ? { ...c, lastName: 'Berg', headline: 'Head of Support at Acme', email: 'jonas.berg@acme.example', emailStatus: 'verified', revealedAt: Date.now() } : c,
  ),
};
const noop = async () => ({ revealed: 0, noEmail: 0, failed: 0, error: null });

function Answer({ score, eyebrow, title, children, visual, tint, flip }: {
  score: string; eyebrow: string; title: ReactNode; children: ReactNode; visual: ReactNode; tint: string; flip?: boolean;
}) {
  return (
    <article className={`l-answer ${flip ? 'flip' : ''}`} data-reveal>
      <div className="l-answer-copy">
        <Eyebrow label={eyebrow} score={score} />
        <h2>{title}</h2>
        {children}
      </div>
      <div className={`l-stagecard ${tint}`}>{visual}</div>
    </article>
  );
}

function Answers() {
  return (
    <section id="answers" className="l-answers l-wrap">
      <div className="l-section-head" data-reveal>
        <h2>One click. <em>Four answers.</em></h2>
        <p>The side panel reads the company for you while you're still on their homepage. These are its real parts.</p>
      </div>

      <Answer
        score="90" eyebrow="Does it fit?" tint="mint"
        title={<>Scored against <em>your</em> requirements.</>}
        visual={<div className="l-ui"><FitCard fit={acme.fit!} /></div>}
      >
        <p>Company size and location are checked exactly; everything else by Jev. A near miss counts half, and an unsure answer says so. The number always adds up.</p>
        <ul className="l-points"><li>75% your requirements, 25% overall judgment</li><li>Every check shown, never hidden in the score</li></ul>
      </Answer>

      <Answer
        score="74" eyebrow="Why now?" tint="sand" flip
        title={<>Reasons to reach out <em>this week.</em></>}
        visual={
          <div className="l-ui-stack">
            <div className="l-ui"><WhyNowCard whyNow={acme.whyNow!} /></div>
            <div className="l-float quote">
              <span className="l-mono">acme.example/pricing</span>
              "SSO, SCIM and audit logs on the new Enterprise plan"
            </div>
          </div>
        }
      >
        <p>Hiring for the roles your product serves, headcount growth, fresh funding, and what their own site says. Every signal links to where it came from.</p>
        <ul className="l-points"><li>Labels written by Sift, quotes taken word for word</li><li>Relevance judged against what you sell</li></ul>
      </Answer>

      <Answer
        score="92" eyebrow="Who to email?" tint="peach"
        title={<>The person who <em>owns the problem.</em></>}
        visual={<div className="l-ui contacts"><ContactPicker contacts={acmeRevealed.contacts!} reveal={noop} /></div>}
      >
        <p>Senior people first, then the leads who actually run the team at smaller companies, ranked by how likely they own what you solve. When two are equally good, you see both.</p>
        <ul className="l-points"><li>Reveal one email, or all of them, with the cost shown first</li><li>Finding people is free</li></ul>
      </Answer>

      <Answer
        score="88" eyebrow="On LinkedIn too" tint="fog" flip
        title={<>From a profile to <em>a verdict.</em></>}
        visual={
          <div className="l-li">
            <div className="l-li-card">
              <span className="l-mono">linkedin.com/in/jonas-berg</span>
              <strong>Jonas Berg</strong>
              <span>Head of Support at Acme</span>
            </div>
            <svg className="l-li-arrow" viewBox="0 0 60 20" aria-hidden><path d="M2 10 H52 M44 3 L54 10 L44 17" /></svg>
            <div className="l-ui"><ProfileCard result={fromProfile} /></div>
          </div>
        }
      >
        <p>Click Sift on someone's profile. It works out who they are from the address alone, then shows their company's fit and where they rank among the people there.</p>
        <ul className="l-points"><li>1 credit, their email included</li><li>Never reads LinkedIn's pages</li></ul>
      </Answer>
    </section>
  );
}

// ---------- after the click: one dark card, one light ----------

function After() {
  return (
    <section className="l-after l-wrap" data-reveal>
      <div className="l-tile dark">
        <Eyebrow label="My Accounts" dark />
        <h3>Every company you save, ranked.</h3>
        <p>By fit and timing, with a status, a note and CSV export. Refresh any account for 2 credits.</p>
        <div className="l-mini-rows" aria-hidden>
          {[['Acme', 90, 74], ['Northwind', 81, 52], ['Harbor', 64, 70]].map(([n, f, t]) => (
            <div key={n as string}><span>{n}</span><span className="l-bar"><i style={{ width: `${f}%` }} /></span><b>{Math.round(0.6 * (f as number) + 0.4 * (t as number))}</b></div>
          ))}
        </div>
      </div>
      <div className="l-tile light">
        <Eyebrow label="Discover" />
        <h3>Fifty more like your best accounts.</h3>
        <p>Apollo's lookalike search, filtered by your ideal customer, for one credit. Look up the ones you like.</p>
        <div className="l-mini-chips" aria-hidden>
          {['lumen.example', 'kettle.example', 'fjordly.example', 'northwind.example', 'harbor.example'].map((c) => <span key={c}>{c}</span>)}
        </div>
      </div>
    </section>
  );
}

// ---------- costs ----------

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      if (reduced || to === 0) return setN(to);
      const start = performance.now();
      const tick = (t: number) => {
        const k = Math.min((t - start) / 800, 1);
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(node);
    return () => io.disconnect();
  }, [to]);
  return <span ref={el}>{n}</span>;
}

function Costs() {
  const lines = [
    { n: 2, what: 'Look up a new company', note: '1 for the company, 1 for its job postings. Free again for 7 days.' },
    { n: 0, what: 'Find the people', note: "Apollo's people search costs nothing." },
    { n: 1, what: 'Reveal an email', note: 'Only charged when Apollo finds the person.' },
    { n: 1, what: 'Look up a LinkedIn profile', note: 'Email included. Free again for 30 days.' },
  ];
  return (
    <section id="costs" className="l-costs l-wrap">
      <div className="l-costs-head" data-reveal>
        <Eyebrow label="Costs" />
        <h2>It costs <em>what it says.</em></h2>
        <p>Sift spends your Apollo credits and puts the price on every button. Set a monthly budget and it asks before going over.</p>
      </div>
      <div className="l-receipt" data-reveal>
        <div className="l-receipt-top"><span>Apollo credits</span><span>per action</span></div>
        {lines.map((l) => (
          <div key={l.what} className="l-receipt-line">
            <div>
              <div className="l-receipt-what">{l.what}<i aria-hidden /></div>
              <p>{l.note}</p>
            </div>
            <div className="l-receipt-n"><CountUp to={l.n} /></div>
          </div>
        ))}
        <div className="l-receipt-foot"><span>Sift's own fee</span><b>0</b></div>
      </div>
    </section>
  );
}

// ---------- privacy: a dark band ----------

function Privacy() {
  return (
    <section id="privacy" className="l-privacy">
      <Suspense fallback={null}><LazyBlinds /></Suspense>
      <div className="l-wrap l-privacy-in" data-reveal>
        <div>
          <Eyebrow label="Privacy" dark />
          <h2>Your keys. Your browser. <em>Nothing in between.</em></h2>
          <ul>
            <li>No Sift server, no account, no analytics.</li>
            <li>Keys, profile and saved accounts stay in Chrome's local storage.</li>
            <li>Sift reads a site only when you click its icon there. On LinkedIn, only the address.</li>
          </ul>
          <a className="l-btn glass" href={PRIVACY}>Read the privacy policy</a>
        </div>
        <svg className="l-diagram" viewBox="0 0 440 300" role="img" aria-label="Your browser talks directly to Apollo and TypeSafe; there is no Sift server in between">
          <path className="flow" d="M150 150 C 230 150, 250 70, 330 70" />
          <path className="flow" d="M150 150 C 230 150, 250 230, 330 230" />
          <g className="node you"><circle cx="110" cy="150" r="42" /><text x="110" y="146">Your</text><text x="110" y="162">browser</text></g>
          <g className="node"><circle cx="366" cy="70" r="36" /><text x="366" y="75">Apollo</text></g>
          <g className="node"><circle cx="366" cy="230" r="36" /><text x="366" y="235">TypeSafe</text></g>
          <g className="gone"><circle cx="280" cy="150" r="22" /><text x="280" y="154">Sift</text><text x="280" y="190" className="gone-label">no server</text></g>
        </svg>
      </div>
    </section>
  );
}

// ---------- questions ----------

function Faq() {
  const qs: [string, string][] = [
    ['What do I need?', 'Chrome, an Apollo account with an API key, and a TypeSafe API key for Jev.'],
    ['What is Jev?', "TypeSafe's decision model. It answers typed questions (yes or no, pick one, a score) with probabilities instead of writing text. That is why Sift's reasons are checks and quotes, never made-up prose."],
    ['How is the fit score worked out?', "75% your requirements, each one counted (a near miss counts half), and 25% Jev's overall judgment of the company."],
    ['Does it work on LinkedIn?', "Yes, on people's profiles. Sift sends only the profile's address to Apollo to find out who they are. It never reads LinkedIn's pages."],
    ['Can it find phone numbers?', 'Not yet. Apollo delivers phone numbers to a server, and Sift deliberately has none.'],
  ];
  return (
    <section className="l-faq l-wrap" data-reveal>
      <div>
        <Eyebrow label="Questions" />
        <h2>Good <em>questions.</em></h2>
      </div>
      <div>
        {qs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------- the end: one night block, closing line on top, footer over a sea of slats ----------

function End() {
  return (
    <footer className="l-end">
      <div className="l-end-copy l-wrap" data-reveal>
        <h2>Sift the next company <em>you visit.</em></h2>
        <div className="l-ctas">
          <a className="l-btn mint" href={INSTALL}>Install from GitHub</a>
          <a className="l-btn glass" href={REPO}>Read the source</a>
        </div>
      </div>
      <div className="l-wrap l-maker" data-reveal>
        <img src={`${MAKER}.png?size=112`} alt="" width="56" height="56" loading="lazy" />
        <div className="l-maker-who">
          <span className="l-mono">Made by</span>
          <strong>Aditya-v05</strong>
          <p>A GTM engineer building Sift in the open. Ideas, bugs, or just want to say hi? I read everything.</p>
        </div>
        <div className="l-maker-links">
          <a className="l-btn glass" href={MAKER}>GitHub profile</a>
          <a className="l-btn glass" href={ISSUES}>Open an issue</a>
        </div>
      </div>
      <div className="l-wrap l-footer-top">
        <div className="l-footer-brand">
          <a className="l-brand" href="#top"><img src={icon48} alt="" width="26" height="26" /> Sift</a>
          <p>Know who's worth talking to. Open source, on your own keys.</p>
        </div>
        <div className="l-footer-cols">
          <div>
            <h4>Product</h4>
            <a href="#answers">How it works</a>
            <a href="#costs">Costs</a>
            <a href={INSTALL}>Install</a>
          </div>
          <div>
            <h4>Project</h4>
            <a href={REPO}>GitHub</a>
            <a href={LOG}>Changelog</a>
            <a href={`${REPO}/blob/main/LICENSE`}>MIT license</a>
          </div>
          <div>
            <h4>Trust</h4>
            <a href={PRIVACY}>Privacy policy</a>
            <a href="#privacy">No server</a>
          </div>
        </div>
      </div>
      <div className="l-sea">
        <Suspense fallback={null}><LazySlats /></Suspense>
      </div>
      <div className="l-wrap l-footer-base">
        <span>Built on Apollo and TypeSafe Jev. Not affiliated with either.</span>
        <span>2026</span>
      </div>
    </footer>
  );
}
