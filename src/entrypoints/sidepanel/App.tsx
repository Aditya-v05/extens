import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { CreditBar } from '@/components/CreditBar';
import { ago, pct } from '@/components/format';
import { ContactPicker } from '@/components/ContactPicker';
import { RequirementStrip, StateIcon } from '@/components/Icon';
import { checkState, checksSummary, upgradeFit } from '@/lib/mapping';
import { useCredits } from '@/components/useCredits';
import { lookupCost } from '@/lib/credits';
import { describeError } from '@/lib/errors';
import { openAccounts, send } from '@/lib/messages';
import { normalizeDomainInput } from '@/lib/resolver';
import * as store from '@/lib/storage';
import type { Check, LookupResult, Signal, ViewState, WhyNow } from '@/lib/types';
import './panel.css';

const LOW_FIT = 40;

export default function App() {
  const [windowId, setWindowId] = useState<number | null>(null);
  const [view, setView] = useState<ViewState>({ status: 'idle' });

  useEffect(() => {
    let off = () => {};
    browser.windows.getCurrent().then(async (w) => {
      const id = w.id!;
      setWindowId(id);
      setView(await store.getView(id));
      off = store.onViewChange(id, setView);
    });
    return () => off();
  }, []);

  const credits = useCredits();
  const cost = lookupCost(credits.settings);
  const openSettings = () => browser.runtime.openOptionsPage();

  const lookup: Lookup = (domain, force = false, allowOverBudget = false) => {
    if (windowId !== null) send({ type: 'lookup', windowId, domain, force, allowOverBudget });
  };

  return (
    <main className="panel">
      {view.status !== 'needs_setup' && <CreditBar credits={credits} onSettings={openSettings} />}
      <Body view={view} windowId={windowId} lookup={lookup} cost={cost} />
      <footer className="row spread small muted">
        <button className="link small" onClick={() => openAccounts()}>My Accounts</button>
        <button className="link small" onClick={() => browser.runtime.openOptionsPage()}>Settings</button>
      </footer>
    </main>
  );
}

type Lookup = (domain: string, force?: boolean, allowOverBudget?: boolean) => void;

function Body({ view, windowId, lookup, cost }: { view: ViewState; windowId: number | null; lookup: Lookup; cost: number }) {
  switch (view.status) {
    case 'idle':
      return (
        <Empty title="Open a company's website" body="Then click the Sift icon in your toolbar, or press Alt+Shift+S (⌥⇧S on a Mac).">
          <DomainInput onSubmit={(d) => lookup(d)} cost={cost} />
        </Empty>
      );
    case 'needs_setup':
      return (
        <Empty
          title="Set up in 2 minutes"
          body={view.missing.includes('keys') ? 'Add your Apollo and Jev keys, then describe what you sell.' : 'Describe what you sell and who you sell to.'}
        >
          <button className="primary" onClick={() => browser.runtime.openOptionsPage()}>Open setup</button>
        </Empty>
      );
    case 'not_company':
      return (
        <Empty title="This isn't a company website" body="Open a company's site and click the icon again, or type a domain.">
          <DomainInput onSubmit={(d) => lookup(d)} cost={cost} />
        </Empty>
      );
    case 'not_found':
      return (
        <Empty title={`Apollo doesn't know ${view.domain}`} body="Try the company's main domain.">
          <DomainInput onSubmit={(d) => lookup(d)} cost={cost} />
        </Empty>
      );
    case 'over_budget':
      return (
        <Empty
          title="Monthly credit budget reached"
          body={`Sift has used ${view.spent} of your ${view.budget}-credit budget this month. Looking up ${view.domain} costs ${view.cost} more.`}
        >
          <div className="row">
            <button className="primary" onClick={() => lookup(view.domain, false, true)}>Look up anyway</button>
            <button onClick={() => browser.runtime.openOptionsPage()}>Change budget</button>
          </div>
        </Empty>
      );
    case 'loading':
      return <ResultView domain={view.domain} result={view.partial} loadingStage={view.stage} windowId={windowId} lookup={lookup} cost={cost} />;
    case 'error':
      return (
        <div className="stack">
          <div className="notice error">
            <div>{describeError(view.error)}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => lookup(view.domain, true)}>Retry</button>
              {view.error.invalidKey && <button onClick={() => browser.runtime.openOptionsPage()}>Open Settings</button>}
            </div>
          </div>
          {view.partial && <ResultView domain={view.domain} result={view.partial} windowId={windowId} lookup={lookup} cost={cost} />}
        </div>
      );
    case 'done':
      return <ResultView domain={view.domain} result={view.result} cached={view.cached} windowId={windowId} lookup={lookup} cost={cost} />;
  }
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="empty stack">
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      {children}
    </div>
  );
}

function DomainInput({ onSubmit, cost }: { onSubmit: (domain: string) => void; cost: number }) {
  const [value, setValue] = useState('');
  const domain = normalizeDomainInput(value);
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (domain) onSubmit(domain);
      }}
    >
      <input placeholder="acme.com" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit" disabled={!domain} title={`Uncached lookups cost ${cost} Apollo credits`}>Look up ({cost} cr)</button>
    </form>
  );
}

// ---------- result ----------

interface ResultProps {
  domain: string;
  result: LookupResult | null;
  loadingStage?: 'company' | 'judging' | 'ranking' | 'done';
  cached?: boolean;
  windowId: number | null;
  lookup: Lookup;
  cost: number;
}

function ResultView({ domain, result, loadingStage, cached, windowId, lookup, cost }: ResultProps) {
  const loading = loadingStage !== undefined;
  if (!result) return <CompanySkeleton domain={domain} />;
  const { company, persona, contacts } = result;
  const fit = upgradeFit(result.fit); // results shown before requirement-based scoring
  return (
    <div className="stack">
      <header className="company">
        {company.logo ? <img src={company.logo} alt="" className="logo" /> : <div className="logo placeholder">{company.name[0]}</div>}
        <div className="grow">
          <h1>{company.name}</h1>
          <div className="small muted">{company.domain}</div>
          <div className="small muted">
            {[company.headcount && `${company.headcount.toLocaleString('en-US')} employees`, company.fundingStage, company.industry]
              .filter(Boolean)
              .join(', ')}
          </div>
        </div>
        {!loading && <SaveButton result={result} />}
      </header>

      {fit ? <FitCard fit={fit} /> : loading && <SectionSkeleton label="Checking ICP fit" />}

      {result.whyNow ? (
        <WhyNowCard whyNow={result.whyNow} />
      ) : loading ? (
        fit && <SectionSkeleton label="Checking why now" />
      ) : (
        result.whyNow === undefined && <div className="small muted">Refresh to check why now.</div>
      )}

      {persona && (
        <div className="small persona">
          <span className="muted">Best persona </span>
          {persona.chosen ? <strong>{persona.chosen}</strong> : <strong>none of your personas fit</strong>}
          {persona.chosen && <span className="muted"> ({pct(persona.distribution[persona.chosen] ?? persona.confidence)})</span>}
        </div>
      )}

      {contacts ? (
        <Contacts result={result} ranking={loadingStage === 'ranking'} windowId={windowId} lowFit={!!fit && fit.score < LOW_FIT} />
      ) : (
        loading && <SectionSkeleton label="Finding people" />
      )}

      {!loading && (
        <div className="row spread small muted">
          <span>{cached ? `Updated ${ago(result.fetchedAt)}` : 'Just updated'}</span>
          <button className="link small" onClick={() => lookup(domain, true)}>Refresh ({cost} credit{cost === 1 ? '' : 's'})</button>
        </div>
      )}
    </div>
  );
}

function FitCard({ fit }: { fit: NonNullable<LookupResult['fit']> }) {
  const tone = fit.score >= 70 ? 'good' : fit.score >= LOW_FIT ? 'warn' : 'bad';
  const word = fit.score >= 70 ? 'Strong fit' : fit.score >= LOW_FIT ? 'Partial fit' : 'Weak fit';
  const explained = fit.requirements !== undefined && fit.requirements !== null && fit.overall !== undefined;
  return (
    <section className="fit">
      <div className="row spread fit-head">
        <div className="score" aria-label={`ICP match ${fit.score} percent`}>
          {fit.score}<span className="unit">%</span>
        </div>
        <span className={`pill ${tone}`}>{word}</span>
      </div>
      <RequirementStrip states={fit.checks.map(checkState)} />
      <p className="small muted fit-why">
        {fit.checks.length ? `${checksSummary(fit.checks)}.` : 'No requirements set.'}
        {explained && ` Overall judgment ${fit.overall}.`}
      </p>
      {fit.checks.length > 0 && (
        <ul className="checks">
          {fit.checks.map((c, i) => <CheckRow key={i} check={c} />)}
        </ul>
      )}
    </section>
  );
}

const RELEVANT = 0.5;
const signalKey = (s: Signal) => `${s.kind}:${s.siteType ?? ''}`;

function WhyNowCard({ whyNow }: { whyNow: WhyNow }) {
  const [showOthers, setShowOthers] = useState(false);
  const relevant = whyNow.signals.filter((s) => s.relevance >= RELEVANT);
  const others = whyNow.signals.filter((s) => s.relevance < RELEVANT);
  const t = whyNow.timing;
  const [tone, word] = t === null ? ['', 'No signals'] : t >= 67 ? ['good', 'Hot'] : t >= 34 ? ['warn', 'Warm'] : ['', 'Quiet'];
  return (
    <section className="section stack">
      <div className="row spread">
        <h2>Why now</h2>
        <span className="row small">
          {t !== null && <span className="muted">Timing {t}</span>}
          <span className={`pill ${tone}`}>{word}</span>
        </span>
      </div>
      {relevant.length ? (
        <ul className="signals">{relevant.map((s) => <SignalRow key={signalKey(s)} signal={s} />)}</ul>
      ) : (
        <div className="small muted">
          {whyNow.signals.length ? 'Nothing here looks especially relevant to what you sell.' : 'No timing signals found in Apollo.'}
        </div>
      )}
      {others.length > 0 && (
        <>
          <button className="link small" onClick={() => setShowOthers(!showOthers)}>
            {showOthers ? 'Hide' : 'Show'} {others.length} less relevant signal{others.length === 1 ? '' : 's'}
          </button>
          {showOthers && <ul className="signals dim">{others.map((s) => <SignalRow key={signalKey(s)} signal={s} />)}</ul>}
        </>
      )}
      {whyNow.jobsStatus === 'unavailable' && <div className="small muted">Job postings aren't available on this Apollo key.</div>}
      {whyNow.jobsStatus === 'off' && <div className="small muted">Hiring signals are off in Settings (saves 1 credit per lookup).</div>}
      {whyNow.siteStatus === 'unavailable' && (
        <div className="small muted">Website not read: click the toolbar icon while on the company's site to include it.</div>
      )}
    </section>
  );
}

function SignalRow({ signal: s }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const links = s.evidence.filter((e) => e.url);
  if (s.kind === 'site') return <SiteSignalRow signal={s} />;
  return (
    <li>
      <div className="grow">
        <div className="row spread">
          <strong>{s.label}</strong>
          <span className="small muted" title="How relevant this is to what you sell">{pct(s.relevance)}</span>
        </div>
        {s.detail && <div className="small muted">{s.detail}</div>}
        {s.kind === 'hiring' && links.length > 0 ? (
          <>
            <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Hide roles' : `See ${links.length} role${links.length === 1 ? '' : 's'}`}</button>
            {open && (
              <ul className="evidence small">
                {links.map((e, i) => <li key={i}><a href={e.url!} target="_blank" rel="noreferrer">{e.label}</a></li>)}
              </ul>
            )}
          </>
        ) : (
          links[0] && <a className="small" href={links[0].url!} target="_blank" rel="noreferrer">Source</a>
        )}
      </div>
    </li>
  );
}

/** Website signals quote the page's own words and link to where they were found. */
function SiteSignalRow({ signal: s }: { signal: Signal }) {
  const [open, setOpen] = useState(false);
  const [first, ...more] = s.evidence;
  return (
    <li>
      <div className="grow">
        <div className="row spread">
          <strong>{s.label}</strong>
          <span className="small muted">from their site</span>
          <span className="grow" />
          <span className="small muted" title="How relevant this is to what you sell">{pct(s.relevance)}</span>
        </div>
        {first && <Quote evidence={first} />}
        {more.length > 0 && (
          <>
            <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Hide' : `${more.length} more from their site`}</button>
            {open && more.map((e, i) => <Quote key={i} evidence={e} />)}
          </>
        )}
      </div>
    </li>
  );
}

function Quote({ evidence: e }: { evidence: Signal['evidence'][number] }) {
  const path = e.url ? new URL(e.url).pathname.replace(/\/$/, '') || '/' : null;
  return (
    <div className="quote small">
      <span>“{e.label}”</span>
      <span className="muted">
        {' '}
        {e.url && <a href={e.url} target="_blank" rel="noreferrer">{path}</a>}
        {e.date && `, ${new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`}
      </span>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const state = checkState(check);
  const detail = check.detail ?? (check.p !== undefined ? pct(check.p) : undefined);
  return (
    <li>
      <StateIcon state={state} />
      <span className="grow">{check.label}</span>
      {detail && <span className={`small ${state === 'near' || state === 'unsure' ? 'state-near' : 'muted'}`}>{detail}</span>}
    </li>
  );
}

function Contacts({ result, ranking, windowId, lowFit }: { result: LookupResult; ranking: boolean; windowId: number | null; lowFit: boolean }) {
  const [showAnyway, setShowAnyway] = useState(false);
  const contacts = result.contacts ?? [];
  if (lowFit && !showAnyway) {
    return (
      <button className="link" onClick={() => setShowAnyway(true)}>
        Show {contacts.length} contact{contacts.length === 1 ? '' : 's'} anyway
      </button>
    );
  }
  if (!contacts.length) {
    return <div className="notice">No contacts found at this company in Apollo.</div>;
  }
  const reveal = (personIds: string[]) => send({ type: 'reveal', windowId, domain: result.domain, personIds });
  return (
    <section className="stack contacts">
      {result.contactsFallback && (
        <div className="notice small">No one matched your persona titles, so these are senior people instead.</div>
      )}
      {ranking ? <p className="small muted">Ranking contacts…</p> : <ContactPicker contacts={contacts} reveal={reveal} />}
    </section>
  );
}

function SaveButton({ result }: { result: LookupResult }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    store.getSaved().then((s) => setSaved(!!s[result.domain]));
  }, [result.domain]);
  const toggle = async () => {
    if (saved) await store.unsaveAccount(result.domain);
    else await store.saveAccount(result);
    setSaved(!saved);
  };
  return (
    <button className={saved ? 'saved' : ''} aria-pressed={saved} onClick={toggle} title={saved ? 'Remove from My Accounts' : 'Add to My Accounts'}>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

function CompanySkeleton({ domain }: { domain: string }) {
  return (
    <div className="stack">
      <div className="small muted">Looking up {domain}…</div>
      <div className="skeleton" style={{ height: 40 }} />
      <div className="skeleton" style={{ height: 120 }} />
    </div>
  );
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="stack">
      <div className="small muted">{label}…</div>
      <div className="skeleton" style={{ height: 60 }} />
    </div>
  );
}
