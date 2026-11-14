// What this tool is called and where it lives. Read at build time only: astro.config.mjs, the
// frontmatter of .astro pages, tests and tools/. Never import this from a Svelte component or a
// <script>: it pulls in the list of every Eurth tool, and browser code must not carry that
// (HANDBOOK.md, Launch). Hand the component what it needs as props instead.
import { defineSite } from '@eurth/style/build';

export const site = defineSite({
  // The subdomain, and the tool's id in @eurth/style's tools.json.
  id: 'dynasty',
  name: 'Dynasty',
  url: 'https://dynasty.eurth.org',
  // "<Name>: free online <thing> maker for worldbuilders"
  title: 'Dynasty: free online family tree maker for worldbuilders',
  description: 'A free online family tree maker for worldbuilders: draw a royal or noble house, pick its succession law and see who inherits the crown. No account needed.',
  tagline: 'Family trees and who inherits',
  pages: [
    { href: '/', label: 'Tree' },
    { href: '/examples/', label: 'Examples' },
    { href: '/guide/', label: 'Guide' },
    { href: '/glossary/', label: 'Glossary' },
  ],
  repo: 'https://github.com/eurth-org/eurth-dynasty',
  ogAlt: 'Dynasty, family trees and who inherits, at dynasty.eurth.org: the Eurth yurt beside a small family tree with the heir ringed.',
  // The crown's fanfare is silent until the visitor switches sound on in the footer.
  sound: true,
});
