import { browser } from 'wxt/browser';
import * as apollo from './apollo';
import { lookupCost, overBudget, parseBalance, totalSpent, type Settings } from './credits';
import { ApiError, toLookupError } from './errors';
import * as jev from './jev';
import { applyRanks, mapFit, mapPersona, mapWhyNow } from './mapping';
import type { Answer } from './jev';
import {
  ROLE_BATCH, accountQuestions, companyState, jobId, peopleState, rankQuestions, roleQuestions, sellerState,
  siteQuestions, siteRelId, siteTypeId, snippetState, whyNowQuestions, whyNowState,
} from './questions';
import { registrableDomain } from './resolver';
import { scanSite, type SiteScan, type Snippet } from './site-scan';
import { evaluateRules } from './rules';
import { jobCandidates, signalCandidates, type JobCandidate, type SignalCandidate } from './signals';
import * as store from './storage';
import type { Keys, LookupResult, Profile, ViewState, WhyNow } from './types';

const DAY = 24 * 60 * 60 * 1000;

/** Used when no one matches the persona titles. */
const FALLBACK_SENIORITIES = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director'];

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

export async function runLookup(windowId: number, domain: string, opts: LookupOptions = {}): Promise<void> {
  const { force = false, allowOverBudget = false, tabId } = opts;
  const token = Symbol(domain);
  runs.set(windowId, token);
  const show = async (v: ViewState) => {
    if (runs.get(windowId) === token) await store.setView(windowId, v);
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
      return show({ status: 'done', domain, result: { ...hit, contacts }, cached: true });
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
    await show({ status: 'done', domain, result: partial, cached: false });
  } catch (err) {
    await show({ status: 'error', domain, error: toLookupError(err), partial });
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
    findPeople(keys.apollo, company.apolloId, profile.rules.personas),
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
      ? jev
          .ask(keys.typesafe, { ...state, best_persona: persona?.chosen ?? null, people: peopleState(found.contacts) }, rankQuestions(found.contacts))
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

async function findPeople(key: string, organizationId: string, personas: string[]) {
  if (personas.length) {
    const contacts = await apollo.searchPeople(key, { organizationId, titles: personas });
    if (contacts.length) return { contacts, fallback: false };
  }
  const contacts = await apollo.searchPeople(key, { organizationId, seniorities: FALLBACK_SENIORITIES });
  return { contacts, fallback: true };
}

// ---------- reveal ----------

/** Spend one Apollo credit to reveal a person, and patch every copy of them we hold. */
export async function revealContact(windowId: number, domain: string, personId: string): Promise<void> {
  const keys = await store.getKeys();
  if (!keys?.apollo) throw new Error('Missing Apollo key');
  const r = await apollo.revealPerson(keys.apollo, personId);
  // Apollo charges enrichment only when it finds the person.
  if (r.found) await store.recordSpend('reveal');
  refreshBalance();
  const reveal = {
    lastName: r.lastName,
    email: r.email,
    emailStatus: r.emailStatus,
    linkedin: r.linkedin,
    revealedAt: Date.now(),
    ...(r.title ? { title: r.title } : {}),
  };
  await store.putReveal(personId, reveal);

  const patch = (res: LookupResult): LookupResult => ({
    ...res,
    contacts: res.contacts?.map((c) => (c.apolloId === personId ? { ...c, ...reveal } : c)) ?? null,
  });
  const cached = await store.getCached(domain);
  if (cached) await store.putCached(patch(cached));
  const saved = (await store.getSaved())[domain];
  if (saved) await store.saveAccount(patch(saved));
  const view = await store.getView(windowId);
  if (view.status === 'done' && view.domain === domain) {
    await store.setView(windowId, { ...view, result: patch(view.result) });
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
