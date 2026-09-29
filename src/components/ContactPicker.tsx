import { useEffect, useState } from 'react';
import { describeError } from '@/lib/errors';
import type { Contact, LookupError } from '@/lib/types';

export function contactName(c: Contact): string {
  return `${c.firstName} ${c.lastName ?? (c.lastNameObfuscated ? `${c.lastNameObfuscated[0]}.` : '')}`.trim();
}

/** Short enough to read in a closed dropdown; order already says who's best. */
function optionLabel(c: Contact): string {
  const note = c.email ? ' (email ready)' : !c.hasEmail ? ' (no email)' : '';
  return `${contactName(c)}, ${c.title ?? 'Unknown title'}${note}`;
}

/**
 * One contact at a time. The ranked list lives in a dropdown instead of a wall of cards;
 * the best match is selected first.
 */
export function ContactPicker({
  contacts,
  reveal,
}: {
  contacts: Contact[];
  /** Spend a credit to reveal this person's email; resolves to an error or null. */
  reveal: (personId: string) => Promise<LookupError | null>;
}) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.apolloId);
  // A new lookup (different people) starts again from the best match.
  const ids = contacts.map((c) => c.apolloId).join();
  useEffect(() => setSelectedId(contacts[0]?.apolloId), [ids]);

  const index = Math.max(0, contacts.findIndex((c) => c.apolloId === selectedId));
  const selected = contacts[index];
  if (!selected) return null;

  return (
    <div className="picker stack">
      <div className="row spread">
        <h2>{index === 0 ? 'Best contact' : 'Contact'}</h2>
        {contacts.length > 1 && <span className="small muted">{index + 1} of {contacts.length}</span>}
      </div>
      {contacts.length > 1 && (
        <select
          aria-label="Choose a contact"
          value={selected.apolloId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {contacts.map((c) => (
            <option key={c.apolloId} value={c.apolloId}>{optionLabel(c)}</option>
          ))}
        </select>
      )}
      <ContactDetail key={selected.apolloId} contact={selected} reveal={reveal} />
    </div>
  );
}

function ContactDetail({ contact: c, reveal }: { contact: Contact; reveal: (id: string) => Promise<LookupError | null> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LookupError | null>(null);
  const [copied, setCopied] = useState(false);
  const name = contactName(c);

  const onReveal = async () => {
    setBusy(true);
    setError(null);
    setError(await reveal(c.apolloId));
    setBusy(false);
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`${name} <${c.email}>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

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

      {c.revealedAt !== undefined ? (
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
        <button className="primary" disabled={busy} onClick={onReveal}>
          {busy ? 'Revealing…' : 'Reveal email (1 credit)'}
        </button>
      ) : (
        <div className="small muted">No email in Apollo</div>
      )}
      {c.linkedin && (
        <a className="small" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a>
      )}
      {error && <div className="notice error small">{describeError(error)}</div>}
    </div>
  );
}
