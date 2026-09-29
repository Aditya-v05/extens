import { totalSpent } from '@/lib/credits';
import type { CreditState } from './useCredits';

const fmt = (n: number) => n.toLocaleString('en-US');

function Bar({ used, of }: { used: number; of: number }) {
  const ratio = of > 0 ? Math.min(used / of, 1) : 1;
  const tone = ratio >= 0.9 ? 'bad' : ratio >= 0.7 ? 'warn' : 'ok';
  return (
    <div className={`credit-bar ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={used}>
      <div style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

/**
 * Apollo's real balance when the key can read it (master keys); otherwise what ICP Scout
 * has spent this month, against the user's budget if they set one.
 */
export function CreditBar({ credits, onSettings }: { credits: CreditState; onSettings: () => void }) {
  const { settings, ledger, balance } = credits;
  const spent = totalSpent(ledger);
  const budget = settings.monthlyBudget;

  if (balance?.available) {
    const resets = balance.cycleEnd ? new Date(balance.cycleEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
    return (
      <div className="credits">
        <div className="row spread small">
          <span><strong>{fmt(balance.leftOver)}</strong> Apollo credits left</span>
          <span className="muted">{resets ? `resets ${resets}` : `of ${fmt(balance.limit)}`}</span>
        </div>
        <Bar used={balance.consumed} of={balance.limit} />
        <div className="small muted">
          ICP Scout used {fmt(spent)} this month{budget !== null && `, budget ${fmt(budget)}`}
        </div>
      </div>
    );
  }

  return (
    <div className="credits">
      <div className="row spread small">
        <span>
          <strong>{fmt(spent)}</strong>
          {budget !== null ? ` of ${fmt(budget)}` : ''} Apollo credits used this month
        </span>
        <button className="link small" onClick={onSettings}>{budget === null ? 'Set budget' : 'Budget'}</button>
      </div>
      {budget !== null && <Bar used={spent} of={budget} />}
    </div>
  );
}
