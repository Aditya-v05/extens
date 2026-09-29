# Sift

<img src="public/icon/128.png" width="64" alt="Sift">

[![CI](https://github.com/Aditya-v05/extens/actions/workflows/ci.yml/badge.svg)](https://github.com/Aditya-v05/extens/actions/workflows/ci.yml)

An open-source Chrome extension for anyone doing outbound. Open a company's website, click the icon (or press **Alt+Shift+S**, ⌥⇧S on a Mac), and a side panel tells you:

1. **Does this company fit my ICP?** A fit score driven mostly by your own requirements (met / near miss / unsure / not met), with Jev's overall judgment as a smaller part.
2. **Why now?** Hiring for roles your product serves, headcount growth, recent funding, plus what the company's own site says: enterprise plans, SOC 2, AI launches, acquisitions, new executives. Each signal links to its source; website signals quote the page word for word.
3. **Who should I talk to?** People at the company, ranked by how likely they are to own the problem you solve.
4. **Their email**, revealed on click, or all at once with *Reveal all* (it shows the credit cost first). The best contacts are shown up front (two if two are nearly as good); the rest are one click away.

**Discover** (a tab in My Accounts) finds companies like your best saved accounts. It uses Apollo's lookalike search, already filtered by your ICP's size and country and skipping anything you've saved, viewed or dismissed. 50 suggestions cost 1 credit and are kept for 7 days; look up the ones you like (2 credits each).

**My Accounts** (from the panel footer or Settings) is a full-page list of saved and recently viewed companies. It's ranked by priority (60% fit + 40% timing), with a status (New / Contacted / Replied / Not a fit), notes, search, a "Hot only" filter, per-account refresh, and CSV export.

Company and people data come from **Apollo**. Judgments come from **Jev**, [TypeSafe](https://typesafe.ai)'s System One model. You bring both API keys.

## Privacy

Full policy: [PRIVACY.md](PRIVACY.md).

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
| Discover search | 1 credit per 50 suggestions (repeat visits within 7 days are free) |
| Fit, persona, ranking, why now | Three Jev calls, a few thousand input tokens per lookup |
| Reveal email | **1 Apollo credit**, and the button says so |

Results are cached per domain for 7 days, so revisits are free. Revealed emails are kept for good.

The side panel shows a **credit bar**. With an Apollo *master* API key it shows your team's real balance. Other keys can't read the balance, so Sift counts its own spending this month instead. You can set a **monthly budget**: once it's reached, new lookups ask before spending.

## Install

Chrome Web Store: submission kit in [`store/`](store/) (listing text, permission justifications, screenshots). Until it's listed, install from source:

### From source

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
   - *Who to look for* (all prefilled): titles, seniority levels, keywords (single words such as "operations", which find titles you didn't list) and titles to leave out. People search costs no credits.

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
npm run build && npm run smoke             # loads the built extension in Chromium, checks the UI, screenshots every page (no API calls)
npm run build && npm run store-shots       # regenerates the Chrome Web Store images in store/
npm run zip                                # packages .output/sift-<version>-chrome.zip for upload

CI (`.github/workflows/ci.yml`) runs the type-check, unit tests, build and smoke test on every push. It needs no API keys and spends no credits.
```

Code map:

```
src/entrypoints/background.ts   icon click, messages, key tests
src/entrypoints/sidepanel/      the panel UI
src/entrypoints/options/        setup, rules editor, credits
src/entrypoints/accounts/       My Accounts page
src/lib/accounts.ts             priority, ranking, filters for My Accounts
src/lib/discover.ts             lookalike query, seeds, candidate merging (Discover)
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

## License

MIT
