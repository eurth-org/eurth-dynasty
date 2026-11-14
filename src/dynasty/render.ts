/**
 * The tree as a picture: one SVG, text and all, that stands on its own as a download and says in
 * words what it shows. The heir has the word "Heir" and a ring; the reigning person a crown and
 * the word "Reigning". Nothing is told by colour alone.
 *
 * Whatever a person typed (names, titles, the house) is escaped before it goes in.
 */
import { describeTree, ordinal } from './describe';
import { CARD_HEIGHT, CARD_WIDTH, layoutTree, type Card, type Layout } from './layout';
import { displayName, indexTree, isDead, lawNames, yearOf, type Person, type Tree, type TreeIndex } from './model';
import { lineOfSuccession, type Succession, type Why } from './succession';

/** The colours of a drawing. The names are @eurth/style's tokens; the site passes its own. */
export interface Palette {
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  lineStrong: string;
  accentText: string;
  /** The crown beside "Reigning". Decoration: the word carries the meaning. */
  crown: string;
}

/** @eurth/style's values at the time of writing, for use where the tokens can't be reached. */
export const palettes: Record<'dark' | 'light', Palette> = {
  dark: { surface: '#002b36', surfaceRaised: '#0d353f', ink: '#fcf6e1', inkMuted: '#bac1b5', lineStrong: '#798c88', accentText: '#80c8e5', crown: '#f7941d' },
  light: { surface: '#ffffff', surfaceRaised: '#f8f8f8', ink: '#222222', inkMuted: '#545454', lineStrong: '#646464', accentText: '#12577b', crown: '#7a4100' },
};

type Role = keyof Palette;
const kebab = (role: Role): string => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * How a shape gets its colours. A downloaded picture carries them as plain values; a drawing
 * inside a page carries class names instead (dy-f-ink, dy-s-line-strong, …), so the page's
 * stylesheet can give it the tokens and it follows the theme.
 */
type Paint = (colours: { fill?: Role; stroke?: Role }) => string;
const paintWith = (palette: Palette): Paint => ({ fill, stroke }) => `${fill ? ` fill="${palette[fill]}"` : ''}${stroke ? ` stroke="${palette[stroke]}"` : ''}`;
const paintWithClasses: Paint = ({ fill, stroke }) => ` class="${[fill ? `dy-f-${kebab(fill)}` : '', stroke ? `dy-s-${kebab(stroke)}` : ''].filter(Boolean).join(' ')}"`;

/** The class names a drawing inside a page uses, with the role each stands for. */
export const paintClasses: { name: string; property: 'fill' | 'stroke'; role: Role }[] = (['surface', 'surfaceRaised', 'ink', 'inkMuted', 'lineStrong', 'accentText', 'crown'] as Role[]).flatMap((role) => [
  { name: `dy-f-${kebab(role)}`, property: 'fill' as const, role },
  { name: `dy-s-${kebab(role)}`, property: 'stroke' as const, role },
]);

export const SANS = 'system-ui, Arial, sans-serif';
export const MONO = 'ui-monospace, Menlo, monospace';

/** Card height when a name needs two lines. */
export const TALL_CARD_HEIGHT = 90;
/** Room above the tree for the house's name. */
export const HEADING_HEIGHT = 84;
const NAME_CHARS = 23;

/** A crown, 16 by 12, as on the mock-up. */
export const CROWN_PATH = 'M1 11L2 3L5.5 6.5L8 1L10.5 6.5L14 3L15 11Z';

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** A name on one or two lines of a card, cut with an ellipsis if it still doesn't fit. */
export function wrapName(text: string, max = NAME_CHARS): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= max) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const cut = (value: string): string => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
  if (lines.length <= 2) return lines.map(cut);
  return [cut(lines[0]!), cut(`${lines[1]} ${lines.slice(2).join(' ')}`)];
}

const whyTags: Partial<Record<Why, string>> = {
  abdicated: 'Abdicated',
  renounced: 'Renounced',
  'married-out': 'Married out',
  illegitimate: 'Born outside marriage',
  adopted: 'Adopted',
};

export interface CardText {
  /** The word above the name: "Reigning since 1988", "Heir", "3rd in line", "Renounced", or nothing. */
  tag: string;
  reigning: boolean;
  heir: boolean;
  /** Place in the line, when they have one. */
  place?: number;
  /** The name with its title, on one or two lines. */
  name: string[];
  /** "b. 1958", "1930–1988", or nothing. */
  dates: string;
  /** Everything above in one sentence, for screen readers. */
  label: string;
}

/** What a person's card says. */
export function cardText(tree: Tree, succession: Succession, person: Person): CardText {
  const reigning = succession.reigning === person.id;
  const place = succession.line.find((entry) => entry.id === person.id)?.place;
  const heir = place === 1;
  const from = yearOf(person.reignFrom);
  const to = yearOf(person.reignTo);
  const excluded = succession.excluded.find((entry) => entry.id === person.id && entry.through === undefined);

  let tag = '';
  if (reigning) tag = from ? `Reigning since ${from}` : 'Reigning';
  else if (heir) tag = tree.law === 'elective' ? 'First choice' : 'Heir';
  else if (place !== undefined) tag = tree.law === 'elective' ? `${ordinal(place)} choice` : `${ordinal(place)} in line`;
  else if (from) tag = `Reigned ${from}–${to}`;
  else if (person.abdicated) tag = 'Abdicated';
  else if (excluded) tag = whyTags[excluded.why] ?? '';
  else if (person.illegitimate) tag = 'Born outside marriage';
  else if (person.adopted) tag = 'Adopted';

  const born = yearOf(person.born);
  const died = yearOf(person.died);
  const dates = isDead(person) ? (born || died ? `${born || '?'}–${died || '?'}` : 'died') : born ? `b. ${born}` : '';
  const spoken = isDead(person) ? (born || died ? `${born || 'unknown'} to ${died || 'unknown'}` : 'died') : born ? `born ${born}` : '';
  const full = displayName(person);
  return {
    tag,
    reigning,
    heir,
    ...(place === undefined ? {} : { place }),
    name: wrapName(full),
    dates,
    label: [full, tag.replace('–', ' to '), spoken].filter(Boolean).join(', '),
  };
}

/** Whether any name runs to two lines, in which case every card is the taller size. */
export const needsTallCards = (tree: Tree): boolean => tree.people.some((person) => wrapName(displayName(person)).length > 1);

/** The layout the drawing uses: card height chosen to fit the longest name. */
export const drawingLayout = (tree: Tree): Layout => layoutTree(tree, { cardWidth: CARD_WIDTH, cardHeight: needsTallCards(tree) ? TALL_CARD_HEIGHT : CARD_HEIGHT });

/** The path of a link: straight runs with the corners left square, as a pedigree is drawn. */
export const linkPath = (points: readonly (readonly [number, number])[]): string => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('');

export interface RenderOptions {
  /** The colours of a picture that stands on its own. Night's, when neither this nor `classes` is given. */
  palette?: Palette;
  /** For a drawing inside a page: class names instead of colours (see paintClasses), and no ground. */
  classes?: boolean;
  /** Put before the ids of the title and description, when a page holds more than one drawing. */
  idPrefix?: string;
  /** The house's name, realm and law above the tree. On by default. */
  heading?: boolean;
  /** A layout made earlier (see drawingLayout), to avoid working it out twice. */
  layout?: Layout;
  succession?: Succession;
}

function cardSvg(card: Card, text: CardText, paint: Paint): string {
  const { x, y, width: w, height: h } = card;
  const parts: string[] = [];
  // The ring: a second outline, clear of the card, so it reads without colour.
  if (text.heir) parts.push(`<rect x="${x - 5}" y="${y - 5}" width="${w + 10}" height="${h + 10}" rx="16" fill="none" stroke-width="3"${paint({ stroke: 'accentText' })}/>`);
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" stroke-width="1.5"${paint({ fill: 'surfaceRaised', stroke: 'lineStrong' })}/>`);
  const inner: string[] = [];
  let tagX = 12;
  if (text.reigning) {
    inner.push(`<path transform="translate(12 9)" d="${CROWN_PATH}"${paint({ fill: 'crown' })}/>`);
    tagX = 34;
  }
  if (text.tag) {
    inner.push(`<text x="${tagX}" y="20" font-family="${SANS}" font-size="11" font-weight="700" letter-spacing="0.66"${paint({ fill: text.reigning || text.place !== undefined ? 'accentText' : 'inkMuted' })}>${escapeXml(text.tag.toUpperCase())}</text>`);
  }
  text.name.forEach((line, i) => {
    inner.push(`<text x="12" y="${41 + i * 18}" font-family="${SANS}" font-size="15"${paint({ fill: 'ink' })}>${escapeXml(line)}</text>`);
  });
  if (text.dates) inner.push(`<text x="12" y="${h - 11}" font-family="${MONO}" font-size="12"${paint({ fill: 'inkMuted' })}>${escapeXml(text.dates)}</text>`);
  // A nested svg clips its contents, so an unusually wide name can't spill out of its card.
  parts.push(`<svg x="${x}" y="${y}" width="${w}" height="${h}">${inner.join('')}</svg>`);
  return `<g>${parts.join('')}</g>`;
}

/**
 * The whole tree as an SVG document.
 * @param tree a clean tree (see cleanTree)
 */
export function treeSvg(tree: Tree, options: RenderOptions = {}): string {
  const paint = options.classes ? paintWithClasses : paintWith(options.palette ?? palettes.dark);
  const ids = options.idPrefix ?? 'dynasty';
  const index: TreeIndex = indexTree(tree);
  const succession = options.succession ?? lineOfSuccession(tree);
  const layout = options.layout ?? drawingLayout(tree);
  const heading = options.heading !== false;
  const top = heading ? HEADING_HEIGHT : 0;
  const width = Math.max(layout.width, heading ? 480 : 240);
  const height = Math.max(layout.height, 120) + top;
  const title = tree.house ? `Family tree of ${/^(house|clan|dynasty|line|family|kindred)\b/i.test(tree.house) ? 'the ' : ''}${tree.house}` : 'Family tree';

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${ids}-title ${ids}-desc">`);
  out.push(`<title id="${ids}-title">${escapeXml(title)}</title>`);
  out.push(`<desc id="${ids}-desc">${escapeXml(describeTree(tree, succession, index))}</desc>`);
  if (!options.classes) out.push(`<rect width="${width}" height="${height}"${paint({ fill: 'surface' })}/>`);
  if (heading) {
    out.push(`<text x="24" y="44" font-family="${SANS}" font-size="28" font-weight="700"${paint({ fill: 'ink' })}>${escapeXml(tree.house || 'Family tree')}</text>`);
    out.push(`<text x="24" y="68" font-family="${SANS}" font-size="14"${paint({ fill: 'inkMuted' })}>${escapeXml([tree.realm, lawNames[tree.law]].filter(Boolean).join(' · '))}</text>`);
  }
  out.push(`<g transform="translate(0 ${top})">`);
  if (!layout.cards.length) {
    out.push(`<text x="24" y="40" font-family="${SANS}" font-size="15"${paint({ fill: 'inkMuted' })}>Nobody here yet.</text>`);
  }
  out.push(`<g fill="none" stroke-width="2" stroke-linejoin="round">`);
  for (const link of layout.links) out.push(`<path d="${linkPath(link.points)}"${link.dashed ? ' stroke-dasharray="6 5"' : ''}${paint({ stroke: 'lineStrong' })}/>`);
  out.push('</g>');
  for (const card of layout.cards) {
    const person = index.person.get(card.id);
    if (person) out.push(cardSvg(card, cardText(tree, succession, person), paint));
  }
  out.push('</g></svg>');
  return out.join('');
}
