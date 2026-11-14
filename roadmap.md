# Roadmap

Dynasty draws family trees for fictional royal and noble houses and works out who inherits, at dynasty.eurth.org. It is door 6 of Eurth's 2026 advent calendar and opens on 15 December 2026 at 00:00 Europe/Brussels.

Three parts: what comes next, what each release added (newest first), and what's not planned.

## Where to pick up

**15 November 2026.** Phase 1 is done: the engine in `src/dynasty/`, the worked examples and glossary in `src/content/`, all tested. Phase 2 is under way, from the starter template of @eurth/style 1.0.0.

Done in Phase 2 so far:

- The starter's configuration, renamed for Dynasty: `eurth.config.mjs`, `astro.config.mjs`, `wrangler.jsonc`, `LAUNCH_AT` (15 December), the three workflows, `tests/shell.test.js`, placeholder icons in `public/`.
- `src/dynasty/edit.ts`: every change the tool can make to a tree, tested.
- The drawing can carry class names instead of colours, for trees inside pages (`src/components/TreeFigure.astro`).
- The tool: `src/tool/Maker.svelte` with `TreeView.svelte`, `PersonEditor.svelte` and `palette.ts`.
- Pages: the tree (start page), examples, glossary and 404. The site builds, and the suite's checks pass on it.

Next, in order:

1. `src/pages/guide.astro`: the prose, with the worked examples from `src/content/worked.ts`.
2. `npm run axe`, and try every part of the tool in a browser (`npm run preview`). Astro needs Node 22.23 or later; on this machine that is `/opt/homebrew/bin/node` (26).
3. `npm run images` for the icons and the sharing image; README; `docs/feedback-log.md`.

Waiting on others:

- **The profile schema** describes `dynasty` as names only (house, law, monarch, heir, succession), and the handbook asks sections to stay small. The brief asks for the whole tree in the file, so Dynasty keeps it under keys of its own in its section (`people`, `relations`, `rules`, `reigning` and a few more), which the schema allows. To propose to @eurth/profile, so the schema describes them.
- **IIWiki's family tree templates:** Stijn to say which exist (Family tree, Tree chart, Ahnentafel). Until then the wiki export is the plain one: a table and a numbered line.

## Next

### Phase 1: the engine and the words (needs nothing from @eurth/style)

Plain TypeScript in `src/dynasty/`, tests in `tests/`, as Flagwright keeps its engine in `src/flag/`. Only TypeScript and Vitest are installed. Commit and push after each step.

1. **Model** (`model.ts`): a tree is a house name, people, unions, the law, the rules and the reigning person.
   - Person: name, title, born and died (a year, or a full date; any whole year, since Eurth's calendars aren't ours), sex (male, female, or not stated), notes, a link out (https only), and whether they have renounced.
   - Union: two partners, married and ended dates, and whether it is a marriage "out" (unequal or unapproved).
   - Child link: a child belongs to a union or to one parent, by birth or adoption, legitimate or not.
   - Everything that arrives from a link or a file is checked and clamped: 500 people at most, text lengths capped, unknown ids dropped. Cycles are found, never followed.
2. **Succession** (`succession.ts`): one pure function from a tree to the line, each entry with its place and the reason, plus a list of who is left out and why.
   - Absolute primogeniture: eldest child first, then that child's line, then the next child.
   - Male-preference primogeniture: sons and their lines before daughters and theirs.
   - Agnatic: males in the male line only.
   - Agnatic seniority: the oldest generation of male-line males first (brothers before sons), eldest line first within a generation.
   - Elective: the line is the user's own ordered picks from those eligible.
   - The line descends from a founder: by default the reigning person's earliest ancestor in the tree, or one the user picks.
   - Exclusions, a toggle each: illegitimacy, renunciation, marrying out. Each takes out the person and the descendants that follow from it. The dead are passed over but their children keep their place.
   - Adoption isn't in the brief's toggles; adopted children don't inherit unless a fourth toggle, "Adopted children inherit", is on.
3. **What if** (`whatif.ts`): a person and an event (dies, abdicates, renounces, marries out) give a new tree, who reigns, the new line, and what changed. Also the same question under each other law ("Under male-preference, Prince Vanko would reign instead").
4. **Layout and drawing** (`layout.ts`, `render.ts`): generations in rows, spouses side by side, siblings in birth order, no overlaps; positions and connector lines as plain numbers, then an SVG string with a title and description. The heir gets the word "Heir" and a ring, the reigning person a crown and the word "Reigning". Colours come in as a palette, so the site can pass @eurth/style's tokens later.
5. **Description** (`describe.ts`): the house, the law, who reigns and the line of succession as plain text, for Copy description and screen readers.
6. **Saving** (`link.ts`, `profile.ts`): a compact, versioned form for the link's query string (small trees only; past a set length the tool says to save the file instead), and the profile's `dynasty` section: the summary fields Foundations defined, plus people, unions, law, rules and the reigning person. Every other section and every unknown key is left alone.
7. **GEDCOM** (`gedcom.ts`): export 5.5.1 (people, families, names, titles, sex, dates, marriages, adoption, notes, links; legitimacy and renunciation as custom tags) and a forgiving import of 5.5.1 and 7.0 files from other genealogy tools.
8. **Wiki export** (`wikitext.ts`): a tidy wikitable of the house and a numbered line of succession. The template version waits for the answer about IIWiki.
9. **Examples** (`examples.ts`): fictional houses, one for each law and exclusion, starting with the mock-up's House of Varenko of Ostaril and the profile example's House of Maravel of Calderwyn.
10. **Guide and glossary** (`src/content/`): the five laws with a worked example each, exclusions, regencies, claimants and pretenders, how real houses kept records (house laws, the Almanach de Gotha, Burke's, heralds' visitations), with sources and a last-updated date; a glossary of about 40 terms. The worked examples are data, and the tests run every law against them.
11. **Own grandparent** (`validate.ts`): spot a person who is their own ancestor, for the easter egg, and other things worth a gentle note (a child older than a parent, a marriage after a death).

### Phase 2: the site (only once @eurth/style 1.0.0 is released)

12. Start from the starter template in eurth-style; read HANDBOOK.md first, and where it differs from this plan, the handbook wins.
13. Pages: Tree (the maker), Guide, Glossary, Examples, with titles, descriptions, canonical links, JSON-LD, sitemap.xml, robots.txt, llms.txt and Open Graph images.
14. The tool, as a Svelte 5 island: house and law controls, the rules toggles, the tree with zoom, pan and arrow-key movement between people, person and marriage editors, the live line of succession, and What if with its result card.
15. Save and load: the link, the profile file (file picker and drag and drop, from @eurth/profile), GEDCOM in and out.
16. Exports: SVG, PNG and WebP of the tree in the handbook's sizes, wikitext, GEDCOM, Copy link, Copy picture, Copy description, and the Share dialog.
17. Delight: the crown passes along the line when the reigning person changes; the toast "That's a song, not a succession." for a person who is their own grandparent; the suite's own touches from @eurth/style.
18. Offline, install, security headers, axe and Lighthouse checks, as the handbook asks.
19. CI, and the launch workflow: `LAUNCH_AT` is `2026-12-15T00:00:00+01:00`, the scheduled run starts at 22:30 UTC on 14 December, and it also runs by hand. No custom domain and no workers.dev deploy before then.
20. README (use, development, deployment), docs/feedback-log.md, and the handbook's checklist.

### After launch

- A tighter layout: families are each given their own band, which is safe but wide. Let neighbouring branches tuck under one another.

- Wiki export for IIWiki's own family tree templates, once we know which it has.

## Releases

None yet.

## Not planned

- **Accounts, or trees kept on a server.** A tree lives in its link or its file; nothing is stored.
- **Real genealogy research** (records search, DNA, matching with other trees). Dynasty is for fiction; GEDCOM is there so real tools can open what it makes.
