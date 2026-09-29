import type { SiteSignalType } from './site-types';

export interface Keys {
  apollo: string;
  typesafe: string;
}

/** The seller's own answers from onboarding, kept verbatim for Jev's context. */
export interface ProfileAnswers {
  sells: string;
  icp: string;
  buyers: string;
}

/** Editable rules generated from the answers. */
export interface Rules {
  /** Exact, checked in code. null = no constraint. */
  headcount: { min: number | null; max: number | null } | null;
  /** Exact, checked in code against Apollo's country. Empty = any. */
  countries: string[];
  /** Semantic, each asked to Jev as a yes/no question. */
  checks: string[];
  /** Buyer titles, used for Apollo search and Jev persona choice. */
  personas: string[];
}

export interface Profile {
  answers: ProfileAnswers;
  rules: Rules;
  updatedAt: number;
}

export interface Company {
  apolloId: string;
  name: string;
  domain: string;
  logo: string | null;
  industry: string | null;
  headcount: number | null;
  country: string | null;
  city: string | null;
  fundingStage: string | null;
  totalFunding: string | null;
  foundedYear: number | null;
  description: string | null;
  keywords: string[];
  linkedin: string | null;
}

/**
 * met / not_met: clear answer. near: an exact rule missed by a small margin (e.g. 520 vs a 500 cap).
 * unsure: Jev can't tell (probability between 0.35 and 0.65). unknown: Apollo has no data.
 */
export type CheckState = 'met' | 'near' | 'unsure' | 'not_met' | 'unknown';

export interface Check {
  label: string;
  /** Kept for results cached before `state` existed; prefer `state`. null when data is missing. */
  pass: boolean | null;
  state?: CheckState;
  /** 0–1 contribution to the requirements score; null = not counted (unknown). */
  credit?: number | null;
  source: 'rule' | 'jev';
  /** Jev probability of yes, for semantic checks. */
  p?: number;
  detail?: string;
}

export interface Fit {
  /** 0–100 headline: 75% requirements + 25% Jev's overall judgment (overall alone when there are no checks). */
  score: number;
  confidence: number;
  checks: Check[];
  /** 0–100 average credit over the checks; null when no check could be judged. */
  requirements?: number | null;
  /** 0–100 Jev's holistic ICP judgment (the Score question). */
  overall?: number;
}

export interface PersonaPick {
  /** null when Jev says none of the personas fit. */
  chosen: string | null;
  confidence: number;
  distribution: Record<string, number>;
}

export interface Contact {
  apolloId: string;
  firstName: string;
  lastName: string | null;
  lastNameObfuscated: string | null;
  title: string | null;
  hasEmail: boolean;
  /** 0–100 relevance, from the Jev Score. null until ranked. */
  rank: number | null;
  email?: string | null;
  emailStatus?: string | null;
  linkedin?: string | null;
  revealedAt?: number;
}

export interface Evidence {
  label: string;
  url?: string | null;
  /** ISO date. */
  date?: string | null;
}

export type SignalKind = 'hiring' | 'hiring_volume' | 'headcount_growth' | 'headcount_decline' | 'funding' | 'site';

export interface Signal {
  kind: SignalKind;
  /** For kind 'site': which type from the fixed library (SITE_SIGNAL_TYPES). */
  siteType?: SiteSignalType;
  /** Written by code from facts, never by a model. */
  label: string;
  detail?: string;
  /** Jev probability that this signal makes now a good time, given what the seller sells. */
  relevance: number;
  evidence: Evidence[];
}

export interface WhyNow {
  /** 0–100 from the Jev Score; null when there were no signals to judge. */
  timing: number | null;
  /** Sorted by relevance, most relevant first. */
  signals: Signal[];
  /** ok, unavailable (not on the key's plan), or off (turned off in Settings to save credits). */
  jobsStatus: 'ok' | 'unavailable' | 'off';
  /**
   * Website signals: ok, unavailable (no access to a tab on this company's site, e.g. a typed-in
   * domain), or off (turned off in Settings). Missing on results cached before website signals.
   */
  siteStatus?: 'ok' | 'unavailable' | 'off';
}

export interface LookupResult {
  domain: string;
  fetchedAt: number;
  company: Company;
  fit: Fit | null;
  persona: PersonaPick | null;
  contacts: Contact[] | null;
  /** True when no persona title matched and we fell back to senior people. */
  contactsFallback?: boolean;
  /** undefined on results cached before "why now" existed. */
  whyNow?: WhyNow | null;
}

export type Service = 'apollo' | 'jev';

export interface LookupError {
  service: Service;
  status: number | null;
  message: string;
  invalidKey: boolean;
}

export type Stage = 'company' | 'judging' | 'ranking' | 'done';

export type ViewState =
  | { status: 'idle' }
  | { status: 'needs_setup'; missing: ('keys' | 'profile')[] }
  | { status: 'not_company'; url: string | null }
  | { status: 'not_found'; domain: string }
  | { status: 'over_budget'; domain: string; spent: number; budget: number; cost: number }
  | { status: 'loading'; domain: string; stage: Stage; partial: LookupResult | null }
  | { status: 'done'; domain: string; result: LookupResult; cached: boolean }
  | { status: 'error'; domain: string; error: LookupError; partial: LookupResult | null };
