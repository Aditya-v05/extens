import { useEffect, useState } from 'react';
import { useCredits } from '@/components/useCredits';
import { lookupCost, totalSpent } from '@/lib/credits';
import { toCsv } from '@/lib/csv';
import { send, type KeyTest } from '@/lib/messages';
import { generateRules } from '@/lib/rules';
import * as store from '@/lib/storage';
import type { Keys, LookupResult, ProfileAnswers, Rules } from '@/lib/types';
import './options.css';

export default function Options() {
  return (
    <main className="options stack">
      <header>
        <h1>ICP Scout</h1>
        <p className="muted">
          Everything stays in this browser. Your keys are sent only to Apollo and TypeSafe. There's no server and no tracking.
        </p>
      </header>
      <KeysSection />
      <ProfileSection />
      <CreditsSection />
      <SavedSection />
    </main>
  );
}

// ---------- keys ----------

function KeysSection() {
  const [keys, setKeys] = useState<Keys>({ apollo: '', typesafe: '' });
  const [tests, setTests] = useState<{ apollo: KeyTest; typesafe: KeyTest } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store.getKeys().then((k) => k && setKeys(k));
  }, []);

  const saveAndTest = async () => {
    setBusy(true);
    const trimmed = { apollo: keys.apollo.trim(), typesafe: keys.typesafe.trim() };
    await store.setKeys(trimmed);
    setKeys(trimmed);
    setTests(await send({ type: 'testKeys', keys: trimmed }));
    setBusy(false);
  };

  return (
    <section className="card stack">
      <h2>1 · API keys</h2>
      <KeyField
        label="Apollo API key"
        hint={<>From Apollo → Settings → Integrations → API. It needs access to people search and enrichment.</>}
        value={keys.apollo}
        onChange={(apollo) => setKeys({ ...keys, apollo })}
        test={tests?.apollo}
      />
      <KeyField
        label="TypeSafe API key (Jev)"
        hint={<>From <a href="https://typesafe.ai" target="_blank" rel="noreferrer">typesafe.ai</a>. Jev makes the fit and ranking judgments.</>}
        value={keys.typesafe}
        onChange={(typesafe) => setKeys({ ...keys, typesafe })}
        test={tests?.typesafe}
      />
      <div>
        <button className="primary" disabled={busy || !keys.apollo || !keys.typesafe} onClick={saveAndTest}>
          {busy ? 'Testing…' : 'Save & test keys'}
        </button>
      </div>
    </section>
  );
}

function KeyField(props: { label: string; hint: React.ReactNode; value: string; onChange: (v: string) => void; test?: KeyTest }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label>{props.label}</label>
      <div className="row">
        <input type={shown ? 'text' : 'password'} value={props.value} onChange={(e) => props.onChange(e.target.value)} autoComplete="off" spellCheck={false} />
        <button className="ghost" onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'}</button>
      </div>
      <div className="small muted hint">{props.hint}</div>
      {props.test && <div className={`small ${props.test.ok ? 'ok' : 'err'}`}>{props.test.ok ? '✓ ' : '✗ '}{props.test.message}</div>}
    </div>
  );
}

// ---------- profile ----------

const EMPTY_ANSWERS: ProfileAnswers = { sells: '', icp: '', buyers: '' };

function ProfileSection() {
  const [answers, setAnswers] = useState<ProfileAnswers>(EMPTY_ANSWERS);
  const [rules, setRules] = useState<Rules | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    store.getProfile().then((p) => {
      if (!p) return;
      setAnswers(p.answers);
      setRules(p.rules);
    });
  }, []);

  const complete = answers.sells.trim() && answers.icp.trim() && answers.buyers.trim();

  const save = async () => {
    if (!rules) return;
    await store.setProfile({ answers, rules, updatedAt: Date.now() });
    await store.clearCache(); // cached results were judged against the old profile
    setStatus('Saved. New lookups use this profile.');
  };

  return (
    <section className="card stack">
      <h2>2 · What you sell</h2>
      <Field
        label="What do you sell?"
        placeholder="AI support QA software for SaaS companies."
        value={answers.sells}
        onChange={(sells) => setAnswers({ ...answers, sells })}
      />
      <Field
        label="Describe your ideal customer"
        placeholder="Series A–C SaaS companies, 50–500 employees, in North America, with large customer support teams."
        value={answers.icp}
        onChange={(icp) => setAnswers({ ...answers, icp })}
      />
      <Field
        label="Who normally buys?"
        placeholder="VP Customer Experience, Head of Support, COO"
        value={answers.buyers}
        onChange={(buyers) => setAnswers({ ...answers, buyers })}
        rows={2}
      />
      <div>
        <button disabled={!complete} onClick={() => { setRules(generateRules(answers)); setStatus(null); }}>
          {rules ? 'Regenerate rules from answers' : 'Generate rules'}
        </button>
      </div>

      {rules && (
        <>
          <RulesEditor rules={rules} onChange={setRules} />
          <div className="row">
            <button className="primary" disabled={!complete || !rules.personas.length} onClick={save}>Save profile</button>
            {status && <span className="small ok">{status}</span>}
          </div>
        </>
      )}
    </section>
  );
}

function Field(props: { label: string; placeholder: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label>{props.label}</label>
      <textarea rows={props.rows ?? 3} placeholder={props.placeholder} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  );
}

function RulesEditor({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  const hc = rules.headcount ?? { min: null, max: null };
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v))));
  const setHc = (patch: Partial<typeof hc>) => {
    const next = { ...hc, ...patch };
    onChange({ ...rules, headcount: next.min === null && next.max === null ? null : next });
  };

  return (
    <div className="rules stack">
      <p className="small muted">
        Check these rules and edit them. Headcount and country are checked exactly. Each company check is a yes/no question for Jev.
      </p>
      <div>
        <label>Company size (employees)</label>
        <div className="row">
          <input type="number" min={0} placeholder="Min" value={hc.min ?? ''} onChange={(e) => setHc({ min: num(e.target.value) })} />
          <span className="muted">to</span>
          <input type="number" min={0} placeholder="Max" value={hc.max ?? ''} onChange={(e) => setHc({ max: num(e.target.value) })} />
        </div>
      </div>
      <div>
        <label>Countries</label>
        <CommaInput
          value={rules.countries}
          placeholder="Any country (e.g. United States, Canada)"
          onChange={(countries) => onChange({ ...rules, countries })}
        />
      </div>
      <ListEditor
        label="Company checks"
        hint="e.g. “B2B SaaS”, “Has a large customer support team”"
        items={rules.checks}
        onChange={(checks) => onChange({ ...rules, checks })}
      />
      <ListEditor
        label="Buyer personas (job titles)"
        hint="Used to search Apollo and to pick the best persona."
        items={rules.personas}
        onChange={(personas) => onChange({ ...rules, personas })}
      />
    </div>
  );
}

/** Keeps its own text so typing commas and spaces isn't eaten by re-parsing. */
function CommaInput({ value, placeholder, onChange }: { value: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => setText(value.join(', ')), [value.join('|')]);
  return (
    <input
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map((s) => s.trim()).filter(Boolean))}
    />
  );
}

function ListEditor({ label, hint, items, onChange }: { label: string; hint: string; items: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <label>{label}</label>
      <ul className="list">
        {items.map((item, i) => (
          <li key={i} className="row">
            <input value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="ghost" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input placeholder={hint} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim()}>Add</button>
      </form>
    </div>
  );
}

// ---------- credits ----------

function CreditsSection() {
  const { settings, ledger, balance } = useCredits();
  const [budgetText, setBudgetText] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const budgetValue = budgetText ?? (settings.monthlyBudget === null ? '' : String(settings.monthlyBudget));

  const saveBudget = () => {
    const n = budgetValue.trim() === '' ? null : Math.max(0, Math.round(Number(budgetValue)));
    store.setSettings({ ...settings, monthlyBudget: Number.isFinite(n) ? n : null });
    setBudgetText(null);
  };
  const check = async () => {
    setChecking(true);
    await send({ type: 'refreshBalance' });
    setChecking(false);
  };

  return (
    <section className="card stack">
      <h2>3 · Apollo credits</h2>
      <p className="small muted" style={{ margin: 0 }}>
        A new company lookup costs {lookupCost(settings)} Apollo credit{lookupCost(settings) === 1 ? '' : 's'}: 1 for the company
        {settings.fetchJobs ? ', 1 for job postings' : ''}. People search is free. Revealing an email costs 1.
        Repeat visits use the 7-day cache and cost nothing.
      </p>

      <div>
        <label>Spent by ICP Scout this month</label>
        <div>
          <strong>{totalSpent(ledger)}</strong>
          <span className="muted small">
            {' '}· {ledger.company} company lookups · {ledger.jobs} job-posting fetches · {ledger.reveal} email reveals
          </span>
        </div>
      </div>

      <div>
        <label>Apollo balance</label>
        {balance?.available ? (
          <div>
            <strong>{balance.leftOver.toLocaleString('en-US')}</strong> of {balance.limit.toLocaleString('en-US')} lead credits left
            {balance.cycleEnd && <span className="muted small"> · resets {new Date(balance.cycleEnd).toLocaleDateString()}</span>}
          </div>
        ) : (
          <div className="small muted">
            Your Apollo team balance shows here if your key is a <strong>master API key</strong>. Other keys can't read it, so ICP Scout counts its own spending instead.
          </div>
        )}
        <button className="ghost small" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check balance now'}</button>
      </div>

      <div>
        <label>Monthly budget for ICP Scout</label>
        <div className="row">
          <input
            type="number"
            min={0}
            placeholder="No limit"
            value={budgetValue}
            onChange={(e) => setBudgetText(e.target.value)}
            onBlur={saveBudget}
            onKeyDown={(e) => e.key === 'Enter' && saveBudget()}
            style={{ maxWidth: 160 }}
          />
          <span className="small muted">credits. When reached, new lookups ask before spending.</span>
        </div>
      </div>

      <label className="row checkbox">
        <input
          type="checkbox"
          checked={settings.fetchJobs}
          onChange={(e) => store.setSettings({ ...settings, fetchJobs: e.target.checked })}
        />
        <span>Hiring signals: fetch job postings for "why now" (+1 credit per lookup)</span>
      </label>

      <label className="row checkbox">
        <input
          type="checkbox"
          checked={settings.scanSite}
          onChange={(e) => store.setSettings({ ...settings, scanSite: e.target.checked })}
        />
        <span>
          Website signals: read the pricing, blog, changelog and security pages of the site you're on (free; only when you
          click the icon; nothing leaves your browser except snippets sent to Jev)
        </span>
      </label>
    </section>
  );
}

// ---------- saved accounts ----------

type Saved = LookupResult & { savedAt: number };

function SavedSection() {
  const [saved, setSaved] = useState<Saved[]>([]);
  const load = () => store.getSaved().then((s) => setSaved(Object.values(s).sort((a, b) => b.savedAt - a.savedAt)));
  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    const blob = new Blob([toCsv(saved)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icp-scout-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card stack">
      <div className="row spread">
        <h2>4 · Saved accounts</h2>
        <div className="row">
          <button className="ghost" onClick={load}>Reload</button>
          <button disabled={!saved.length} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      {saved.length === 0 ? (
        <p className="muted small">No saved accounts yet. Hit ☆ Save in the side panel.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Company</th><th>Fit</th><th>Why now</th><th>Best contact</th><th>Saved</th><th /></tr>
          </thead>
          <tbody>
            {saved.map((a) => {
              const best = a.contacts?.[0];
              return (
                <tr key={a.domain}>
                  <td><strong>{a.company.name}</strong><div className="small muted">{a.domain}</div></td>
                  <td>{a.fit ? `${a.fit.score}%` : '—'}</td>
                  <td>
                    {a.whyNow?.timing ?? '—'}
                    <div className="small muted">{a.whyNow?.signals.find((s) => s.relevance >= 0.5)?.label ?? ''}</div>
                  </td>
                  <td>
                    {best ? (
                      <>
                        {best.firstName} {best.lastName ?? ''}
                        <div className="small muted">{best.email ?? best.title ?? ''}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="small muted">{new Date(a.savedAt).toLocaleDateString()}</td>
                  <td><button className="ghost" onClick={async () => { await store.unsaveAccount(a.domain); load(); }}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
