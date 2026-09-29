import type { LookupResult } from './types';

const HEADER = [
  'company', 'domain', 'fit_score', 'best_persona', 'first_name', 'last_name', 'title', 'contact_rank',
  'email', 'email_status', 'linkedin', 'saved_at',
];

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per contact; accounts with no contacts still get one row. */
export function toCsv(saved: (LookupResult & { savedAt: number })[]): string {
  const rows: unknown[][] = [];
  for (const a of saved) {
    const base = [a.company.name, a.domain, a.fit?.score ?? '', a.persona?.chosen ?? ''];
    const savedAt = new Date(a.savedAt).toISOString();
    if (!a.contacts?.length) {
      rows.push([...base, '', '', '', '', '', '', '', savedAt]);
      continue;
    }
    for (const c of a.contacts) {
      rows.push([
        ...base, c.firstName, c.lastName ?? c.lastNameObfuscated ?? '', c.title ?? '', c.rank ?? '',
        c.email ?? '', c.emailStatus ?? '', c.linkedin ?? '', savedAt,
      ]);
    }
  }
  return [HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
