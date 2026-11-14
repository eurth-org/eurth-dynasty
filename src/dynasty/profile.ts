/**
 * The "dynasty" section of the Eurth profile file (<nation>.eurth.json), the file that carries a
 * nation from one Eurth tool to the next. Dynasty owns this one section and touches no other;
 * reading, checking, merging and saving the file itself is @eurth/profile's work.
 *
 * The section has two halves:
 *
 * - What the other tools read, as @eurth/profile defines it: `house`, `law`, `monarch`, `heir`
 *   and `succession` (names, first in line first), with `link` and `summary`. All plain text.
 * - The tree itself, so the file can bring it back for editing: `format`, `lawId`, `realm`,
 *   `people`, `relations`, `rules`, `reigning`, `founder` and `picks`. The profile schema lets a
 *   section carry keys of its own, and these are Dynasty's.
 *
 * Keys in the section that this version doesn't know are kept as they were.
 */
import { summarise } from './describe';
import { treeLink } from './link';
import { cleanTree, displayName, indexTree, lawNames, type Exclusions, type Law, type Person, type Tree } from './model';
import { lineOfSuccession } from './succession';

/** The version of the tree's shape inside the section. */
export const TREE_FORMAT = 1;

export interface Relation {
  id: string;
  /** The two partners, by person id. */
  a: string;
  b: string;
  married?: string;
  ended?: string;
  /** A marriage the house does not recognise. */
  out?: boolean;
}

export interface DynastySection {
  link?: string;
  summary?: string;
  updated?: string;
  /** "House of Varenko" */
  house?: string;
  /** The law's name, for example "Absolute primogeniture". */
  law?: string;
  /** The reigning person, with title. */
  monarch?: string;
  /** The heir, with title. */
  heir?: string;
  /** The line of succession, first in line first: 50 names at most. */
  succession?: string[];
  /** The version of the keys below. */
  format?: number;
  lawId?: Law;
  realm?: string;
  people?: Person[];
  relations?: Relation[];
  /** What takes someone out of the line: true means the rule is on. */
  rules?: Exclusions;
  /** The reigning person, by id. */
  reigning?: string;
  /** The ancestor the line descends from, by id. */
  founder?: string;
  /** Under an elective law: the chosen candidates, by id. */
  picks?: string[];
  [key: string]: unknown;
}

const OWN_KEYS = ['link', 'summary', 'house', 'law', 'monarch', 'heir', 'succession', 'format', 'lawId', 'realm', 'people', 'relations', 'rules', 'reigning', 'founder', 'picks'] as const;

const cut = (text: string, max = 80): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

export interface SectionOptions {
  /** The address of the tool, to make the link from. Defaults to dynasty.eurth.org. */
  base?: string;
  /** The section already in the file, so keys this version doesn't know are kept. */
  previous?: unknown;
}

/**
 * The section for a tree. `updated` is left to @eurth/profile's setSection, which stamps it.
 * The link holds the whole tree when it is small enough, and is the tool's address when not.
 */
export function toSection(tree: Tree, options: SectionOptions = {}): DynastySection {
  const index = indexTree(tree);
  const succession = lineOfSuccession(tree);
  const name = (id: string | undefined): string => cut(displayName(id === undefined ? undefined : index.person.get(id)));

  const kept: Record<string, unknown> = {};
  if (typeof options.previous === 'object' && options.previous !== null && !Array.isArray(options.previous)) {
    for (const [key, value] of Object.entries(options.previous)) {
      if (!(OWN_KEYS as readonly string[]).includes(key)) kept[key] = value;
    }
  }

  const base = options.base ?? 'https://dynasty.eurth.org/';
  const link = treeLink(tree, base) ?? base;
  const section: DynastySection = { ...kept };
  if (/^https:\/\/[!-~]+$/.test(link) && link.length <= 4000) section.link = link;
  section.summary = summarise(tree, succession, index);
  if (tree.house) section.house = tree.house;
  section.law = lawNames[tree.law];
  if (succession.reigning !== undefined) section.monarch = name(succession.reigning);
  if (succession.heir !== undefined) section.heir = name(succession.heir);
  section.succession = succession.line.slice(0, 50).map((place) => name(place.id));
  section.format = TREE_FORMAT;
  section.lawId = tree.law;
  if (tree.realm) section.realm = tree.realm;
  section.people = tree.people.map((p) => ({ ...p }));
  section.relations = tree.unions.map((u) => ({ ...u }));
  section.rules = { ...tree.exclude };
  if (tree.reigning !== undefined) section.reigning = tree.reigning;
  if (tree.founder !== undefined) section.founder = tree.founder;
  if (tree.picks.length) section.picks = [...tree.picks];
  return section;
}

/** Whether a section carries a tree, and not only the names the other tools read. */
export function hasTree(section: unknown): boolean {
  return typeof section === 'object' && section !== null && Array.isArray((section as DynastySection).people);
}

/**
 * The tree in a section, or null when the section has only names (written by hand, say, or by
 * another tool). Whatever is there is cleaned like any other input.
 */
export function fromSection(section: unknown): Tree | null {
  if (!hasTree(section)) return null;
  const s = section as DynastySection;
  if (typeof s.format === 'number' && s.format > TREE_FORMAT) return null;
  return cleanTree({
    house: s.house,
    realm: s.realm,
    law: s.lawId,
    exclude: s.rules,
    reigning: s.reigning,
    founder: s.founder,
    picks: s.picks,
    people: s.people,
    unions: s.relations,
  });
}
