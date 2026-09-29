import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import icon48 from '../public/icon/48.png';
import { Demo } from './Demo';

// three.js is most of the page's script; load it after the text has painted.
const LazyField = lazy(() => import('./SiftField').then((m) => ({ default: m.SiftField })));
const SiftField = (props: { count?: number; sieve?: number; centerX?: number }) => (
  <Suspense fallback={null}>
    <LazyField {...props} />
  </Suspense>
);

const REPO = 'https://github.com/Aditya-v05/extens';
const INSTALL = `${REPO}#install`;
const PRIVACY = `${REPO}/blob/main/PRIVACY.md`;

export default function Landing() {
  const [onDark, setOnDark] = useState(true);
  const hero = useRef<HTMLElement>(null);

  // The bar is dark over the hero, then turns into a light blurred bar over the rest of the page.
  useEffect(() => {
    const el = hero.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnDark(!!e && e.intersectionRatio > 0.12), { threshold: [0, 0.12, 0.3] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="l-page">
      <header className={`l-header ${onDark ? 'dark' : 'light'}`}>
        <div className="l-header-in">
          <a className="l-brand" href="#top">
            <img src={icon48} alt="" width="26" height="26" />
            Sift
          </a>
          <nav className="l-nav">
            <a href="#how">How it works</a>
            <a href="#costs">Costs</a>
            <a href="#privacy">Privacy</a>
            <a href={REPO}>GitHub</a>
          </nav>
          <a className="l-nav-cta" href={INSTALL}>Install</a>
        </div>
      </header>

      <main id="top">
        <section className="l-hero" ref={hero}>
          <SiftField />
          <div className="l-hero-copy">
            <p className="l-kicker">A Chrome extension for outbound</p>
            <h1>Know who's worth talking to.</h1>
            <p className="l-lede">
              Sift qualifies any company you visit, finds why they matter now, and surfaces the right person to contact. One
              click, on your own Apollo and Jev keys.
            </p>
            <div className="l-ctas">
              <a className="l-button" href={INSTALL}>Install from GitHub</a>
              <a className="l-link" href="#how">See how it works</a>
            </div>
            <p className="l-note">Free and open source. Chrome Web Store coming soon.</p>
          </div>
        </section>

        <section className="l-stage" aria-label="Demo">
          <Demo />
        </section>

        <Story />

        <section className="l-after l-wrap">
          <h2>And after the click</h2>
          <div className="l-after-cols">
            <div>
              <h3>My Accounts</h3>
              <p>Every company you save, ranked by fit and timing, with a status, a note and one-click CSV export.</p>
            </div>
            <div>
              <h3>Discover</h3>
              <p>Fifty companies like your best accounts, already filtered by your ideal customer, for one credit.</p>
            </div>
            <div>
              <h3>Who to look for</h3>
              <p>Your titles, seniority and keywords decide who gets found, so the lead who really runs the team isn't missed.</p>
            </div>
          </div>
        </section>

        <Costs />
        <Privacy />
        <Faq />

        <section className="l-closing">
          <SiftField count={1600} sieve={-0.35} centerX={0} />
          <div className="l-closing-copy">
            <h2>Sift the next company you visit.</h2>
            <div className="l-ctas center">
              <a className="l-button" href={INSTALL}>Install from GitHub</a>
              <a className="l-link" href={REPO}>Read the source</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-footer l-wrap">
        <span className="l-brand small">
          <img src={icon48} alt="" width="18" height="18" /> Sift
        </span>
        <span className="l-footer-links">
          <a href={REPO}>GitHub</a>
          <a href={PRIVACY}>Privacy</a>
          <span>MIT licensed</span>
        </span>
      </footer>
    </div>
  );
}

// ---------- scroll story: the real panel follows the step you're reading ----------

const STEPS = [
  {
    id: 'fit',
    title: 'Does it fit?',
    body: 'Your own requirements, checked one by one: company size and location exactly, everything else by Jev. Near misses and unsure answers are marked as such, so the score adds up.',
  },
  {
    id: 'why',
    title: 'Why now?',
    body: "Hiring for the roles your product serves, headcount growth, fresh funding, and what their own site says: an enterprise plan, SOC 2, a new product. Every signal links to where it came from.",
  },
  {
    id: 'who',
    title: 'Who to email?',
    body: 'Senior people first, then the leads who actually run the team at smaller companies, ranked by how likely they own the problem you solve. Reveal one email, or all of them.',
  },
  {
    id: 'linkedin',
    title: 'On LinkedIn too.',
    body: "Click Sift on someone's profile. It finds out who they are from the address alone, shows their company's fit, and where they rank among the people there.",
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

function Story() {
  const [active, setActive] = useState<StepId>('fit');
  const frame = useRef<HTMLIFrameElement>(null);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.step as StepId);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ siftStep: active }, location.origin);
  }, [active]);

  return (
    <section id="how" className="l-story l-wrap">
      <div className="l-story-head">
        <h2>One click. Four answers.</h2>
        <p>The side panel reads the company for you while you're still on their homepage.</p>
      </div>
      <div className="l-story-body">
        <ol className="l-steps">
          {STEPS.map((s, i) => (
            <li key={s.id} data-step={s.id} ref={(el) => void (refs.current[i] = el)} className={active === s.id ? 'on' : ''}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="l-story-panel">
          <div className="l-story-frame">
            <div className="l-panel-head">
              <img src={icon48} alt="" width="16" height="16" /> Sift
            </div>
            <iframe
              ref={frame}
              src="/panel.html"
              title="Sift side panel"
              loading="lazy"
              onLoad={() => frame.current?.contentWindow?.postMessage({ siftStep: active }, location.origin)}
            />
          </div>
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
        const k = Math.min((t - start) / 700, 1);
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
  const items = [
    { n: 2, unit: 'credits', what: 'to look up a new company', note: '1 for the company, 1 for its job postings. Revisits within 7 days are free.' },
    { n: 0, unit: 'credits', what: 'to find the people', note: "Apollo's people search costs nothing." },
    { n: 1, unit: 'credit', what: 'per email you reveal', note: 'Only charged when Apollo finds the person.' },
    { n: 1, unit: 'credit', what: 'per LinkedIn profile', note: 'Identifies the person, email included. Free again for 30 days.' },
  ];
  return (
    <section id="costs" className="l-costs l-wrap">
      <h2>It costs what it says.</h2>
      <p className="l-sub">Sift spends your Apollo credits and shows the price on every button. Set a monthly budget and it asks before going over.</p>
      <div className="l-cost-grid">
        {items.map((i) => (
          <div key={i.what} className="l-cost">
            <div className="l-cost-n"><CountUp to={i.n} /></div>
            <div className="l-cost-what">{i.unit} {i.what}</div>
            <p>{i.note}</p>
          </div>
        ))}
      </div>
      <p className="l-small">Jev's judgments cost well under a cent per lookup on your TypeSafe key. Discover costs 1 credit for 50 suggestions.</p>
    </section>
  );
}

// ---------- privacy: who talks to whom ----------

function Privacy() {
  return (
    <section id="privacy" className="l-privacy l-wrap">
      <div className="l-privacy-copy">
        <h2>Your keys. Your browser. Nothing in between.</h2>
        <ul>
          <li>No Sift server, no account, no analytics.</li>
          <li>Keys, profile and saved accounts stay in Chrome's local storage.</li>
          <li>Sift reads a website only when you click its icon there. On LinkedIn it uses only the address.</li>
        </ul>
        <a className="l-link" href={PRIVACY}>Read the privacy policy</a>
      </div>
      <svg className="l-diagram" viewBox="0 0 440 300" role="img" aria-label="Your browser talks directly to Apollo and TypeSafe; there is no Sift server in between">
        <path className="flow" d="M150 150 C 230 150, 250 70, 330 70" />
        <path className="flow" d="M150 150 C 230 150, 250 230, 330 230" />
        <g className="node you"><circle cx="110" cy="150" r="40" /><text x="110" y="146">Your</text><text x="110" y="162">browser</text></g>
        <g className="node"><circle cx="366" cy="70" r="36" /><text x="366" y="75">Apollo</text></g>
        <g className="node"><circle cx="366" cy="230" r="36" /><text x="366" y="235">TypeSafe</text></g>
        <g className="gone"><circle cx="280" cy="150" r="22" /><text x="280" y="154">Sift</text><text x="280" y="190" className="gone-label">no server</text></g>
      </svg>
    </section>
  );
}

// ---------- questions ----------

function Faq() {
  const qs: [string, string][] = [
    ['What do I need?', 'Chrome, an Apollo account with an API key, and a TypeSafe API key for Jev.'],
    ['What is Jev?', "TypeSafe's decision model. It answers typed questions (yes or no, pick one, a score) with probabilities instead of writing text. That is why Sift's reasons are checks and quotes, never made-up prose."],
    ['How is the fit score worked out?', "75% your requirements, each one counted (a near miss counts half), and 25% Jev's overall judgment of the company."],
    ['Does it work on LinkedIn?', "Yes, on people's profiles. Sift sends only the profile's address to Apollo to find out who they are, then shows their company's fit and where they rank. It never reads LinkedIn's pages."],
    ['Can it find phone numbers?', 'Not yet. Apollo delivers phone numbers to a server, and Sift deliberately has none.'],
  ];
  return (
    <section className="l-faq l-wrap">
      <h2>Questions</h2>
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
