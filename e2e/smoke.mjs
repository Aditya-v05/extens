// UI smoke test: loads the built extension into Playwright's Chromium, seeds sample data (no API calls,
// no credits), exercises My Accounts, and screenshots every page into e2e/screenshots/.
// Run: npm run build && npm run smoke   (first time: npx playwright install chromium)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { accountMeta, results, saved } from './seed.mjs';

const EXT = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
const OUT = fileURLToPath(new URL('./screenshots', import.meta.url));
mkdirSync(OUT, { recursive: true });
const check = (ok, msg) => { if (!ok) { console.error(`✗ ${msg}`); process.exitCode = 1; } else console.log(`✓ ${msg}`); };
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const errors = [];
ctx.on('page', (p) => { p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errors.push(`${p.url()}: ${m.text()}`)); });

const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/accounts.html`);
await page.evaluate(async ({ results, saved, accountMeta }) => {
  await chrome.storage.local.set({
    keys: { apollo: 'x', typesafe: 'y' }, cache: results, saved, accountMeta,
    credits: { month: new Date().toISOString().slice(0, 7), company: 14, jobs: 12, reveal: 3 },
    settings: { monthlyBudget: 100, fetchJobs: true, scanSite: true },
  });
}, { results, saved, accountMeta });
await page.reload();
await page.waitForSelector('.account');
await page.screenshot({ path: `${OUT}/accounts.png`, fullPage: true });

// Expand Gorgias and check interactions: status change, note, search, tabs.
await page.click('text=Gorgias');
await page.waitForSelector('.details');
await page.screenshot({ path: `${OUT}/accounts-expanded.png`, fullPage: true });
await page.selectOption('select[aria-label="Status for Linear"]', 'replied');
await page.waitForTimeout(200);
const meta = await page.evaluate(async () => (await chrome.storage.local.get('accountMeta')).accountMeta);
check(meta['linear.app']?.status === 'replied', 'status change is saved');
check(
  (await page.locator('.company strong').allInnerTexts()).join() === 'Gorgias,Intercom,Linear',
  'saved accounts are ranked by priority',
);
await page.fill('.search', 'support');
await page.waitForTimeout(100);
check((await page.locator('.account').count()) === 3, 'search matches contact titles and signals');
await page.fill('.search', '');
await page.click('text=Recently viewed');
await page.waitForTimeout(100);
check((await page.locator('.company strong').allInnerTexts()).join() === 'Notion', 'recently viewed lists unsaved lookups');
await page.click('text=Saved');

// Narrow window layout.
await page.setViewportSize({ width: 420, height: 900 });
await page.screenshot({ path: `${OUT}/accounts-narrow.png`, fullPage: true });

// Side panel page (as a tab, 400px wide) showing a done lookup for Linear.
const panel = await ctx.newPage();
await panel.setViewportSize({ width: 400, height: 1100 });
await panel.goto(`chrome-extension://${id}/sidepanel.html`);
await panel.evaluate(async (result) => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain: 'linear.app', result, cached: true } });
}, results['linear.app']);
await panel.reload();
await panel.waitForSelector('.score');
await panel.click('text=/less relevant/').catch(() => {});
await panel.screenshot({ path: `${OUT}/panel.png`, fullPage: true });

// Settings page.
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${id}/options.html`);
await opts.waitForSelector('text=Apollo credits');
await opts.screenshot({ path: `${OUT}/settings.png`, fullPage: true });

check(await panel.locator('text=Why now').count() > 0, 'side panel renders a lookup');
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
console.log(`screenshots: ${OUT}`);
await ctx.close();
