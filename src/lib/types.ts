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

export interface Check {
  label: string;
  /** null when data is missing. */
  pass: boolean | null;
  source: 'rule' | 'jev';
  /** Jev probability of yes, for semantic checks. */
  p?: number;
  detail?: string;
}

export interface Fit {
  /** 0–100, from the Jev Score. */
  score: number;
  confidence: number;
  checks: Check[];
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

export interface LookupResult {
  domain: string;
  fetchedAt: number;
  company: Company;
  fit: Fit | null;
  persona: PersonaPick | null;
  contacts: Contact[] | null;
  /** True when no persona title matched and we fell back to senior people. */
  contactsFallback?: boolean;
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
  | { status: 'loading'; domain: string; stage: Stage; partial: LookupResult | null }
  | { status: 'done'; domain: string; result: LookupResult; cached: boolean }
  | { status: 'error'; domain: string; error: LookupError; partial: LookupResult | null };
