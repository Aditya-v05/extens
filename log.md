# Change log

Newest first. Each entry covers what changed, why, and how it was verified. Design details live in [`SPEC.md`](SPEC.md).

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
