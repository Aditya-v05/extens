import * as apollo from './apollo';
import { toLookupError } from './errors';
import * as jev from './jev';
import { applyRanks, mapFit, mapPersona } from './mapping';
import { accountQuestions, companyState, peopleState, rankQuestions, sellerState } from './questions';
import { evaluateRules } from './rules';
import * as store from './storage';
import type { Keys, LookupResult, Profile, ViewState } from './types';

/** Used when no one matches the persona titles. */
const FALLBACK_SENIORITIES = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director'];

// ---------- orchestration ----------

/** Latest lookup per window; older runs stop writing when superseded. */
const runs = new Map<number, symbol>();

export async function runLookup(windowId: number, domain: string, force = false): Promise<void> {
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

  let partial: LookupResult | null = null;
  try {
    await show({ status: 'loading', domain, stage: 'company', partial: null });
    partial = await lookup(keys!, profile!, domain, async (stage, p) => {
      partial = p;
      await show({ status: 'loading', domain, stage, partial: p });
    });
    if (!partial) return show({ status: 'not_found', domain });
    await store.putCached(partial);
    await show({ status: 'done', domain, result: partial, cached: false });
  } catch (err) {
    await show({ status: 'error', domain, error: toLookupError(err), partial });
  }
}

type Progress = (stage: 'judging' | 'ranking', partial: LookupResult) => Promise<void>;

async function lookup(keys: Keys, profile: Profile, domain: string, progress: Progress): Promise<LookupResult | null> {
  const org = await apollo.enrichOrganization(keys.apollo, domain);
  if (!org) return null;
  const company = apollo.mapOrganization(org, domain);
  let result: LookupResult = { domain, fetchedAt: Date.now(), company, fit: null, persona: null, contacts: null };
  await progress('judging', result);

  const seller = sellerState(profile);
  const state = { seller, company: companyState(company) };

  // Jev #1 (fit, checks, persona) runs alongside the free people search.
  const [answers, found] = await Promise.all([
    jev.ask(keys.typesafe, state, accountQuestions(profile)),
    findPeople(keys.apollo, company.apolloId, profile.rules.personas),
  ]);
  const persona = mapPersona(answers, profile);
  result = {
    ...result,
    fit: mapFit(answers, profile, evaluateRules(profile.rules, company)),
    persona,
    contacts: found.contacts,
    contactsFallback: found.fallback,
  };
  await progress('ranking', result);

  if (found.contacts.length) {
    const rankAnswers = await jev.ask(
      keys.typesafe,
      { ...state, best_persona: persona?.chosen ?? null, people: peopleState(found.contacts) },
      rankQuestions(found.contacts),
    );
    result = { ...result, contacts: await store.withReveals(applyRanks(found.contacts, rankAnswers)) };
  }
  return result;
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
