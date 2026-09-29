import { describe, expect, it } from 'vitest';
import { domainFromUrl, normalizeDomainInput } from './resolver';

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
