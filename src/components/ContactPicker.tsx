import { useEffect, useState } from 'react';
import { revealable, splitContacts } from '@/lib/contacts';
import { overBudget, totalSpent } from '@/lib/credits';
import { describeError } from '@/lib/errors';
import type { RevealOutcome } from '@/lib/pipeline';
import type { Contact } from '@/lib/types';
import { useCredits } from './useCredits';

export function contactName(c: Contact): string {
  return `${c.firstName} ${c.lastName ?? (c.lastNameObfuscated ? `${c.lastNameObfuscated[0]}.` : '')}`.trim();
}

type Reveal = (personIds: string[]) => Promise<RevealOutcome>;

/**
 * The best contacts up front (more than one when they're nearly as good), everyone else in a list that
 * expands inside the panel, and one action to reveal every remaining email.
 */
export function ContactPicker({ contacts, reveal }: { contacts: Contact[]; reveal: Reveal }) {
  const { featured, others } = splitContacts(contacts);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // A different company starts closed.
  const ids = contacts.map((c) => c.apolloId).join();
  useEffect(() => {
    setOpen(false);
    setMessage(null);
  }, [ids]);

  const run = async (personIds: string[]) => {
    const out = await reveal(personIds);
    if (personIds.length > 1 || out.failed) setMessage(outcomeText(out));
    return out;
  };

  return (
    <div className="contact-list stack">
      <div className="row spread">
        <h2>{featured.length > 1 ? 'Best contacts' : 'Best contact'}</h2>
        <span className="small muted">{contacts.length} found</span>
      </div>

      {featured.map((c) => <ContactRow key={c.apolloId} contact={c} reveal={run} />)}

      {others.length > 0 && (
        <>
          <button className="link disclosure" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} {others.length} more contact{others.length === 1 ? '' : 's'}
          </button>
          {open && (
            <ul className="more">
              {others.map((c) => <li key={c.apolloId}><ContactRow contact={c} reveal={run} compact /></li>)}
            </ul>
          )}
        </>
      )}

      <RevealAll contacts={contacts} reveal={run} />
      {message && <p className="small muted reveal-result" role="status">{message}</p>}
    </div>
  );
}

function outcomeText(o: RevealOutcome): string {
  const parts = [`Revealed ${o.revealed} email${o.revealed === 1 ? '' : 's'}`];
  if (o.noEmail) parts.push(`${o.noEmail} had no email in Apollo`);
  if (o.failed) parts.push(`${o.failed} failed${o.error ? `: ${describeError(o.error)}` : ''}`);
  return `${parts.join('. ')}.`;
}

/** Reveal every remaining email at once, after an inline confirmation that states the cost. */
function RevealAll({ contacts, reveal }: { contacts: Contact[]; reveal: Reveal }) {
  const { settings, ledger } = useCredits();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = revealable(contacts);
  if (pending.length < 2) return null;

  const n = pending.length;
  const over = overBudget(ledger, settings, n);
  const go = async () => {
    setBusy(true);
    await reveal(pending.map((c) => c.apolloId));
    setBusy(false);
    setConfirming(false);
  };

  if (!confirming) {
    return (
      <button className="primary" onClick={() => setConfirming(true)}>
        Reveal all {n} emails ({n} credits)
      </button>
    );
  }
  return (
    <div className="confirm stack">
      <p className="small" style={{ margin: 0 }}>
        Reveal {n} emails for up to {n} Apollo credits? You're only charged for people Apollo finds.
        {over && (
          <span className="state-not_met">
            {' '}This goes past your monthly budget ({totalSpent(ledger)} of {settings.monthlyBudget} used).
          </span>
        )}
      </p>
      <div className="row" style={{ gap: 20 }}>
        <button className="primary" disabled={busy} onClick={go}>{busy ? `Revealing ${n}…` : `Reveal ${n} emails`}</button>
        <button className="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div>
  );
}

function ContactRow({ contact: c, reveal, compact }: { contact: Contact; reveal: Reveal; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = contactName(c);

  const onReveal = async () => {
    setBusy(true);
    await reveal([c.apolloId]);
    setBusy(false);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${name} <${c.email}>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const emailLine =
    c.revealedAt !== undefined ? (
      c.email ? (
        <div className="row email">
          <span className="grow">{c.email}</span>
          {c.emailStatus && <span className={`pill ${c.emailStatus === 'verified' ? 'good' : 'warn'}`}>{c.emailStatus}</span>}
          <button className="ghost small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      ) : (
        <div className="small muted">Apollo has no email for this person.</div>
      )
    ) : c.hasEmail ? (
      <button className={compact ? 'small' : 'primary'} disabled={busy} onClick={onReveal}>
        {busy ? 'Revealing…' : compact ? 'Reveal (1 cr)' : 'Reveal email (1 credit)'}
      </button>
    ) : (
      <div className="small muted">No email</div>
    );

  if (compact) {
    // Two lines: who they are on the left; rank and the one action on the right.
    return (
      <div className="contact compact">
        <div className="grow">
          <div className="name-line">{name}</div>
          <div className="small muted">{c.title ?? 'Unknown title'}</div>
          {c.revealedAt !== undefined && emailLine}
        </div>
        <div className="side">
          {c.rank !== null && <span className="small muted" title={`Rank ${c.rank} of 100`}>{c.rank}</span>}
          {c.revealedAt === undefined && emailLine}
        </div>
      </div>
    );
  }

  return (
    <div className="contact">
      <div className="row spread">
        <div className="grow">
          <strong>{name}</strong>
          <div className="small muted">{c.title ?? 'Unknown title'}</div>
        </div>
        {c.rank !== null && (
          <div className="rank" title={`How likely this person owns the problem: ${c.rank} out of 100`}>
            <div className="bar"><div style={{ width: `${c.rank}%` }} /></div>
            <span className="small muted">{c.rank}</span>
          </div>
        )}
      </div>
      {emailLine}
      {c.linkedin && <a className="small" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a>}
    </div>
  );
}
