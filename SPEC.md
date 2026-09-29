# v1 Spec — ICP Browser Extension

> Working name: ICP Scout. Open source (MIT). Status: v1 built, 2026-09-29.

## 1. What it is

A Chrome side-panel extension. You're on a company's website, you click the icon, and it answers three questions:

1. **Does this company matter to me?** (ICP fit)
2. **Why now?** (timing signals — v1.5+)
3. **Who should I talk to?** (ranked people, email reveal)

Data comes from **Apollo** (user's own key). Judgments come from **Jev**, TypeSafe's System One model (user's own key). There is no backend.

**The wedge:** "I'm looking at a company. Tell me whether it matters, why now, and who I should talk to." Nothing else in v1.

## 2. Principles

- **Local-only.** No server, no telemetry, no account. Keys and data live in `chrome.storage.local` and go only to Apollo and TypeSafe.
- **BYOK.** The user pays Apollo and TypeSafe directly. We never touch their keys.
- **Rules in code, judgment in Jev.** Anything exact (headcount in range, country match) is code. Anything semantic (is this B2B SaaS? does this title own the problem?) is a Jev question.
- **No invented claims.** Jev doesn't generate text. Every reason shown is either an Apollo fact or a Jev answer to a question we wrote. Every web signal (v2) carries its source URL.
- **The user can override.** A low fit score never hides contacts.
- **Credits are visible.** Anything that spends Apollo credits says so before it happens.

## 3. Scope

### In v1
- Onboarding: two API keys, three free-text questions, editable rules
- Side panel on any website: company lookup, fit score and checklist, persona, ranked contacts
- Email reveal (one person at a time, on click)
- Save account (local), copy contact, export saved accounts to CSV
- Per-domain cache (7 days, manual refresh)

### Not in v1
Phone numbers · automated outbound · email/opener generation · sequences · CRM sync · bulk lists · autonomous agents · analytics dashboards · extra data providers · Firefox · hosted backend.

## 4. User flows

### 4.1 Onboarding (first run, and anytime from Settings)

1. **Keys.** Paste the Apollo API key and the TypeSafe API key. Each gets a "Test" button that makes one cheap call and shows ✓/✗.
2. **Three questions** (free text):
   - What do you sell? — *"AI support QA software for SaaS companies."*
   - Describe your ideal customer. — *"Series A–C SaaS, 50–500 employees, large support teams."*
   - Who normally buys? — *"VP Customer Experience, Head of Support, COO."*
3. **Generate rules.** Code (no model call) parses the answers into editable rules:
   ```
   Company size:   50–500                         (regex on the ICP text)
   Countries:      United States                  (alias/region list, e.g. "North America", "DACH")
   Company checks: "Series A–C SaaS companies",   (remaining ICP clauses; each is a Jev yes/no question)
                   "large customer support teams"
   Personas:       VP Customer Experience, Head of Support, COO   (split from the buyers answer)
   ```
4. The user edits and saves. The saved rules are the profile; the original free text is kept, because it goes into Jev's context on every call.

### 4.2 Lookup (the core loop)

1. The user clicks the icon on `linear.app` and the side panel opens.
2. The domain is taken from the tab URL. Cache hit → render immediately and show "Updated 2d ago · Refresh."
3. Cache miss → run the pipeline (§6), streaming results in as they arrive:
   - Company header (name, logo, size, industry) appears first
   - Fit score and checklist
   - Recommended persona and ranked contacts
4. Each contact has a **Reveal email (1 credit)** button.

### 4.3 Reveal, save, export
- **Reveal:** calls Apollo's enrichment for that one person. The email and its status (verified/guessed) are cached with the contact.
- **Save account:** stores the snapshot (company, score, contacts, revealed emails) locally.
- **Export:** CSV of saved accounts and contacts from Settings.

### 4.4 My Accounts (built)
A full-tab page (`accounts.html`), opened from the panel footer or Settings.
- **Tabs:**
  - *Saved*.
  - *Recently viewed*: unsaved lookups still in the 7-day cache, with ☆ Save.
- **Row:**
  - **Priority** = `0.6 × fit + 0.4 × timing`; missing timing counts as 0.
  - Fit %.
  - Why-now label and top signal (relevance ≥ 0.5).
  - Best contact (email when revealed).
  - Status: New / Contacted / Replied / Not a fit.
  - Updated: flagged stale after 14 days.
  - *Refresh · 2 cr* and *Remove*.
- **Expanded row:** fit checklist, all signals with sources, top 6 contacts with *Reveal · 1 cr*, and a note.
- **Controls:** search (company, domain, industry, note, persona, every contact title, signal labels and details), status filter, "Hot only" (timing ≥ 67), and sort by priority / fit / timing / recently saved.
- **Data:**
  - Status and notes live in `accountMeta`, separate from the lookup snapshot, so refreshes and re-saves keep them.
  - Any successful lookup of a saved domain updates the saved snapshot; `savedAt` is preserved.
  - If the cache holds a newer lookup than the saved snapshot, the list shows the newer one.
- **Refresh:** a *headless* lookup in the background worker (`runLookup(null, …)`), with no panel and no tab, so no website signals. The budget check still applies (the page asks before going over).
- **CSV export:** moved here; adds status and note columns.

## 5. Architecture

```
┌────────────── Chrome extension (MV3) ─────────────────────┐
│                                                            │
│  Side panel (React)  ◄──messages──►  Background worker     │
│  - renders state                     - pipeline            │
│  - no API calls                      - apollo client       │
│                                      - jev client          │
│  Options page                        - rules engine        │
│  - keys, profile, export             - cache (storage)     │
└────────────────────────────────────────────────────────────┘
            │                               │
            ▼                               ▼
     api.apollo.io                 api.typesafe.ai/v1/systemone
```

- **Stack:** WXT + React + TypeScript.
- **Permissions:** `activeTab`, `scripting`, `sidePanel`, `storage`; host permissions only for `api.apollo.io` and `api.typesafe.ai`. No `<all_urls>`.
- **Modules** (kept separate so a self-hosted server version is easy later): `resolver`, `apollo`, `jev`, `rules`, `pipeline`, `cache`, `store`.

## 6. Pipeline

```
domain
  │
  ├─► Apollo: organization enrich (by domain) ─────────┐
  │                                                     │
  │   (run in parallel once the org is known)           ▼
  ├─► Code: exact rules (headcount, geo)        company facts
  ├─► Jev call #1 (parallel questions):
  │      icp_fit (Score), semantic checks (Noul each),
  │      persona (Choice)
  ├─► Apollo: people search (org id + all persona titles; no credits)
  │
  └─► Jev call #2: rank people (Score per candidate, one batched request)
          │
          ▼
     result object → cache → side panel
```

**Latency target:** first content in under 1.5s, full result in under 4s.

**Result object:**
```ts
{
  domain, fetchedAt,
  company: { name, logo, industry, headcount, location, apolloId },
  fit: {
    score,                                   // 0–100, from the Jev Score
    checks: [{ label, pass, source: "rule" | "jev", p? }]
  },
  persona: { chosen, distribution },
  contacts: [{ apolloId, name, title, linkedin, rank, email?, emailStatus? }]
}
```

## 7. Jev decisions

All calls: `POST /v1/systemone`, `model: "jev-latest"`. State = seller profile + company facts as named JSON.

### Decision 1 — Account: "Should I pursue this company?"
- `icp_fit` — **Score**, 5 levels, from "clearly outside the ICP (wrong kind of company)" to "a textbook ICP customer." Each level is a concrete description.
- One **Noul** per semantic rule, e.g. `is_b2b_saas`, `stage_in_range`, `custom_1: "Has a large customer support team"`. These become the ✓/✗ checklist.
- Exact rules (headcount, country) are evaluated in **code**, not Jev, and merged into the same checklist.
- **Each check has a state and a credit:**
  - **met** (1); **not met** (0).
  - **near miss** (0.5): headcount within 10% outside a limit, e.g. 520 against 500.
  - **unsure** (Jev p between 0.35 and 0.65; credit = p).
  - **unknown** (no Apollo data; not counted).
  - Jev checks use p as credit.
- **Displayed score** = `0.75 × requirements + 0.25 × overall`:
  - *requirements* = average credit over the checks;
  - *overall* = Jev's holistic `icp_fit` Score (0–100), which catches what the checks don't, like whether they need what you sell;
  - with no checks, the score is *overall* alone.
- **Shown as:** the score; a strip with one segment per check coloured by state; "2 of 4 met, 1 near miss, 1 unsure. Overall judgment 53."; and the checklist with line icons.
- **Why:** on 2026-09-29 a real Gorgias lookup showed 3 ticks next to "53%, Partial fit", because the score was *overall* alone. The user reasonably read that as broken.
- **Old results:** results cached or saved before this are rebuilt on display (`upgradeFit`). Nothing needs clearing.

### Decision 2 — Timing ("why now", built)
Code builds candidate signals from Apollo facts, each with evidence (`src/lib/signals.ts`):
- **Headcount growth/decline:** 6-month change ≥ ±5% or 12-month change ≥ ±10%.
- **Funding:** the latest round within 24 months, linked to its news article. Mergers and acquisitions get their own label.
- **Hiring volume:** 3 or more open roles. Postings not seen for 45+ days are dropped. The same role posted in several places is merged by stripping locations from titles.
- **Open roles:** up to 40, each judged individually.

Jev calls, run in parallel with the people ranking:
- A **Noul** per open role, in parallel **batches of 10**: "is this role in the team run by the seller's typical buyers?" Relevant roles (p ≥ 0.5) roll up into a single "Hiring N relevant roles" signal, with a link to each posting.
  - *Wording:* `eval/roles-eval.mjs` compares four wordings on 66 labelled roles × 3 sellers × 2 companies each (one neutral, one in the seller's own space). The buyer-team wording scored 132/132. "Building up the function the product serves" scored 117–125 and counted engineers and PMs as support roles.
  - *Batching:* long lists squeeze answers toward 0.5. On 38 real Intercom-style roles, one call of 40 scored 31/38, while batches of 10 scored 38/38 (relevant roles averaged 0.83, irrelevant 0.18).
- A **Noul** per other signal: does it make now an especially good time, given what the seller sells?
- A **Score** (4 levels) for overall timing, shown as Hot (≥ 67), Warm (≥ 34) or Quiet.

Signals with relevance ≥ 0.5 are shown; the rest sit behind "Show less relevant signals". Labels are always written by code, never by the model.

### Website signals (built)
- **Access:** on an icon click, `chrome.scripting.executeScript` runs `scanSite` (`src/lib/site-scan.ts`) in that tab, using the `activeTab` grant. It runs with the page's origin, so it can fetch the same site's other pages without host permissions. There's no install warning and no "all sites" access.
  - The function is serialized into the tab, so it must be self-contained. A unit test runs it via `new Function(fn.toString())`.
  - If there's no grant (typed-in domain, tab navigated away) or the tab shows another site, the lookup continues without it (`siteStatus: 'unavailable'`).
- **Pages:** the current page, plus pricing, blog, changelog and security. Links found on the current page are preferred; common paths are the fallback. That's 5 pages max, 5s timeout each, same origin only.
- **Extraction (code):**
  - Current page: headline and announcement lines ("Introducing…", "raised", "joins as"…).
  - Pricing: enterprise/SSO/SCIM/contract lines.
  - Security: SOC 2/ISO/HIPAA lines.
  - Blog/changelog: post titles that link to their own page, with a date found near each item. Plain dates are read as UTC.
  - Text glued from several elements is dropped as layout noise, and duplicates are removed.
  - Dated posts older than 365 days are dropped; at most 30 snippets.
- **Jev, per snippet** (batches of 10):
  - a **Choice** over the fixed library in `src/lib/site-types.ts` (enterprise push, security/compliance, AI launch, product launch, pricing change, expansion, funding, acquisition, leadership, partnership, customer milestone, none);
  - a **Noul** for relevance to the seller.
  - Snippets whose type Jev is less than 0.5 sure of, or typed as none, are dropped. The rest are grouped into one signal per type.
  - `eval/site-signals-eval.mjs`: 29/30 on real snippets.
- **Display:** the code-written label (e.g. "Shipping AI") plus the page's own words as a quote, linked to the page and dated.
- **Timing:** the timing Score also sees the website snippets.

### Decision 3 — Person: "Who most likely owns the problem?"
- `persona` — **Choice** over the user's personas plus `none_fit`. Asked in Jev call #1.
- `rank_<id>` — **Score** per candidate person (title, seniority, department): "How likely is this person to own the problem the seller solves?" Batched into one request. Sort by score and tie-break on seniority.

### Onboarding conversion
- Pure code in v1 (see §4.1). The user edits the result. Mapping free text onto Apollo's industry list with Jev is a possible later improvement.

## 8. Apollo usage

| Purpose | Endpoint (verified 2026-09-29) | Credits |
|---|---|---|
| Company by domain | `GET /api/v1/organizations/enrich?domain=` | 1 (per Apollo's API pricing doc) |
| Find people | `POST /api/v1/mixed_people/api_search` (`organization_ids`, `person_titles`) | none expected |
| Reveal email | `POST /api/v1/people/match` with `{ id }` | 1 per reveal |
| Job postings | `GET /api/v1/organizations/{id}/job_postings` (`title`, `url`, `posted_at`, `last_seen_at`, `city`, `state`, `country`) | 1 per page (we fetch one page of 100) |
| Credit balance | `POST /api/v1/usage_stats/credit_usage_stats` → `credit_usage_stats.lead_credit.{limit,consumed,left_over}`, `current_credit_cycle` | free; **master key only** (403 otherwise) |

- Auth header: `X-Api-Key`.
- `mixed_people/search` returned **403** for this key. Use `api_search` only.
- `api_search` returns only `id`, `first_name`, `last_name_obfuscated`, `title`, `has_email`, `has_direct_phone`. There is no seniority and no LinkedIn URL, so **people are ranked on title only**. Show "Cristina C." until the email is revealed. Mark or sort down people with `has_email: false`.
- `people/match` by id returns the full name, `email`, `email_status` (e.g. `verified`), `linkedin_url`, `seniority`, and `departments`.
- The organization lookup already includes `organization_headcount_{six,twelve,twenty_four}_month_growth`, `departmental_head_count`, `funding_events`, `latest_funding_stage`, and `technology_names`. Most of v1.5 "why now" needs **no extra calls**. Job postings are untested.
- Rate limit headers: `x-rate-limit-minute: 1000`.

Cache everything per domain to avoid repeat spend.

### Credits
- **Ledger:** every credit-spending call is recorded in a local, per-month ledger (company, jobs, reveal). Writes are queued, so parallel calls can't lose a count.
- **Balance:** with a master key, the panel shows Apollo's real `lead_credit` balance, refreshed after each spend. For other keys, the 403 is remembered for a day.
- **Budget:** an optional monthly budget. When the next lookup would exceed it, the panel shows "Monthly credit budget reached" with *Look up anyway*.
- **Hiring signals setting:** turning off job postings makes a lookup cost 1 credit instead of 2.

## 9. Storage

```
keys:      { apollo, typesafe }          // local only, never synced
profile:   { rawAnswers, rules, personas, updatedAt }
cache:     { [domain]: ResultObject }    // 7-day TTL
saved:     { [domain]: ResultObject & { savedAt } }
accountMeta: { [domain]: { status, note, updatedAt } }   // survives refresh / unsave
reveals:   { [apolloPersonId]: { email, status, revealedAt } }
settings:  { monthlyBudget: number | null, fetchJobs: boolean, scanSite: boolean }
credits:   { month: "YYYY-MM", company, jobs, reveal }   // spent by ICP Scout
balance:   Apollo lead-credit balance (master keys) or { available: false }
```

## 10. Side panel states

| State | Shows |
|---|---|
| No keys / no profile | "Set up in 2 minutes" → onboarding |
| Non-company page (google.com, localhost, chrome://) | "Open a company's website" |
| Company not found in Apollo | "Apollo doesn't know this domain", with a manual domain input |
| Low fit | Score + checklist, then "Show contacts anyway →" |
| No people found | "No matching contacts", with other personas to try |
| API error / 429 / 529 | Which service failed, plus Retry. A partial result stays visible. |
| Invalid key | Link to Settings, naming the failing key |

## 11. Testing

- **Eval set:** 30 real companies, hand-labelled for fit (yes/no), best persona, and best person. Run it against the pipeline and report fit accuracy, persona accuracy, and whether the best person lands in the top 3.
- Use it to tune question wording and score thresholds. Re-run it after any prompt change.
- **Unit tests:** rules engine, domain resolver, result mapping (Apollo and Jev fixtures).
- **Manual QA:** each state in §10.

## 12. Day-1 spikes

Results from 2026-09-29, using curl with an `Origin: chrome-extension://…` header against linear.app:

| Check | Result |
|---|---|
| Apollo accepts extension-origin calls | ✅ org enrich 200 (~1.0s), api_search 200 (~1.6s), people/match 200 (~0.5s) |
| TypeSafe accepts extension-origin calls | ✅ 200 in ~0.36s, 580 input tokens for 3 questions |
| TypeSafe CORS preflight from a `chrome-extension://` origin | ❌ 400, so **all API calls must go through the background worker** (with host permissions, CORS doesn't apply there) |
| Estimated latency | ~1.0s to company header; ~3s full result (org → [Jev #1 ∥ search] → Jev #2) |
| Apollo credit cost of org enrich / search | ✅ Apollo's pricing doc: org enrich 1, job postings 1 per page, people search free, people enrichment 1 when found |
| Apollo ToS on third-party BYOK tools | ⏳ still to read |

Jev response shapes observed (model `jev-1.13.0`):
- Score: `{ score: 2.1, confidence, probabilities: {"0".."4"}, legend }`. Map to 0–100 as `score / (levels-1) * 100`.
- Noul: `{ noul: 0.97 }`
- Choice: `{ choice, confidence, probabilities }`

Sanity check: for an example seller of support QA software, Linear scored 2.1/4 ("partial fit") and the persona was `head_support` at 0.91. Both are sensible.

## 13. Roadmap

- ~~**v1.5 — Why now**~~ built. See §7, Decision 2.
- ~~**v2 — On-site signals**~~ built. See §7, "Website signals".
- ~~**My Accounts**~~ built. See "My Accounts" in §4.
- **Next:** optional self-hosted relay for phone reveals; "find more companies like my saved ones."

## 14. Open questions

- Name
- First real ICP to use for the eval set
