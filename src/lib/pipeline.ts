import { browser } from 'wxt/browser';
import * as apollo from './apollo';
import { lookupCost, overBudget, parseBalance, totalSpent, type Settings } from './credits';
import {
  buildLookalikeQuery, filtersLabel, mapCandidate, mergeCandidates, pickSeeds, searchKey,
  type Candidate, type DiscoverResult,
} from './discover';
import { applyReveals, type RevealPatch } from './contacts';
import { MAX_PEOPLE, SENIOR, excludeByTitle, interleave, mergePeople, peopleFilters, type PeopleFilters } from './people';
import { ApiError, toLookupError } from './errors';
import * as jev from './jev';
import { applyRanks, mapFit, mapPersona, mapWhyNow, upgradeResult } from './mapping';
import type { Answer } from './jev';
import {
  ROLE_BATCH, accountQuestions, companyState, jobId, peopleState, rankId, rankQuestions, roleQuestions, sellerState,
  siteQuestions, siteRelId, siteTypeId, snippetState, whyNowQuestions, whyNowState,
} from './questions';
import { registrableDomain } from './resolver';
import { scanSite, type SiteScan, type Snippet } from './site-scan';
import { evaluateRules } from './rules';
import { jobCandidates, signalCandidates, type JobCandidate, type SignalCandidate } from './signals';
import * as store from './storage';
import type { Contact, Keys, LookupError, LookupResult, Profile, ViewState, WhyNow } from './types';

const DAY = 24 * 60 * 60 * 1000;


// ---------- orchestration ----------

/** Latest lookup per window; older runs stop writing when superseded. */
const runs = new Map<number, symbol>();

export interface LookupOptions {
  /** Skip the cache (Refresh). */
  force?: boolean;
  /** The user chose to go past their monthly credit budget. */
  allowOverBudget?: boolean;
  /** Tab showing the company's site, for website signals (needs the activeTab grant from an icon click). */
  tabId?: number;
}

/**
 * Look up a company. With a windowId, progress streams to that window's side panel; with null
 * (My Accounts refresh) it runs headless. Returns the final state either way.
 */
export async function runLookup(windowId: number | null, domain: string, opts: LookupOptions = {}): Promise<ViewState> {
  const { force = false, allowOverBudget = false, tabId } = opts;
  const token = Symbol(domain);
  if (windowId !== null) runs.set(windowId, token);
  const show = async (v: ViewState): Promise<ViewState> => {
    if (windowId !== null && runs.get(windowId) === token) await store.setView(windowId, v);
    return v;
  };

  const [keys, profile] = await Promise.all([store.getKeys(), store.getProfile()]);
  const missing: ('keys' | 'profile')[] = [];
  if (!keys?.apollo || !keys?.typesafe) missing.push('keys');
  if (!profile) missing.push('profile');
  if (missing.length) return show({ status: 'needs_setup', missing });

  if (!force) {
    const hit = await store.getCached(domain);
    if (hit) {
      const contacts = hit.contacts ? await store.withReveals(hit.contacts) : null;
      return show({ status: 'done', domain, result: upgradeResult({ ...hit, contacts }), cached: true });
    }
  }

  const [settings, ledger] = await Promise.all([store.getSettings(), store.getLedger()]);
  const cost = lookupCost(settings);
  if (!allowOverBudget && overBudget(ledger, settings, cost)) {
    return show({ status: 'over_budget', domain, spent: totalSpent(ledger), budget: settings.monthlyBudget!, cost });
  }

  let partial: LookupResult | null = null;
  try {
    await show({ status: 'loading', domain, stage: 'company', partial: null });
    // Reading the site is free and independent of Apollo, so it starts right away.
    const site: Promise<SiteScan | null> =
      settings.scanSite && tabId !== undefined ? scanTab(tabId, domain) : Promise.resolve(null);
    partial = await lookup(keys!, profile!, settings, domain, site, async (stage, p) => {
      partial = p;
      await show({ status: 'loading', domain, stage, partial: p });
    });
    if (!partial) return show({ status: 'not_found', domain });
    await store.putCached(partial);
    // A saved account follows its latest lookup (status and notes live separately).
    if ((await store.getSaved())[domain]) await store.saveAccount(partial);
    return await show({ status: 'done', domain, result: partial, cached: false });
  } catch (err) {
    return await show({ status: 'error', domain, error: toLookupError(err), partial });
  } finally {
    refreshBalance();
  }
}

type Progress = (stage: 'judging' | 'ranking', partial: LookupResult) => Promise<void>;

async function lookup(
  keys: Keys, profile: Profile, settings: Settings, domain: string, site: Promise<SiteScan | null>, progress: Progress,
): Promise<LookupResult | null> {
  const org = await apollo.enrichOrganization(keys.apollo, domain);
  if (!org) return null;
  await store.recordSpend('company');
  const company = apollo.mapOrganization(org, domain);
  let result: LookupResult = { domain, fetchedAt: Date.now(), company, fit: null, persona: null, contacts: null };
  await progress('judging', result);

  const seller = sellerState(profile);
  const state = { seller, company: companyState(company) };

  // Jev #1 (fit, checks, persona) runs alongside the free people search and the job postings fetch.
  const [answers, found, postings] = await Promise.all([
    jev.ask(keys.typesafe, state, accountQuestions(profile)),
    findPeople(keys.apollo, company.apolloId, peopleFilters(profile.rules)),
    settings.fetchJobs ? getJobsOrNull(keys.apollo, company.apolloId) : Promise.resolve('off' as const),
  ]);
  const jobsStatus: WhyNow['jobsStatus'] = postings === 'off' ? 'off' : postings === null ? 'unavailable' : 'ok';
  const persona = mapPersona(answers, profile);
  result = {
    ...result,
    fit: mapFit(answers, profile, evaluateRules(profile.rules, company)),
    persona,
    contacts: found.contacts,
    contactsFallback: found.fallback,
  };
  await progress('ranking', result);

  // Jev #2 (rank people) and Jev #3 (why now) are independent, so they run together.
  const now = Date.now();
  const jobs = jobCandidates(Array.isArray(postings) ? postings : [], now);
  const signals = signalCandidates(org, jobs, now);
  const scan = await site;
  const snippets = scan ? freshSnippets(scan.snippets, now) : [];
  const siteStatus: NonNullable<WhyNow['siteStatus']> = !settings.scanSite ? 'off' : scan ? 'ok' : 'unavailable';
  const [contacts, whyNow] = await Promise.all([
    found.contacts.length
      ? rankPeople(keys.typesafe, { ...state, best_persona: persona?.chosen ?? null }, found.contacts)
          .then((rankAnswers) => store.withReveals(applyRanks(found.contacts, rankAnswers)))
      : Promise.resolve(found.contacts),
    signals.length || jobs.length || snippets.length
      ? judgeWhyNow(keys.typesafe, state, signals, jobs, snippets).then((a) =>
          mapWhyNow(a, signals, jobs, jobsStatus, { snippets, status: siteStatus }),
        )
      : Promise.resolve({ timing: null, signals: [], jobsStatus, siteStatus }),
  ]);
  return { ...result, contacts, whyNow };
}

const chunk = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/**
 * Timing + signals in one call; roles and website snippets in parallel batches of ROLE_BATCH
 * (long lists blur answers). Returns answers keyed as mapWhyNow expects, with batch-local ids
 * remapped to global ones: job_<index into jobs>, site_type_/site_rel_<index into snippets>.
 */
export async function judgeWhyNow(
  key: string, state: object, signals: SignalCandidate[], jobs: JobCandidate[], snippets: Snippet[] = [],
): Promise<Record<string, Answer>> {
  const roleBatches = chunk(jobs, ROLE_BATCH);
  const siteBatches = chunk(snippets, ROLE_BATCH);
  const [main, roleAnswers, siteAnswers] = await Promise.all([
    jev.ask(key, { ...state, ...whyNowState(signals, jobs, snippets) }, whyNowQuestions(signals)),
    Promise.all(roleBatches.map((b) => jev.ask(key, { ...state, open_roles: whyNowState([], b).open_roles }, roleQuestions(b.length)))),
    Promise.all(siteBatches.map((b) => jev.ask(key, { ...state, website: snippetState(b) }, siteQuestions(b.length)))),
  ]);
  const answers: Record<string, Answer> = { ...main };
  const remap = (batchAnswers: Record<string, Answer>[], ids: ((i: number) => string)[]) =>
    batchAnswers.forEach((a, b) => {
      for (let i = 0; i < ROLE_BATCH; i++) {
        for (const id of ids) {
          const ans = a[id(i)];
          if (ans) answers[id(b * ROLE_BATCH + i)] = ans;
        }
      }
    });
  remap(roleAnswers, [jobId]);
  remap(siteAnswers, [siteTypeId, siteRelId]);
  return answers;
}

// ---------- website signals ----------

const MAX_SNIPPETS = 30;
/** Dated posts older than this aren't "now". Undated snippets (pricing, security, homepage) are current. */
const SNIPPET_MAX_AGE_DAYS = 365;

export function freshSnippets(snippets: Snippet[], now: number): Snippet[] {
  return snippets
    .filter((s) => !s.date || now - Date.parse(s.date) <= SNIPPET_MAX_AGE_DAYS * DAY)
    .slice(0, MAX_SNIPPETS);
}

/**
 * Run the site reader inside the user's tab. Only works while the tab still has the activeTab
 * grant from the icon click, and only if it's showing this company's site.
 */
async function scanTab(tabId: number, domain: string): Promise<SiteScan | null> {
  try {
    const [res] = await browser.scripting.executeScript({ target: { tabId }, func: scanSite, args: [5] });
    const scan = res?.result as SiteScan | undefined;
    if (!scan || registrableDomain(scan.host.toLowerCase()) !== domain) return null;
    return scan;
  } catch {
    return null; // no grant (typed-in domain, navigated away) or a page that blocks scripts
  }
}

/** Job postings are a bonus: a key without access to them shouldn't break the lookup. */
async function getJobsOrNull(key: string, organizationId: string) {
  try {
    const jobs = await apollo.getJobPostings(key, organizationId);
    await store.recordSpend('jobs');
    return jobs;
  } catch (err) {
    if (err instanceof ApiError && err.status !== null && err.status < 500 && err.status !== 429) return null;
    throw err;
  }
}

/**
 * People search is free, so cast a wider net in parallel and put senior people first, using the user's
 * "Who to look for" settings (peopleFilters):
 *  1. their titles among the chosen seniorities;
 *  2. each keyword among the chosen seniorities (catches titles they didn't spell out, e.g.
 *     "Head of Customer Operations" for "customer");
 *  3. their titles at any level;
 *  4. each keyword at any level: small companies often have no VP or Head for the function, and the
 *     real owner is a "Lead" or "Manager" (at Linear, 180 people: "Customer Experience Leader").
 * Merged in that order, so senior people still come first; Jev ranks everyone by title.
 * Then excluded titles are dropped here (Apollo's API ignores its own exclusion filter).
 */
export async function findPeople(key: string, organizationId: string, f: PeopleFilters) {
  const seniorities = f.seniorities.length ? f.seniorities : undefined;
  const keywords = f.keywords.slice(0, MAX_KEYWORD_SEARCHES);
  const senior: Promise<Contact[]>[] = [];
  const anyLevel: Promise<Contact[]>[] = [];
  if (f.titles.length) senior.push(apollo.searchPeople(key, { organizationId, titles: f.titles, seniorities }));
  for (const k of keywords) senior.push(apollo.searchPeople(key, { organizationId, keywords: k, seniorities }));
  if (seniorities) {
    if (f.titles.length) anyLevel.push(apollo.searchPeople(key, { organizationId, titles: f.titles }));
    for (const k of keywords) anyLevel.push(apollo.searchPeople(key, { organizationId, keywords: k }));
  }
  if (senior.length) {
    const [seniorLists, anyLists] = await Promise.all([Promise.all(senior), Promise.all(anyLevel)]);
    // Senior people first; the any-level searches take turns so each keyword gets a say (at Linear, one
    // "customer" search of 15 reps used to fill the list before "operations" found the Product Operations Lead).
    const merged = mergePeople([...seniorLists, interleave(anyLists)], Infinity);
    const contacts = excludeByTitle(merged, f.excludeTitles).slice(0, MAX_PEOPLE);
    if (contacts.length) return { contacts, fallback: false };
  }
  const contacts = excludeByTitle(await apollo.searchPeople(key, { organizationId, seniorities: seniorities ?? SENIOR }), f.excludeTitles);
  return { contacts, fallback: true };
}

/** Keyword searches per lookup (each is one free Apollo request). */
const MAX_KEYWORD_SEARCHES = 5;

/** Rank people in batches of ROLE_BATCH (long lists blur Jev's answers); keys are rank_<index into contacts>. */
export async function rankPeople(key: string, state: object, contacts: Contact[]): Promise<Record<string, Answer>> {
  const batches = chunk(contacts, ROLE_BATCH);
  const results = await Promise.all(batches.map((b) => jev.ask(key, { ...state, people: peopleState(b) }, rankQuestions(b))));
  const answers: Record<string, Answer> = {};
  results.forEach((a, bi) => {
    for (let i = 0; i < batches[bi]!.length; i++) {
      const ans = a[rankId(i)];
      if (ans) answers[rankId(bi * ROLE_BATCH + i)] = ans;
    }
  });
  return answers;
}

// ---------- reveal ----------

export interface RevealOutcome {
  revealed: number;
  /** Found by Apollo but without an email. */
  noEmail: number;
  failed: number;
  error: LookupError | null;
}

/**
 * Reveal emails for several people (a few requests at a time), then record the credits and patch
 * every copy we hold (cache, saved account, open panel) in one write each, so parallel reveals
 * can't overwrite each other.
 */
export async function revealContacts(windowId: number | null, domain: string, personIds: string[]): Promise<RevealOutcome> {
  const keys = await store.getKeys();
  if (!keys?.apollo) throw new Error('Missing Apollo key');
  const reveals: Record<string, RevealPatch> = {};
  let found = 0;
  let failed = 0;
  let error: LookupError | null = null;

  const queue = [...new Set(personIds)];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const r = await apollo.revealPerson(keys.apollo, id);
        if (r.found) found++; // Apollo charges enrichment only when it finds the person.
        reveals[id] = {
          lastName: r.lastName, email: r.email, emailStatus: r.emailStatus, linkedin: r.linkedin, revealedAt: Date.now(),
          ...(r.title ? { title: r.title } : {}),
        };
      } catch (err) {
        failed++;
        error ??= toLookupError(err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(REVEAL_CONCURRENCY, queue.length) }, worker));

  if (found) await store.recordSpend('reveal', found);
  refreshBalance();
  if (Object.keys(reveals).length) {
    await store.putReveals(reveals);
    const cached = await store.getCached(domain);
    if (cached) await store.putCached(applyReveals(cached, reveals));
    const saved = (await store.getSaved())[domain];
    if (saved) await store.saveAccount(applyReveals(saved, reveals));
    if (windowId !== null) {
      const view = await store.getView(windowId);
      if (view.status === 'done' && view.domain === domain) {
        await store.setView(windowId, { ...view, result: applyReveals(view.result, reveals) });
      }
    }
  }
  const withEmail = Object.values(reveals).filter((r) => r.email).length;
  return { revealed: withEmail, noEmail: Object.keys(reveals).length - withEmail, failed, error };
}

/** Parallel Apollo enrichment requests during "reveal all". */
const REVEAL_CONCURRENCY = 3;

// ---------- discover ----------

export type DiscoverOutcome =
  | { status: 'ok'; result: DiscoverResult; cached: boolean }
  | { status: 'needs_setup' }
  | { status: 'no_seeds' }
  | { status: 'over_budget'; spent: number; budget: number; cost: number }
  | { status: 'error'; error: LookupError };

const DISCOVER_TTL_MS = 7 * DAY;

/**
 * Find companies like the user's best saved accounts, filtered by their exact ICP rules.
 * One Apollo search page = 1 credit; an unchanged search within 7 days is served from storage.
 */
export async function runDiscover(opts: { more?: boolean; fresh?: boolean; allowOverBudget?: boolean } = {}): Promise<DiscoverOutcome> {
  const [keys, profile, saved, meta, cache, dismissed, previous] = await Promise.all([
    store.getKeys(), store.getProfile(), store.getSaved(), store.getAccountMeta(), store.getAllCached(),
    store.getDismissed(), store.getDiscover(),
  ]);
  if (!keys?.apollo || !profile) return { status: 'needs_setup' };
  const seeds = pickSeeds(saved, meta);
  if (!seeds.length) return { status: 'no_seeds' };

  const key = searchKey(profile.rules, seeds);
  const exclude = [...Object.keys(saved), ...Object.keys(cache), ...dismissed, ...seeds.map((s) => s.domain)];
  const excludeSet = new Set(exclude);
  const same = !opts.fresh && previous && previous.key === key && Date.now() - previous.fetchedAt < DISCOVER_TTL_MS;
  if (same && !opts.more) {
    const result = { ...previous, candidates: mergeCandidates(previous.candidates, [], excludeSet) };
    return { status: 'ok', result, cached: true };
  }

  const [settings, ledger] = await Promise.all([store.getSettings(), store.getLedger()]);
  if (!opts.allowOverBudget && overBudget(ledger, settings, 1)) {
    return { status: 'over_budget', spent: totalSpent(ledger), budget: settings.monthlyBudget!, cost: 1 };
  }
  const page = same && opts.more ? previous.page + 1 : 1;
  try {
    const { organizations, totalEntries } = await apollo.searchOrganizations(
      keys.apollo, buildLookalikeQuery(profile.rules, seeds, exclude, page),
    );
    await store.recordSpend('search');
    refreshBalance();
    const incoming = organizations.map(mapCandidate).filter((c): c is Candidate => c !== null);
    const result: DiscoverResult = {
      key, seeds, filtersLabel: filtersLabel(profile.rules), fetchedAt: same ? previous.fetchedAt : Date.now(), page, totalEntries,
      candidates: mergeCandidates(same && opts.more ? previous.candidates : [], incoming, excludeSet),
    };
    await store.setDiscover(result);
    return { status: 'ok', result, cached: false };
  } catch (err) {
    return { status: 'error', error: toLookupError(err) };
  }
}

// ---------- credit balance ----------


/**
 * Re-read Apollo's credit balance. Only master keys can; for other keys we remember
 * that for a day instead of asking after every lookup.
 */
export async function refreshBalance(force = false): Promise<void> {
  try {
    const [keys, prev] = await Promise.all([store.getKeys(), store.getBalance()]);
    if (!keys?.apollo) return;
    if (!force && prev && !prev.available && Date.now() - prev.checkedAt < DAY) return;
    await store.setBalance(parseBalance(await apollo.getCreditUsage(keys.apollo)));
  } catch (err) {
    if (err instanceof ApiError && err.invalidKey) await store.setBalance({ available: false, checkedAt: Date.now() });
  }
}
