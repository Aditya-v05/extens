// UI smoke test: loads the built extension into Playwright's Chromium, seeds sample data (no API calls,
// no credits), exercises My Accounts, and screenshots every page into e2e/screenshots/.
// Run: npm run build && npm run smoke   (first time: npx playwright install chromium)
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { accountMeta, discover, profile, results, saved } from './seed.mjs';

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

// "No boxes, only lines": nothing may have a border on all four sides (checkboxes excepted).
const boxed = async (pg) => pg.evaluate(() =>
  [...document.querySelectorAll('body *')]
    .filter((el) => el.getClientRects().length && !(el instanceof HTMLInputElement && el.type === 'checkbox'))
    .filter((el) => {
      const cs = getComputedStyle(el);
      return ['Top', 'Right', 'Bottom', 'Left'].every((side) => parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none');
    })
    .map((el) => `${el.tagName.toLowerCase()}.${el.className}`));

const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/accounts.html`);
await page.evaluate(async ({ results, saved, accountMeta, profile, discover }) => {
  await chrome.storage.local.set({
    keys: { apollo: 'x', typesafe: 'y' }, cache: results, saved, accountMeta, profile, discover,
    credits: { month: new Date().toISOString().slice(0, 7), company: 14, jobs: 12, reveal: 3 },
    settings: { monthlyBudget: 100, fetchJobs: true, scanSite: true },
  });
}, { results, saved, accountMeta, profile, discover });
await page.reload();
await page.waitForSelector('.account');
check((await page.title()) === 'My Accounts – Sift', 'pages are named Sift');
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
  (await page.locator('.company strong').allInnerTexts()).join() === 'Linear,Gorgias,Intercom',
  'saved accounts are ranked by priority (Linear 68, Gorgias 59, Intercom 49)',
);
await page.fill('.search', 'support');
await page.waitForTimeout(100);
check((await page.locator('.account').count()) === 3, 'search matches contact titles and signals');
await page.fill('.search', '');
await page.click('text=Recently viewed');
await page.waitForTimeout(100);
check((await page.locator('.company strong').allInnerTexts()).join() === 'Notion', 'recently viewed lists unsaved lookups');
await page.click('text=Saved');

// Discover: lookalikes of the best saved accounts (seeded search, so no API call and no credit).
await page.click('role=tab[name="Discover"]');
await page.waitForSelector('.candidate');
check((await page.locator('.discover .lede strong').innerText()) === 'Linear, Gorgias', 'Discover seeds from the best saved accounts, skipping Not a fit');
check((await page.locator('.candidate strong').allInnerTexts()).join() === 'Help Scout,Kustomer,Netomi', 'Discover lists suggestions in Apollo similarity order');
check((await page.locator('.candidate button', { hasText: 'Look up (2 cr)' }).count()) === 3, 'each suggestion can be looked up, with its cost');
await page.screenshot({ path: `${OUT}/discover.png`, fullPage: true });
await page.locator('.candidate', { hasText: 'Kustomer' }).locator('button', { hasText: 'Dismiss' }).click();
await page.waitForTimeout(200);
const dismissed = await page.evaluate(async () => (await chrome.storage.local.get('dismissed')).dismissed);
check((await page.locator('.candidate').count()) === 2 && dismissed?.includes('kustomer.com'), 'Dismiss hides a suggestion and remembers it');
const discoverBoxes = await boxed(page);
check(discoverBoxes.length === 0, `no boxes on Discover${discoverBoxes.length ? `: ${discoverBoxes.slice(0, 5).join(', ')}` : ''}`);
await page.click('role=tab[name="Saved 3"]');

// Narrow window layout.
await page.setViewportSize({ width: 420, height: 900 });
await page.screenshot({ path: `${OUT}/accounts-narrow.png`, fullPage: true });

// Side panel page (as a tab, 400px wide) showing a done lookup for Linear.
const panel = await ctx.newPage();
await panel.setViewportSize({ width: 400, height: 1100 });
await panel.goto(`chrome-extension://${id}/sidepanel.html`);
// The UI must stay white even when the OS is in dark mode.
await panel.emulateMedia({ colorScheme: 'dark' });
for (const domain of ['gorgias.com', 'linear.app']) {
  await panel.evaluate(async ({ domain, result }) => {
    const w = await chrome.windows.getCurrent();
    await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain, result, cached: true } });
  }, { domain, result: results[domain] });
  await panel.reload();
  await panel.waitForSelector('.score');
  await panel.click('text=/less relevant/').catch(() => {});
  await panel.screenshot({ path: `${OUT}/panel-${domain.split('.')[0]}.png`, fullPage: true });
}
// Contacts on gorgias.com: two near-tied best contacts up front, six more tucked away inside the panel.
await panel.evaluate(async (result) => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain: 'gorgias.com', result, cached: true } });
}, results['gorgias.com']);
await panel.reload();
await panel.waitForSelector('.contact-list');
const featured = await panel.locator('.contact:not(.compact) strong').allInnerTexts();
check(featured.join() === 'Maya Chen,Tom R.', `two very good contacts both show up front (${featured.join(', ')})`);
check((await panel.locator('.contact.compact').count()) === 0, 'other contacts start collapsed');
await panel.click('text=/Show 6 more contacts/');
check((await panel.locator('.contact.compact').count()) === 6, 'the rest expand as a list');
const width = await panel.evaluate(() => document.documentElement.clientWidth);
const overflow = await panel.evaluate(() => Math.max(...[...document.querySelectorAll('.more, .contact')].map((e) => e.getBoundingClientRect().right)));
check(overflow <= width, `expanded list stays inside the panel (${Math.round(overflow)} <= ${width}px)`);
check(await panel.locator('select').count() === 0, 'no native dropdown that could spill outside the panel');
await panel.click('text=/Reveal all 6 emails \\(6 credits\\)/');
check(await panel.locator('.confirm').isVisible(), 'reveal all asks first and states the cost');
await panel.screenshot({ path: `${OUT}/panel-contacts.png`, fullPage: true });
await panel.click('.confirm >> text=Cancel');
// LinkedIn: a lookup opened from a profile shows that person first, with where they rank.
await panel.evaluate(async (result) => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain: 'gorgias.com', cached: true,
    // As in real use, the profile person was revealed by the LinkedIn match.
    result: { ...result, profile: { apolloId: 'g2', url: 'https://www.linkedin.com/in/tom-reyes' },
      contacts: result.contacts.map((c) => (c.apolloId === 'g2' ? { ...c, lastName: 'Reyes', headline: 'Head of Support at Gorgias', email: 'tom@gorgias.com', emailStatus: 'verified', revealedAt: Date.now() } : c)) } } });
}, results['gorgias.com']);
await panel.reload();
await panel.waitForSelector('.profile-card');
check((await panel.locator('.profile-card strong').innerText()) === 'Tom Reyes' && (await panel.locator('.profile-card').innerText()).includes('Ranks 2 of 8'),
  'a LinkedIn lookup shows the profile person first, with their rank');
await panel.screenshot({ path: `${OUT}/panel-linkedin.png`, fullPage: true });
// LinkedIn pages that aren't profiles get their own guidance.
await panel.evaluate(async () => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'not_company', url: 'https://www.linkedin.com/feed/' } });
});
await panel.reload();
check(await panel.locator("text=Open a person's profile").count() === 1, 'LinkedIn pages that are not profiles explain what to open');
check(await panel.locator('button', { hasText: 'Sift this page' }).count() === 1, 'pages Sift cannot use offer Sift this page');
// Back to a normal lookup for the checks that follow.
await panel.evaluate(async (result) => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain: 'gorgias.com', result, cached: true } });
}, results['gorgias.com']);
await panel.reload();
await panel.waitForSelector('.score');
// Switching tabs: the result was sifted from another tab (the accounts page), so the panel offers to sift this one.
const tabOf = async (pg) => pg.evaluate(async () => (await chrome.tabs.getCurrent()).id);
const otherTab = await tabOf(page);
const panelTab = await tabOf(panel);
const setViewTab = (tabId) => panel.evaluate(async (tabId) => {
  const w = await chrome.windows.getCurrent();
  await chrome.storage.session.set({ [`viewTab_${w.id}`]: { tabId, at: Date.now() } });
}, tabId);
await setViewTab(otherTab);
await panel.bringToFront();
await panel.waitForTimeout(300);
check(await panel.locator('.switched.changed').isVisible() && (await panel.locator('.switched').innerText()).includes('Still showing gorgias.com'),
  'after a tab switch the panel says so and offers Sift this page');
await panel.screenshot({ path: `${OUT}/panel-switched.png` });
await setViewTab(panelTab);
await panel.waitForTimeout(300);
check(await panel.locator('.switched.changed').count() === 0 && (await panel.locator('.switched').innerText()).includes('Showing gorgias.com'),
  'on the result\'s own tab the line is calm but Sift this page is still there');
const bg = await panel.evaluate(() => getComputedStyle(document.body).backgroundColor);
check(bg === 'rgb(255, 255, 255)', `panel stays white in OS dark mode (${bg})`);
const text = await panel.evaluate(() => document.body.innerText);
check(!/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2605\u2606\u2713\u2717]/u.test(text), 'no emoji or symbol glyphs in the panel');

// Settings page.
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${id}/options.html`);
await opts.waitForSelector('text=Apollo credits');

// Who to look for: defaults from the personas, editable, saved with the profile.
await opts.waitForSelector('text=Who to look for');
const checked = await opts.locator('.seniorities input:checked').count();
check(checked === 7, `seniority defaults to owner..director (${checked} checked)`);
const keywordInputs = await opts.locator('.people-editor .list input').evaluateAll((els) => els.map((e) => e.value));
check(keywordInputs.join() === 'VP Customer Experience,Head of Support,COO,customer,experience,support', `titles and keywords come from the personas (${keywordInputs.join(', ')})`);
await opts.fill('input[placeholder^="One word each"]', 'operations');
await opts.press('input[placeholder^="One word each"]', 'Enter');
await opts.locator('.seniorities label', { hasText: 'Partner' }).locator('input').uncheck();
await opts.click('button:has-text("Save profile")');
await opts.waitForTimeout(200);
const savedRules = await opts.evaluate(async () => (await chrome.storage.local.get('profile')).profile.rules);
check(savedRules.keywords.includes('operations') && !savedRules.seniorities.includes('partner'), 'edited filters are saved with the profile');
await opts.screenshot({ path: `${OUT}/settings.png`, fullPage: true });

check(await panel.locator('text=Why now').count() > 0, 'side panel renders a lookup');
for (const [name, pg] of [['panel', panel], ['My Accounts', page], ['settings', opts]]) {
  const found = await boxed(pg);
  check(found.length === 0, `no boxes on ${name}${found.length ? `: ${found.slice(0, 5).join(', ')}` : ''}`);
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
console.log(`screenshots: ${OUT}`);
await ctx.close();
