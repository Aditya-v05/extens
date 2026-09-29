// Chrome Web Store images from the real built extension (sample data, no API calls).
// Run: npm run build && npm run store-shots   → store/*.png
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { accountMeta, discover, profile, results, saved } from './seed.mjs';

const EXT = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
const OUT = fileURLToPath(new URL('../store', import.meta.url));
mkdirSync(OUT, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/accounts.html`);
await page.evaluate(async (data) => {
  await chrome.storage.local.set({
    keys: { apollo: 'x', typesafe: 'y' }, ...data,
    credits: { month: new Date().toISOString().slice(0, 7), company: 14, jobs: 12, reveal: 3, search: 1 },
    settings: { monthlyBudget: 100, fetchJobs: true, scanSite: true },
  });
}, { cache: results, saved, accountMeta, profile, discover });

/** The side panel at its real 400px width, beside a short headline, on a 1280×800 canvas. */
async function panelShot(file, domain, headline, sub, prepare) {
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${id}/sidepanel.html`);
  await p.evaluate(async ({ domain, result }) => {
    const w = await chrome.windows.getCurrent();
    await chrome.storage.session.set({ [`view_${w.id}`]: { status: 'done', domain, result, cached: true } });
  }, { domain, result: results[domain] });
  await p.reload();
  await p.waitForSelector('.score');
  // Sample data has no website scan; its "not read" note isn't what the store should show.
  await p.evaluate(() => [...document.querySelectorAll('.section .small.muted')].filter((e) => e.textContent.includes('Website not read')).forEach((e) => e.remove()));
  if (prepare) await prepare(p);
  await p.evaluate(({ headline, sub }) => {
    const panel = document.querySelector('.panel');
    const stage = document.createElement('div');
    stage.style.cssText = 'display:flex;gap:96px;align-items:flex-start;padding:72px 96px;height:800px;box-sizing:border-box;overflow:hidden;background:#f5f5f2';
    const copy = document.createElement('div');
    copy.style.cssText = 'flex:1;padding-top:120px';
    copy.innerHTML = `<div style="font-size:52px;font-weight:500;letter-spacing:-0.03em;line-height:1.05;color:#26282b">${headline}</div>
      <p style="font-size:19px;line-height:1.5;color:#7c7f84;margin-top:24px;max-width:30ch">${sub}</p>`;
    const frame = document.createElement('div');
    frame.style.cssText = 'width:400px;height:656px;overflow:hidden;background:#fff;box-shadow:0 1px 0 #e6e6e1,0 0 0 1px #e6e6e1';
    panel.style.minHeight = '0';
    frame.appendChild(panel);
    stage.append(copy, frame);
    document.body.replaceChildren(stage);
  }, { headline, sub });
  await p.screenshot({ path: `${OUT}/${file}`, clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await p.close();
}

await panelShot('1-fit.png', 'gorgias.com', 'Does this company fit?', 'One click on their website. Scored against your own requirements, each one shown.');
/** Keep the company header and one part of the panel. */
const only = (keep) => (p) => p.evaluate((keep) => {
  for (const sel of ['.fit', '.section', '.persona', '.contacts']) {
    if (sel !== keep) document.querySelectorAll(sel).forEach((e) => (e.style.display = 'none'));
  }
}, keep);

await panelShot('2-contacts.png', 'gorgias.com', 'Who to talk to', 'The people most likely to own the problem you solve. Reveal one email, or all of them.', async (p) => {
  await p.click('text=/Show \\d+ more contacts/');
  await only('.contacts')(p);
});
await panelShot('3-why-now.png', 'linear.app', 'Why now', 'Hiring, growth, funding and what their own site says. Every signal links to its source.', async (p) => {
  await p.click('text=/less relevant/').catch(() => {});
  await only('.section')(p);
});

await page.reload();
await page.waitForSelector('.account');
await page.screenshot({ path: `${OUT}/4-my-accounts.png` });
await page.click('role=tab[name="Discover"]');
await page.waitForSelector('.candidate');
await page.screenshot({ path: `${OUT}/5-discover.png` });

// Small promo tile (440×280).
const tile = await ctx.newPage();
await tile.setViewportSize({ width: 440, height: 280 });
await tile.goto(`chrome-extension://${id}/sidepanel.html`);
await tile.evaluate((iconUrl) => {
  document.body.innerHTML = `<div style="height:280px;display:flex;align-items:center;gap:24px;padding:0 40px;background:#fff">
    <img src="${iconUrl}" width="96" height="96">
    <div><div style="font-size:44px;font-weight:500;letter-spacing:-0.03em;color:#26282b">Sift</div>
    <div style="font-size:16px;line-height:1.45;color:#7c7f84;margin-top:6px">ICP fit, why now and the right person, from any company site.</div></div></div>`;
}, `chrome-extension://${id}/icon/128.png`);
await tile.waitForTimeout(200);
await tile.screenshot({ path: `${OUT}/promo-tile-440x280.png` });

await ctx.close();
console.log(`store images: ${OUT}`);
