import { useEffect, useState } from 'react';
import { ago } from '@/components/format';
import { priority } from '@/lib/accounts';
import { DISCOVER_PAGE_SIZE, pickSeeds, searchKey, type Candidate, type DiscoverResult } from '@/lib/discover';
import { describeError } from '@/lib/errors';
import { upgradeResult } from '@/lib/mapping';
import { send } from '@/lib/messages';
import type { DiscoverOutcome } from '@/lib/pipeline';
import * as store from '@/lib/storage';
import type { LookupResult, Profile } from '@/lib/types';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface State {
  profile: Profile | undefined;
  saved: Awaited<ReturnType<typeof store.getSaved>>;
  meta: Awaited<ReturnType<typeof store.getAccountMeta>>;
  cache: Record<string, LookupResult>;
  discover: DiscoverResult | undefined;
}

function useDiscoverState(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const load = async () => {
      const [profile, saved, meta, cache, discover] = await Promise.all([
        store.getProfile(), store.getSaved(), store.getAccountMeta(), store.getAllCached(), store.getDiscover(),
      ]);
      setState({ profile, saved, meta, cache, discover });
    };
    load();
    return store.onLocalChange(['profile', 'saved', 'accountMeta', 'cache', 'discover', 'dismissed', 'reveals'], load);
  }, []);
  return state;
}

/** Ask before going past the monthly budget, then run again with permission. */
async function withBudget(run: (allow: boolean) => Promise<DiscoverOutcome | { status: string; spent?: number; budget?: number; cost?: number }>) {
  let res = await run(false);
  if (res.status === 'over_budget' && 'spent' in res) {
    if (!confirm(`Monthly credit budget reached (${res.spent} of ${res.budget}). This costs ${res.cost} more. Continue?`)) return null;
    res = await run(true);
  }
  return res;
}

export function DiscoverTab({ lookupCost }: { lookupCost: number }) {
  const state = useDiscoverState();
  const [busy, setBusy] = useState<'search' | 'more' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!state) return null;

  const { profile, saved, meta, cache, discover } = state;
  if (!profile) return <Note title="Finish setup first" body="Describe what you sell in Settings. Discover uses your ICP rules as filters." />;
  const seeds = pickSeeds(saved, meta);
  if (!seeds.length) {
    return <Note title="Save a few companies you like first" body="Discover finds companies similar to your best saved accounts. Look some up in the side panel and click Save." />;
  }

  const current = discover && discover.key === searchKey(profile.rules, seeds) && Date.now() - discover.fetchedAt < TTL_MS ? discover : null;
  const search = async (kind: 'search' | 'more') => {
    setBusy(kind);
    setError(null);
    const res = await withBudget((allow) =>
      send({ type: 'discover', more: kind === 'more', fresh: kind === 'search' && !!current, allowOverBudget: allow }),
    );
    setBusy(null);
    if (res?.status === 'error' && 'error' in res) setError(describeError(res.error));
  };
  const loaded = current ? current.page * DISCOVER_PAGE_SIZE : 0;

  return (
    <div className="discover stack">
      <p className="lede">
        Companies like your best saved accounts: <strong>{seeds.map((s) => s.name).join(', ')}</strong>.
        {current?.filtersLabel || discover?.filtersLabel ? ` Only ${current?.filtersLabel ?? discover?.filtersLabel}.` : ''}
      </p>

      {!current ? (
        <div className="stack">
          {discover && <p className="small muted">Your saved accounts or ICP changed since the last search.</p>}
          <button className="primary" disabled={!!busy} onClick={() => search('search')}>
            {busy ? 'Searching…' : `Find ${DISCOVER_PAGE_SIZE} similar companies (1 credit)`}
          </button>
        </div>
      ) : (
        <div className="row spread wrap small">
          <span className="muted">
            {current.candidates.length} suggestions from {current.totalEntries.toLocaleString('en-US')} matches in Apollo, found {ago(current.fetchedAt)}.
          </span>
          <span className="row" style={{ gap: 20 }}>
            {loaded < current.totalEntries && (
              <button className="small" disabled={!!busy} onClick={() => search('more')}>
                {busy === 'more' ? 'Loading…' : `Load ${DISCOVER_PAGE_SIZE} more (1 credit)`}
              </button>
            )}
            <button className="ghost small" disabled={!!busy} onClick={() => search('search')}>
              {busy === 'search' ? 'Searching…' : 'Search again (1 credit)'}
            </button>
          </span>
        </div>
      )}
      {error && <div className="notice error small">{error}</div>}

      {current && current.candidates.length > 0 && (
        <ol className="candidates">
          {current.candidates.map((c) => (
            <CandidateRow key={c.domain} candidate={c} result={cache[c.domain]} saved={!!saved[c.domain]} lookupCost={lookupCost} />
          ))}
        </ol>
      )}
      {current && current.candidates.length === 0 && <p className="muted">No new companies left in this search. Try Load more or Search again.</p>}
      <p className="small muted">Suggestions keep Apollo's similarity order. Look one up to see its fit, timing and contacts.</p>
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="discover empty">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
    </div>
  );
}

function CandidateRow({ candidate: c, result, saved, lookupCost }: { candidate: Candidate; result?: LookupResult; saved: boolean; lookupCost: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const facts = [
    c.foundedYear && `Founded ${c.foundedYear}`,
    c.revenue && `${/^\d/.test(c.revenue) ? '$' : ''}${c.revenue} revenue`, // Apollo sends "35M" (USD)
    c.growth12 !== null && `headcount ${c.growth12 >= 0 ? '+' : ''}${Math.round(c.growth12 * 100)}% in 12 months`,
  ].filter(Boolean);

  const lookUp = async () => {
    setBusy(true);
    setError(null);
    const res = await withBudget((allow) => send({ type: 'refreshAccount', domain: c.domain, allowOverBudget: allow }));
    setBusy(false);
    if (res?.status === 'error' && 'error' in res) setError(describeError(res.error));
    else if (res?.status === 'not_found') setError(`Apollo has no details for ${c.domain}.`);
  };

  const r = result ? upgradeResult(result) : null;
  const p = r ? priority(r) : null;
  return (
    <li className="candidate">
      {c.logo ? <img src={c.logo} alt="" className="logo" /> : <span className="logo placeholder">{c.name[0]}</span>}
      <div className="grow">
        <div className="row" style={{ gap: 10 }}>
          <strong>{c.name}</strong>
          <a className="small" href={`https://${c.domain}`} target="_blank" rel="noreferrer">{c.domain}</a>
        </div>
        <div className="small muted">{facts.length ? facts.join(', ') : 'No details from Apollo yet'}</div>
        {r && (
          <div className="small looked-up">
            Fit {r.fit?.score ?? '–'}%{r.whyNow?.timing != null && `, timing ${r.whyNow.timing}`}
            {p !== null && <span className="muted">, priority {p}</span>}
          </div>
        )}
        {error && <div className="notice error small">{error}</div>}
      </div>
      <div className="actions row">
        {r ? (
          saved ? <span className="small muted">Saved</span> : <button className="small" onClick={() => store.saveAccount(result!)}>Save</button>
        ) : (
          <button className="small" disabled={busy} onClick={lookUp}>{busy ? 'Looking up…' : `Look up (${lookupCost} cr)`}</button>
        )}
        <button className="ghost small" onClick={() => store.dismissCandidate(c.domain)}>Dismiss</button>
      </div>
    </li>
  );
}

