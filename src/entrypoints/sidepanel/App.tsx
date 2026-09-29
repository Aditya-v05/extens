import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { describeError } from '@/lib/errors';
import { send } from '@/lib/messages';
import { normalizeDomainInput } from '@/lib/resolver';
import * as store from '@/lib/storage';
import type { Check, Contact, LookupError, LookupResult, ViewState } from '@/lib/types';
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

  const lookup = (domain: string, force = false) => {
    if (windowId !== null) send({ type: 'lookup', windowId, domain, force });
  };

  return (
    <main className="panel">
      <Body view={view} windowId={windowId} lookup={lookup} />
      <footer className="row spread small muted">
        <span>Click the toolbar icon on any company site.</span>
        <button className="link small" onClick={() => browser.runtime.openOptionsPage()}>Settings</button>
      </footer>
    </main>
  );
}

function Body({ view, windowId, lookup }: { view: ViewState; windowId: number | null; lookup: (d: string, force?: boolean) => void }) {
  switch (view.status) {
    case 'idle':
      return (
        <Empty title="Open a company's website" body="Then click the ICP Scout icon in your toolbar.">
          <DomainInput onSubmit={lookup} />
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
          <DomainInput onSubmit={lookup} />
        </Empty>
      );
    case 'not_found':
      return (
        <Empty title={`Apollo doesn't know ${view.domain}`} body="Try the company's main domain.">
          <DomainInput onSubmit={lookup} />
        </Empty>
      );
    case 'loading':
      return <ResultView domain={view.domain} result={view.partial} loadingStage={view.stage} windowId={windowId} lookup={lookup} />;
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
          {view.partial && <ResultView domain={view.domain} result={view.partial} windowId={windowId} lookup={lookup} />}
        </div>
      );
    case 'done':
      return <ResultView domain={view.domain} result={view.result} cached={view.cached} windowId={windowId} lookup={lookup} />;
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

function DomainInput({ onSubmit }: { onSubmit: (domain: string) => void }) {
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
      <button type="submit" disabled={!domain}>Look up</button>
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
  lookup: (d: string, force?: boolean) => void;
}

function ResultView({ domain, result, loadingStage, cached, windowId, lookup }: ResultProps) {
  const loading = loadingStage !== undefined;
  if (!result) return <CompanySkeleton domain={domain} />;
  const { company, fit, persona, contacts } = result;
  return (
    <div className="stack">
      <header className="company">
        {company.logo ? <img src={company.logo} alt="" className="logo" /> : <div className="logo placeholder">{company.name[0]}</div>}
        <div className="grow">
          <h1>{company.name}</h1>
          <div className="small muted">
            {[company.domain, company.industry, company.headcount && `${company.headcount.toLocaleString('en-US')} employees`, company.fundingStage]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        {!loading && <SaveButton result={result} />}
      </header>

      {fit ? <FitCard fit={fit} /> : loading && <SectionSkeleton label="Checking ICP fit" />}

      {persona && (
        <div className="small">
          <span className="muted">Best persona: </span>
          {persona.chosen ? (
            <strong>{persona.chosen}</strong>
          ) : (
            <strong>none of your personas fit</strong>
          )}
          {persona.chosen && <span className="muted"> · {pct(persona.distribution[persona.chosen] ?? persona.confidence)}</span>}
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
          <button className="link small" onClick={() => lookup(domain, true)}>Refresh</button>
        </div>
      )}
    </div>
  );
}

function FitCard({ fit }: { fit: NonNullable<LookupResult['fit']> }) {
  const tone = fit.score >= 70 ? 'good' : fit.score >= LOW_FIT ? 'warn' : 'bad';
  const word = fit.score >= 70 ? 'Strong fit' : fit.score >= LOW_FIT ? 'Partial fit' : 'Weak fit';
  return (
    <section className="card stack">
      <div className="row spread">
        <div>
          <div className={`score ${tone}`}>{fit.score}%</div>
          <div className="small muted">ICP match</div>
        </div>
        <span className={`pill ${tone}`}>{word}</span>
      </div>
      {fit.checks.length > 0 && (
        <ul className="checks">
          {fit.checks.map((c, i) => <CheckRow key={i} check={c} />)}
        </ul>
      )}
    </section>
  );
}

function CheckRow({ check }: { check: Check }) {
  const icon = check.pass === null ? '?' : check.pass ? '✓' : '✗';
  const tone = check.pass === null ? 'unknown' : check.pass ? 'pass' : 'fail';
  const detail = check.detail ?? (check.p !== undefined ? pct(check.p) : undefined);
  return (
    <li className={tone}>
      <span className="icon" aria-hidden>{icon}</span>
      <span className="grow">{check.label}</span>
      {detail && <span className="small muted">{detail}</span>}
    </li>
  );
}

function Contacts({ result, ranking, windowId, lowFit }: { result: LookupResult; ranking: boolean; windowId: number | null; lowFit: boolean }) {
  const [showAnyway, setShowAnyway] = useState(false);
  const contacts = result.contacts ?? [];
  if (lowFit && !showAnyway) {
    return (
      <button className="link" onClick={() => setShowAnyway(true)}>
        Show {contacts.length} contact{contacts.length === 1 ? '' : 's'} anyway →
      </button>
    );
  }
  if (!contacts.length) {
    return <div className="notice">No contacts found at this company in Apollo.</div>;
  }
  const [best, ...rest] = contacts;
  return (
    <section className="stack">
      {result.contactsFallback && (
        <div className="notice small">No one matched your persona titles, so these are senior people instead.</div>
      )}
      <h2>{ranking ? 'Ranking contacts…' : 'Best contact'}</h2>
      <ContactCard contact={best!} domain={result.domain} windowId={windowId} featured />
      {rest.length > 0 && (
        <>
          <h2>Other contacts</h2>
          {rest.map((c) => <ContactCard key={c.apolloId} contact={c} domain={result.domain} windowId={windowId} />)}
        </>
      )}
    </section>
  );
}

function ContactCard({ contact: c, domain, windowId, featured }: { contact: Contact; domain: string; windowId: number | null; featured?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LookupError | null>(null);
  const [copied, setCopied] = useState(false);
  const revealed = c.revealedAt !== undefined;
  const name = `${c.firstName} ${c.lastName ?? (c.lastNameObfuscated ? `${c.lastNameObfuscated[0]}.` : '')}`.trim();

  const reveal = async () => {
    if (windowId === null) return;
    setBusy(true);
    setError(null);
    const res = await send({ type: 'reveal', windowId, domain, personId: c.apolloId });
    if (!res.ok) setError(res.error);
    setBusy(false);
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={`contact card ${featured ? 'featured' : ''}`}>
      <div className="row spread">
        <div className="grow">
          <div className="row">
            <strong>{name}</strong>
            {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="small">LinkedIn</a>}
          </div>
          <div className="small muted">{c.title ?? 'Unknown title'}</div>
        </div>
        {c.rank !== null && <RankMeter value={c.rank} />}
      </div>

      {revealed ? (
        c.email ? (
          <div className="row email">
            <code className="grow">{c.email}</code>
            {c.emailStatus && <span className={`pill ${c.emailStatus === 'verified' ? 'good' : 'warn'}`}>{c.emailStatus}</span>}
            <button className="ghost small" onClick={() => copy(`${name} <${c.email}>`)}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        ) : (
          <div className="small muted">Apollo has no email for this person.</div>
        )
      ) : c.hasEmail ? (
        <button className={featured ? 'primary' : ''} disabled={busy} onClick={reveal}>
          {busy ? 'Revealing…' : 'Reveal email · 1 credit'}
        </button>
      ) : (
        <div className="small muted">No email in Apollo</div>
      )}
      {error && <div className="notice error small">{describeError(error)}</div>}
    </div>
  );
}

function RankMeter({ value }: { value: number }) {
  return (
    <div className="rank" title={`Likelihood this person owns the problem: ${value}%`}>
      <div className="bar"><div style={{ width: `${value}%` }} /></div>
      <span className="small muted">{value}</span>
    </div>
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
  return <button className={saved ? 'ghost' : ''} onClick={toggle}>{saved ? '★ Saved' : '☆ Save'}</button>;
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

const pct = (p: number) => `${Math.round(p * 100)}%`;

function ago(t: number): string {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
