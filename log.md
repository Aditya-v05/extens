# Change log

Newest first. Each entry covers what changed, why, and how it was verified. Design details live in [`SPEC.md`](SPEC.md).

---

## 2026-09-30 — Sift this page is always there

> "no resift button ?" (screenshot: panel showing Fieldguide while the tab was on Pylon)

- **Why it was missing:** the line only appeared once the panel knew which tab its result came from. A result made before the update, or from a typed domain or My Accounts, had no recorded tab, so the panel never offered the button.
- **Fix:** every result now has a line above it, "Showing fieldguide.com", with **Sift this page**. When the active tab is no longer the result's own, the line changes to "This tab has changed. Still showing fieldguide.com." and gets stronger. Empty and not-a-company pages keep their own single button.
- **Verified:**
  - the smoke test checks both states and that there is only one button on not-a-company pages;
  - 31 smoke checks, 123 tests and the build pass;
  - screenshot `e2e/screenshots/panel-linear.png`.
- **To try it:** reload the unpacked extension at chrome://extensions.

---

## 2026-09-30 — Landing: slat cards across the whole hero (branch `site-redesign`)

> "we can have the cards all over actually and size the sift text in the cards a bit up" (their screenshot, on a shorter screen, had SIFT cut off at the bottom)

- **Layout:** the slat wall now fills the entire hero behind the copy. Cards behind the headline, lede and button (an ellipse around the copy) and under the nav are dimmed so the text stays readable.
- **SIFT sizing:** SIFT now takes the space between the copy and the bottom edge, up to 380 px tall, so it is always fully visible. It is large on tall screens and smaller on short ones instead of being cropped.
- **Verified:**
  - screenshots at 1440×900, 1528×750 (close to the user's screen) and 390 px;
  - no overflow or page errors;
  - every reveal fires;
  - `og.png` regenerated;
  - tests pass.

---

## 2026-09-30 — Landing v7: SIFT in slats, new headline (branch `site-redesign`)

> "let us remove the sifting part - lets add the large sift text down there - lets change the text to sift through the companies (work on it a bit)" and, with the MicroSlats source pasted: "i want small cards like this but no animation needed we can maybe darken the cards to spell out sift below and they flicker randomly"

- **Copy:**
  - headline "Sift through companies. / *Talk to the right ones.*";
  - lede "Open any company's site and Sift tells you if it fits, why now, and who to reach. One click, on your own Apollo and Jev keys.";
  - one Install Sift button, with "Free and open source" under it;
  - page title and share description updated to match.
- **SIFT in slats** (`site/SlatWord.tsx`, replaces the evidence canvas):
  - a full-width wall of small rounded cards fills the bottom of the first screen;
  - the cards inside the letters of SIFT are darkened, so the word reads like holes punched in a sieve;
  - random cards flicker, and about 1 in 8 flickers mint;
  - no waves and no cursor effects;
  - it is our own 2D-canvas take on the idea, no ogl and no copied code, redrawn about 16 times a second only while visible, and still under reduced motion;
  - phones use smaller cards so the letters stay readable.
- **Verified:**
  - screenshots at 1440 and 390 px;
  - every reveal fires on scroll; no overflow or page errors;
  - `og.png` regenerated;
  - compile, 123 tests, `wxt build` and smoke pass.

---

## 2026-09-30 — Landing v6: centred hero with a living evidence canvas (branch `site-redesign`)

> "no lets not use the right left design its too ai like can we think of something different". Then a pasted direction: one centred idea with very little copy, then show Sift doing it ("noise comes in, one answer comes out"). Mint should mean signal only. Kill the galaxy, the ghost wordmark and the second CTA.

- **Copy:**
  - "Know who's worth / *talking to.*";
  - "Qualify any company. Find the signal. Reach the right person.";
  - one CTA, **Install Sift** (cream), with "Bring your own Apollo + Jev keys" in small mono.
- **Evidence canvas** (`site/Evidence.tsx`), about 1100 px wide under the copy. It plays a 12.8 s loop:
  1. six pieces of evidence about Acme appear in grey (status: "reading acme.example…");
  2. the three that don't matter (the Series B at 48%, a blog offsite recap, a brand-designer opening) blur away ("sifting…");
  3. the three that do (hiring 86%, the pricing-page quote 71%, headcount 62%) turn mint and draw in, and thin mint lines join them;
  4. Ingrid Holm, VP Customer Experience, 92 (fit 90, timing 74) appears ("signal.").
- **Receipts:** hovering or focusing any piece shows its source. The loop holds while you hover, or while the canvas is off screen or the tab is hidden.
- **Other behaviour:** reduced motion shows the final answer at once. On phones the pieces stack and connect vertically. Every number comes from `demo-data.ts`.
- **Colour:** mint now means signal. The Install buttons (nav, hero, closing) are cream; the swirl and three.js are gone from the hero (fx.tsx now holds only the blinds and slats).
- **Answers section:** labelled "How Sift got there".
- **Verified:**
  - screenshots of the sequence (reading, sifting, signal, hover receipt) at 1440 px and 390 px;
  - every reveal fires on scroll; no overflow or page errors;
  - `og.png` regenerated from the final frame;
  - compile, 123 tests, `wxt build` and smoke pass.

---

## 2026-09-30 — Landing v5: product-first hero (branch `site-redesign`)

> Pasted critique: the hero had too many competing focal points (galaxy, ghost wordmark, long grey paragraph, three CTAs); "Don't sell mystery in space. Sell clarity from noise." Recommended: copy left, a real product result right, sparse dots, no ghost wordmark, one primary CTA, Privacy out of the top nav. The user: "i think we might have to use the best".

- **Left:**
  - "Know who's worth talking to.";
  - a shorter lede ("…explains why it matters now, and surfaces the best person to contact.");
  - **Install Sift** (primary) and **See the demo** (scrolls to `#demo`);
  - one quiet line: "Free and open source. Runs on your own Apollo and Jev keys, one click in your browser."
- **Right:** a condensed result card for Acme: fit 90, why now (Timing 74, with hiring 86%, moving upmarket 71%, headcount 62%), and Talk to Ingrid Holm, VP Customer Experience, 92. Every number is read from `demo-data.ts`, so it matches the real panel in the demo below. Rows arrive in the order Sift works.
- **Swirl:** now a sparse ring (1,700 dots, down from 3,400; 900 on phones), tilted face-on so it frames the card as the thing it feeds.
- **Removed:** the ghost "SIFT" wordmark, the selection point, and Privacy from the top nav (it stays in the footer).
- **Fixes:**
  - the web stub gained `tabs.onActivated/onUpdated` and `permissions.request`, because the demo renders the real panel, which now listens for tab switches;
  - the avatar initials had inherited the job-title style.
- **Verified:**
  - screenshots at 1440 and 390 px;
  - every reveal fires on scroll;
  - no overflow or page errors; reduced motion OK;
  - `og.png` regenerated (headline and card);
  - compile, 123 tests, `wxt build` and smoke pass.
- **Note:** the round widget at the right edge of the user's screenshots comes from a browser extension on their machine, not from the site.

---

## 2026-09-30 — Sift this page: re-sift after switching tabs

> "we need a refresh button like once i switch to different site with the panel open i need to have a button the re-sifts if it doesnt"

- **What:**
  - when the active tab is no longer the one the panel's result came from (you switched tabs, or that tab loaded another page), a line appears under the credit bar: "This tab has changed. Still showing gorgias.com." with **Sift this page**;
  - the same button is on the empty, not-a-company and LinkedIn-feed states.
- **Why a permission:**
  - Chrome only gives an extension a tab's address after its icon or shortcut is used, and a click inside the side panel doesn't count;
  - so the button asks once for the optional `tabs` permission, inside the click, then reads the active tab's address only at that moment;
  - it is not requested at install, and switching tabs only compares tab ids, which need no permission;
  - if you decline, the panel says to use the icon or Alt+Shift+S.
- **Limit:** lookups started from the button can't scan the website (that needs the icon's grant), so website signals show as unavailable for uncached companies. Apollo data, fit, hiring, headcount, funding and contacts all work.
- **How:**
  - the background records the source tab on every sift (`setViewTab`);
  - `useTabSwitched` in `src/components/SiftThisPage.tsx` compares it with the active tab;
  - a new `siftTab` message reuses the icon-click path (`siftTab()` in background);
  - PRIVACY, README, SPEC, the store listing and the landing privacy line are updated.
- **Verified:**
  - compile and 123 tests pass;
  - `wxt build`: the manifest lists `tabs` only under `optional_permissions`;
  - smoke now has 30 checks: the bar appears when the result's tab isn't the active one, disappears when it is, and "Sift this page" shows on pages Sift can't use;
  - not verified: the Chrome permission prompt itself (headless Chromium can't show it). Worth one manual try: click Sift on a site, switch tabs, press Sift this page, allow.

---

## 2026-09-30 — Landing: wordmark behind the headline (branch `site-redesign`)

> "can we have the sift word below the swirl like behind the hero text - know who's worth talking part"

- **What changed:** the outline "SIFT" moved out of the vortex into the hero copy. It is centred on the headline and sits behind it (z-index -1 inside the copy). The swirl is now clear above it, and the letters' top edge just meets the swirl's lower rim.
- **Verified:**
  - screenshots at 1440 and 390 px (the text stays legible over the 16% stroke);
  - no overflow or page errors;
  - `og.png` regenerated;
  - tests pass.

---

## 2026-09-30 — Landing: portfolio and email in the maker strip (branch `site-redesign`)

> "add my portfolio in the contact part and this along with my email"

- **Maker strip:**
  - now reads "Made by Aditya Venkatesan" (name from the portfolio);
  - shows the email as a mono link;
  - buttons: Portfolio (https://aditya-venkatesan-gtm.vercel.app/, mint, primary), Email me (mailto), GitHub.
- **Footer:** "Report an issue" moved into the Project column.
- **Verified:**
  - screenshots of the strip at 1440 and 390 px;
  - no overflow or page errors;
  - compile and tests pass.

---

## 2026-09-30 — Landing v4.2: outline wordmark behind the swirl (branch `site-redesign`)

> "can we incorporate this part into the hero section somehow i really like it" (the outline SIFT wordmark from v3)

- **What changed:** the giant outline "SIFT" (1 px mint stroke at 16%) is back. It sits behind the vortex, centred on the selection point (the same `--vy` the canvas uses), so the particles sweep across the letters. The layers, back to front: wordmark, canvas, selection point. On phones it is 36vw wide.
- **Verified:**
  - screenshots at 1440 and 390 px;
  - no overflow or page errors;
  - `og.png` regenerated;
  - tests pass.

---

## 2026-09-30 — Landing v4.1: quieter hero, maker strip in the footer (branch `site-redesign`)

> "i dont want those lines/callouts at all - and i am not sure about the center logo also itd be cool to know that i have created this so a contact part at the footer would be cool as well"

- **Hero:**
  - removed the two annotation lines;
  - replaced the boxed app icon with a glowing selection point that slowly breathes, so the picture no longer looks pasted on;
  - the swirl now has a clear hierarchy: faint loose dust, medium dots on the arms, and the few selected dots mint, about twice the size and fully bright, orbiting tight around the point;
  - about 35% fewer particles (3,400 desktop, 1,500 mobile).
- **Footer:** a "Made by" strip above the links with the GitHub avatar, handle, one line ("A GTM engineer building Sift in the open…"), and buttons to the GitHub profile and to open an issue. No email is published.
- **Verified:**
  - screenshots at 1440 and 390 px;
  - no overflow or page errors;
  - every reveal fires on a real wheel scroll (the old QA script jumped past the new strip);
  - `og.png` regenerated;
  - 123 tests, `wxt build` and smoke (28) pass.

---

## 2026-09-30 — Landing page v4: our own look (branch `site-redesign`, preview only)

> "i like the style but it feels like we straight up ripped off we need to add our own twist … i dont necessarily want so much cursor action … we can have the 3js swirl as the main part not so small on the top … the text with the beautiful sift embed … bigger and more in the center"

- **Hero is the swirl** (`site/fx.tsx`, replaces `SiftField.tsx`). Sifting as panning for gold:
  - thousands of dots ride three spiral arms in towards the Sift mark;
  - most flash and are flung back over the rim, and about 1 in 12 turns mint and settles into a ring around the mark;
  - it is big and centred, with two hand-set notes ("every company you visit", "the few worth your time");
  - the headline, lede and buttons sit under it; the chips, result pill, stats and outline wordmark are gone.
- **No cursor effects anywhere.** The pictures move on their own.
- **Meridian signatures removed and replaced with a sieve motif:**
  - the framed card with dot corners → a full-bleed night hero;
  - the glass pill nav → a full-width bar with a mint scroll-progress line;
  - numbered chips → a sieve glyph, the question, and the score the card beside it shows (90, 74, 92, 88, matching the demo data);
  - flat tinted blocks → slatted stages;
  - tinted cost cards → a receipt with dotted leaders and "Sift's own fee: 0";
  - the privacy band sits behind closed blinds (a shader), and the closing and footer are one night block over a rolling sea of slats instead of a giant wordmark.
- **Shaders:** the React Bits components the user shared (GradientBlinds, MicroSlats) were ideas only. The blinds and slats are our own small three.js shaders: no `ogl` dependency, and no Commons Clause code in an MIT repo. All three share one lifecycle: they draw only while on screen, pause in hidden tabs and hold a still frame under reduced motion.
- **Verified:**
  - Playwright at 1440 and 390 px, screenshots reviewed (fixed the dark-on-dark closing headline, too-bright blinds light, a small mobile swirl, and note legibility over the arms);
  - no overflow, no page errors, reveals fire, content visible under reduced motion, card hover lift -4 px;
  - `og.png` regenerated;
  - compile, 123 tests, `wxt build` and smoke (28) pass.

---

## 2026-09-30 — Landing page v3: centred funnel hero, Meridian-style sections (branch `site-redesign`, preview only)

> "this part makes little sense - id like to have the hero section text alligned tpo thew center with the particle funekling in the middle - also it looks pretty bland and boring … the header and footer are lackluster https://meridian-ind.vercel.app/"

- **Research (Playwright):** Meridian closely (framed deep-green hero card, dot-grid corners, floating glass pill nav, serif headings with mono labels, numbered sections, tinted cards, a giant cropped wordmark), plus Attio, Clay, Wispr, incident.io, Linear and Polar.
- **Hero:**
  - a framed dark card with dot-grid corners;
  - example domains at the top fall into a centred funnel onto the Sift mark (`SiftField.tsx` rewritten). About 1 in 13 dots pass, turn mint and stream into a result pill: "Ingrid Holm, VP Customer Experience 92";
  - centred copy in Instrument Serif, mono eyebrow, mint and glass buttons, a stats row (1 click, 4 answers, 0 servers, 2 credits) and an outline "SIFT" wordmark.
- **Nav:** a floating glass pill (blur, border, depth) that tightens on scroll.
- **Scroll story replaced.** The iframe story didn't read well. It is now four numbered answers (01 fit, 02 why now, 03 who to email, 04 LinkedIn), each beside a tinted stage holding the *real* panel component (`FitCard`, `WhyNowCard`, `ContactPicker`, `ProfileCard`, now exported from `App.tsx`; nothing else changed). The panel iframe files are removed.
- **Also:**
  - "After the click" as dark and light tiles;
  - costs on tinted cards;
  - privacy as a full-bleed night band;
  - a dark closing card with the field;
  - a new footer with three link columns (including the changelog) and a giant gradient "SIFT" wordmark.
- **Fonts:** Instrument Serif and JetBrains Mono (self-hosted via fontsource).
- **Verified:**
  - Playwright QA: every reveal fires, the nav scrolled state works, no horizontal overflow at 390 px, content visible under reduced motion, card hover lift -4 px, no page errors;
  - screenshots reviewed (fixed the footer wordmark letters colliding and the result pill width on mobile);
  - `og.png` regenerated from the new hero;
  - `npm run compile`, 123 tests, `wxt build`, and smoke (28 checks) pass.
  - The no-slop-motion linter flags 10 soft shadows. They are kept on purpose: layered white cards on tinted stages and the glass nav are the Meridian depth the user asked for.

---

## 2026-09-30 — Landing page redesign (branch `site-redesign`, preview only)

> "can we make the site atleast a bit better this is super bland lets give it some life … visit multiple yc company landing pages … u can use three js"

- **Research (Playwright):** Resend, Raycast, Supabase, Loops and PostHog. Hero screenshots, whole-page strips, fonts, WebGL/video use, animation counts, and hero motion measured (idle vs. mouse: Raycast 17% / 12%, Resend 4% / 5%). All five have fixed navs.
  - **Patterns taken:** one moving hero object beside a calm, huge headline (Resend, Raycast); the product big and early (Loops, Raycast); short punchy section heads; a story that ends on the opening promise.
- **Hero: "sifting", in three.js** (`site/SiftField.tsx`).
  - A polar-night field: dots fall onto a shimmering dotted sieve. Most flash and scatter; about 1 in 14 passes, turns the mark's teal, and funnels into a stream that lands where the Sift panel opens in the demo below.
  - The pointer parts the dots.
  - All motion runs in one vertex shader (61 fps even on headless software GL). It pauses off-screen and in hidden tabs, is static under reduced motion, and is loaded after first paint (page script 11 KB gz; three.js 133 KB gz separately).
- **Copy:** "Know who's worth talking to." (the user's line), a solid Install button, and "See how it works".
- **Structure:**
  - the demo straddling night and day;
  - **"One click. Four answers."**, a scroll story where the *real* side panel (an iframe, `site/panel.html`) follows the step being read: fit → why now (scrolls to the signals) → who (contacts, email revealed) → LinkedIn ("On this profile");
  - "And after the click" (My Accounts, Discover, Who to look for);
  - **costs** as big counting numbers (2 / 0 / 1 / 1);
  - **privacy** as a diagram (your browser → Apollo and TypeSafe, no Sift server);
  - FAQ;
  - a dark closing band with the field again.
- **Header:** dark over the hero, then light and blurred.
- **Design note:** this departs on purpose from the extension's all-white, lines-only system (dark bands, a solid pill button) because the user asked for more life. The extension UI is unchanged.
- **Verified in Playwright:** field renders and moves; header switches; each story step switches the embedded panel (scroll positions 0 / 397 / 537, profile card on LinkedIn); counts reach 2 / 0 / 1 / 1; no errors; no horizontal overflow at 390px; reduced motion is fully still. Slop linter clean on `site/`. Extension tests, tsc and build unaffected.
- **Fixed during review:** the closing headline was dark-on-dark (base `h2` colour); "TypeSafe" overflowed its circle; the sieve sat behind the paragraph under the headline (narrowed and moved right); "to." widowed (balanced wrap).

---

## 2026-09-30 — Site address is now sift-through.vercel.app

- The Vercel project's production domain was renamed in the dashboard from `sift-rosy-omega.vercel.app` to **`sift-through.vercel.app`**. The old address now returns `DEPLOYMENT_NOT_FOUND`.
- Updated the social-preview and canonical tags (`site/index.html`) and the README link to the new address.
- Auto-deploy was delayed, not broken. The Git link was healthy (repo connected, branch `main`, deployments enabled). `b196b0a` deployed about 2 minutes after the push and covers the LinkedIn commit `cbee0ef`, which Vercel skipped as superseded. Verified live: the new `og:url` and the landing FAQ's LinkedIn answer.

---

## 2026-09-30 — LinkedIn profiles

> "yes build linkedin support"

- **Click Sift on a LinkedIn profile.** It sends only the address to Apollo's `people/match` (`linkedin_url`), which returns the person (title, **LinkedIn headline**, verified email) and their company's domain. The normal lookup then runs on that company, with the person ranked among the others.
  - Costs 1 credit for the person (their email included), plus the company lookup if it's new.
  - The match is cached 30 days, so a revisit is free.
- **Panel:** an **On this profile** block comes first: name, headline, rank bar, "Ranks N of M here", email with Copy. Other LinkedIn pages get "Open a person's profile". A profile with no company shows the person and their email.
- **Plumbing:**
  - `linkedinProfile()` / `isLinkedin()` in the resolver; `matchLinkedin()` / `mapProfileMatch()` in the Apollo client.
  - `runProfileLookup()`, plus a `focus` option on `runLookup`. The lookup message carries `profileUrl` for Refresh and "Look up anyway".
  - `withFocus()` merges the person into the contacts; `peopleState` passes headlines to Jev.
  - Cached and saved copies don't keep the profile marker.
- **No new permissions:** the icon click's `activeTab` already gives the address. LinkedIn's page content is never read. PRIVACY.md, the store listing, the README, Settings' cost note and the landing page (FAQ now "Yes, on people's profiles"; cost row added) are updated.
- **Tests:**
  - profile URL parsing (tracking query strings, country subdomains, non-profile pages, look-alike domains);
  - `mapProfileMatch` on Apollo's real response shape; `withFocus`;
  - the flow with mocks: first visit 1 credit (email saved, person ranked into the cached company, cache copy unmarked), revisit free, unknown profile, no company, budget.
  - 123 pass. Smoke adds "On this profile … Ranks 2 of 8" and the LinkedIn guidance.
- **Live, end to end (3 credits):** Cristina Cordova's profile → Linear lookup in 3.5s; she's #1 of 25 (66), Skyline Lau second, Alexandra third. The revisit was free and instant.

---

## 2026-09-29 — Finding the owner at small companies (Linear)

User screenshot: Sift on Linear listed "Jon P., Customer Experience" as best contact (3 found), while LinkedIn showed Skyline Lau, *Customer Experience Leader*, and Alexandra, *Product Operations Lead (Customer Experience & ProdOps)*.

- **Probe (free people search):** Apollo has both.
  - Skyline is found by the keyword "customer experience" at any level.
  - Alexandra's Apollo title is just "Product Operations Lead", so only "operations" finds her.
  - The Ramp fix only searched keywords among *senior* people. Linear (180 people) has no VP or Head for CX; its owners are Leads and Managers.
- **Search:** a fourth tier, each keyword at any level. Senior results still come first; the any-level searches **take turns** (`interleave`), so the first keyword's 15 reps can't fill the list before "operations" gets a say. Cap 25 → 30.
- **Ranking:** new `eval/rank-eval.mjs` (14 ordered pairs of real titles). The plain wording scored 10/14: it put "Customer Experience" (a rep) above "Customer Experience Manager" and above the COO. The level-aware wording (leads and managers outrank members; a bare function title usually means an individual contributor) scored 13/14; the only miss is a near-tie at the bottom. Shipped.
- **Live, default settings:**
  - Linear: 3 → 22 found; up front Cristina Cordova (COO, 70) + Skyline Lau (Customer Experience Leader, 66).
  - With the keyword "operations": Skyline first (78), Alexandra #3.
  - Ramp: Elena, Head of Customer Operations, first (77), then CX managers and Customer Success heads.
- **Tests:** `findPeople` searches in order (senior, then any level), turn-taking merge, exclusions; `interleave`. 106 pass.
- **Note:** cached results keep their old contacts until *Refresh* (or until a profile save clears the cache).

---

## 2026-09-29 — Demo directed with no-slop-motion's rules

> "https://github.com/ferndesk/no-slop-motion - can u use for the demo"

That repo is an agent skill for making launch *films* (MP4): ten sign-off gates, Cartesia voice, Suno music, HyperFrames render. Our demo is a live loop of the real panel, so we used its **motion rules and its slop linter**, not the film pipeline.

- **Actions finish:** a cursor travels to the Sift icon and presses it before the panel opens, and presses "Reveal email" before the email appears. Targets are measured from the DOM every loop.
- **No hard pops:** every part of the panel (credit bar, header, fit, why now, persona, contacts, email) rises in as the lookup produces it. Checks, signals and contacts arrive one by one. The fit strip fills left to right as the first "hit", followed by 1.5s of air.
- **One idea at a time:** the fake page dims to 40% while the panel works.
- **Eases:** power3.out for arrivals, power2.inOut for the cursor, power2.in for exits; the panel opens on expo.out. No linear moves, no overshoot.
- **Type:** the headline enters blur to sharp (14px → 0, y 24 → 0); the lines under it rise after it in order.
- **Robustness:** the loop pauses while the tab is hidden. With reduced motion there's no cursor and no animation, just the finished panel. All motion styles are scoped to the demo; the extension itself is unchanged.
- **Linter** (`scripts/qa/lint-slop.ts` from the repo, run on `site/` and `src/`): it found the pulsing glow ring on the demo's icon (removed; the cursor click replaces it) and the field focus line drawn with `box-shadow` (now a 2px border). Both now report 0 errors and 0 warnings.
- **Bug caught by the click check:** the icon's pressed look was added to the element directly, and React's re-render in the same moment wiped it, so the click never showed. It's now React state.
- **Verified:**
  - both presses land (cursor tip inside the icon and inside "Reveal email" at the moment of pressing), on desktop and at 390px;
  - a 28-frame contact sheet of one loop reviewed;
  - the fit block's entrance animation is running;
  - reduced motion shows the final panel with the cursor hidden;
  - no page errors, no horizontal overflow.

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
