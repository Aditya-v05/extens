import { SENIOR, functionKeywords } from './people';
import type { Check, Company, ProfileAnswers, Rules } from './types';

const EMPLOYEE_WORDS = String.raw`(?:employees?|people|staff|ftes?|headcount|persons?|emp)`;
const NUM = String.raw`(\d[\d,.]*\s*k?)`;

function toNumber(raw: string): number {
  const s = raw.replace(/[\s,]/g, '').toLowerCase();
  const n = parseFloat(s);
  return s.endsWith('k') ? Math.round(n * 1000) : Math.round(n);
}

export interface HeadcountMatch {
  min: number | null;
  max: number | null;
  matched: string;
}

export function parseHeadcount(text: string): HeadcountMatch | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => [number | null, number | null]][] = [
    [new RegExp(`${NUM}\\s*(?:-|–|—|to)\\s*${NUM}\\s*\\+?\\s*${EMPLOYEE_WORDS}`, 'i'), (m) => [toNumber(m[1]!), toNumber(m[2]!)]],
    [new RegExp(`${NUM}\\s*\\+\\s*${EMPLOYEE_WORDS}`, 'i'), (m) => [toNumber(m[1]!), null]],
    [new RegExp(`(?:under|fewer than|less than|up to|below|<)\\s*${NUM}\\s*${EMPLOYEE_WORDS}`, 'i'), (m) => [null, toNumber(m[1]!)]],
    [new RegExp(`(?:over|more than|at least|above|>)\\s*${NUM}\\s*${EMPLOYEE_WORDS}`, 'i'), (m) => [toNumber(m[1]!), null]],
  ];
  for (const [re, pick] of patterns) {
    const m = text.match(re);
    if (m) {
      const [min, max] = pick(m);
      return { min, max, matched: m[0] };
    }
  }
  return null;
}

/** Aliases → Apollo country names. Regions expand to several countries. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  'united states': ['United States'], usa: ['United States'], 'u.s.': ['United States'], us: ['United States'],
  america: ['United States'],
  canada: ['Canada'],
  'united kingdom': ['United Kingdom'], uk: ['United Kingdom'], britain: ['United Kingdom'],
  germany: ['Germany'], france: ['France'], spain: ['Spain'], italy: ['Italy'], netherlands: ['Netherlands'],
  ireland: ['Ireland'], sweden: ['Sweden'], norway: ['Norway'], denmark: ['Denmark'], finland: ['Finland'],
  switzerland: ['Switzerland'], austria: ['Austria'], belgium: ['Belgium'], poland: ['Poland'], portugal: ['Portugal'],
  israel: ['Israel'], india: ['India'], singapore: ['Singapore'], australia: ['Australia'], 'new zealand': ['New Zealand'],
  japan: ['Japan'], brazil: ['Brazil'], mexico: ['Mexico'], 'united arab emirates': ['United Arab Emirates'], uae: ['United Arab Emirates'],
  'north america': ['United States', 'Canada'],
  dach: ['Germany', 'Austria', 'Switzerland'],
  nordics: ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
  benelux: ['Belgium', 'Netherlands', 'Luxembourg'],
  anz: ['Australia', 'New Zealand'],
  europe: ['United Kingdom', 'Ireland', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Sweden',
    'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Poland', 'Portugal', 'Czech Republic', 'Estonia'],
};

export function parseCountries(text: string): { countries: string[]; matched: string[] } {
  const countries = new Set<string>();
  const matched: string[] = [];
  // Longest aliases first so "north america" wins over "america".
  const aliases = Object.keys(COUNTRY_ALIASES).sort((a, b) => b.length - a.length);
  let rest = text;
  for (const alias of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // "us" only counts in caps ("US"); lowercase it's the pronoun.
    const target =
      alias === 'us' ? /(?<![\w.])US(?!\w)/g : new RegExp(`(?<![\\w.])${escaped}(?!\\w)`, 'gi');
    const hits = rest.match(target);
    if (hits) {
      for (const c of COUNTRY_ALIASES[alias]!) countries.add(c);
      matched.push(...hits);
      rest = rest.replace(target, ' ');
    }
  }
  return { countries: [...countries], matched };
}

const FILLER = /^(?:and|with|that|who|which|are|is|have|has|in|based in|located in|headquartered in|the|a|an|of|or|,|\s)+|(?:\s|,|and|or|in|the)+$/gi;
const ONLY_STOPWORDS = /^(?:and|with|that|who|in|based|located|the|a|an|of|or|companies|company|businesses)?$/i;

function cleanClause(clause: string): string {
  let prev: string;
  let s = clause.trim();
  do {
    prev = s;
    s = s.replace(FILLER, '').trim();
  } while (s !== prev);
  return s.replace(/\.$/, '').trim();
}

export function splitList(text: string, extraSeparators: RegExp | null = null): string[] {
  let parts = text.split(/[,;\n•]+/);
  if (extraSeparators) parts = parts.flatMap((p) => p.split(extraSeparators));
  return parts.map((p) => p.trim().replace(/\.$/, '').trim()).filter(Boolean);
}

/** Turn onboarding free text into editable rules. Pure code: no model call. */
export function generateRules(answers: ProfileAnswers): Rules {
  let icp = answers.icp;
  const hc = parseHeadcount(icp);
  if (hc) icp = icp.replace(hc.matched, ' ');
  const geo = parseCountries(icp);
  for (const m of geo.matched) icp = icp.replace(m, ' ');

  const checks = splitList(icp)
    .map(cleanClause)
    .filter((c) => c.length > 2 && !ONLY_STOPWORDS.test(c));

  const personas = [...new Set(splitList(answers.buyers, /\s+or\s+|\s*\/\s*/i))];

  return {
    headcount: hc ? { min: hc.min, max: hc.max } : null,
    countries: geo.countries,
    checks: [...new Set(checks)],
    personas,
    seniorities: [...SENIOR],
    keywords: functionKeywords(personas),
    excludeTitles: [],
  };
}

export function headcountLabel(h: NonNullable<Rules['headcount']>): string {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (h.min !== null && h.max !== null) return `${fmt(h.min)}–${fmt(h.max)} employees`;
  if (h.min !== null) return `${fmt(h.min)}+ employees`;
  if (h.max !== null) return `Up to ${fmt(h.max)} employees`;
  return 'Any size';
}

/** Headcount this close outside a limit (as a share of the limit) is a near miss, not a fail. */
export const NEAR_MISS = 0.1;

/** Exact rules, evaluated in code against Apollo facts. */
export function evaluateRules(rules: Rules, company: Company): Check[] {
  const out: Check[] = [];
  const h = rules.headcount;
  if (h && (h.min !== null || h.max !== null)) {
    const n = company.headcount;
    const base = { label: headcountLabel(h), source: 'rule' as const };
    if (n === null) {
      out.push({ ...base, pass: null, state: 'unknown', credit: null, detail: 'Headcount unknown' });
    } else {
      const inside = (h.min === null || n >= h.min) && (h.max === null || n <= h.max);
      const near =
        !inside &&
        (h.max === null || n <= h.max * (1 + NEAR_MISS)) &&
        (h.min === null || n >= h.min * (1 - NEAR_MISS));
      const fmt = n.toLocaleString('en-US');
      out.push({
        ...base,
        pass: inside,
        state: inside ? 'met' : near ? 'near' : 'not_met',
        credit: inside ? 1 : near ? 0.5 : 0,
        detail: near ? `${fmt}, just ${h.max !== null && n > h.max ? 'over' : 'under'}` : `${fmt} employees`,
      });
    }
  }
  if (rules.countries.length) {
    const c = company.country;
    const label = rules.countries.length > 3 ? `Based in ${rules.countries.slice(0, 3).join(', ')} +${rules.countries.length - 3}` : `Based in ${rules.countries.join(', ')}`;
    const pass = c ? rules.countries.some((x) => x.toLowerCase() === c.toLowerCase()) : null;
    out.push({
      label,
      source: 'rule',
      pass,
      state: pass === null ? 'unknown' : pass ? 'met' : 'not_met',
      credit: pass === null ? null : pass ? 1 : 0,
      detail: c ?? 'Country unknown',
    });
  }
  return out;
}
