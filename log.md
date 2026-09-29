# Change log

Newest first. Each entry covers what changed, why, and how it was verified. Design details live in [`SPEC.md`](SPEC.md).

---

## 2026-09-29 — Site redeployed; auto-deploy from GitHub

- Production redeployed with full-URL `og:image`, `og:url` and canonical tags, checked on the live page (`og.png` served as `image/png`).
- The GitHub repo `Aditya-v05/extens` is connected to the Vercel project `sift` (it was already connected when `vercel link` set up the project). **Every push to `main` now deploys the site to production.** Pull requests and other branches get preview URLs.

---

## 2026-09-29 — Landing page (Vercel)

> "lets host in vercel - yes install form guithub with coming soon - i think a looping animatio maybe"

- **`site/`:** a one-page site, built with Vite and deployed by Vercel (`vercel.json`: `npm run site:build` → `site/dist`).
- **The demo is the real side panel.** `site/vite.config.ts` swaps `wxt/browser` for `site/browser-stub.ts` (in-memory storage with change events, no-op messaging), so the extension's own `App` renders on a normal page.
  - `Demo.tsx` loops through a lookup: the icon pulses, the panel slides in, then company, fit (while why-now is still loading), why now, and contacts. It scrolls to the contacts, reveals an email, closes, and repeats.
  - It pauses while the tab is hidden, and shows the finished state with no motion when reduced motion is on.
  - The demo can't drift from the product because it *is* the product.
- **Demo data is fictional:** "Acme" at `acme.example` (a reserved domain) with made-up people. The fit score is computed by Sift's own `combineFit`: 4 of 4 met, overall 78 → 90.
- **Page:**
  - hero with *Install from GitHub*, *Read the source*, and "Chrome Web Store: coming soon";
  - what the panel answers (fit, why now, who), and what comes after the click (My Accounts, Discover);
  - "It costs what it says" (the credit table);
  - "Your keys, your browser";
  - FAQ, including honest "not yet" answers for LinkedIn and phone numbers.
  - Same design system as the extension, no emoji, lines only; stacks on phones with no horizontal scroll.
- **Assets:** a social image (`site/public/og.png`, 1200×630, rendered from the page) and a favicon. Icons are imported rather than copied, so the extension zip didn't grow.
- **Tooling:** `npm run site:dev` / `site:build`; `compile` also type-checks the site (against the real extension types). CI builds the site too.
- **Bug fixed in the extension, found by the demo:** the side panel read its state *then* subscribed to changes, so a change landing in between was lost. In the extension, a background write at that moment would leave the panel stale until the next update. It now subscribes first and only uses the initial read if nothing arrived meanwhile.
- **Rejected:** `@vercel/config` (for a `vercel.ts`) brought 3 high-severity advisories through `path-to-regexp`, with only an old-version downgrade as a fix. A plain `vercel.json` needs no dependency; still 0 vulnerabilities.
- **Verified:**
  - desktop and 390px phone screenshots, six animation frames reviewed, no console errors, no horizontal overflow;
  - reduced-motion mode shows the finished panel;
  - extension unit tests, tsc (extension and site), build, and smoke still pass.
- **Deployed** to https://sift-rosy-omega.vercel.app (Vercel project `sift`), after the user ran `npx vercel login`. The CLI was asked for a preview, but Vercel sends a project's first deployment to production. The social image and canonical links now use the full URL.

---

## 2026-09-29 — Ready to share: CI, store kit, shortcut, v0.2.0

- **Phones are parked.** The user's Apollo account has 0 of 2,500 direct-dial (phone) credits left this cycle, and phone reveals need a webhook relay, i.e. a backend.
- **CI** (`.github/workflows/ci.yml`): on every push and PR it runs type-check, unit tests, build, then Playwright's Chromium and the smoke test, and uploads the screenshots. No API keys; the live tests skip themselves.
- **Chrome Web Store kit:**
  - `PRIVACY.md`: what's stored locally, what goes to Apollo and TypeSafe, website access only on click, no Sift server.
  - `store/listing.md`: name, 132-character summary, description, single purpose, a justification for each permission, data disclosures, privacy policy URL.
  - `npm run store-shots` (`e2e/store-shots.mjs`) renders the real built extension with sample data: 3 panel shots (fit, contacts, why now) beside a short headline, My Accounts, Discover, and a 440×280 promo tile with the icon. Each panel shot shows one part of the panel.
- **Keyboard shortcut:** `_execute_action` at Alt+Shift+S (⌥⇧S on a Mac). It works like clicking the icon, including the one-tab access. The panel's empty state mentions it.
- **Version 0.2.0**, `engines.node >= 22`, `npm run zip` for the upload package.
- README: CI badge, shortcut, privacy link, install section, the new scripts.

**Verified:** 105 unit tests, tsc, build, smoke 26/26, zip built, store images reviewed. The first CI run on GitHub passed every step in 1m27s. The actions were then bumped from v4 to v7, since v4 targets the deprecated Node 20.

---

## 2026-09-29 — "Who to look for": the people filters, in Settings

> "should we maybe just uhm recreate the apollo filters ?"

Not the whole Apollo panel; only what its API actually honours.

- **Probed at Ramp (free):**
  - titles and seniorities work; keywords work;
  - `include_similar_titles` returned nothing;
  - department filters returned nothing (with the parameter name tried; it isn't documented);
  - `person_not_titles` was ignored.
  - Copying Apollo's filter UI would have shown controls that silently do nothing.
- **Settings → What you sell → Who to look for** (prefilled from the personas, saved with the profile):
  - **Titles:** the personas.
  - **Seniority:** Apollo's 10 levels as checkboxes; default owner…director; none checked = any level.
  - **Keywords:** one word each; default the personas' function words; the first 5 are searched.
  - **Leave out titles containing:** applied by Sift, whole words, any case.
- **Data:** `Rules` gains optional `seniorities`, `keywords`, `excludeTitles`. `peopleFilters()` fills defaults, so older profiles work unchanged, and `generateRules` sets them for new ones.
- **Search:** `findPeople` takes these filters: titles at the chosen seniorities, one search per keyword, titles at any level, merged senior-first, exclusions dropped, up to 25. With no seniority checked it doesn't repeat the title search.
- **Settings also** counts Discover searches in "Spent by Sift this month".
- **Tests:**
  - defaults for old profiles; whole-word exclusion ("Internal" isn't "intern");
  - `findPeople` sends the exact searches in order, puts senior people first, drops exclusions, handles any-level and fallback;
  - `generateRules` fills the new fields.
  - 105 unit tests pass. Smoke adds: 7 seniorities checked by default, titles and keywords from the personas, and adding "operations" + unticking Partner is saved. 26/26 pass.

---

## 2026-09-29 — Finding the real owner (Ramp)

> "is there no better cx head in ramp ?"

There was. Sift never saw her.

- **Cause:** people search matched the persona titles with no seniority filter and took the first 15. At Ramp that returned 15 of 23 customer-experience reps, and Jev could only rank who it was given, so "Waylon L., Customer Experience" came out on top. Ramp's **Head of Customer Operations** (Elena G.) never appeared, because her title doesn't contain the persona phrases.
- **Probing Ramp with the free search:**
  - the persona titles among senior people: 0 results;
  - the phrase "customer experience" among senior people: 0 results;
  - the word "customer" among senior people: Elena plus a Director and three Heads of Customer Success.
- **Fix** (`findPeople`, `src/lib/people.ts`): three free searches in parallel, merged senior-first, up to 25.
  1. The persona titles among senior people.
  2. Senior people matching each single function word from the personas ("customer", "experience", "support").
  3. The persona titles at any level, to fill in.
- **Ranking** now runs in batches of 10 (`rankPeople`), the same lesson as the role judgments: long lists blur Jev's answers.
- **Result at Ramp (live, 1 credit for the company lookup):** 20 people found in 0.9s and ranked in 0.4s. Elena, Head of Customer Operations, is first at 62, ahead of the CX reps (44–49).
- **Guard:** while testing, a search with an empty company id came back with 333,230 people from other companies (IKEA, banks…). Apollo silently drops the filter. `searchPeople` now refuses to run without a company id; there's a test for it. Real lookups always have an id; this was a test-harness mistake, but the failure would have been silent.
- **Tests:** `people.test.ts` (function words, merge order and cap) and `people-guard.test.ts`. 99 pass.

---

## 2026-09-29 — Discover: companies like your best saved accounts

- **Apollo findings:**
  - `mixed_companies/search` takes `lookalike_organization_ids` (max 5) and costs 1 credit per page of up to 100.
  - Results carry name, domain, logo, founding year, revenue and headcount growth, but no industry, headcount or description.
  - The user's new **master key** works for `credit_usage_stats` (425 of 2,525 lead credits left, resets Oct 7), so the credit bar can show the real balance once it's pasted into Settings. The key isn't stored anywhere in the repo.
- **Discover tab** in My Accounts:
  - Seeds = top 5 saved accounts by priority, skipping "Not a fit", named before anything is spent.
  - The ICP's headcount and country rules become search filters; saved, viewed, dismissed and seed domains are excluded.
  - 50 suggestions for 1 credit, in Apollo's similarity order, each with founding year, revenue and 12-month headcount growth.
  - *Look up (2 cr)* runs a full lookup, after which the row shows fit, timing and priority plus *Save*. *Dismiss* hides a suggestion and keeps it out of future searches.
  - *Load 50 more* / *Search again* cost 1 each. An unchanged search is reused for 7 days, and opening the tab never spends.
- **Ledger:** gains a `search` kind; old ledgers without it still add up.
- **Bug found by the smoke test:** chrome.storage returns objects with sorted keys (`{max, min}`), so a search key made from stored rules didn't match one made from fresh rules. That could have made a cached search look stale and asked for another paid search. `searchKey` now uses plain arrays, with a test for it.
- **Tests:**
  - `discover.test.ts`: query building, labels, key stability including storage key order, seed choice, both response shapes, merging.
  - `discover-run.test.ts`: 1 credit per page, repeats free, "more" loads page 2 without duplicates, no seeds, budget, dismissed exclusion.
  - Smoke: seeds shown, similarity order, look-up cost shown, Dismiss remembered, no boxes. 23/23 pass.
- **Live:** real Discover with the master key returned 403 lookalikes of Gorgias (50–500 employees, US), 49 new on page 1, in 1.4s, recorded as exactly 1 `search` credit.

---

## 2026-09-29 — Contacts: best up front, the rest inside the panel, reveal all

> "the drop down should be limited to the extension panel - and we should have the best contatc out first and the other contacts are in a dropdown - what happens if there are two very good contacts do both of them show up - and there should be a button to enrich all of them at one go"

- **Dropdown escaping the panel:** a native `<select>` menu is drawn by the OS and spilled over the page. Replaced by "Show N more contacts", which expands inside the panel as two-line rows (name and title; rank and *Reveal (1 cr)* on the right).
- **Two very good contacts:** now both show. Up front = the best, plus anyone within 10 rank points of them who ranks at least 60 and has an email, up to 3 (`splitContacts`, `src/lib/contacts.ts`). Before, only the single best showed.
- **Reveal all:** *Reveal all N emails (N credits)* asks inline first, states the cost ("you're only charged for people Apollo finds"), and warns in red if it would pass the monthly budget. Afterwards it reports e.g. "Revealed 5 emails. 1 had no email in Apollo."
- **`revealContacts`** (`src/lib/pipeline.ts`) replaces the single reveal. The `reveal` message takes `personIds`.
  - Runs 3 Apollo requests at a time and records credits only for people found.
  - Updates the cache, saved account and open panel in one write each. Revealing one at a time in parallel would have lost updates to read-modify-write races.
  - Failed people stay unrevealed, so they can be retried.
- **Tests:**
  - `contacts.test.ts`: near-ties, the cap of 3, the minimum rank, no-email people, the multi-reveal patch.
  - `reveal.test.ts`: at most 3 in flight, charges 6 of 8 (not-found and failed aren't charged), exactly one write per copy, failures stay retryable.
  - Smoke test on a 8-contact sample: both near-tied contacts shown, the rest collapsed then expanded, the list stays within the 400px panel, no `<select>`, Reveal all asks with the cost. 18/18 pass.

---

## 2026-09-29 — Renamed to Sift; contacts dropdown; icon

> "all the emails getting listed like this is not efficient a drop down is good … lets rename it to sift … the icon as well"

- **Name:** ICP Scout → **Sift**: manifest (`Sift`, action title "Sift this company"), page titles, UI copy, README, SPEC, LICENSE, package name, and the CSV file name (`sift-accounts-<date>.csv`). Earlier log entries keep the old name as history. The GitHub repo is still `extens`.
- **Icon:** from the user's design, exported to `public/icon/{16,32,48,96,128}.png`, which WXT adds to the manifest.
  - The off-white rounded square is kept so the navy mark stays visible on dark Chrome toolbars (the user's theme is dark); the corners outside the square are transparent.
  - 16px and 32px are redrawn with the mark filling more of the square so it stays legible.
  - The README shows the icon.
- **Contacts:** one at a time instead of a stack of cards.
  - New `ContactPicker` shows the selected person (name, title, rank, email or *Reveal email (1 credit)*, LinkedIn) under an accent line.
  - A dropdown lists everyone in rank order, marked "(email ready)" or "(no email)", with "1 of N" beside the heading.
  - A new lookup resets to the best match.
  - Used in both the side panel and My Accounts (which previously listed the top 6).
- **Cleanup:** the contact-card code in the panel and the contact list in My Accounts are gone; the picker's styles moved to the shared stylesheet so both pages get them.
- **Smoke test:** new checks that pages are named Sift, the panel shows one contact at a time, the dropdown lists everyone best first, and choosing someone shows them. 15/15 pass.

---

## 2026-09-29 — Lines only, no boxes

> "lets not have boxes at all just use lines"

- **Buttons** are underlined text actions. The main action on a view gets a heavier 2px underline; secondary actions are stone grey and underline on hover.
- **Fields** (inputs, textareas, selects) have a single bottom line that turns fjord blue on focus.
- **Sections** (settings, `.card`) are separated by a top hairline and space, with no border box.
- **Side panel contacts** are rows between hairlines, and the best contact sits under a 2px accent line. The Reveal email action is left-aligned text instead of a full-width button.
- **Tags** ("Warm", "verified", "Partial fit") are coloured words, no tag shape. Notices use a coloured left line.
- **My Accounts:**
  - Priority is a plain coloured number (was a tinted square).
  - An expanded row is marked by a dashed divider (was a grey background).
  - Tabs are underlined words; the logo placeholder is a plain letter.
- **Emails** use the normal typeface instead of monospace.
- **Smoke test:** a new check fails if any element on the panel, My Accounts or Settings has a border on all four sides (checkboxes excepted). 11/11 pass.

---

## 2026-09-29 — Fit score follows your requirements; white Scandinavian UI

First feedback from using the real extension:

> "no emoji emojis suck - use white scandinavian styel for the ui - also you told its a strong fit but its a partial fit with 53% but 3 of my requiremtnes are met"

### Fit score
- **Problem:** the headline was only Jev's holistic judgment. The checklist sat beside it but never counted. Real Gorgias lookup: 3 ticks, "53%, Partial fit". Two details made it worse:
  - 520 employees against a 500 cap was a hard fail.
  - "Large support teams" at p = 0.50 showed as a tick although Jev couldn't tell.
- **Now:**
  - Each check has a **state** (met / near miss / unsure / not met / no data) and a **credit**.
  - Near miss = headcount within 10% outside a limit, worth 0.5.
  - Unsure = Jev 0.35–0.65.
  - Score = **75% requirements + 25% overall judgment** (`combineFit` in `src/lib/mapping.ts`).
- **Gorgias:** 53 → **69**, shown as "2 of 4 met, 1 near miss, 1 unsure. Overall judgment 53."
- **Old results** (cache, saved accounts, an open panel) are rebuilt on display by `upgradeFit`.
  - The old linear.app result goes 35 → 69, since it meets 3 of 4.
  - My Accounts re-ranks to Linear 68, Gorgias 59, Intercom 49.
- **Correction:** my earlier "gorgias.com: strong fit" came from the made-up sample data used for screenshots (82%), not a real lookup. The sample data now mirrors the real Gorgias result.

### Design
- **No emoji or symbol glyphs anywhere.**
  - Signal icons are gone.
  - ✓/✗ became thin SVG line icons, one per state (`src/components/Icon.tsx`).
  - Star Save is now a Save / Saved button.
  - Arrows after links are gone, middle-dot separators became commas or parentheses, and the settings sections lost their numbers.
- **White Scandinavian look** (`src/components/styles.css`):
  - Palette: white, birch surface, frost hairlines, granite text, one fjord-blue accent, and muted moss / ochre / lingon for status.
  - Always light, even in OS dark mode.
  - Font: Schibsted Grotesk (Norwegian), bundled with the extension, so nothing is fetched.
  - Sentence-case headings; sections separated by space and hairlines instead of stacked cards.
- **The one loud element:** a large, light fit number with a **requirement strip** under it, one segment per check coloured by state.
- **Fixed:** the credit bar never drew on My Accounts (its styles only lived in the panel's CSS).

**Verified:**
- 79 unit tests, including the real Gorgias case, near-miss bounds, and upgrading old results.
- `npm run smoke` 8/8. New checks: the panel stays white with the OS in dark mode, no emoji or symbol glyphs in the panel, and the new ranking.
- Screenshots reviewed for the panel, My Accounts and Settings.

---

## 2026-09-29 — My Accounts

A full-page list of saved and recently viewed companies. Ranked, filterable, with status and notes.

- **Page** (`src/entrypoints/accounts/`): opened from the side-panel footer and Settings (Settings section 4 replaces the old saved table).
  - **Tabs:** Saved / Recently viewed. Recently viewed = cached lookups from the last 7 days, with ☆ Save.
  - **Priority** = 60% fit + 40% timing (`src/lib/accounts.ts`). Sort by priority, fit, timing or recently saved.
  - **Row:** fit, why-now label + top signal, best contact, status dropdown (New / Contacted / Replied / Not a fit), last updated (stale after 14 days), *Refresh · 2 cr*, *Remove*.
  - **Expanded row:** fit checklist, every signal with sources, top 6 contacts with *Reveal · 1 cr*, a note.
  - **Filters:** search (across company, note, persona, all contact titles, signal labels and details), status, "Hot only".
  - Stacks into cards in narrow windows.
- **Data:**
  - Status and notes live in `accountMeta`, separate from the snapshot, so they survive refreshes and unsave/re-save.
  - A successful lookup of a saved company now updates its saved copy, keeping the original `savedAt`.
  - The list prefers the newer of the saved snapshot and the cache.
- **Headless refresh:** `runLookup` accepts `windowId: null` and returns the final state. The background handles `refreshAccount` and the page asks before going over budget. `revealContact` also works without a panel.
- **CSV:** moved to My Accounts; adds `status` and `note` columns.
- **UI smoke test** (`e2e/smoke.mjs`, `npm run smoke`): loads the *built* extension into Playwright's Chromium, seeds sample data (no API calls), checks ranking, status saving, search, the tabs, the side panel and page errors, and screenshots every page.
  - This was the first time the UI ran in a real browser. It found: search missing contact titles and signal details (fixed); link buttons centred instead of left-aligned (fixed); awkward contact-line wrapping (fixed); a cramped search box in narrow windows (fixed).
- **Real-extension check:** clicked *Refresh* on a saved account in real Chromium with the real keys. It took 1.8s, recorded exactly 2 credits (company 1, jobs 1), kept status, note and `savedAt`, and threw no errors. This is the first confirmation that Apollo and Jev work from inside the actual extension, not just from Node.

**Verified:** 74 unit tests (new: priority, stale flag, row building, sort/filter; storage tests for savedAt, metadata surviving unsave, and no lost concurrent credit spends); tsc and build clean; smoke test 6/6.

---

## 2026-09-29 — Website signals (v2)

Why now now also reads the company's own website. Rule: every signal quotes the page and links to it.

- **No new install warning.** An icon click gives `activeTab`. With the new `scripting` permission, `scanSite` runs inside that tab and fetches the same site's pricing, blog, changelog and security pages (it runs with the page's origin, so no host permissions). Costs no Apollo credits.
- **`src/lib/site-scan.ts`** (self-contained, because Chrome serializes it into the tab) extracts:
  - Current page: headline and announcement lines.
  - Pricing: enterprise/SSO/SCIM/contract lines.
  - Security: certifications.
  - Blog/changelog: post titles with dates.
- **Real-site tuning** (linear.app, intercom.com, gorgias.com, vercel.com, notion.com):
  - Dropped text glued from several elements ("PulseInboxMy issues"): layout noise.
  - Post titles must link to their own page; this removes section labels and headings inside a single post.
  - Dates are read only near each item (Linear posts were all getting one date).
  - Text is joined with spaces between elements, so "officeAug 3, 2026" becomes a readable date.
  - Plain dates are read as UTC: "Aug 3" was coming out as Aug 2 in UTC+5:30.
  - Duplicate snippets are removed.
- **Fixed signal library** in `src/lib/site-types.ts`: enterprise push, security/compliance, AI launch, product launch, pricing change, expansion, funding, acquisition, leadership, partnership, customer milestone, none.
- **Jev:** per snippet, a Choice (type) and a Noul (relevance), in batches of 10, run in parallel with the role batches.
  - `eval/site-signals-eval.mjs`: **29/30** on real snippets. The miss: a third-party model's adoption stat labelled "AI launch".
- **Real finds:** Notion: new CTO, ZeroEntropy acquisition, Notion 3.7 agent skills, SOC 2 / ISO. Intercom: "Salesforce signs definitive agreement to acquire Fin", Fin evals launch. Linear: SOC 2, Linear Agent.
- **Panel:** 🌐 rows showing the label plus a verbatim quote, a link to the page path, and the date; "N more from their site" expands.
  - If the site couldn't be read (e.g. a typed-in domain), the card says so.
- **Settings:** a "Website signals" switch (default on). `WhyNow.siteStatus` is `'ok' | 'unavailable' | 'off'`.

**Verified:**
- 66 unit tests, including the reader on fixture HTML in two timezones, a standalone-serialization test, site-signal grouping, and snippet batch remapping.
- The *built, minified* scanner was extracted from `background.js` and run standalone.
- Real sites were scanned and the snippets judged by live Jev (~350ms).
- Not yet clicked through in a real Chrome window.

---

## 2026-09-29 — Role-judgment fix, credit tracking

### Why-now role judgments: wording + batching
**Problem:** Jev counted roles like Account Executive, Backend Engineer and Staff AI PM as "relevant" for a support-QA seller.

**Cause 1: wording.** The old question ("is the company building up the function the seller's product serves?") was too loose.
- Added `eval/roles-eval.mjs`: 66 labelled roles × 3 sellers (support QA, sales engagement, dev platform) × 2 companies (one neutral, one in the seller's own space).
- Results: buyer-team wording 132/132; old wording 117–125; "uses it day to day" 121–127; "judge role not industry" 119–123.
- **Shipped:** "Is this role in the team run by the seller's typical buyers?" (`roleQuestions` in `src/lib/questions.ts`).

**Cause 2: batch size (the main one).** All 40 roles went to Jev in one call, and long lists squeeze answers toward 0.5.
- On 38 real Intercom-style roles, one call of 40 scored 31/38. Batches of 10 scored 38/38 (relevant roles averaged 0.83, irrelevant 0.18), and ran faster (318ms vs 417ms).
- **Shipped:** `judgeWhyNow` in `src/lib/pipeline.ts` runs timing + signals in one call and roles in parallel batches of `ROLE_BATCH = 10`, then maps answers back to the right roles. `src/lib/pipeline.test.ts` covers that mapping.

**Live result:** Intercom went from 7 "relevant" roles (including AE, Brand Voice Lead, Program Manager) to 5, all support or customer success. Linear shows 3.

### Apollo credit tracking
**Finding:** lookups aren't free. Per [Apollo's API pricing](https://docs.apollo.io/docs/api-pricing): organization enrichment = 1 credit, job postings = 1 per page, people enrichment = 1 when found, people search = free. So a new lookup costs **2 credits**.

- `src/lib/credits.ts`: a per-month ledger (company / jobs / reveal), the budget check, lookup cost, and parsing of Apollo's `credit_usage_stats` response.
- **Balance:** `POST /usage_stats/credit_usage_stats` shows the real team balance, but only with a master key. Other keys get 403, which is remembered for 24h. Our test key isn't a master key, so the ledger is the fallback.
- **Recording spends:** after org enrich, after job postings, and after a reveal only when Apollo found the person. Writes are queued so parallel calls can't lose a count.
- **Side panel:** a credit bar at the top (`src/components/CreditBar.tsx`) showing Apollo's balance (master key) or this month's spend (vs. budget, if set). Costs are on the Refresh, Look up and Reveal buttons.
- **Budget:** a new `over_budget` view state, "Monthly credit budget reached", with *Look up anyway* / *Change budget*.
- **Settings → "3 · Apollo credits":** spend breakdown, balance, *Check balance now*, monthly budget, and a hiring-signals switch (off = 1 credit per lookup; why-now then says the signals are off).
- `WhyNow.jobsAvailable` became `jobsStatus: 'ok' | 'unavailable' | 'off'`.

### Also
- Fixed the pushed live test failing type-check (`process` has no Node types in the extension project).
- The live test now asserts that a lookup records exactly `{ company: 1, jobs: 1 }`.

**Verified:** 61 unit tests pass, `tsc` is clean, the build is clean, and the live pipeline passes on intercom.com and linear.app. The panel and settings UI haven't been clicked through in a real Chrome window yet.

---

## 2026-09-29 — Why now

Added timing signals, following the plan's rule that every signal needs evidence. Code writes each signal from Apollo facts; Jev only judges relevance.

- **Findings:**
  - Apollo's organization lookup already includes 6, 12 and 24-month headcount growth, `funding_events` (with news URLs) and department headcounts.
  - `GET /organizations/{id}/job_postings` works (title, url, posted_at, last_seen_at, city/state/country).
- **`src/lib/signals.ts`** builds candidate signals:
  - **Headcount growth/decline:** 6-month change ≥ ±5% or 12-month change ≥ ±10%.
  - **Latest funding:** within 24 months, with its source link. Mergers and acquisitions get their own label.
  - **Hiring volume:** 3 or more open roles.
  - **Open roles:** postings Apollo hasn't seen for 45+ days are dropped. Job titles lose trailing locations and glued-on cities ("Solutions Engineer New Chicago"), so the same role in different cities is counted once.
- **Jev (Decision 2):** a yes/no per open role, a yes/no per signal, and a 4-level timing score. Relevant roles roll up into "Hiring N relevant roles" with a link to each posting.
- **Side panel:** a "Why now" card with the timing label (Hot ≥ 67 / Warm ≥ 34 / Quiet), relevant signals first, less relevant ones collapsed, and source links.
- **Saved accounts and CSV:** added a timing score and the top signal.
- **Speed:** runs in parallel with the contact ranking; the whole lookup takes 1.3–1.8s.

**Verified:** 47 new and existing tests; live on linear.app (Hot 69), intercom.com (Warm 50) and gorgias.com (Warm 45).

---

## 2026-09-29 — v1 (commit `e16358b`)

The first working extension. See `SPEC.md` §1–§12.

- **Setup:** WXT + React + TypeScript, Manifest V3. Permissions: `activeTab`, `sidePanel`, `storage`, and host access to `api.apollo.io` and `api.typesafe.ai` only.
- **Day-1 checks:** both APIs accept extension-origin calls. TypeSafe rejects browser-page requests from an extension origin, so all API calls go through the background worker. Apollo `mixed_people/search` returns 403 for the test key, so `api_search` is used instead (hidden last names, title only).
- **Pipeline:** company lookup → exact rules in code (headcount, country) + Jev fit/checks/persona in parallel with people search → Jev ranks each person.
- **UI:** a side panel (fit card, persona, ranked contacts, email reveal, save) and a settings page (key test, 3-question onboarding → editable rules, saved accounts + CSV).
- **Other:** a 7-day per-domain cache; reveals are kept for good; MIT license; README.
