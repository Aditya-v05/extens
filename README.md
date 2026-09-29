# Sift

<img src="public/icon/128.png" width="64" alt="Sift">

An open-source Chrome extension for anyone doing outbound. Open a company's website, click the icon, and a side panel tells you:

1. **Does this company fit my ICP?** A fit score driven mostly by your own requirements (met / near miss / unsure / not met), with Jev's overall judgment as a smaller part.
2. **Why now?** Hiring for roles your product serves, headcount growth, recent funding, plus what the company's own site says: enterprise plans, SOC 2, AI launches, acquisitions, new executives. Each signal links to its source; website signals quote the page word for word.
3. **Who should I talk to?** People at the company, ranked by how likely they are to own the problem you solve.
4. **Their email**, revealed on click. Contacts are ranked and picked from a dropdown, one at a time.

**My Accounts** (from the panel footer or Settings) is a full-page list of saved and recently viewed companies. It's ranked by priority (60% fit + 40% timing), with a status (New / Contacted / Replied / Not a fit), notes, search, a "Hot only" filter, per-account refresh, and CSV export.

Company and people data come from **Apollo**. Judgments come from **Jev**, [TypeSafe](https://typesafe.ai)'s System One model. You bring both API keys.

## Privacy

- No server, no account, no telemetry.
- Your keys and data stay in this browser (`chrome.storage.local`) and are only sent to `api.apollo.io` and `api.typesafe.ai`.
- Permissions: `activeTab` and `scripting` (only when you click the icon: read the tab's URL, and read that same site's pricing, blog, changelog and security pages), `sidePanel`, `storage`. There's no "read all websites" permission and no access to your browsing unless you click.
- Website signals send short public snippets from the company's own pages to Jev for labelling. You can turn this off in Settings.

## Costs

Per [Apollo's API pricing](https://docs.apollo.io/docs/api-pricing):

| Action | Cost |
|---|---|
| New company lookup | **2 Apollo credits**: 1 for the company, 1 for job postings. Turn off hiring signals in Settings to make it 1 |
| People search | Free |
| Fit, persona, ranking, why now | Three Jev calls, a few thousand input tokens per lookup |
| Reveal email | **1 Apollo credit**, and the button says so |

Results are cached per domain for 7 days, so revisits are free. Revealed emails are kept for good.

The side panel shows a **credit bar**. With an Apollo *master* API key it shows your team's real balance. Other keys can't read the balance, so Sift counts its own spending this month instead. You can set a **monthly budget**: once it's reached, new lookups ask before spending.

## Install (from source)

```bash
npm install
npm run build        # outputs .output/chrome-mv3
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`.

For development, `npm run dev` starts Chrome with the extension loaded and hot reload on.

## Setup

The settings page opens on install:

1. **Keys:** your Apollo API key (it needs people search and enrichment) and your TypeSafe key. Hit *Save & test*.
2. **What you sell:** three plain-English answers (what you sell, your ideal customer, who buys).
3. **Generate rules**, then edit them:
   - *Company size* and *countries* are checked exactly against Apollo data.
   - Each *company check* ("B2B SaaS", "large support team") is a yes/no question for Jev.
   - *Buyer personas* drive the Apollo search and the persona pick.

## How it works

```
click icon → domain → Apollo company lookup
                        ├─ rules (code): headcount, country
                        ├─ Jev #1: fit score + yes/no checks + best persona   ┐ run in
                        ├─ Apollo people search (persona titles)              │ parallel
                        ├─ Apollo job postings                                │
                        └─ read the site: pricing, blog, changelog, security  ┘
                      → Jev #2: rank each person    ┐ parallel
                      → Jev #3: why now signals     │  (roles and site snippets
                                                    ┘   judged in batches of 10)
                      → side panel
```

Everything runs in the extension's background worker. See [`SPEC.md`](SPEC.md) for the full design and [`log.md`](log.md) for the change history.

## Develop

```bash
npm test             # unit tests
npm run compile      # type-check
APOLLO_KEY=... TYPESAFE_KEY=... npm test   # also runs the live end-to-end test (spends 2 Apollo credits)
TYPESAFE_KEY=... node eval/roles-eval.mjs  # compares role-question wordings on labelled roles
TYPESAFE_KEY=... node eval/site-signals-eval.mjs  # checks website-snippet labelling
SITES=https://linear.app/ npx vitest run src/lib/site-scan.live.test.ts --silent=false  # website reader on real sites
npm run build && npm run smoke             # loads the built extension in Chromium, checks My Accounts, screenshots every page (no API calls)
```

Code map:

```
src/entrypoints/background.ts   icon click, messages, key tests
src/entrypoints/sidepanel/      the panel UI
src/entrypoints/options/        setup, rules editor, credits
src/entrypoints/accounts/       My Accounts page
src/lib/accounts.ts             priority, ranking, filters for My Accounts
src/lib/pipeline.ts             lookup orchestration and reveals
src/lib/apollo.ts, jev.ts       API clients
src/lib/questions.ts            every Jev question, in one place
src/lib/rules.ts                ICP text → rules; exact rule checks
src/lib/signals.ts              Apollo facts → why-now candidate signals
src/lib/credits.ts              credit ledger, budget, Apollo balance parsing
src/lib/site-scan.ts            website reader injected into the tab (self-contained)
src/lib/site-types.ts           the fixed library of website signal types
eval/roles-eval.mjs             wording eval for the per-role Jev question
src/lib/mapping.ts              Jev answers → fit, persona, ranking, why now
```

## Roadmap

- Phone numbers through an optional self-hosted relay
- "Find more companies like my saved ones"

## License

MIT
