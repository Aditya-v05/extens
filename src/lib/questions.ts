import type { Question } from './jev';
import { SITE_SIGNAL_TYPES } from './site-types';
import type { Snippet } from './site-scan';
import type { JobCandidate, SignalCandidate } from './signals';
import type { Company, Contact, Profile } from './types';

export const FIT_LEVELS = [
  'Clearly outside the ICP: the wrong kind of company for what the seller sells.',
  'Weak fit: some overlap, but at least one major mismatch with the ICP.',
  'Partial fit: the right kind of company, but several ICP criteria are unmet or unclear.',
  'Strong fit: meets most ICP criteria and plausibly needs what the seller sells.',
  'Textbook ICP customer: meets the ICP criteria and clearly needs what the seller sells.',
];

export const RANK_LEVELS = [
  'Unlikely to be involved in buying what the seller sells.',
  'Might influence the purchase but is unlikely to own the problem.',
  'Likely a key stakeholder in the problem the seller solves.',
  'Most likely owns the problem the seller solves and the budget for it.',
];

export function sellerState(profile: Profile) {
  return {
    sells: profile.answers.sells,
    ideal_customer: profile.answers.icp,
    typical_buyers: profile.answers.buyers,
  };
}

export function companyState(c: Company) {
  return {
    name: c.name,
    domain: c.domain,
    description: c.description,
    industry: c.industry,
    keywords: c.keywords,
    employees: c.headcount,
    country: c.country,
    funding_stage: c.fundingStage,
    total_funding: c.totalFunding,
    founded_year: c.foundedYear,
  };
}

export const checkId = (i: number) => `check_${i}`;
export const personaId = (i: number) => `persona_${i}`;
export const rankId = (i: number) => `rank_${i}`;
export const NONE_FIT = 'none_fit';

/** Decisions 1 (account) and the persona half of 3, asked together in one call. */
export function accountQuestions(profile: Profile): Record<string, Question> {
  const q: Record<string, Question> = {
    icp_fit: {
      type: 'score',
      instructions:
        'How well does `company` match the ideal customer described in `seller.ideal_customer`, given what the seller sells (`seller.sells`)?',
      criteria: FIT_LEVELS,
    },
  };
  profile.rules.checks.forEach((check, i) => {
    q[checkId(i)] = {
      type: 'noul',
      instructions: `Does \`company\` satisfy this criterion from the seller's ideal customer profile: "${check}"?`,
    };
  });
  const personas = profile.rules.personas;
  if (personas.length) {
    const criteria: Record<string, string> = {};
    personas.forEach((p, i) => (criteria[personaId(i)] = p));
    criteria[NONE_FIT] = 'None of these roles would own this problem at this company.';
    q.persona = {
      type: 'choice',
      instructions:
        'At `company`, which of these roles most likely owns the problem the seller solves (`seller.sells`) and would buy it?',
      criteria,
    };
  }
  return q;
}

export function peopleState(contacts: Contact[]) {
  return contacts.map((c) => ({ title: c.title ?? 'Unknown title' }));
}

/** Decision 3: one Score per candidate, batched into one call. */
export function rankQuestions(contacts: Contact[]): Record<string, Question> {
  const q: Record<string, Question> = {};
  contacts.forEach((_, i) => {
    q[rankId(i)] = {
      type: 'score',
      instructions: `How likely is the person \`people[${i}]\` at \`company\` to own the problem the seller solves (\`seller.sells\`)? The seller's usual buyers are \`seller.typical_buyers\`; \`best_persona\` is the role judged most likely to own it here.`,
      criteria: RANK_LEVELS,
    };
  });
  return q;
}

// ---------- Decision 2: timing ("why now") ----------

export const TIMING_LEVELS = [
  'No sign that now is a particularly good time to reach out.',
  'Mild signals: something is changing, but it is only loosely related to what the seller sells.',
  'Clear signals: recent changes make what the seller sells more relevant now.',
  'Strong, recent signals that the company needs what the seller sells right now.',
];

export const jobId = (i: number) => `job_${i}`;
export const signalId = (i: number) => `signal_${i}`;

export function whyNowState(signals: SignalCandidate[], jobs: JobCandidate[], snippets: Snippet[] = []) {
  return {
    signals: signals.map((s) => s.fact),
    open_roles: jobs.map((j) => ({ title: j.title, days_open: j.daysOpen })),
    ...(snippets.length ? { website: snippetState(snippets) } : {}),
  };
}

export function snippetState(snippets: Snippet[]) {
  return snippets.map((s) => ({ text: s.text, page: s.source, date: s.date }));
}

/** Overall timing Score plus one yes/no per fact-based signal. */
export function whyNowQuestions(signals: SignalCandidate[]): Record<string, Question> {
  const q: Record<string, Question> = {
    timing: {
      type: 'score',
      instructions:
        'Considering `signals`, `open_roles` and anything on the company\'s own `website`, how strongly does the current situation at `company` suggest that now is a good time for the seller to reach out, given what the seller sells (`seller.sells`)?',
      criteria: TIMING_LEVELS,
    },
  };
  signals.forEach((_, i) => {
    q[signalId(i)] = {
      type: 'noul',
      instructions: `Given what the seller sells (\`seller.sells\`), does \`signals[${i}]\` make now an especially good time for the seller to reach out to \`company\`?`,
    };
  });
  return q;
}

/**
 * Roles are judged in batches this size. Long lists squeeze answers toward 0.5:
 * on a 38-role eval, one call of 40 scored 31/38, batches of 10 scored 38/38 (eval/roles-eval.mjs).
 */
export const ROLE_BATCH = 10;

/** One yes/no per role in a batch; ids are local to the batch (`job_0`..). */
export function roleQuestions(count: number): Record<string, Question> {
  // Wording chosen by eval/roles-eval.mjs: anchoring on the buyers' team beat "the function the product serves".
  const q: Record<string, Question> = {};
  for (let i = 0; i < count; i++) {
    q[jobId(i)] = {
      type: 'noul',
      instructions: `Is \`open_roles[${i}]\` a role in the team or department run by the seller's typical buyers (\`seller.typical_buyers\`), i.e. the people who would use the seller's product (\`seller.sells\`)?`,
      criteria: {
        true: "Yes: this hire joins the team that uses or owns the seller's product.",
        false: "No: this hire is in another function (for example sales, engineering, design, recruiting, finance or product), unless that function is the one the seller's product serves.",
      },
    };
  }
  return q;
}

// ---------- website signals ----------

export const siteTypeId = (i: number) => `site_type_${i}`;
export const siteRelId = (i: number) => `site_rel_${i}`;

/**
 * Per snippet: which signal type it shows (Choice over SITE_SIGNAL_TYPES) and whether it makes
 * now a good time for this seller (Noul). Ids are local to the batch; state is `website`.
 * Type wording checked by eval/site-signals-eval.mjs (29/30 on real snippets).
 */
export function siteQuestions(count: number): Record<string, Question> {
  const q: Record<string, Question> = {};
  for (let i = 0; i < count; i++) {
    q[siteTypeId(i)] = {
      type: 'choice',
      instructions: `What does the website snippet \`website[${i}]\` (from \`company\`'s own site) announce or show about the company? Pick "none" for generic marketing copy, how-to or thought-leadership posts, and engineering write-ups.`,
      criteria: { ...SITE_SIGNAL_TYPES },
    };
    q[siteRelId(i)] = {
      type: 'noul',
      instructions: `Given what the seller sells (\`seller.sells\`), does \`website[${i}]\` make now an especially good time for the seller to reach out to \`company\`?`,
    };
  }
  return q;
}
