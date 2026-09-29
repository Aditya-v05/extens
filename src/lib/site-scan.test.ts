// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanSite } from './site-scan';

const ORIGIN = 'https://acme.com';

const PAGES: Record<string, string> = {
  '/pricing': `<h2>Pro</h2><h3>Enterprise</h3><ul><li>SAML SSO and SCIM provisioning</li><li>Unlimited projects</li></ul>
    <p>Need custom contract terms? Contact sales.</p>`,
  '/blog': `<main>
    <article><a href="/blog/series-b"><h2>We raised a $50M Series B to expand globally</h2></a><time datetime="2026-09-01">Sep 1</time></article>
    <article><a href="/blog/london"><h2>Hello London: our first European office</h2></a><span>Aug 3, 2026</span></article>
    <article><h2>Section heading without a link</h2></article>
  </main>`,
  '/changelog': `<ul><li><a href="/changelog/ai-agent">Introducing the Acme AI agent for every team</a></li></ul>`,
  '/security': `<h2>Certifications</h2><p>Acme is SOC 2 Type II and ISO 27001 certified.</p>`,
};

function mockSite(home: string) {
  (window as any).happyDOM.setURL(`${ORIGIN}/`);
  document.documentElement.innerHTML = `<head></head><body>${home}</body>`;
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const html = PAGES[path];
    return {
      ok: !!html, url, headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => `<html><body>${html ?? ''}</body></html>`,
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('scanSite', () => {
  it('reads the current page and the standard pages, keeping verbatim text', async () => {
    const fetchMock = mockSite(`
      <nav><a href="/pricing">Pricing</a><a href="/blog">Blog</a></nav>
      <h1>The support platform for modern teams</h1>
      <a href="/news/ai">Introducing Acme AI: answers in seconds</a>
      <div>PulseInboxMy issuesReviews</div>`);
    const scan = await scanSite(5);

    expect(scan.host).toBe('acme.com');
    expect(fetchMock.mock.calls.map(([u]) => new URL(u).pathname).sort()).toEqual(['/blog', '/changelog', '/pricing', '/security']);
    const by = (source: string) => scan.snippets.filter((s) => s.source === source).map((s) => [s.text, s.date]);
    expect(by('home')).toEqual([
      ['The support platform for modern teams', null],
      ['Introducing Acme AI: answers in seconds', null],
    ]);
    expect(by('pricing')).toEqual([
      ['SAML SSO and SCIM provisioning', null],
      ['Need custom contract terms? Contact sales.', null],
    ]);
    expect(by('blog')).toEqual([
      ['We raised a $50M Series B to expand globally', '2026-09-01'],
      ['Hello London: our first European office', '2026-08-03'],
    ]);
    expect(by('changelog')).toEqual([['Introducing the Acme AI agent for every team', null]]);
    expect(by('security')).toEqual([['Acme is SOC 2 Type II and ISO 27001 certified.', null]]);
    expect(scan.snippets.find((s) => s.source === 'blog')!.url).toBe(`${ORIGIN}/blog/series-b`);
  });

  it('prefers the paths the site links to', async () => {
    const fetchMock = mockSite(`<a href="/plans">Plans</a><a href="/whats-new">What's new</a><h1>Acme does things well</h1>`);
    await scanSite(5);
    const paths = fetchMock.mock.calls.map(([u]) => new URL(u).pathname);
    expect(paths).toContain('/plans');
    expect(paths).toContain('/whats-new');
    expect(paths).not.toContain('/pricing');
  });

  it('survives being serialized, as chrome.scripting.executeScript does', async () => {
    mockSite(`<h1>Standalone functions have no module scope</h1>`);
    // executeScript sends func.toString() to the tab: any reference to module scope would throw here.
    const standalone = new Function(`return (${scanSite.toString()})`)() as typeof scanSite;
    const scan = await standalone(5);
    expect(scan.snippets.map((s) => s.text)).toContain('Standalone functions have no module scope');
  });
});
