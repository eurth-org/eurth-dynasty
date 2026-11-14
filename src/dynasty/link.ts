/**
 * A tree lives in its link: the whole of it goes into the query string, compact and with a
 * version in front, so a link made today still opens after the tool has grown.
 *
 *   https://dynasty.eurth.org/?d=1.WyJIb3VzZSBvZiBWYXJlbmtvIiwi…
 *
 * The form is the one @eurth/style gives every tool ("<version>.<compact JSON, base64url>"),
 * written and read with its helpers. Only small trees fit: past MAX_STATE the tool says so and
 * offers the profile file instead.
 *
 * What arrives in a link is someone else's input. decodeTree never throws, and everything it
 * reads goes through cleanTree before it is used.
 */
import { decodeState, encodeState } from '@eurth/style';
import { cleanTree, laws, type Tree } from './model';

export const LINK_VERSION = 1;
export const LINK_PARAM = 'd';
export const SITE = 'https://dynasty.eurth.org/';
/** The longest state a link may carry, so that the whole link fits the profile file's 4,000 characters. */
export const MAX_STATE = 3900;

const DEAD = 1;
const ADOPTED = 2;
const ILLEGITIMATE = 4;
const ABDICATED = 8;
const RENOUNCED_SELF = 16;
const RENOUNCED_LINE = 32;
const OUT = 1;

/** Drops the empty values off the end of a list: most people have no notes and no link. */
function trim(values: (string | number)[]): (string | number)[] {
  let end = values.length;
  while (end > 0 && (values[end - 1] === '' || values[end - 1] === 0)) end--;
  return values.slice(0, end);
}

/**
 * The tree as nested lists, with places in the list instead of ids and bit flags instead of
 * named ticks. 0 always means "none", so the empty ends can be cut off.
 */
export function packTree(tree: Tree): unknown[] {
  const at = new Map(tree.people.map((p, i) => [p.id, i + 1]));
  const unionAt = new Map(tree.unions.map((u, i) => [u.id, i + 1]));
  const ref = (id: string | undefined): number => (id === undefined ? 0 : (at.get(id) ?? 0));
  const people = tree.people.map((p) =>
    trim([
      p.name,
      p.sex === 'm' ? 1 : p.sex === 'f' ? 2 : 0,
      p.title ?? '',
      p.born ?? '',
      p.died ?? '',
      (p.dead ? DEAD : 0) |
        (p.adopted ? ADOPTED : 0) |
        (p.illegitimate ? ILLEGITIMATE : 0) |
        (p.abdicated ? ABDICATED : 0) |
        (p.renounced === 'self' ? RENOUNCED_SELF : 0) |
        (p.renounced === 'line' ? RENOUNCED_LINE : 0),
      p.union === undefined ? 0 : (unionAt.get(p.union) ?? 0),
      ref(p.parent),
      p.reignFrom ?? '',
      p.reignTo ?? '',
      p.notes ?? '',
      p.link ?? '',
    ]),
  );
  const unions = tree.unions.map((u) => trim([ref(u.a), ref(u.b), u.married ?? '', u.ended ?? '', u.out ? OUT : 0]));
  const exclude = (tree.exclude.illegitimate ? 1 : 0) | (tree.exclude.renounced ? 2 : 0) | (tree.exclude.out ? 4 : 0) | (tree.exclude.adopted ? 8 : 0);
  return [tree.house, tree.realm ?? '', laws.indexOf(tree.law), exclude, ref(tree.reigning), ref(tree.founder), tree.picks.map(ref).filter(Boolean), people, unions];
}

/** A packed tree back into a tree, or null when it isn't one. People are p1, p2, … and unions u1, u2, … */
export function unpackTree(value: unknown): Tree | null {
  if (!Array.isArray(value) || !Array.isArray(value[7])) return null;
  const [house, realm, law, exclude, reigning, founder, picks, rawPeople, rawUnions] = value as unknown[];
  const id = (n: unknown): string | undefined => (typeof n === 'number' && Number.isInteger(n) && n > 0 ? `p${n}` : undefined);
  const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const bits = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) ? v : 0);

  const people = (rawPeople as unknown[]).map((raw, i): Record<string, unknown> => {
    const p = Array.isArray(raw) ? (raw as unknown[]) : [];
    const flags = bits(p[5]);
    const union = bits(p[6]);
    return {
      id: `p${i + 1}`,
      name: p[0],
      sex: p[1] === 1 ? 'm' : p[1] === 2 ? 'f' : 'x',
      title: text(p[2]),
      born: text(p[3]),
      died: text(p[4]),
      dead: (flags & DEAD) !== 0,
      adopted: (flags & ADOPTED) !== 0,
      illegitimate: (flags & ILLEGITIMATE) !== 0,
      abdicated: (flags & ABDICATED) !== 0,
      renounced: flags & RENOUNCED_LINE ? 'line' : flags & RENOUNCED_SELF ? 'self' : undefined,
      union: union > 0 ? `u${union}` : undefined,
      parent: id(p[7]),
      reignFrom: text(p[8]),
      reignTo: text(p[9]),
      notes: text(p[10]),
      link: text(p[11]),
    };
  });
  const unions = (Array.isArray(rawUnions) ? (rawUnions as unknown[]) : []).map((raw, i): Record<string, unknown> => {
    const u = Array.isArray(raw) ? (raw as unknown[]) : [];
    return { id: `u${i + 1}`, a: id(u[0]), b: id(u[1]), married: text(u[2]), ended: text(u[3]), out: (bits(u[4]) & OUT) !== 0 };
  });
  const ex = bits(exclude);
  return cleanTree({
    house,
    realm,
    law: laws[bits(law)],
    exclude: { illegitimate: (ex & 1) !== 0, renounced: (ex & 2) !== 0, out: (ex & 4) !== 0, adopted: (ex & 8) !== 0 },
    reigning: id(reigning),
    founder: id(founder),
    picks: Array.isArray(picks) ? picks.map(id) : [],
    people,
    unions,
  });
}

/** The tree as the value of the link's query parameter. */
export function encodeTree(tree: Tree): string {
  return encodeState(packTree(tree), LINK_VERSION);
}

/** Reads a tree back. Null for anything that isn't one: too long, malformed, a version from the future. */
export function decodeTree(text: string | null | undefined): Tree | null {
  const state = decodeState(text, { maxLength: MAX_STATE * 2 });
  return state && state.version === LINK_VERSION ? unpackTree(state.value) : null;
}

/** Whether the tree is small enough to travel in a link. */
export const fitsInLink = (tree: Tree): boolean => encodeTree(tree).length <= MAX_STATE;

/** The link for a tree, or null when the tree is too big for one. */
export function treeLink(tree: Tree, base: string = SITE): string | null {
  const state = encodeTree(tree);
  if (state.length > MAX_STATE) return null;
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set(LINK_PARAM, state);
  return url.toString();
}

/** The tree in a page address ("?d=1.…"), if there is one. */
export function treeFromSearch(search: string): Tree | null {
  return decodeTree(new URLSearchParams(search).get(LINK_PARAM));
}

/** The same tree with its people numbered p1, p2, … and its unions u1, u2, …, as a link gives it back. */
export function withPlainIds(tree: Tree): Tree {
  return unpackTree(packTree(tree)) ?? cleanTree({});
}
