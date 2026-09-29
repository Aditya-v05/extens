import { describe, expect, it } from 'vitest';
import type { JobPosting } from './apollo';
import { jobCandidates, normalizeJobTitle, signalCandidates } from './signals';

const NOW = Date.UTC(2026, 8, 29);
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const job = (title: string, posted: number, extra: Partial<JobPosting> = {}): JobPosting => ({
  title, url: `https://jobs.example/${posted}`, postedAt: daysAgo(posted), lastSeenAt: daysAgo(1),
  city: null, state: null, country: null, ...extra,
});

describe('normalizeJobTitle', () => {
  it.each([
    ['Customer Success Manager, Enterprise North America →', 'Customer Success Manager'],
    ['Product Support Specialist, Pacific/Mountain Time', 'Product Support Specialist'],
    ['Senior Customer Success Manager - Enterprise', 'Senior Customer Success Manager, Enterprise'],
    ['Account Executive (Remote, US)', 'Account Executive'],
    ['Technical Recruiter', 'Technical Recruiter'],
    ['Senior AI Deployment Consultant Sydney', 'Senior AI Deployment Consultant'],
    ['Solutions Engineer New San Francisco', 'Solutions Engineer'],
    ['Staff Data Engineer, GTM New Dublin, Ireland; London, England', 'Staff Data Engineer'],
    ['Relationship Manager, Mid Market', 'Relationship Manager, Mid Market'],
    ['New Business Account Executive', 'New Business Account Executive'],
  ])('%s → %s', (raw, clean) => expect(normalizeJobTitle(raw)).toBe(clean));

  it('strips places from the company\'s own postings', () => {
    expect(normalizeJobTitle('Senior Solutions Architect, LATAM New NYC, Remote; San Francisco, California', ['California']))
      .toBe('Senior Solutions Architect');
  });

  it('strips segments naming the posting location', () => {
    expect(normalizeJobTitle('Customer Success Manager, High Touch New Chicago, Illinois', ['Chicago', 'Illinois', 'United States']))
      .toBe('Customer Success Manager');
  });
});

describe('jobCandidates', () => {
  it('merges the same role across locations, keeping the oldest posting', () => {
    const jobs = jobCandidates([
      job('Customer Success Manager, New York', 5, { city: 'New York' }),
      job('Customer Success Manager, Remote - EMEA', 40),
      job('Deal Desk', 10),
    ], NOW);
    expect(jobs.map((j) => [j.title, j.daysOpen])).toEqual([['Deal Desk', 10], ['Customer Success Manager', 40]]);
  });

  it('drops postings Apollo has not seen for 45+ days', () => {
    expect(jobCandidates([job('Old role', 200, { lastSeenAt: daysAgo(60) })], NOW)).toEqual([]);
  });
});

describe('signalCandidates', () => {
  const org = {
    estimated_num_employees: 180,
    organization_headcount_six_month_growth: 0.211,
    organization_headcount_twelve_month_growth: 0.419,
    funding_events: [
      { date: '2023-09-01T00:00:00.000+00:00', type: 'Series B', amount: '35M', currency: '$' },
      { date: '2025-06-01T00:00:00.000+00:00', type: 'Series C', amount: '82M', currency: '$', news_url: 'https://news.example/c' },
    ],
  };
  const threeJobs = jobCandidates([job('A', 3), job('B', 12), job('C', 50)], NOW);

  it('builds growth, latest funding and hiring volume from facts', () => {
    const s = signalCandidates(org, threeJobs, NOW);
    expect(s.map((x) => [x.kind, x.label, x.detail])).toEqual([
      ['headcount_growth', 'Headcount +21% in 6 months', '+42% in 12 months'],
      ['funding', 'Raised $82M Series C', 'Jun 2025 · 1 year ago'],
      ['hiring_volume', '3 open roles', '2 posted in the last 30 days'],
    ]);
    expect(s[1]!.evidence[0]).toMatchObject({ url: 'https://news.example/c' });
  });

  it('reports decline, labels acquisitions, and skips stale funding', () => {
    const s = signalCandidates({
      organization_headcount_six_month_growth: -0.05,
      organization_headcount_twelve_month_growth: -0.07,
      funding_events: [{ date: '2026-09-01', type: 'Merger / Acquisition', amount: '3.6B', currency: '$' }],
    }, [], NOW);
    expect(s.map((x) => x.label)).toEqual(['Headcount -5% in 6 months', 'Merger / acquisition ($3.6B)']);
    expect(signalCandidates({ latest_funding_round_date: '2020-01-01', latest_funding_stage: 'Seed' }, [], NOW)).toEqual([]);
  });

  it('ignores flat headcount and thin hiring', () => {
    expect(signalCandidates({ organization_headcount_six_month_growth: 0.01 }, threeJobs.slice(0, 2), NOW)).toEqual([]);
  });
});
