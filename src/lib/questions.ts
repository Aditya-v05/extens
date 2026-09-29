import type { Question } from './jev';
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
