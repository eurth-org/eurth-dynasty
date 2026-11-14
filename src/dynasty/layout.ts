/**
 * Where everyone goes. Generations in rows, spouses side by side, siblings in birth order, and no
 * card on top of another. The result is plain numbers: the drawing (render.ts) and the tool both
 * read it, and neither has to know how it was worked out.
 *
 * A family tree is not really a tree: cousins marry, people marry twice, two families join. So
 * the layout picks a tree out of it. Everyone joined by marriage forms one unit, set side by
 * side; a unit hangs under the parents of one of its members (the "anchor"), and each family gets
 * a band of its own width, which is what keeps cards apart. Parents of the other members are
 * joined to them by a longer line (a "cross" link) wherever they ended up.
 */
import { indexTree, type Tree, type TreeIndex } from './model';
import { defaultFounder } from './succession';

export const CARD_WIDTH = 200;
export const CARD_HEIGHT = 72;
/** Between two partners. Wide enough for the marriage line and the drop to their children. */
export const SPOUSE_GAP = 28;
/** Between one family and the next in a row. */
export const SIBLING_GAP = 32;
/** Between rows. The lines to the children run in here. */
export const ROW_GAP = 84;
export const MARGIN = 24;

export interface LayoutOptions {
  cardWidth?: number;
  cardHeight?: number;
  /** The person whose family is drawn first, on the left. Defaults to the founder of the line. */
  first?: string;
}

export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0 for the oldest generation. */
  row: number;
}

export type Point = [number, number];

export interface Link {
  /**
   * marriage: between two partners. descent: from parents to the children drawn beneath them.
   * cross: from parents to a child who is drawn elsewhere, beside a spouse.
   */
  kind: 'marriage' | 'descent' | 'cross';
  /** A line through these points, each segment straight across or straight down. */
  points: Point[];
  union?: string;
  child?: string;
  /** The line to a child who was adopted or born outside marriage. The card says so in words too. */
  dashed?: boolean;
}

export interface Layout {
  width: number;
  height: number;
  rows: number;
  cards: Card[];
  links: Link[];
}

interface Group {
  union?: string;
  /** For the children of one known parent. */
  parent?: string;
  /** Where the group sits in its unit, to order groups left to right. */
  at: number;
  kids: string[];
  cross: string[];
}

interface Node {
  members: string[];
  row: number;
  groups: Group[];
  children: Node[];
  width: number;
}

/**
 * The row of each person. A child is at least one row below both parents and partners share a
 * row. Then each couple is brought down to sit just above its children, so in-laws line up with
 * the family they married into instead of floating at the top.
 */
function generations(tree: Tree, index: TreeIndex, units: string[][]): Map<string, number> {
  const cap = tree.people.length + 2;
  const unitOf = new Map<string, string[]>();
  for (const unit of units) for (const id of unit) unitOf.set(id, unit);

  /** Pushes rows down until every rule holds. Rows only ever grow, so it ends. */
  const settle = (row: Map<string, number>): void => {
    for (let pass = 0; pass < cap; pass++) {
      let changed = false;
      for (const p of tree.people) {
        let r = row.get(p.id) ?? 0;
        for (const parent of index.parents(p.id)) r = Math.max(r, Math.min((row.get(parent) ?? 0) + 1, cap));
        if (r !== row.get(p.id)) {
          row.set(p.id, r);
          changed = true;
        }
      }
      for (const unit of units) {
        const r = Math.max(...unit.map((id) => row.get(id) ?? 0));
        for (const id of unit) {
          if (row.get(id) !== r) {
            row.set(id, r);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  };

  let row = new Map(tree.people.map((p) => [p.id, 0]));
  settle(row);

  // A child whose row is held in place by something other than these parents (a marriage into
  // another family, say) is what the parents line up with. Children held by nothing else simply
  // follow their parents down.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const unit of units) {
      const kids = unit.flatMap((id) => index.children(id)).filter((kid) => !unit.includes(kid.id));
      if (!kids.length) continue;
      const held = kids.filter((kid) => (unitOf.get(kid.id) ?? []).some((member) => index.parents(member).some((parent) => !unit.includes(parent))));
      const guide = held.length ? held : kids;
      const lowest = (rows: Map<string, number>): number => Math.min(...guide.map((kid) => rows.get(kid.id) ?? 0));
      const target = lowest(row) - 1;
      if (target <= (row.get(unit[0]!) ?? 0)) continue;
      const trial = new Map(row);
      for (const id of unit) trial.set(id, target);
      settle(trial);
      // If moving the parents pushed the very child they were lining up with, the family is
      // tangled (an uncle married to a niece, say): leave them where they were.
      if (lowest(trial) - 1 !== target) continue;
      row = trial;
      changed = true;
    }
    if (!changed) break;
  }

  const top = Math.min(...row.values());
  for (const [id, r] of row) row.set(id, r - top);
  return row;
}

/** Everyone joined by marriage, as one group each. A person who never married is a group of one. */
function marriageUnits(tree: Tree): string[][] {
  const head = new Map(tree.people.map((p) => [p.id, p.id]));
  const find = (id: string): string => {
    let at = id;
    while (head.get(at) !== at) at = head.get(at)!;
    head.set(id, at);
    return at;
  };
  for (const u of tree.unions) {
    if (head.has(u.a) && head.has(u.b)) head.set(find(u.a), find(u.b));
  }
  const units = new Map<string, string[]>();
  for (const p of tree.people) {
    const key = find(p.id);
    const unit = units.get(key);
    if (unit) unit.push(p.id);
    else units.set(key, [p.id]);
  }
  return [...units.values()];
}

/** Works out where every card and line goes. The same tree always gives the same layout. */
export function layoutTree(tree: Tree, options: LayoutOptions = {}): Layout {
  if (!tree.people.length) return { width: 0, height: 0, rows: 0, cards: [], links: [] };
  const index = indexTree(tree);
  const W = options.cardWidth ?? CARD_WIDTH;
  const H = options.cardHeight ?? CARD_HEIGHT;

  const units = marriageUnits(tree);
  const unitOf = new Map<string, number>();
  units.forEach((unit, i) => unit.forEach((id) => unitOf.set(id, i)));
  const rowOf = generations(tree, index, units);

  // The members of a unit in a row: the anchor, with a first spouse on the left and any later
  // ones on the right, and each spouse's own other partners beyond them.
  const chain = (anchor: string): string[] => {
    const seen = new Set([anchor]);
    const partners = (id: string): string[] => index.unions(id).map((u) => index.partner(u, id));
    const run = (id: string): string[] => {
      if (seen.has(id)) return [];
      seen.add(id);
      return [id, ...partners(id).flatMap(run)];
    };
    const mine = [...new Set(partners(anchor))];
    if (mine.length < 2) return [anchor, ...mine.flatMap(run)];
    const left = run(mine[0]!).reverse();
    return [...left, anchor, ...mine.slice(1).flatMap(run)];
  };

  const placed = new Set<number>();
  const build = (anchor: string, minRow: number): Node => {
    placed.add(unitOf.get(anchor)!);
    const members = chain(anchor);
    const at = new Map(members.map((id, i) => [id, i]));
    const row = Math.max(rowOf.get(anchor) ?? 0, minRow);
    const groups: Group[] = [];
    const done = new Set<string>();
    members.forEach((id, i) => {
      for (const u of index.unions(id)) {
        if (done.has(u.id)) continue;
        done.add(u.id);
        groups.push({ union: u.id, at: (i + (at.get(index.partner(u, id)) ?? i)) / 2, kids: [], cross: [] });
      }
      if (index.children(id).some((kid) => kid.union === undefined)) groups.push({ parent: id, at: i, kids: [], cross: [] });
    });
    groups.sort((x, y) => x.at - y.at);

    const node: Node = { members, row, groups, children: [], width: 0 };
    for (const group of groups) {
      const kids = group.union !== undefined ? index.childrenOfUnion(group.union) : index.children(group.parent!).filter((kid) => kid.union === undefined);
      for (const kid of kids) {
        if (placed.has(unitOf.get(kid.id)!)) {
          group.cross.push(kid.id);
        } else {
          group.kids.push(kid.id);
          node.children.push(build(kid.id, row + 1));
        }
      }
    }
    const unitWidth = members.length * W + (members.length - 1) * SPOUSE_GAP;
    const below = node.children.reduce((sum, child) => sum + child.width, 0) + Math.max(0, node.children.length - 1) * SIBLING_GAP;
    node.width = Math.max(unitWidth, below);
    return node;
  };

  // The founder's family first; then every family that starts with someone whose parents aren't
  // in the tree; then whatever is left (which only happens when people are their own ancestors).
  const first = options.first !== undefined && index.person.has(options.first) ? options.first : (tree.founder ?? defaultFounder(tree, index));
  const roots: Node[] = [];
  const start = (id: string): void => {
    if (!placed.has(unitOf.get(id)!)) roots.push(build(id, 0));
  };
  if (first !== undefined && index.person.has(first)) start(first);
  for (const unit of units) {
    if (unit.every((id) => index.parents(id).length === 0)) start(unit[0]!);
  }
  for (const p of tree.people) {
    if (index.parents(p.id).length === 0) start(p.id);
  }
  for (const p of tree.people) start(p.id);

  const cards = new Map<string, Card>();
  const anchorOf = new Map<Node, string>();
  const place = (node: Node, left: number): void => {
    const below = node.children.reduce((sum, child) => sum + child.width, 0) + Math.max(0, node.children.length - 1) * SIBLING_GAP;
    let cursor = left + (node.width - below) / 2;
    for (const child of node.children) {
      place(child, cursor);
      cursor += child.width + SIBLING_GAP;
    }
    const unitWidth = node.members.length * W + (node.members.length - 1) * SPOUSE_GAP;
    let unitLeft = left + (node.width - unitWidth) / 2;
    if (node.children.length) {
      const centre = (child: Node): number => cards.get(anchorOf.get(child)!)!.x + W / 2;
      const middle = (centre(node.children[0]!) + centre(node.children.at(-1)!)) / 2;
      unitLeft = Math.min(Math.max(middle - unitWidth / 2, left), left + node.width - unitWidth);
    }
    node.members.forEach((id, i) => {
      cards.set(id, { id, x: Math.round(unitLeft + i * (W + SPOUSE_GAP)), y: MARGIN + node.row * (H + ROW_GAP), width: W, height: H, row: node.row });
    });
  };
  // Each node's anchor is the member its parents' line comes down to.
  const noteAnchors = (node: Node, anchor: string): void => {
    anchorOf.set(node, anchor);
    const kids = node.groups.flatMap((group) => group.kids);
    node.children.forEach((child, i) => noteAnchors(child, kids[i]!));
  };

  let cursor = MARGIN;
  for (const root of roots) {
    noteAnchors(root, root.members[0]!);
    place(root, cursor);
    cursor += root.width + SIBLING_GAP * 1.5;
  }

  const links: Link[] = [];
  const dash = (id: string): { dashed?: boolean } => {
    const p = index.person.get(id);
    return p && (p.adopted || p.illegitimate) ? { dashed: true } : {};
  };
  const draw = (node: Node): void => {
    const position = new Map(node.members.map((id, i) => [id, i]));
    const bottom = MARGIN + node.row * (H + ROW_GAP) + H;
    let lane = 0;
    let bracket = 0;
    for (const group of node.groups) {
      let origin: Point;
      if (group.union !== undefined) {
        const u = index.union.get(group.union)!;
        const [l, r] = [cards.get(u.a)!, cards.get(u.b)!].sort((x, y) => x.x - y.x) as [Card, Card];
        if (Math.abs((position.get(u.a) ?? 0) - (position.get(u.b) ?? 0)) === 1) {
          const y = l.y + H / 2;
          links.push({ kind: 'marriage', union: u.id, points: [[l.x + W, y], [r.x, y]] });
          origin = [(l.x + W + r.x) / 2, y];
        } else {
          // Partners with someone between them: the line dips under the cards in between.
          const y = bottom + 8 + 8 * Math.min(bracket++, 2);
          links.push({ kind: 'marriage', union: u.id, points: [[l.x + W - 16, bottom], [l.x + W - 16, y], [r.x + 16, y], [r.x + 16, bottom]] });
          origin = [(l.x + W - 16 + r.x + 16) / 2, y];
        }
      } else {
        // Off-centre, so it can't be mistaken for one line with a drop to a child straight below.
        const card = cards.get(group.parent!)!;
        origin = [card.x + W / 4, bottom];
      }
      if (!group.kids.length && !group.cross.length) continue;
      const busY = bottom + 30 + 10 * Math.min(lane++, 4);

      if (group.kids.length) {
        const tops = group.kids.map((id) => cards.get(id)!);
        const xs = tops.map((card) => card.x + W / 2);
        links.push({ kind: 'descent', ...(group.union === undefined ? {} : { union: group.union }), points: [origin, [origin[0], busY]] });
        const from = Math.min(origin[0], ...xs);
        const to = Math.max(origin[0], ...xs);
        if (to > from) links.push({ kind: 'descent', ...(group.union === undefined ? {} : { union: group.union }), points: [[from, busY], [to, busY]] });
        tops.forEach((card, i) => links.push({ kind: 'descent', child: card.id, ...dash(card.id), points: [[xs[i]!, busY], [xs[i]!, card.y]] }));
      }
      for (const id of group.cross) {
        const card = cards.get(id)!;
        const x = card.x + W / 2;
        const y = busY + 5;
        const end: Point = card.y >= y ? [x, card.y] : [x, card.y + H];
        links.push({ kind: 'cross', child: id, ...dash(id), ...(group.union === undefined ? {} : { union: group.union }), points: [origin, [origin[0], y], [x, y], end] });
      }
    }
    node.children.forEach(draw);
  };
  roots.forEach(draw);

  const all = [...cards.values()];
  const rows = Math.max(...all.map((card) => card.row)) + 1;
  // Kept in the order of the people list, so a layout can be read alongside the tree.
  const ordered = tree.people.map((p) => cards.get(p.id)!).filter(Boolean);
  return {
    width: Math.round(Math.max(...all.map((card) => card.x + card.width)) + MARGIN),
    height: MARGIN * 2 + rows * H + (rows - 1) * ROW_GAP,
    rows,
    cards: ordered,
    links: links.map((link) => ({ ...link, points: link.points.map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2] as Point) })),
  };
}

export interface Neighbours {
  left?: string;
  right?: string;
  up?: string;
  down?: string;
}

/**
 * Where the arrow keys go from a person: left and right along the row, up to a parent, down to
 * the eldest child.
 */
export function neighbours(layout: Layout, tree: Tree, id: string, index: TreeIndex = indexTree(tree)): Neighbours {
  const card = layout.cards.find((c) => c.id === id);
  if (!card) return {};
  const row = layout.cards.filter((c) => c.row === card.row).sort((a, b) => a.x - b.x);
  const at = row.findIndex((c) => c.id === id);
  const has = new Set(layout.cards.map((c) => c.id));
  const up = index.parents(id).find((parent) => has.has(parent));
  const down = index.children(id).find((kid) => has.has(kid.id))?.id;
  const left = row[at - 1]?.id;
  const right = row[at + 1]?.id;
  return {
    ...(left === undefined ? {} : { left }),
    ...(right === undefined ? {} : { right }),
    ...(up === undefined ? {} : { up }),
    ...(down === undefined ? {} : { down }),
  };
}

/** Everyone in reading order: top row first, left to right. For Home, End and screen readers. */
export const readingOrder = (layout: Layout): string[] => [...layout.cards].sort((a, b) => a.row - b.row || a.x - b.x).map((card) => card.id);
