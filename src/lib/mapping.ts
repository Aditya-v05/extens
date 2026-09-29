import { scoreToPercent, type Answer } from './jev';
import { FIT_LEVELS, NONE_FIT, RANK_LEVELS, TIMING_LEVELS, checkId, jobId, rankId, signalId } from './questions';
import type { JobCandidate, SignalCandidate } from './signals';
import type { Check, Contact, Fit, PersonaPick, Profile, Signal, WhyNow } from './types';

export function mapFit(answers: Record<string, Answer>, profile: Profile, ruleChecks: Check[]): Fit | null {
  const fit = answers.icp_fit;
  if (fit?.type !== 'score') return null;
  const jevChecks: Check[] = profile.rules.checks.map((label, i) => {
    const a = answers[checkId(i)];
    const p = a?.type === 'noul' ? a.noul : undefined;
    return { label, source: 'jev', p, pass: p === undefined ? null : p >= 0.5 };
  });
  return {
    score: scoreToPercent(fit.score, FIT_LEVELS.length),
    confidence: fit.confidence,
    checks: [...ruleChecks, ...jevChecks],
  };
}

export function mapPersona(answers: Record<string, Answer>, profile: Profile): PersonaPick | null {
  const a = answers.persona;
  if (a?.type !== 'choice') return null;
  const title = (id: string) => (id === NONE_FIT ? 'None fit' : profile.rules.personas[Number(id.split('_')[1])] ?? id);
  const distribution: Record<string, number> = {};
  for (const [id, p] of Object.entries(a.probabilities)) distribution[title(id)] = p;
  return { chosen: a.choice === NONE_FIT ? null : title(a.choice), confidence: a.confidence, distribution };
}

/** Attach rank scores, then sort: reachable people first, then by rank. */
export function applyRanks(contacts: Contact[], answers: Record<string, Answer>): Contact[] {
  const ranked = contacts.map((c, i) => {
    const a = answers[rankId(i)];
    return { ...c, rank: a?.type === 'score' ? scoreToPercent(a.score, RANK_LEVELS.length) : null };
  });
  return ranked.sort((a, b) => Number(b.hasEmail) - Number(a.hasEmail) || (b.rank ?? -1) - (a.rank ?? -1));
}

/** Relevant open roles collapse into one "hiring" signal; the rest keep their own relevance. */
export function mapWhyNow(
  answers: Record<string, Answer>,
  candidates: SignalCandidate[],
  jobs: JobCandidate[],
  jobsStatus: WhyNow['jobsStatus'],
): WhyNow {
  const noul = (id: string) => {
    const a = answers[id];
    return a?.type === 'noul' ? a.noul : 0;
  };
  const signals: Signal[] = candidates.map((c, i) => ({
    kind: c.kind, label: c.label, detail: c.detail, evidence: c.evidence, relevance: noul(signalId(i)),
  }));

  const relevantJobs = jobs
    .map((j, i) => ({ ...j, p: noul(jobId(i)) }))
    .filter((j) => j.p >= 0.5)
    .sort((a, b) => b.p - a.p);
  if (relevantJobs.length) {
    const n = relevantJobs.length;
    const titles = relevantJobs.slice(0, 3).map((j) => j.title);
    signals.push({
      kind: 'hiring',
      label: `Hiring ${n} relevant role${n === 1 ? '' : 's'}`,
      detail: titles.join(', ') + (n > 3 ? ` +${n - 3} more` : ''),
      relevance: relevantJobs[0]!.p,
      evidence: relevantJobs.map((j) => ({ label: j.title, url: j.url, date: j.postedAt })),
    });
  }

  const timing = answers.timing;
  return {
    timing: timing?.type === 'score' ? scoreToPercent(timing.score, TIMING_LEVELS.length) : null,
    signals: signals.sort((a, b) => b.relevance - a.relevance),
    jobsStatus,
  };
}
