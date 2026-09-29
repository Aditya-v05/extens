import type { Contact, LookupResult } from './types';

/** Others this close to the best contact's rank count as equally good ("two very good contacts"). */
export const TIE_MARGIN = 10;
/** …as long as they're a solid match on their own. */
export const FEATURED_MIN_RANK = 60;
export const MAX_FEATURED = 3;

/**
 * Split ranked contacts into the ones worth showing up front and the rest.
 * The best is always featured; others join it when they're nearly as good and reachable.
 */
export function splitContacts(contacts: Contact[]): { featured: Contact[]; others: Contact[] } {
  const [best, ...rest] = contacts;
  if (!best) return { featured: [], others: [] };
  const bar = Math.max((best.rank ?? 0) - TIE_MARGIN, FEATURED_MIN_RANK);
  const featured = [best];
  const others: Contact[] = [];
  for (const c of rest) {
    if (featured.length < MAX_FEATURED && c.hasEmail && c.rank !== null && best.rank !== null && c.rank >= bar) featured.push(c);
    else others.push(c);
  }
  return { featured, others };
}

/** People whose email can still be revealed (Apollo has one, and we haven't revealed it yet). */
export const revealable = (contacts: Contact[]) => contacts.filter((c) => c.hasEmail && c.revealedAt === undefined);

export type RevealPatch = Pick<Contact, 'lastName' | 'email' | 'emailStatus' | 'linkedin' | 'revealedAt'> & { title?: string };

/** Apply several reveals to one lookup at once (one storage write instead of racing ones). */
export function applyReveals(result: LookupResult, reveals: Record<string, RevealPatch>): LookupResult {
  return {
    ...result,
    contacts: result.contacts?.map((c) => (reveals[c.apolloId] ? { ...c, ...reveals[c.apolloId] } : c)) ?? null,
  };
}

/** Make sure the person from a LinkedIn profile is in the list, keeping what we already know about them. */
export function withFocus(contacts: Contact[], person: Contact | undefined): Contact[] {
  if (!person) return contacts;
  const i = contacts.findIndex((c) => c.apolloId === person.apolloId);
  if (i < 0) return [...contacts, person];
  const merged = { ...contacts[i]!, ...person, rank: contacts[i]!.rank ?? person.rank };
  return contacts.map((c, j) => (j === i ? merged : c));
}
