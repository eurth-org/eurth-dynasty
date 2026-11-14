/**
 * A dynasty: a house, its people, their marriages, and the rules that say who inherits.
 *
 * Everything here is plain data, so a tree can travel in a link, in the profile file or in a
 * GEDCOM file and come back the same. Whatever arrives from outside goes through cleanTree first:
 * a link or a file is someone else's input.
 */

export type Sex = 'm' | 'f' | 'x';

export const laws = ['absolute', 'male-preference', 'agnatic', 'seniority', 'elective'] as const;
export type Law = (typeof laws)[number];

export const lawNames: Record<Law, string> = {
  absolute: 'Absolute primogeniture',
  'male-preference': 'Male-preference primogeniture',
  agnatic: 'Agnatic primogeniture',
  seniority: 'Agnatic seniority',
  elective: 'Elective monarchy',
};

/** One line on each law, for the controls. */
export const lawHints: Record<Law, string> = {
  absolute: 'The eldest child inherits, daughter or son.',
  'male-preference': 'Sons before daughters; a daughter inherits when she has no brothers.',
  agnatic: 'Men in the male line only.',
  seniority: 'Men in the male line, brothers before sons.',
  elective: 'No one inherits: you pick the candidates, in order.',
};

/** A year ("1958", "-120"), a year and month ("1958-03") or a full date ("1958-03-12"). */
export type DateText = string;

export interface Person {
  id: string;
  name: string;
  title?: string;
  /** m, f, or x for "not stated". Only the laws that tell sons from daughters need it. */
  sex: Sex;
  born?: DateText;
  died?: DateText;
  /** Dead, when the date isn't known. A person with a death date is dead either way. */
  dead?: boolean;
  /** When they came to the throne and left it, for those who reigned. */
  reignFrom?: DateText;
  reignTo?: DateText;
  notes?: string;
  /** A link out, to a wiki page or a forum topic. https only. */
  link?: string;
  /** The union this person is a child of. */
  union?: string;
  /** The one known parent, for a child of no recorded union. Ignored when `union` is set. */
  parent?: string;
  /** Adopted by the parents above, not born to them. */
  adopted?: boolean;
  /** Born outside marriage and not legitimised. */
  illegitimate?: boolean;
  /** Gave up their place: for themselves only, or for their descendants too. */
  renounced?: 'self' | 'line';
  /** Gave up the throne itself. Their children keep their place. */
  abdicated?: boolean;
}

export interface Union {
  id: string;
  a: string;
  b: string;
  married?: DateText;
  /** Divorce or annulment. A marriage that ended in a death needs nothing here. */
  ended?: DateText;
  /** A marriage "out": unequal, unapproved, or otherwise not recognised by the house. */
  out?: boolean;
}

/** What takes someone out of the line. Each is a toggle; all are on to begin with. */
export interface Exclusions {
  illegitimate: boolean;
  renounced: boolean;
  out: boolean;
  /** Adopted children do not inherit. Switch off to let them. */
  adopted: boolean;
}

export interface Tree {
  house: string;
  /** The realm the house reigns over, for example "Kingdom of Ostaril". */
  realm?: string;
  people: Person[];
  unions: Union[];
  law: Law;
  exclude: Exclusions;
  /** Who reigns now. */
  reigning?: string;
  /** The ancestor the line descends from. Worked out from the reigning person when not set. */
  founder?: string;
  /** Under an elective law: the chosen candidates, first choice first. */
  picks: string[];
}

export const MAX_PEOPLE = 500;
export const MAX_UNIONS = 500;
export const MAX_PICKS = 50;
export const MAX_NAME = 80;
export const MAX_TITLE = 60;
export const MAX_NOTES = 500;
export const MAX_LINK = 300;

export const defaultExclusions = (): Exclusions => ({ illegitimate: true, renounced: true, out: true, adopted: true });

export const emptyTree = (): Tree => ({ house: '', people: [], unions: [], law: 'absolute', exclude: defaultExclusions(), picks: [] });

// ---------------------------------------------------------------------------------------------
// Cleaning: nothing from a link or a file is trusted.
// ---------------------------------------------------------------------------------------------

/** Plain text on one line: no markup, no control characters, cut to length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const DATE = /^(-?\d{1,5})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/;

/** A date in its tidy form ("1958", "1958-03", "1958-03-12"), or undefined for anything else. */
export function cleanDate(value: unknown): DateText | undefined {
  const text = typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  const found = DATE.exec(text);
  if (!found) return undefined;
  const year = Number(found[1]);
  if (!Number.isInteger(year) || Math.abs(year) > 99999) return undefined;
  const month = found[2] === undefined ? undefined : Number(found[2]);
  const day = found[3] === undefined ? undefined : Number(found[3]);
  if (month !== undefined && (month < 1 || month > 12)) return undefined;
  if (day !== undefined && (day < 1 || day > 31)) return undefined;
  const two = (n: number) => String(n).padStart(2, '0');
  return String(year) + (month === undefined ? '' : `-${two(month)}`) + (month === undefined || day === undefined ? '' : `-${two(day)}`);
}

export interface DateParts {
  year: number;
  month?: number;
  day?: number;
}

export function dateParts(date: DateText | undefined): DateParts | undefined {
  const found = date === undefined ? null : DATE.exec(date);
  if (!found) return undefined;
  return {
    year: Number(found[1]),
    ...(found[2] === undefined ? {} : { month: Number(found[2]) }),
    ...(found[3] === undefined ? {} : { day: Number(found[3]) }),
  };
}

/** A number that sorts dates in order. A year alone sorts before any date within it. */
export function dateKey(date: DateText | undefined): number | undefined {
  const parts = dateParts(date);
  return parts ? parts.year * 10000 + (parts.month ?? 0) * 100 + (parts.day ?? 0) : undefined;
}

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** A date as people write it: "12 March 1958", "March 1958", "1958". */
export function formatDate(date: DateText | undefined): string {
  const parts = dateParts(date);
  if (!parts) return '';
  const month = parts.month === undefined ? '' : `${months[parts.month - 1]} `;
  const day = parts.day === undefined || parts.month === undefined ? '' : `${parts.day} `;
  return `${day}${month}${parts.year}`;
}

export const yearOf = (date: DateText | undefined): string => {
  const parts = dateParts(date);
  return parts ? String(parts.year) : '';
};

/** An https link, or undefined. Nothing else is ever turned into a link. */
export function cleanLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > MAX_LINK || !/^https:\/\/[!-~]+$/.test(text) || /[<>"'`\\]/.test(text)) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password ? text : undefined;
  } catch {
    return undefined;
  }
}

const ID = /^[A-Za-z0-9_-]{1,16}$/;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** An id not yet in use: p1, p2, … or u1, u2, … */
export function newId(prefix: 'p' | 'u', taken: Iterable<string>): string {
  const used = new Set(taken);
  for (let n = used.size + 1; ; n++) {
    const id = `${prefix}${n}`;
    if (!used.has(id)) return id;
  }
}

/**
 * Turns anything into a tree that the rest of the code can rely on: known fields only, text cut
 * to length, dates in order of digits, ids unique, and every reference pointing at something
 * that exists. What can't be mended is dropped. It never throws.
 *
 * A person may still be their own ancestor after this. That is a mistake in the story, not in the
 * data: the engine and the drawing cope with it, and validate.ts points it out.
 */
export function cleanTree(input: unknown): Tree {
  const source = isRecord(input) ? input : {};
  const people: Person[] = [];
  const ids = new Set<string>();

  for (const raw of list(source.people).slice(0, MAX_PEOPLE)) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !ID.test(raw.id) || ids.has(raw.id)) continue;
    ids.add(raw.id);
    const person: Person = { id: raw.id, name: cleanText(raw.name, MAX_NAME), sex: raw.sex === 'm' || raw.sex === 'f' ? raw.sex : 'x' };
    const title = cleanText(raw.title, MAX_TITLE);
    if (title) person.title = title;
    for (const key of ['born', 'died', 'reignFrom', 'reignTo'] as const) {
      const date = cleanDate(raw[key]);
      if (date) person[key] = date;
    }
    if (raw.dead === true && !person.died) person.dead = true;
    const notes = cleanText(raw.notes, MAX_NOTES);
    if (notes) person.notes = notes;
    const link = cleanLink(raw.link);
    if (link) person.link = link;
    if (typeof raw.union === 'string') person.union = raw.union;
    else if (typeof raw.parent === 'string') person.parent = raw.parent;
    if (raw.adopted === true) person.adopted = true;
    if (raw.illegitimate === true) person.illegitimate = true;
    if (raw.renounced === 'self' || raw.renounced === 'line') person.renounced = raw.renounced;
    if (raw.abdicated === true) person.abdicated = true;
    people.push(person);
  }

  const unions: Union[] = [];
  const unionIds = new Set<string>();
  for (const raw of list(source.unions).slice(0, MAX_UNIONS)) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !ID.test(raw.id) || unionIds.has(raw.id)) continue;
    if (typeof raw.a !== 'string' || typeof raw.b !== 'string' || raw.a === raw.b || !ids.has(raw.a) || !ids.has(raw.b)) continue;
    unionIds.add(raw.id);
    const union: Union = { id: raw.id, a: raw.a, b: raw.b };
    const married = cleanDate(raw.married);
    if (married) union.married = married;
    const ended = cleanDate(raw.ended);
    if (ended) union.ended = ended;
    if (raw.out === true) union.out = true;
    unions.push(union);
  }

  // Parents must exist, and nobody is born of their own marriage or is their own parent.
  const unionById = new Map(unions.map((u) => [u.id, u]));
  for (const person of people) {
    if (person.union !== undefined) {
      const union = unionById.get(person.union);
      if (!union || union.a === person.id || union.b === person.id) delete person.union;
    }
    if (person.parent !== undefined && (!ids.has(person.parent) || person.parent === person.id)) delete person.parent;
    if (person.union === undefined && person.parent === undefined) delete person.adopted;
  }

  const exclude = isRecord(source.exclude) ? source.exclude : {};
  const tree: Tree = {
    house: cleanText(source.house, MAX_NAME),
    people,
    unions,
    law: laws.includes(source.law as Law) ? (source.law as Law) : 'absolute',
    exclude: {
      illegitimate: exclude.illegitimate !== false,
      renounced: exclude.renounced !== false,
      out: exclude.out !== false,
      adopted: exclude.adopted !== false,
    },
    picks: [...new Set(list(source.picks).filter((id): id is string => typeof id === 'string' && ids.has(id)))].slice(0, MAX_PICKS),
  };
  const realm = cleanText(source.realm, MAX_NAME);
  if (realm) tree.realm = realm;
  if (typeof source.reigning === 'string' && ids.has(source.reigning)) tree.reigning = source.reigning;
  if (typeof source.founder === 'string' && ids.has(source.founder)) tree.founder = source.founder;
  return tree;
}

/** A copy that shares nothing with the original, so one can be changed without the other. */
export const cloneTree = (tree: Tree): Tree => ({
  ...tree,
  people: tree.people.map((p) => ({ ...p })),
  unions: tree.unions.map((u) => ({ ...u })),
  exclude: { ...tree.exclude },
  picks: [...tree.picks],
});

// ---------------------------------------------------------------------------------------------
// Reading a tree
// ---------------------------------------------------------------------------------------------

export const isDead = (person: Person): boolean => person.dead === true || person.died !== undefined;

/** "King Teomir II"; "Unnamed" for a person with no name yet. */
export const displayName = (person: Person | undefined): string =>
  person ? [person.title, person.name].filter(Boolean).join(' ') || 'Unnamed' : 'Unknown';

export interface TreeIndex {
  tree: Tree;
  person: Map<string, Person>;
  union: Map<string, Union>;
  /** A person's place in the list, the tie-break wherever order matters. */
  position: Map<string, number>;
  /** A person's parents: the two partners of the union they were born to, or the one known parent. */
  parents: (id: string) => string[];
  /** A person's children, eldest first. */
  children: (id: string) => Person[];
  /** The children of one union, eldest first. */
  childrenOfUnion: (unionId: string) => Person[];
  /** A person's unions, earliest first. */
  unions: (id: string) => Union[];
  /** The other partner of a union. */
  partner: (union: Union, id: string) => string;
}

/**
 * Siblings in birth order. Those with no birth date come after those with one, in the order they
 * were added; so a tree with no dates at all keeps the order it was typed in.
 */
export function byBirth(position: Map<string, number>) {
  return (x: Person, y: Person): number => {
    const kx = dateKey(x.born) ?? Infinity;
    const ky = dateKey(y.born) ?? Infinity;
    if (kx !== ky) return kx < ky ? -1 : 1;
    return (position.get(x.id) ?? 0) - (position.get(y.id) ?? 0);
  };
}

/** Looks everything up once, so the engine and the drawing don't search the lists again and again. */
export function indexTree(tree: Tree): TreeIndex {
  const person = new Map(tree.people.map((p) => [p.id, p]));
  const union = new Map(tree.unions.map((u) => [u.id, u]));
  const position = new Map(tree.people.map((p, i) => [p.id, i]));
  const order = byBirth(position);

  const parents = (id: string): string[] => {
    const p = person.get(id);
    if (!p) return [];
    const u = p.union === undefined ? undefined : union.get(p.union);
    if (u) return [u.a, u.b];
    return p.parent !== undefined && person.has(p.parent) ? [p.parent] : [];
  };

  const childLists = new Map<string, Person[]>();
  const unionChildLists = new Map<string, Person[]>();
  for (const p of tree.people) {
    for (const parentId of parents(p.id)) {
      const kids = childLists.get(parentId);
      if (kids) kids.push(p);
      else childLists.set(parentId, [p]);
    }
    if (p.union !== undefined && union.has(p.union)) {
      const kids = unionChildLists.get(p.union);
      if (kids) kids.push(p);
      else unionChildLists.set(p.union, [p]);
    }
  }
  for (const kids of childLists.values()) kids.sort(order);
  for (const kids of unionChildLists.values()) kids.sort(order);

  const unionLists = new Map<string, Union[]>();
  tree.unions.forEach((u) => {
    for (const id of [u.a, u.b]) {
      const mine = unionLists.get(id);
      if (mine) mine.push(u);
      else unionLists.set(id, [u]);
    }
  });
  const unionPosition = new Map(tree.unions.map((u, i) => [u.id, i]));
  for (const mine of unionLists.values()) {
    mine.sort((x, y) => {
      const kx = dateKey(x.married) ?? Infinity;
      const ky = dateKey(y.married) ?? Infinity;
      if (kx !== ky) return kx < ky ? -1 : 1;
      return (unionPosition.get(x.id) ?? 0) - (unionPosition.get(y.id) ?? 0);
    });
  }

  return {
    tree,
    person,
    union,
    position,
    parents,
    children: (id) => childLists.get(id) ?? [],
    childrenOfUnion: (id) => unionChildLists.get(id) ?? [],
    unions: (id) => unionLists.get(id) ?? [],
    partner: (u, id) => (u.a === id ? u.b : u.a),
  };
}

/** Everyone a person descends from, nearest first. Safe when someone is their own ancestor. */
export function ancestorsOf(index: TreeIndex, id: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>([id]);
  let layer = index.parents(id);
  while (layer.length) {
    const next: string[] = [];
    for (const ancestor of layer) {
      if (seen.has(ancestor)) continue;
      seen.add(ancestor);
      found.push(ancestor);
      next.push(...index.parents(ancestor));
    }
    layer = next;
  }
  return found;
}

/** Everyone descended from a person, nearest first. Safe when someone is their own ancestor. */
export function descendantsOf(index: TreeIndex, id: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>([id]);
  let layer = index.children(id).map((p) => p.id);
  while (layer.length) {
    const next: string[] = [];
    for (const child of layer) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
      next.push(...index.children(child).map((p) => p.id));
    }
    layer = next;
  }
  return found;
}
