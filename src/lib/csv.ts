import { EMPTY_META, STATUS_LABELS, type AccountMeta } from './accounts';
import type { LookupResult } from './types';

const HEADER = [
  'company', 'domain', 'status', 'note', 'fit_score', 'timing_score', 'top_signal', 'best_persona', 'first_name', 'last_name', 'title', 'contact_rank',
  'email', 'email_status', 'linkedin', 'saved_at',
];

function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per contact; accounts with no contacts still get one row. */
export function toCsv(saved: (LookupResult & { savedAt: number })[], meta: Record<string, AccountMeta> = {}): string {
  const rows: unknown[][] = [];
  for (const a of saved) {
    const top = a.whyNow?.signals.find((s) => s.relevance >= 0.5);
    const m = meta[a.domain] ?? EMPTY_META;
    const base = [
      a.company.name, a.domain, STATUS_LABELS[m.status], m.note, a.fit?.score ?? '', a.whyNow?.timing ?? '',
      top ? [top.label, top.detail].filter(Boolean).join(': ') : '', a.persona?.chosen ?? '',
    ];
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
