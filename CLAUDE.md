You're building Dynasty (dynasty.eurth.org), family trees with succession rules for fictional royal and noble houses, one of Eurth's free worldbuilding tools. Eurth (eurth.org) is a worldbuilding and roleplay community since 2004. The attached repo is eurth-org/eurth-dynasty.

Working order (Foundations and many other tools are being built at the same time tonight):
1. Save this brief as CLAUDE.md.
2. If the repo named above doesn't exist on GitHub yet, create it as a public, empty repo in eurth-org with the gh CLI and connect this folder; if you can't, ask me.
3. Read what already exists of github.com/eurth-org/eurth-style (HANDBOOK.md) and github.com/eurth-org/eurth-profile; they may still be in progress. Write the plan and show it to me.
4. Build the tool's core logic as plain TypeScript modules with thorough tests, and its content and data (guide text, presets, examples, data snapshots). None of that needs eurth-style.
5. Only once @eurth/style 1.0.0 is released (check the releases of github.com/eurth-org/eurth-style), start the site from its starter template and carry on to the end of this brief. Until then, don't scaffold the site, pages or styles.
6. Commit and push after every finished step, and keep roadmap.md up to date with exactly where to pick up, so a new session can continue if this one stops.

Background for every step: Read HANDBOOK.md in github.com/eurth-org/eurth-style and start from its starter template; read the profile schema in github.com/eurth-org/eurth-profile; look at github.com/eurth-org/eurth-flag, the reference build. The handbook wins over this brief on everything shared. Then write a plan and show it to me before you build.

Mock-up: the "dynasty.eurth.org, family tree and succession" board on https://claude.ai/artifact/32RKDdVTtCfHsL6Qc6LxV6.

Pages: Tree, Guide, Glossary, Examples.

The tree, v1
- People: name, title, birth and death (year, or a full date), sex where succession needs it, notes, and a link out (wiki or forum).
- Relations: marriages (with dates), children, adoption, legitimacy.
- Automatic layout, drawn as SVG: generations in rows, spouses side by side, siblings in birth order; zoom and pan; keyboard navigation between people.
- Succession laws: absolute primogeniture, male-preference primogeniture, agnatic (male line only), agnatic seniority, and elective (the user picks). Exclusions: illegitimacy, renunciation, marrying out, with a toggle each.
- The line of succession, recalculated live, with the heir marked by a word and a ring, never colour alone.
- What if: pick a person and an event (dies, abdicates, renounces, marries out) and see the new line and who reigns.

Saving and re-import: small trees fit in the link; any tree saves and loads as the profile file, and that file is how a tree comes back for editing. Also import and export GEDCOM, so genealogy tools can open it.

Wiki export: wikitext for IIWiki. Before building it, ask me which family tree templates IIWiki has (Wikipedia's Family tree, Tree chart and Ahnentafel are the candidates) and build for those; if none exist, export a tidy wikitable and a line-of-succession list.

Guide: succession laws explained with diagrams, regencies, claimants and pretenders, how real houses kept records, with sources.

Profile section "dynasty": people, relations, the law and the reigning person.

Exports: SVG, PNG and WebP of the tree; wikitext; GEDCOM; Copy description (the line of succession as text).

Signature touch: a crown passes along the line when the reigning person changes. Easter egg: a person who is their own grandparent gets the toast "That's a song, not a succession."

Done when the handbook's checklist passes and every succession law is unit-tested against the guide's worked examples.
