import { describe, expect, it } from 'vitest';
import { domainFromUrl, isLinkedin, linkedinProfile, normalizeDomainInput } from './resolver';

describe('domainFromUrl', () => {
  it.each([
    ['https://linear.app/pricing', 'linear.app'],
    ['https://www.stripe.com/', 'stripe.com'],
    ['https://app.linear.app/team/x', 'linear.app'],
    ['https://shop.acme.co.uk/a', 'acme.co.uk'],
    ['https://acme.vercel.app/', 'acme.vercel.app'],
    ['https://docs.acme.com.', 'acme.com'],
  ])('%s → %s', (url, domain) => expect(domainFromUrl(url)).toBe(domain));

  it.each([
    'chrome://extensions', 'about:blank', 'http://localhost:3000', 'http://192.168.1.1', 'https://www.google.com/search?q=x',
    'https://mail.google.com', 'https://www.linkedin.com/company/linear', 'https://x.com/linear', 'file:///tmp/a.html', null,
  ])('rejects %s', (url) => expect(domainFromUrl(url)).toBeNull());
});

describe('normalizeDomainInput', () => {
  it('accepts bare and full domains', () => {
    expect(normalizeDomainInput(' Acme.com ')).toBe('acme.com');
    expect(normalizeDomainInput('https://www.acme.com/about')).toBe('acme.com');
    expect(normalizeDomainInput('not a domain')).toBeNull();
  });
});

describe('linkedinProfile', () => {
  it.each([
    ['https://www.linkedin.com/in/cristinajcordova/', 'https://www.linkedin.com/in/cristinajcordova'],
    ['http://linkedin.com/in/CristinaJCordova?trk=abc#x', 'https://www.linkedin.com/in/cristinajcordova'],
    ['https://uk.linkedin.com/in/some-one-12345/details/experience/', 'https://www.linkedin.com/in/some-one-12345'],
    ['https://www.linkedin.com/in/j%C3%B6rg-m%C3%BCller', 'https://www.linkedin.com/in/j%C3%B6rg-m%C3%BCller'],
  ])('%s → %s', (url, profile) => expect(linkedinProfile(url)).toBe(profile));

  it.each([
    'https://www.linkedin.com/company/linear', 'https://www.linkedin.com/feed/', 'https://notlinkedin.com/in/x',
    'https://www.linkedin.com.evil.io/in/x', 'chrome://newtab', null,
  ])('rejects %s', (url) => expect(linkedinProfile(url)).toBeNull());

  it('knows LinkedIn pages that are not profiles', () => {
    expect(isLinkedin('https://www.linkedin.com/company/linear')).toBe(true);
    expect(isLinkedin('https://linear.app')).toBe(false);
  });
});
