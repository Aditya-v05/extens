// @vitest-environment happy-dom
/**
 * Runs the website reader against real sites. Skipped unless SITES is set:
 *   SITES=https://linear.app/,https://www.notion.com/ npx vitest run src/lib/site-scan.live.test.ts --silent=false
 */
import { it } from 'vitest';
import { scanSite } from './site-scan';

const SITES: string[] = ((globalThis as any).process?.env?.SITES ?? '').split(',').filter(Boolean);
if (!SITES.length) it.skip('live site scan (set SITES)', () => {});
for (const site of SITES) {
  it(`scan ${site}`, async () => {
    (window as any).happyDOM.setURL(site);
    const html = await (await fetch(site)).text();
    document.documentElement.innerHTML = html.replace(/<link[^>]*>|<script[\s\S]*?<\/script>/gi, '').replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>[\s\S]*$/i, '');
    const t0 = Date.now();
    const r = await scanSite(5);
    console.log(`\n==== ${site} (${Date.now() - t0}ms)`);
    for (const p of r.pages) console.log('  page', p.ok ? 'ok ' : 'FAIL', p.source, p.url);
    for (const s of r.snippets) console.log(`  [${s.source}] ${s.date ?? ''} ${s.text}`);
  }, 60000);
}
