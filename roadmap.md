# Roadmap

Dynasty draws family trees for fictional royal and noble houses and works out who inherits, at dynasty.eurth.org. It is door 6 of Eurth's 2026 advent calendar and opens on 15 December 2026 at 00:00 Europe/Brussels.

Three parts: what comes next, what each release added (newest first), and what's not planned.

## Where to pick up

**15 November 2026.** Dynasty is built and waiting for its door. Everything in the brief is in; one point is under "Waiting on Stijn". `npm run check`, `npm run build`, `npm test` (262 tests, the suite's checks included) and `npm run axe` (five pages, both themes, no findings) pass, and CI is green on GitHub, Lighthouse included. Nothing is deployed, and nothing will be until the launch workflow runs.

Astro needs Node 22.23 or later; on this machine that is `/opt/homebrew/bin/node` (26), so put `/opt/homebrew/bin` first on the PATH.

## Next

### Waiting on Stijn

- **The profile schema.** @eurth/profile describes `dynasty` as names only (house, law, monarch, heir, succession), and the handbook asks sections to stay small. The brief asks for the whole tree in the file, so Dynasty keeps it under keys of its own in its section (`people`, `relations`, `rules`, `reigning`, `founder`, `picks`, `lawId`, `realm`, `format`), which the schema allows. To propose to @eurth/profile, so that the schema describes them; or to be told to do it differently.

### Before the door

- **The launch.** The launch workflow starts at 22:30 UTC on 14 December, builds, waits for `LAUNCH_AT` and deploys. If it hasn't started by 22:45 UTC, start it by hand. Afterwards, delete `.github/workflows/launch.yml`.
- **The wiki templates, on IIWiki itself.** The Tree chart, Family tree and Ahnentafel exports follow Wikipedia's templates of those names, tile for tile, and the tests check that every line joins up. IIWiki refuses automated requests, so nobody has yet pasted one into an IIWiki page: do that once with an example house, and say if a parameter (`summary`, `boxstyle_`, `collapsed`) is spelt differently there.
- **A look by eye.** The tool was tried in a browser by script (every control, every download, the profile file and GEDCOM out and back), but not looked at on a phone, and the crown's flight was not watched. Worth five minutes with `npm run preview`.
- **The crown.** The crown beside "Reigning" is the mock-up's own drawing. The handbook asks for Font Awesome icons; swap it for Font Awesome's crown if the two should match.

### After launch

- A tighter layout: families are each given their own band, which is safe but wide. Let neighbouring branches tuck under one another.
- Regents: say who governs for a reigning child, and until when.
- Reorder siblings who have no birth years, and twins.
- More than one set of parents for a person (by birth and by adoption), as GEDCOM allows.
- Semi-Salic succession: the male line first, then the nearest woman when it fails.
- A sharing image per tree (a Worker would draw it; ask first, since it leaves "static assets only").

## 15 November 2026: built, waiting for its door (0.1.0)

The first version. It goes live on 15 December 2026.

- **The tree:** people with a name, title, birth and death (a year or a full date), sex where the law needs it, notes and a link out; marriages with dates; children, adoption and legitimacy. It lays itself out: generations in rows, spouses side by side, siblings in birth order. Zoom, scroll or drag it; move between people with the arrow keys.
- **Five succession laws:** absolute primogeniture, male-preference primogeniture, agnatic primogeniture, agnatic seniority, and elective monarchy, where you rank the candidates.
- **Four house rules, a switch each:** those born outside marriage, those who renounced (for themselves or for their line), those who married out, and adopted children.
- **The line of succession**, worked out again on every change, with the reason for each place and for everyone left out. The heir has the word "Heir" and a ring, in the tree and in the list.
- **What if:** pick a person and an event (dies, abdicates, renounces, marries out) to see who would reign, how the line would move, and what each other law would have said. "Make it happen" applies it.
- **Saving:** a small tree lives in its link. Any tree saves as the nation's profile file, which brings it back for editing. GEDCOM in and out, for genealogy programs.
- **Exports:** SVG, PNG and WebP in the suite's picture sizes; the line of succession as text; the share row and dialog.
- **Wikitext for IIWiki**, in four shapes: the tree as a `{{Tree chart}}` or a `{{Family tree}}` (IIWiki has both, and they share one way of writing a tree), one person's ancestors as an `{{Ahnentafel}}` (five generations), or a plain table. Each comes with the line of succession as a numbered list.
- **Checks:** dates that can't be, a reigning person recorded as dead, a law that needs to know someone's sex.
- **Undo and redo**, for the visit.
- **Pages:** the tree with how-to and questions, six example houses, a guide to the five laws with twelve worked examples, regencies, pretenders and record-keeping, with sources, and a glossary of 46 terms. The tests run the engine over every worked example in the guide.
- **Delight:** the crown flies to the new monarch when the reigning person changes, with a three-note fanfare if sound is on; "Nice." at 69% zoom; and a toast for anyone who manages to be their own grandparent.
- **The kit:** @eurth/style 1 and @eurth/profile 1, from the starter template: Astro static site with the tool as a Svelte island, the shared shell, security headers, service worker, manifest, and the launch and nightly workflows.

## Not planned

- **Accounts, or trees kept on a server.** A tree lives in its link or its file; nothing is stored.
- **Real genealogy research** (records search, DNA, matching with other trees). Dynasty is for fiction; GEDCOM is there so real tools can open what it makes.
- **Browser storage for "recent trees".** The handbook rules it out for every Eurth tool.
