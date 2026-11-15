# Dynasty

> A friendly note: Dynasty is part of Eurth's advent calendar, and its door opens on 15 December 2026. The code is public, the site isn't yet. Please don't spoil the surprise before the door opens.

Dynasty draws family trees for fictional royal and noble houses and works out who inherits the crown. It is one of the free worldbuilding tools by [Eurth](https://eurth.org), a worldbuilding and roleplay community since 2004, and will live at dynasty.eurth.org.

The rules every Eurth tool follows are in the handbook, `node_modules/@eurth/style/HANDBOOK.md`. On anything the tools share, the handbook wins.

## Use

- **Draw the house.** Pick a person to edit them: name, title, dates, sex, notes and a link out. Add their children and spouses from there. The tree lays itself out: generations in rows, spouses side by side, siblings in birth order.
- **Choose the law.** Absolute primogeniture, male-preference primogeniture, agnatic primogeniture, agnatic seniority, or an elective crown where you rank the candidates. Four house rules, a switch each, decide who is left out: those born outside marriage, those who renounced, those who married out, and adopted children.
- **Read the line.** The line of succession is worked out again on every change. The heir is marked by a word and a ring, never by colour alone, and everyone left out is listed with the reason.
- **Ask "what if".** Pick a person and an event (dies, abdicates, renounces, marries out) to see who would reign and how the line would move, and what the other laws would have said.
- **Take it with you.** A small tree lives in its link. Any tree saves as the nation's profile file (`<nation>.eurth.json`), which is how it comes back for editing. There are also SVG, PNG and WebP pictures, wikitext for IIWiki, GEDCOM for genealogy programs, and the line of succession as text.

Nothing is stored in the browser or on a server.

## How it is put together

- `src/dynasty/`: the engine, plain TypeScript with no page in it.
  - `model.ts` (the tree and its cleaning), `succession.ts` (the five laws), `whatif.ts`, `validate.ts` (dates that can't be, and the easter egg), `edit.ts` (every change the tool makes).
  - `layout.ts` and `render.ts` (where everyone goes, and the SVG), `describe.ts` (the tree in words).
  - `link.ts`, `profile.ts`, `gedcom.ts`, `wikitext.ts` (the ways in and out), `examples.ts` (six invented houses).
- `src/content/`: the guide's worked examples and the glossary, as data. The tests run the engine over every worked example, so the guide can't claim a line the tool wouldn't give.
- `src/tool/`: the tool itself, in Svelte. `src/pages/`: the tree, the examples, the guide, the glossary and the 404 page. `src/components/`: trees drawn into pages.
- `eurth.config.mjs`: the tool's name, address, title and pages. Build time only.
- `tests/`: the engine's own tests, and `shell.test.js`, the checks every Eurth tool runs.
- `LAUNCH_AT`: the moment the door opens.

The `dynasty` section of the profile file carries what other tools read (`house`, `law`, `monarch`, `heir`, `succession`, `link`, `summary`) and the tree itself under keys of its own (`people`, `relations`, `rules`, `reigning`, `founder`, `picks`, `lawId`, `realm`, `format`). `src/dynasty/profile.ts` describes them.

## Development

Node 22.23 or later (Astro asks for it).

```sh
npm install
npm run dev          # the site while you work
npm run check        # types
npm run build        # the static site, into dist/
npm test             # the engine's tests and the suite's checks (they read dist/)
npm run axe          # accessibility: every page, both themes
npm run preview      # the built site with its real headers (wrangler dev)
npm run images       # icons and the sharing image, after changing them
```

## Deployment

The site runs as a Cloudflare Worker serving static assets on its custom domain (`wrangler.jsonc`). Until the door opens it isn't deployed anywhere: no custom domain, no workers.dev address.

- The launch workflow (`.github/workflows/launch.yml`) starts at 22:30 UTC on 14 December 2026, builds, waits for the time in `LAUNCH_AT` and deploys. If it hasn't started by 22:45 UTC, start it by hand. Delete it once the tool is live.
- After that, GitHub Actions deploys every push to `main` that passes, and the nightly run keeps `@eurth/style` and `@eurth/profile` up to date.
- Deploying uses the organisation secret `CLOUDFLARE_API_TOKEN`. Without it the deploy step is skipped with a warning.

What's planned and what each release added is in the [roadmap](roadmap.md); points from reviews are in the [feedback log](docs/feedback-log.md).

## Licence

Apache 2.0, see [LICENSE](LICENSE).
