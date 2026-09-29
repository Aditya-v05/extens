import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { CreditBar } from '@/components/CreditBar';
import { ago, pct } from '@/components/format';
import { useCredits } from '@/components/useCredits';
import {
  HOT_TIMING, SORT_LABELS, STATUS_LABELS, bestContact, buildRows, filterRows, sortRows, topSignal,
  type AccountRow, type AccountStatus, type Filters, type SortKey,
} from '@/lib/accounts';
import { lookupCost } from '@/lib/credits';
import { toCsv } from '@/lib/csv';
import { describeError } from '@/lib/errors';
import { send } from '@/lib/messages';
import * as store from '@/lib/storage';
import type { Contact, LookupError } from '@/lib/types';
import './accounts.css';

type Tab = 'saved' | 'recent';

function useAccounts() {
  const [data, setData] = useState<ReturnType<typeof buildRows> & { loaded: boolean }>({ saved: [], recent: [], loaded: false });
  useEffect(() => {
    const load = async () => {
      const [saved, cache, meta] = await Promise.all([store.getSaved(), store.getAllCached(), store.getAccountMeta()]);
      setData({ ...buildRows(saved, cache, meta), loaded: true });
    };
    load();
    return store.onLocalChange(['saved', 'cache', 'accountMeta', 'reveals'], load);
  }, []);
  return data;
}

export default function Accounts() {
  const { saved, recent, loaded } = useAccounts();
  const credits = useCredits();
  const [tab, setTab] = useState<Tab>('saved');
  const [sort, setSort] = useState<SortKey>('priority');
  const [filters, setFilters] = useState<Filters>({ query: '', status: 'all', hotOnly: false });

  const rows = useMemo(
    () => sortRows(filterRows(tab === 'saved' ? saved : recent, tab === 'saved' ? filters : { ...filters, status: 'all' }), sort),
    [tab, saved, recent, filters, sort],
  );

  const exportCsv = async () => {
    const [all, meta] = await Promise.all([store.getSaved(), store.getAccountMeta()]);
    const list = Object.values(all).sort((a, b) => b.savedAt - a.savedAt);
    const blob = new Blob([toCsv(list, meta)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icp-scout-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <main className="accounts stack">
      <header className="row spread wrap">
        <div>
          <h1>My Accounts</h1>
          <p className="muted small">Ranked by priority = 60% ICP fit + 40% timing.</p>
        </div>
        <div className="row">
          <button disabled={!saved.length} onClick={exportCsv}>Export CSV</button>
          <button className="ghost" onClick={() => browser.runtime.openOptionsPage()}>Settings</button>
        </div>
      </header>

      <CreditBar credits={credits} onSettings={() => browser.runtime.openOptionsPage()} />

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
          Saved <span className="count">{saved.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'recent'} className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}>
          Recently viewed <span className="count">{recent.length}</span>
        </button>
      </nav>

      <div className="toolbar row wrap">
        <input
          className="search"
          placeholder="Search company, contact title, signal, note…"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        />
        {tab === 'saved' && (
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as Filters['status'] })}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_LABELS) as AccountStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        )}
        <label className="row checkbox small">
          <input type="checkbox" checked={filters.hotOnly} onChange={(e) => setFilters({ ...filters, hotOnly: e.target.checked })} />
          Hot only (timing ≥ {HOT_TIMING})
        </label>
        <label className="row small">
          <span className="muted">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
        </label>
      </div>

      {!loaded ? null : rows.length === 0 ? (
        <EmptyState tab={tab} filtered={(tab === 'saved' ? saved : recent).length > 0} />
      ) : (
        <div className="table" role="table">
          <div className="thead" role="row">
            <span>Priority</span><span>Company</span><span>Fit</span><span>Why now</span><span>Best contact</span>
            <span>{tab === 'saved' ? 'Status' : ''}</span><span>Updated</span><span />
          </div>
          {rows.map((r) => <AccountRowView key={r.domain} row={r} cost={lookupCost(credits.settings)} />)}
        </div>
      )}
    </main>
  );
}

function EmptyState({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  if (filtered) return <p className="muted">Nothing matches these filters.</p>;
  return tab === 'saved' ? (
    <div className="card empty">
      <h2>No saved accounts yet</h2>
      <p className="muted">Look up a company in the side panel and hit ☆ Save. Anything you looked up in the last 7 days is under “Recently viewed”.</p>
    </div>
  ) : (
    <div className="card empty">
      <h2>Nothing viewed in the last 7 days</h2>
      <p className="muted">Open a company's website and click the ICP Scout icon.</p>
    </div>
  );
}

// ---------- one account ----------

function tone(n: number | null | undefined, hot = 67, warm = 34) {
  return n === null || n === undefined ? '' : n >= hot ? 'good' : n >= warm ? 'warn' : 'bad';
}

function AccountRowView({ row, cost }: { row: AccountRow; cost: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { result: r, meta } = row;
  const c = r.company;
  const best = bestContact(r);
  const signal = topSignal(r);
  const timing = r.whyNow?.timing ?? null;

  const refresh = async (allowOverBudget = false) => {
    setBusy(true);
    setError(null);
    const res = await send({ type: 'refreshAccount', domain: row.domain, allowOverBudget });
    setBusy(false);
    if (res.status === 'over_budget') {
      if (confirm(`Monthly credit budget reached (${res.spent} of ${res.budget}). Refreshing costs ${res.cost} credits. Continue?`)) {
        refresh(true);
      }
    } else if (res.status === 'error') setError(describeError(res.error));
    else if (res.status === 'not_found') setError(`Apollo no longer finds ${row.domain}.`);
    else if (res.status === 'needs_setup') setError('Finish setup in Settings first.');
  };

  const toggleSaved = async () => {
    if (row.saved) {
      if (confirm(`Remove ${c.name} from saved accounts? Its status and note are kept if you save it again.`)) await store.unsaveAccount(row.domain);
    } else {
      await store.saveAccount(r);
    }
  };

  return (
    <div className={`account ${open ? 'open' : ''}`} role="row">
      <div className="cells">
        <span className={`priority ${tone(row.priority)}`} title="60% fit + 40% timing">{row.priority ?? '–'}</span>

        <button className="company link-like" onClick={() => setOpen(!open)} aria-expanded={open}>
          {c.logo ? <img src={c.logo} alt="" className="logo" /> : <span className="logo placeholder">{c.name[0]}</span>}
          <span className="grow">
            <strong>{c.name}</strong>
            <span className="small muted block">
              {[row.domain, c.industry, c.headcount && `${c.headcount.toLocaleString('en-US')} emp.`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>

        <span className={`num ${tone(r.fit?.score, 70, 40)}`}>{r.fit ? `${r.fit.score}%` : '–'}</span>

        <span className="why">
          {timing !== null && <span className={`pill ${tone(timing)}`}>{timing >= 67 ? 'Hot' : timing >= 34 ? 'Warm' : 'Quiet'} · {timing}</span>}
          <span className="small block">{signal ? signal.label : <span className="muted">No strong signal</span>}</span>
        </span>

        <span className="contact-cell">
          {best ? (
            <>
              <span className="block">{contactName(best)}</span>
              <span className="small muted block">{best.email ?? best.title ?? ''}</span>
            </>
          ) : (
            <span className="muted">–</span>
          )}
        </span>

        <span>
          {row.saved && (
            <select
              value={meta.status}
              aria-label={`Status for ${c.name}`}
              onChange={(e) => store.updateAccountMeta(row.domain, { status: e.target.value as AccountStatus })}
            >
              {(Object.keys(STATUS_LABELS) as AccountStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          )}
        </span>

        <span className={`small ${row.stale ? 'stale' : 'muted'}`} title={new Date(r.fetchedAt).toLocaleString()}>
          {ago(r.fetchedAt)}
          {row.stale && ' · stale'}
        </span>

        <span className="actions row">
          <button className="small" disabled={busy} onClick={() => refresh()} title={`Refresh costs ${cost} Apollo credits`}>
            {busy ? 'Refreshing…' : `Refresh · ${cost} cr`}
          </button>
          <button className="ghost small" onClick={toggleSaved}>{row.saved ? 'Remove' : '☆ Save'}</button>
        </span>
      </div>

      {error && <div className="notice error small">{error}</div>}
      {open && <AccountDetails row={row} />}
    </div>
  );
}

function contactName(c: Contact) {
  return `${c.firstName} ${c.lastName ?? (c.lastNameObfuscated ? `${c.lastNameObfuscated[0]}.` : '')}`.trim();
}

function AccountDetails({ row }: { row: AccountRow }) {
  const r = row.result;
  const [note, setNote] = useState(row.meta.note);
  useEffect(() => setNote(row.meta.note), [row.meta.note]);

  return (
    <div className="details">
      <section>
        <h2>Fit</h2>
        {r.fit ? (
          <ul className="plain small">
            {r.fit.checks.map((ch, i) => (
              <li key={i}>
                <span className={ch.pass === null ? 'muted' : ch.pass ? 'ok' : 'err'}>{ch.pass === null ? '?' : ch.pass ? '✓' : '✗'}</span> {ch.label}
              </li>
            ))}
          </ul>
        ) : <p className="muted small">No fit judgment.</p>}
        {r.persona?.chosen && <p className="small">Best persona: <strong>{r.persona.chosen}</strong></p>}
      </section>

      <section>
        <h2>Why now</h2>
        {r.whyNow?.signals.length ? (
          <ul className="plain small">
            {r.whyNow.signals.map((s, i) => {
              const link = s.evidence.find((e) => e.url);
              return (
                <li key={i} className={s.relevance < 0.5 ? 'muted' : ''}>
                  <strong>{s.label}</strong> <span className="muted">{pct(s.relevance)}</span>
                  {s.detail && <span className="block">{s.kind === 'site' ? `“${s.detail}”` : s.detail}</span>}
                  {link?.url && <a href={link.url} target="_blank" rel="noreferrer">source ↗</a>}
                </li>
              );
            })}
          </ul>
        ) : <p className="muted small">{r.whyNow === undefined ? 'Refresh to check why now.' : 'No timing signals.'}</p>}
      </section>

      <section>
        <h2>Contacts</h2>
        {r.contacts?.length ? (
          <ul className="plain">{r.contacts.slice(0, 6).map((c) => <ContactLine key={c.apolloId} contact={c} domain={row.domain} />)}</ul>
        ) : <p className="muted small">No contacts found.</p>}
      </section>

      {row.saved && (
        <section className="note">
          <h2>Note</h2>
          <textarea
            rows={3}
            placeholder="Context, next step, who introduced you…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== row.meta.note && store.updateAccountMeta(row.domain, { note })}
          />
        </section>
      )}

      <p className="small">
        <a href={`https://${row.domain}`} target="_blank" rel="noreferrer">Open {row.domain} ↗</a>
        {r.company.linkedin && <> · <a href={r.company.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></>}
      </p>
    </div>
  );
}

function ContactLine({ contact: c, domain }: { contact: Contact; domain: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LookupError | null>(null);
  const reveal = async () => {
    setBusy(true);
    setError(null);
    const res = await send({ type: 'reveal', windowId: null, domain, personId: c.apolloId });
    if (!res.ok) setError(res.error);
    setBusy(false);
  };
  return (
    <li className="contact-line small">
      <span className="grow">
        <strong>{contactName(c)}</strong>
        <span className="muted block">
          {c.title ?? 'Unknown title'}
          {c.rank !== null && <span title="How likely this person owns the problem"> · rank {c.rank}</span>}
        </span>
      </span>
      {c.revealedAt !== undefined ? (
        c.email ? <code>{c.email}</code> : <span className="muted">No email</span>
      ) : c.hasEmail ? (
        <button className="small" disabled={busy} onClick={reveal}>{busy ? 'Revealing…' : 'Reveal · 1 cr'}</button>
      ) : (
        <span className="muted">No email in Apollo</span>
      )}
      {error && <span className="err">{describeError(error)}</span>}
    </li>
  );
}
