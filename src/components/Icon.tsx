import type { CheckState } from '@/lib/types';

/** Thin line glyphs for check states: no emoji, same stroke everywhere. */
export function StateIcon({ state, size = 14 }: { state: CheckState; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const title = STATE_TITLES[state];
  return (
    <svg {...common} className={`state-${state}`} role="img" aria-label={title}>
      <title>{title}</title>
      {state === 'met' && <path d="M3.5 8.5l3 3 6-7" />}
      {state === 'not_met' && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />}
      {state === 'near' && <path d="M3 9c1.5-2 3-2 5 0s3.5 2 5 0" />}
      {state === 'unsure' && <circle cx="8" cy="8" r="5" strokeDasharray="2.2 2.2" />}
      {state === 'unknown' && <path d="M4.5 8h7" />}
    </svg>
  );
}

export const STATE_TITLES: Record<CheckState, string> = {
  met: 'Met',
  near: 'Near miss',
  unsure: 'Unsure',
  not_met: 'Not met',
  unknown: 'No data',
};

/** One segment per requirement, coloured by its state: "3 of 4" at a glance. */
export function RequirementStrip({ states }: { states: CheckState[] }) {
  if (!states.length) return null;
  return (
    <div className="strip" role="img" aria-label={states.map((s) => STATE_TITLES[s]).join(', ')}>
      {states.map((s, i) => <span key={i} className={`seg seg-${s}`} />)}
    </div>
  );
}
