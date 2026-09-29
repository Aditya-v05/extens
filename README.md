# ICP Scout

> Working name.

An open-source Chrome extension for anyone doing outbound. Open a company's website, click the icon, and a side panel tells you:

1. **Does this company fit my ICP?** A fit score, plus a ✓/✗ checklist showing why.
2. **Who should I talk to?** People at the company, ranked by how likely they are to own the problem you solve.
3. **Their email**, revealed on click.

Company and people data come from **Apollo**. Judgments come from **Jev**, [TypeSafe](https://typesafe.ai)'s System One model. You bring both API keys.

## Privacy

- No server, no account, no telemetry.
- Your keys and data stay in this browser (`chrome.storage.local`) and are only sent to `api.apollo.io` and `api.typesafe.ai`.
- Permissions: `activeTab` (read the current tab's URL when you click the icon), `sidePanel`, `storage`. No access to your browsing unless you click.

## Costs

| Action | Cost |
|---|---|
| Company lookup + people search | Apollo API calls (search spends no credits) |
| Fit, persona and ranking | Two Jev calls, about 1–2k input tokens per lookup |
| Reveal email | **1 Apollo credit**, and the button says so |

Results are cached per domain for 7 days. Revealed emails are kept for good.

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
                        └─ Apollo people search (persona titles)              ┘ parallel
                      → Jev #2: rank each person
                      → side panel
```

Everything runs in the extension's background worker. See [`SPEC.md`](SPEC.md) for the full design.

## Develop

```bash
npm test             # unit tests
npm run compile      # type-check
APOLLO_KEY=... TYPESAFE_KEY=... npm test   # also runs the live end-to-end test (no credits spent)
```

Code map:

```
src/entrypoints/background.ts   icon click, messages, key tests
src/entrypoints/sidepanel/      the panel UI
src/entrypoints/options/        setup, rules editor, saved accounts + CSV
src/lib/pipeline.ts             lookup orchestration and reveals
src/lib/apollo.ts, jev.ts       API clients
src/lib/questions.ts            every Jev question, in one place
src/lib/rules.ts                ICP text → rules; exact rule checks
src/lib/mapping.ts              Jev answers → fit, persona, ranking
```

## Roadmap

- **Why now:** headcount growth, funding and hiring signals (Apollo already returns most of this)
- **On-site signals:** pricing, careers and blog pages, with every signal linked to its source
- Phone numbers through an optional self-hosted relay
- "My Accounts" view, and "find more companies like my saved ones"

## License

MIT
