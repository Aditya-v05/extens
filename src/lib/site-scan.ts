/**
 * Website reader. `scanSite` is injected into the tab the user clicked (activeTab + scripting),
 * so it runs with the page's origin and can fetch other pages of the same site without any
 * host permission. It must stay self-contained: no imports, no references to module scope.
 */

export type SnippetSource = 'home' | 'pricing' | 'blog' | 'changelog' | 'security';

export interface Snippet {
  /** Verbatim page text, trimmed. */
  text: string;
  url: string;
  source: SnippetSource;
  /** ISO date when the page gives one (blog/changelog items). */
  date: string | null;
}

export interface SiteScan {
  host: string;
  pages: { url: string; source: SnippetSource; ok: boolean }[];
  snippets: Snippet[];
}

export async function scanSite(maxPages = 5): Promise<SiteScan> {
  const MAX_SNIPPETS = 40;
  const MAX_LEN = 220;
  const PATHS: Record<Exclude<SnippetSource, 'home'>, RegExp> = {
    pricing: /^\/(pricing|plans)\/?$/i,
    blog: /^\/(blog|news|newsroom|press|resources\/blog)\/?$/i,
    changelog: /^\/(changelog|releases|release-notes|whats-new|updates)\/?$/i,
    security: /^\/(security|trust|compliance)\/?$/i,
  };
  const DEFAULTS: Record<Exclude<SnippetSource, 'home'>, string> = {
    pricing: '/pricing', blog: '/blog', changelog: '/changelog', security: '/security',
  };
  const ANNOUNCE = /\b(introducing|announcing|now available|new:|launch(ed|es|ing)?|raised|series [a-f]|acquir(ed|es|ition)|partner(s|ship)? with|welcome[sd]?|joins as|expan(ds|ding|sion)|opens? (in|our)|generally available|\bGA\b)/i;
  const PRICING = /\b(enterprise|soc ?2|sso|saml|scim|hipaa|audit log|dedicated|contact sales|talk to sales|custom (plan|pricing|contract)|sla|premium support|volume discount)\b/i;
  const SECURITY = /\b(soc ?2|iso ?27001|iso ?27701|hipaa|gdpr|pci|fedramp|pen(etration)? test|type (i|ii|1|2)\b)/i;
  const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
  const DATE_RE = new RegExp(`\\b(\\d{4}-\\d{2}-\\d{2}|(?:${MONTHS})[a-z]*\\.? \\d{1,2},? \\d{4}|\\d{1,2} (?:${MONTHS})[a-z]* \\d{4})\\b`, 'i');

  const origin = location.origin;
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const clip = (s: string) => (s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s);
  const toIso = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    // A calendar date ("Aug 3, 2026") parses as local midnight, which is the previous day in UTC east of
    // Greenwich. Read date-only strings as UTC; leave ISO dates and full timestamps alone.
    const dateOnly = !/^\d{4}-\d{2}-\d{2}$/.test(raw) && !/\d:\d\d|T\d/.test(raw);
    let t = Date.parse(dateOnly ? `${raw} UTC` : raw);
    if (!Number.isFinite(t)) t = Date.parse(raw);
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
  };

  const snippets: Snippet[] = [];
  const seen = new Set<string>();
  // textContent runs neighbouring elements together ("officeAug 3, 2026"); join text nodes with spaces instead.
  const spacedText = (el: Element) => {
    const walker = (el.ownerDocument ?? document).createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
    const parts: string[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.nodeValue ?? '');
    return clean(parts.join(' '));
  };
  // Text glued from several elements ("agentsThe product", "PulseInboxMy issues") is layout noise, not copy.
  const glued = (t: string) => (t.match(/[a-z][A-Z]/g) ?? []).length >= 2;
  const add = (text: string, url: string, source: SnippetSource, date: string | null = null) => {
    const t = clean(text);
    if (t.length < 12 || t.split(' ').length < 3 || glued(t)) return;
    const key = t.toLowerCase();
    if (snippets.length >= MAX_SNIPPETS) return;
    // A card and its own description both match; keep whichever came first, not both.
    for (const k of seen) if (k.includes(key) || key.includes(k)) return;
    seen.add(key);
    snippets.push({ text: clip(t), url, source, date });
  };

  const strip = (doc: Document) => doc.querySelectorAll('script,style,noscript,svg,template,iframe').forEach((n) => n.remove());
  // Skip elements whose raw text is glued layout noise; return the rest with spaces between child elements.
  const texts = (root: ParentNode, sel: string) =>
    Array.from(root.querySelectorAll(sel))
      .filter((e) => !glued(clean(e.textContent)))
      .map(spacedText);

  const extractHome = (doc: Document, url: string) => {
    // The headline says what they're betting on; the rest of the h2s are mostly generic copy.
    for (const t of texts(doc, 'h1').slice(0, 2)) if (t.length <= 160) add(t, url, 'home');
    // Announcement banners and "Introducing …" links.
    for (const t of texts(doc, 'a, p, h2, h3')) {
      if (t.length >= 15 && t.length <= 140 && ANNOUNCE.test(t)) add(t, url, 'home');
    }
  };

  const extractPricing = (doc: Document, url: string) => {
    for (const t of texts(doc, 'h2, h3, h4')) if (t.length <= 80 && PRICING.test(t)) add(t, url, 'pricing');
    for (const t of texts(doc, 'li, p, td')) if (t.length <= 160 && PRICING.test(t)) add(t, url, 'pricing');
  };

  const extractSecurity = (doc: Document, url: string) => {
    for (const t of texts(doc, 'h1, h2, h3, h4, li, p')) if (t.length <= 200 && SECURITY.test(t)) add(t, url, 'security');
  };

  const extractPosts = (doc: Document, url: string, source: 'blog' | 'changelog') => {
    const base = new URL(url).pathname.replace(/\/$/, '');
    const items: { title: string; href: string; date: string | null }[] = [];
    // Prefer <article>s; fall back to links pointing below the listing path.
    const containers = Array.from(doc.querySelectorAll('article'));
    const candidates = containers.length ? containers : Array.from(doc.querySelectorAll(`a[href*="${base}/"]`));
    for (const el of candidates) {
      const heading = el.querySelector('h1, h2, h3, h4');
      const title = clean(heading?.textContent ?? el.textContent);
      if (title.length < 20 || title.length > 160) continue;
      // A post in a listing links to its own page; headings without one are section labels or post body.
      const link = el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a[href]');
      if (!link) continue;
      const href = new URL(link.getAttribute('href')!, url).href.split('#')[0]!;
      if (href.replace(/\/$/, '') === url.replace(/\/$/, '')) continue;
      // Look for the date only close to this item, so neighbours don't share one.
      const scope = el.tagName === 'ARTICLE' ? el : el.closest('li, article') ?? el.parentElement ?? el;
      const time = el.querySelector('time') ?? scope.querySelector('time');
      const nearText = spacedText(scope);
      const date =
        toIso(time?.getAttribute('datetime')) ?? toIso(clean(time?.textContent)) ??
        (nearText.length < 400 ? toIso(nearText.match(DATE_RE)?.[0]) : null);
      items.push({ title, href, date });
      if (items.length >= 10) break;
    }
    for (const it of items) add(it.title, it.href, source, it.date);
  };

  // Find where this site keeps each page type: links on the current page, else common defaults.
  const found = new Map<Exclude<SnippetSource, 'home'>, string>();
  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    let u: URL;
    try {
      u = new URL(a.getAttribute('href')!, origin);
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    for (const [source, re] of Object.entries(PATHS) as [Exclude<SnippetSource, 'home'>, RegExp][]) {
      if (!found.has(source) && re.test(u.pathname)) found.set(source, origin + u.pathname);
    }
  }
  const targets = (Object.keys(DEFAULTS) as Exclude<SnippetSource, 'home'>[])
    .map((source) => ({ source, url: found.get(source) ?? origin + DEFAULTS[source] }))
    .filter((t) => t.url !== location.href.split(/[?#]/)[0]?.replace(/\/$/, ''))
    .slice(0, Math.max(0, maxPages - 1));

  // The page the user is on counts as "home" context.
  const current = document.cloneNode(true) as Document;
  strip(current);
  extractHome(current, location.href);

  const pages: SiteScan['pages'] = [{ url: location.href, source: 'home', ok: true }];
  const fetched = await Promise.all(
    targets.map(async (t) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(t.url, { credentials: 'omit', signal: ctrl.signal, redirect: 'follow' });
        clearTimeout(timer);
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.includes('html') || new URL(res.url).origin !== origin) return { ...t, html: null };
        return { ...t, url: res.url, html: (await res.text()).slice(0, 1_500_000) };
      } catch {
        return { ...t, html: null };
      }
    }),
  );
  for (const f of fetched) {
    pages.push({ url: f.url, source: f.source, ok: !!f.html });
    if (!f.html) continue;
    const doc = new DOMParser().parseFromString(f.html, 'text/html');
    strip(doc);
    if (f.source === 'pricing') extractPricing(doc, f.url);
    else if (f.source === 'security') extractSecurity(doc, f.url);
    else extractPosts(doc, f.url, f.source);
  }

  return { host: location.hostname, pages, snippets };
}
