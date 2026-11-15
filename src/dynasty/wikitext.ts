/**
 * Wikitext for IIWiki, in the four shapes a wiki page might want:
 *
 * - Tree chart and Family tree: the whole tree, drawn with the templates of those names. The two
 *   share one way of writing a tree (a grid of tiles, a row to a line), so one drawing serves both.
 * - Ahnentafel: one person's ancestors, numbered, for the template of that name.
 * - A plain table of the house, which needs no template at all.
 *
 * Each comes with the line of succession as a numbered list. Whatever a person typed is escaped,
 * so a name can't open a link, a template or a table cell.
 */
import { realmWithThe, withThe } from './describe';
import { layoutTree, type Layout } from './layout';
import { displayName, formatDate, indexTree, isDead, lawNames, yearOf, type Person, type Tree, type TreeIndex } from './model';
import { cardText } from './render';
import { claimText, lineOfSuccession, reasonText, type Succession } from './succession';

/** Text that MediaWiki shows as typed and never reads as markup. */
export function wikiEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\|/g, '&#124;')
    .replace(/'{2,}/g, (run) => '&#39;'.repeat(run.length))
    .replace(/~{3,}/g, (run) => '&#126;'.repeat(run.length))
    .replace(/__/g, '_&#95;')
    .replace(/:\/\//g, ':&#47;/')
    .replace(/^([*#:;=!\-+ ])/, (first) => `&#${first.charCodeAt(0)};`);
}

/** A person's name, linked to their page when they have one. */
function wikiName(person: Person | undefined): string {
  const name = wikiEscape(displayName(person));
  return person?.link ? `[${person.link} ${name}]` : name;
}

const status = (tree: Tree, succession: Succession, person: Person, index: TreeIndex): string => {
  if (succession.reigning === person.id) return `'''Reigning'''${person.reignFrom ? ` since ${yearOf(person.reignFrom)}` : ''}`;
  const place = succession.line.find((entry) => entry.id === person.id)?.place;
  if (place === 1) return tree.law === 'elective' ? "'''First choice'''" : "'''Heir''' (1)";
  if (place !== undefined) return String(place);
  if (person.reignFrom) return `Reigned ${yearOf(person.reignFrom)}–${yearOf(person.reignTo)}`;
  const excluded = succession.excluded.find((entry) => entry.id === person.id);
  if (excluded) return `No place: ${wikiEscape(reasonText(tree, excluded, index))}`;
  return isDead(person) ? '' : '—';
};

/** The members of the house as a sortable table. */
export function membersTable(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const rows = ['{| class="wikitable sortable"', `|+ ${wikiEscape(tree.house ? `Members of ${withThe(tree.house)}` : 'Members of the house')}`, '! Name !! Born !! Died !! Parents !! Married !! Place in line'];
  for (const person of tree.people) {
    const parents = index.parents(person.id).map((id) => wikiName(index.person.get(id)));
    const how = person.adopted ? ' (adopted)' : person.illegitimate ? ' (born outside marriage)' : '';
    const spouses = index.unions(person.id).map((u) => {
      const year = yearOf(u.married);
      return `${wikiName(index.person.get(index.partner(u, person.id)))}${year ? ` (${year})` : ''}`;
    });
    const died = person.died ? formatDate(person.died) : person.dead ? 'yes' : '';
    rows.push('|-', `| ${[wikiName(person), formatDate(person.born), died, parents.length ? parents.join(' and ') + how : '', spouses.join('<br>'), status(tree, succession, person, index)].join(' || ')}`);
  }
  rows.push('|}');
  return rows.join('\n');
}

/** The line of succession as a numbered list, with the reigning person above it. */
export function successionList(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const lines: string[] = [];
  const reigning = succession.reigning === undefined ? undefined : index.person.get(succession.reigning);
  lines.push(reigning ? `* '''${wikiName(reigning)}'''${reigning.born ? ` (born ${yearOf(reigning.born)})` : ''}, reigning${reigning.reignFrom ? ` since ${yearOf(reigning.reignFrom)}` : ''}` : "* ''The throne stands empty.''");
  for (const place of succession.line) {
    const person = index.person.get(place.id);
    const claim = claimText(tree, place, index);
    lines.push(`# ${wikiName(person)}${person?.born ? ` (born ${yearOf(person.born)})` : ''}${claim ? `, ${wikiEscape(claim)}` : ''}`);
  }
  if (!succession.line.length) lines.push(tree.law === 'elective' ? ": ''Nobody has been chosen yet.''" : ": ''There is no heir.''");
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Tree chart and Family tree
// ---------------------------------------------------------------------------------------------

export type ChartTemplate = 'Tree chart' | 'Family tree';

/** One tile of the templates' grid, in the layout's units. A box is three tiles wide. */
const TILE = 20;
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

/**
 * The templates' line tiles, by which sides of the tile the line reaches. A line that stops in
 * the middle of a tile has no symbol of its own, so it is drawn through.
 */
const TILES: Record<number, string> = {
  [UP]: '!',
  [DOWN]: '!',
  [UP | DOWN]: '!',
  [LEFT]: '-',
  [RIGHT]: '-',
  [LEFT | RIGHT]: '-',
  [DOWN | RIGHT]: ',',
  [DOWN | LEFT]: '.',
  [UP | RIGHT]: '`',
  [UP | LEFT]: "'",
  [LEFT | RIGHT | UP]: '^',
  [LEFT | RIGHT | DOWN]: 'v',
  [UP | DOWN | RIGHT]: ')',
  [UP | DOWN | LEFT]: '(',
  [UP | DOWN | LEFT | RIGHT]: '+',
};

export interface Chart {
  /** One entry per row of the grid: line tiles as their symbols, a box as its name (it takes three tiles). */
  rows: string[][];
  /** What each box says, by its name. */
  boxes: Map<string, string>;
  /** The box of the heir, to give it a heavier border. */
  heir?: string;
  columns: number;
}

/**
 * The tree on the templates' grid. The layout is the picture's own, asked to keep to a grid: a
 * box is three tiles wide with one tile between boxes, and each level of lines gets a row.
 */
export function chartGrid(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): Chart {
  const layout: Layout = layoutTree(tree, { cardWidth: 3 * TILE, cardHeight: TILE, spouseGap: TILE, siblingGap: TILE, margin: 0, snap: TILE, centreLoneParent: true });
  const boxes = new Map<string, string>();
  if (!layout.cards.length) return { rows: [], boxes, columns: 0 };
  const columns = Math.round(layout.width / TILE);

  // Rows: one for each generation's boxes, and between two generations one for each level at
  // which a line runs across.
  const tops = [...new Set(layout.cards.map((card) => card.y))].sort((a, b) => a - b);
  const levels: number[][] = tops.map(() => []);
  const band = (y: number): { row: number; inBoxes: boolean } => {
    let row = 0;
    while (row + 1 < tops.length && y >= tops[row + 1]!) row++;
    return { row, inBoxes: y <= tops[row]! + TILE };
  };
  for (const link of layout.links) {
    for (const [, y] of link.points) {
      const at = band(y);
      if (!at.inBoxes && !levels[at.row]!.includes(y)) levels[at.row]!.push(y);
    }
  }
  for (const level of levels) level.sort((a, b) => a - b);
  const boxRow: number[] = [];
  let count = 0;
  tops.forEach((_, i) => {
    boxRow.push(count);
    count += 1 + levels[i]!.length;
  });
  const rowOf = (y: number): number => {
    const at = band(y);
    return at.inBoxes ? boxRow[at.row]! : boxRow[at.row]! + 1 + levels[at.row]!.indexOf(y);
  };
  const tileOf = (x: number): number => Math.min(columns - 1, Math.max(0, Math.floor(x / TILE)));

  const lines: number[][] = Array.from({ length: count }, () => new Array<number>(columns).fill(0));
  const names: (string | undefined)[][] = Array.from({ length: count }, () => new Array<string | undefined>(columns).fill(undefined));
  const taken: boolean[][] = Array.from({ length: count }, () => new Array<boolean>(columns).fill(false));
  layout.cards.forEach((card) => {
    const row = rowOf(card.y);
    const column = tileOf(card.x);
    const person = index.person.get(card.id)!;
    const name = `P${tree.people.indexOf(person) + 1}`;
    names[row]![column] = name;
    for (let c = column; c < column + 3 && c < columns; c++) taken[row]![c] = true;
    const text = cardText(tree, succession, person);
    boxes.set(name, [text.tag ? `'''${wikiEscape(text.tag)}'''` : '', wikiName(person), wikiEscape(text.dates)].filter(Boolean).join('<br>'));
  });
  const mark = (row: number, column: number, side: number): void => {
    if (!taken[row]?.[column] && lines[row]) lines[row]![column]! |= side;
  };

  for (const link of layout.links) {
    if (link.kind === 'marriage' && link.points.length === 2) {
      // Partners side by side: the one tile between their boxes.
      mark(rowOf(link.points[0]![1]), tileOf(link.points[0]![0]), LEFT | RIGHT);
      continue;
    }
    for (let i = 1; i < link.points.length; i++) {
      const [x1, y1] = link.points[i - 1]!;
      const [x2, y2] = link.points[i]!;
      const [r1, r2] = [rowOf(y1), rowOf(y2)].sort((a, b) => a - b) as [number, number];
      const [c1, c2] = [tileOf(x1), tileOf(x2)].sort((a, b) => a - b) as [number, number];
      if (r1 === r2) {
        for (let c = c1; c <= c2; c++) {
          if (c > c1) mark(r1, c, LEFT);
          if (c < c2) mark(r1, c, RIGHT);
        }
      } else {
        for (let r = r1; r <= r2; r++) {
          if (r > r1) mark(r, c1, UP);
          if (r < r2) mark(r, c1, DOWN);
        }
      }
    }
  }

  const rows: string[][] = [];
  for (let r = 0; r < count; r++) {
    const row: string[] = [];
    for (let c = 0; c < columns; c++) {
      const name = names[r]![c];
      if (name !== undefined) {
        row.push(name);
        c += 2;
      } else {
        row.push(TILES[lines[r]![c]!] ?? ' ');
      }
    }
    while (row.length && row.at(-1) === ' ') row.pop();
    rows.push(row);
  }
  const heir = succession.heir === undefined ? undefined : `P${tree.people.findIndex((p) => p.id === succession.heir) + 1}`;
  return { rows, boxes, columns, ...(heir && boxes.has(heir) ? { heir } : {}) };
}

/**
 * The tree as a {{Tree chart}} or a {{Family tree}}: the same rows under either name.
 * The heir's box has a heavier border as well as the word.
 */
export function treeChart(tree: Tree, template: ChartTemplate = 'Tree chart', succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const chart = chartGrid(tree, succession, index);
  const summary = wikiEscape(tree.house ? `Family tree of ${withThe(tree.house)}` : 'Family tree');
  const out = [`{{${template}/start|summary=${summary}}}`];
  for (const row of chart.rows) {
    if (!row.length) continue;
    const inRow = row.filter((tile) => chart.boxes.has(tile));
    const contents = inRow.map((name) => `|${name}=${chart.boxes.get(name)}${name === chart.heir ? `|boxstyle_${name}=border-width: 3px;` : ''}`);
    out.push(`{{${template}|${row.map((tile) => (chart.boxes.has(tile) ? `${tile} ` : tile)).join('|')}${contents.join('')}}}`);
  }
  out.push(`{{${template}/end}}`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Ahnentafel
// ---------------------------------------------------------------------------------------------

/** Five generations: the person, and thirty ancestors. */
export const AHNENTAFEL_PLACES = 31;

/**
 * A person's ancestors by ahnentafel number: the person is 1, the father of number n is 2n and
 * the mother 2n + 1. Where the tree doesn't say which parent is which, the first takes the
 * father's place.
 */
export function ahnentafelNumbers(tree: Tree, subject: string, index: TreeIndex = indexTree(tree)): Map<number, Person> {
  const found = new Map<number, Person>();
  const place = (id: string, n: number): void => {
    const person = index.person.get(id);
    if (!person || n > AHNENTAFEL_PLACES) return;
    found.set(n, person);
    const parents = index.parents(id).map((parent) => index.person.get(parent)!);
    let [father, mother] = parents;
    if (mother && (mother.sex === 'm' || father!.sex === 'f') && father!.sex !== 'm' && mother.sex !== 'f') [father, mother] = [mother, father];
    if (!mother && father?.sex === 'f') [father, mother] = [undefined, father];
    if (father) place(father.id, 2 * n);
    if (mother) place(mother.id, 2 * n + 1);
  };
  place(subject, 1);
  return found;
}

/** One person's ancestors as an {{Ahnentafel}}. */
export function ahnentafel(tree: Tree, subject: string, index: TreeIndex = indexTree(tree)): string {
  const places = ahnentafelNumbers(tree, subject, index);
  const out = ['{{Ahnentafel', '|collapsed=no'];
  for (const n of [...places.keys()].sort((a, b) => a - b)) {
    const person = places.get(n)!;
    const born = yearOf(person.born);
    const died = yearOf(person.died);
    const dates = isDead(person) ? (born || died ? ` (${born || '?'}–${died || '?'})` : '') : born ? ` (born ${born})` : '';
    out.push(`|${n}=${n}. ${n === 1 ? `'''${wikiName(person)}'''` : wikiName(person)}${dates}`);
  }
  out.push('}}');
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// The whole export
// ---------------------------------------------------------------------------------------------

export const wikiFormats = [
  { id: 'tree-chart', name: 'Tree chart', hint: 'The whole tree, for the {{Tree chart}} template.' },
  { id: 'family-tree', name: 'Family tree', hint: 'The whole tree, for the older {{Family tree}} template.' },
  { id: 'ahnentafel', name: 'Ahnentafel', hint: 'One person’s ancestors, numbered, for the {{Ahnentafel}} template.' },
  { id: 'table', name: 'Table', hint: 'A plain table of the house. Needs no template.' },
] as const;
export type WikiFormat = (typeof wikiFormats)[number]['id'];

export interface WikiOptions {
  format?: WikiFormat;
  /** For an ahnentafel: whose ancestors. Defaults to the reigning person, then the first in the tree. */
  subject?: string;
}

/** Whose ancestors an ahnentafel shows when nobody is named: the reigning person, then the first in the tree. */
export function ahnentafelSubject(tree: Tree, asked?: string): string | undefined {
  if (asked !== undefined && tree.people.some((p) => p.id === asked)) return asked;
  return tree.reigning !== undefined && tree.people.some((p) => p.id === tree.reigning) ? tree.reigning : tree.people[0]?.id;
}

/**
 * Wikitext for a page: a heading, a sentence on the law, the tree in the shape asked for, the
 * line of succession, and who is left out.
 * @param tree a clean tree (see cleanTree)
 */
export function toWikitext(tree: Tree, options: WikiOptions = {}): string {
  const format = options.format ?? 'table';
  const index = indexTree(tree);
  const succession = lineOfSuccession(tree);
  const house = wikiEscape(tree.house || 'The house');
  const out: string[] = [`== ${house} ==`];
  out.push(
    `${tree.house ? `'''${wikiEscape(withThe(tree.house)).replace(/^the /, 'The ')}'''` : "'''The house'''"}${tree.realm ? ` reigns over ${wikiEscape(realmWithThe(tree.realm))}` : ' reigns'}. The succession follows ${lawNames[tree.law].toLowerCase()}.`,
    '',
  );
  if (format === 'tree-chart' || format === 'family-tree') {
    out.push('=== Family tree ===', treeChart(tree, format === 'tree-chart' ? 'Tree chart' : 'Family tree', succession, index));
  } else if (format === 'ahnentafel') {
    const subject = ahnentafelSubject(tree, options.subject);
    if (subject !== undefined) out.push(`=== Ancestry of ${wikiEscape(displayName(index.person.get(subject)))} ===`, ahnentafel(tree, subject, index));
  } else {
    out.push('=== Members ===', membersTable(tree, succession, index));
  }
  out.push('', '=== Line of succession ===', successionList(tree, succession, index));
  if (succession.excluded.length) {
    out.push('', '=== Not in the line ===');
    for (const entry of succession.excluded) out.push(`* ${wikiName(index.person.get(entry.id))}: ${wikiEscape(reasonText(tree, entry, index))}`);
  }
  return `${out.join('\n')}\n`;
}
