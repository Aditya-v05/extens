# Change log

Newest first. Each entry covers what changed, why, and how it was verified. Design details live in [`SPEC.md`](SPEC.md).

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
