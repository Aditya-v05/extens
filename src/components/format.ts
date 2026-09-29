export const pct = (p: number) => `${Math.round(p * 100)}%`;

export function ago(t: number, now = Date.now()): string {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
