/** Hosts where the page is almost never about the host company itself. */
const SKIP = [
  'google.', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'baidu.com',
  'linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'youtube.com', 'reddit.com',
  'tiktok.com', 'wikipedia.org', 'chatgpt.com', 'claude.ai', 'apollo.io', 'outlook.live.com', 'outlook.office.com',
];

/** Two-label public suffixes we care about, so "acme.co.uk" doesn't collapse to "co.uk". */
const MULTI_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.nz', 'co.in', 'co.jp', 'co.kr', 'co.za', 'com.br',
  'com.mx', 'com.sg', 'com.hk', 'com.tr', 'com.cn', 'com.ar', 'co.il', 'com.my', 'com.ph', 'co.id',
]);

/** Hosting platforms where each subdomain is a different owner. */
const PLATFORM_SUFFIXES = new Set([
  'github.io', 'vercel.app', 'netlify.app', 'herokuapp.com', 'webflow.io', 'framer.website',
  'framer.app', 'myshopify.com', 'pages.dev', 'wixsite.com', 'carrd.co', 'notion.site',
]);

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    host = u.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.')) return null;
  const domain = registrableDomain(host);
  if (SKIP.some((s) => (s.endsWith('.') ? domain.startsWith(s) : domain === s))) return null;
  return domain;
}

export function registrableDomain(host: string): string {
  const labels = host.replace(/^www\./, '').split('.');
  const lastTwo = labels.slice(-2).join('.');
  const keep = MULTI_SUFFIXES.has(lastTwo) || PLATFORM_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

/** Normalize something a user typed ("https://www.Acme.com/pricing", "acme.com"). */
export function normalizeDomainInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  return domainFromUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
}

/**
 * A LinkedIn profile address, normalised to https://www.linkedin.com/in/<slug>, or null.
 * Sift only uses the address (to ask Apollo who it is); it never reads LinkedIn pages.
 */
export function linkedinProfile(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/in\/([^/]+)/i);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]!);
  } catch {
    slug = m[1]!;
  }
  slug = slug.trim().toLowerCase();
  return slug ? `https://www.linkedin.com/in/${encodeURIComponent(slug)}` : null;
}

export const isLinkedin = (url: string | null | undefined) => {
  try {
    return !!url && /(^|\.)linkedin\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
};
