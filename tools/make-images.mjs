// Makes the pictures that aren't drawn by hand, with the Chrome on this machine: the favicon,
// the home-screen icons and the sharing image. Run it after changing the sharing image, and
// commit what it writes to public/:  npm run images
import { makeImages, sharingImage } from '@eurth/style/images';
import { createServer } from 'vite';
import { site } from '../eurth.config.mjs';

// The tree on the sharing image comes from the same code as the site (Vite reads TypeScript):
// a couple and their two children, the elder ringed as heir.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { makeTree, person, union } = await vite.ssrLoadModule('/src/dynasty/examples.ts');
  const { treeSvg } = await vite.ssrLoadModule('/src/dynasty/render.ts');
  const { paletteFor } = await vite.ssrLoadModule('/src/tool/palette.ts');
  const tree = makeTree({
    house: 'House of Varenko',
    reigning: 'king',
    people: [
      person('king', 'King', 'Teomir II', 'm', '1958', { reignFrom: '1988' }),
      person('queen', 'Queen', 'Ressa', 'f', '1960'),
      person('ilsa', 'Princess', 'Ilsa', 'f', '1986', { union: 'u' }),
      person('vanko', 'Prince', 'Vanko', 'm', '1989', { union: 'u' }),
    ],
    unions: [union('u', 'king', 'queen', '1985')],
  });
  const art = treeSvg(tree, { palette: paletteFor('dark'), heading: false });
  const made = await makeImages({ sharing: [{ file: 'og.png', html: sharingImage({ site, art }) }] });
  console.log(`Made ${made.map((file) => `public/${file}`).join(', ')}`);
} finally {
  await vite.close();
}
