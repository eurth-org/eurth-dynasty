/**
 * A tree in words: for "Copy description", for the picture's alternative text, and for the line
 * the profile file carries. Everything the drawing shows by position or by a ring is said here.
 */
import { displayName, indexTree, isDead, lawHints, lawNames, yearOf, type Person, type Tree, type TreeIndex } from './model';
import { claimText, lineOfSuccession, reasonText, type Succession } from './succession';

/** "the House of Varenko" in a sentence; a name that isn't a house's is left as it is. */
export const withThe = (house: string): string => (/^(house|clan|dynasty|line|family|kindred)\b/i.test(house) ? `the ${house}` : house);

/** "the Kingdom of Ostaril" in a sentence; a bare name ("Ostaril") is left as it is. */
export const realmWithThe = (realm: string): string =>
  /^(kingdom|grand duchy|duchy|principality|empire|emirate|sultanate|crown|commonwealth|republic|county|march|realm|tsardom|federation|union|united|holy|free|most serene)\b/i.test(realm)
    ? `the ${realm}`
    : realm;

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "born 1958", "1930 to 1988", "died 1988", or nothing. */
export function lifeText(person: Person): string {
  const born = yearOf(person.born);
  const died = yearOf(person.died);
  if (born && died) return `${born} to ${died}`;
  if (died) return `died ${died}`;
  if (born) return isDead(person) ? `born ${born}, since died` : `born ${born}`;
  return isDead(person) ? 'died' : '';
}

const withLife = (person: Person | undefined): string => {
  if (!person) return 'Unknown';
  const life = lifeText(person);
  return life ? `${displayName(person)} (${life})` : displayName(person);
};

const sentenceList = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** The house rules that are switched on, as a sentence, or nothing under an elective law. */
export function rulesText(tree: Tree): string {
  if (tree.law === 'elective') return tree.exclude.renounced ? 'Those who renounced cannot be chosen.' : '';
  const out: string[] = [];
  if (tree.exclude.illegitimate) out.push('those born outside marriage');
  if (tree.exclude.renounced) out.push('those who renounced');
  if (tree.exclude.out) out.push('those who married out, and the children of such marriages');
  if (tree.exclude.adopted) out.push('adopted children');
  return out.length ? `Left out by the house rules: ${sentenceList(out)}.` : 'The house rules leave nobody out.';
}

/**
 * The line of succession as text, a line each, for copying into a post or a wiki page.
 */
export function describeLine(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const person = (id: string | undefined): Person | undefined => (id === undefined ? undefined : index.person.get(id));
  const lines: string[] = [];
  const head = [tree.house, tree.realm].filter(Boolean).join(', ');
  if (head) lines.push(head);
  lines.push(`Succession law: ${lawNames[tree.law].toLowerCase()}. ${lawHints[tree.law]}`);
  const rules = rulesText(tree);
  if (rules) lines.push(rules);

  const reigning = person(succession.reigning);
  if (reigning) {
    const since = yearOf(reigning.reignFrom);
    const life = lifeText(reigning);
    const extra = [life, since ? `reigning since ${since}` : ''].filter(Boolean).join(', ');
    lines.push(`Reigning: ${displayName(reigning)}${extra ? ` (${extra})` : ''}.`);
  } else {
    lines.push('Reigning: nobody. The throne stands empty.');
  }

  const heirPlace = succession.line[0];
  if (heirPlace) {
    const claim = claimText(tree, heirPlace, index);
    lines.push(`Heir: ${withLife(person(heirPlace.id))}${claim && tree.law !== 'elective' ? `, ${claim}` : ''}.`);
  } else {
    lines.push(tree.law === 'elective' ? 'Heir: nobody has been chosen yet.' : 'Heir: none. Nobody living has a place in the line.');
  }

  if (succession.line.length) {
    lines.push('', 'Line of succession:');
    for (const place of succession.line) {
      const claim = claimText(tree, place, index);
      lines.push(`${place.place}. ${displayName(person(place.id))}${claim ? `, ${claim}` : ''}`);
    }
  }

  if (succession.excluded.length) {
    lines.push('', 'Left out:');
    for (const entry of succession.excluded) lines.push(`- ${displayName(person(entry.id))}: ${reasonText(tree, entry, index)}`);
  }
  return lines.join('\n');
}

/** How many generations the tree spans, by the longest line of descent. */
function generationCount(tree: Tree, index: TreeIndex): number {
  const depth = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const d = 1 + Math.max(0, ...index.children(id).map((kid) => visit(kid.id, trail)));
    trail.delete(id);
    depth.set(id, d);
    return d;
  };
  return Math.max(0, ...tree.people.map((p) => visit(p.id, new Set())));
}

/**
 * The tree in one paragraph: what a picture of it shows. Used as the picture's alternative text
 * and inside the downloaded file.
 */
export function describeTree(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const count = tree.people.length;
  if (!count) return 'An empty family tree.';
  const name = (id: string | undefined): string => displayName(id === undefined ? undefined : index.person.get(id));
  const generations = generationCount(tree, index);
  const parts = [
    `Family tree of ${tree.house ? withThe(tree.house) : 'a house'}${tree.realm ? `, ${tree.realm}` : ''}: ${count} ${count === 1 ? 'person' : 'people'} in ${generations} ${generations === 1 ? 'generation' : 'generations'}.`,
    `The law is ${lawNames[tree.law].toLowerCase()}.`,
  ];
  parts.push(succession.reigning === undefined ? 'Nobody reigns.' : `${name(succession.reigning)} reigns.`);
  if (succession.line.length) {
    const shown = succession.line.slice(0, 10).map((place) => name(place.id));
    const more = succession.line.length - shown.length;
    parts.push(
      succession.line.length === 1
        ? `The heir, and the whole line of succession, is ${shown[0]}.`
        : `The heir is ${shown[0]}. The line of succession: ${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''}.`,
    );
  } else {
    parts.push('There is no heir.');
  }
  return parts.join(' ');
}

/** One paragraph for the profile file, 600 characters at most. */
export function summarise(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const name = (id: string | undefined): string => displayName(id === undefined ? undefined : index.person.get(id));
  const house = tree.house ? withThe(tree.house) : 'The house';
  const subject = house.charAt(0).toUpperCase() + house.slice(1);
  const parts = [`${subject}${tree.realm ? ` reigns over ${realmWithThe(tree.realm)}` : ' reigns'} under ${lawNames[tree.law].toLowerCase()}.`];
  if (succession.reigning !== undefined) {
    const after = succession.line.slice(1, 3).map((place) => name(place.id));
    parts.push(
      succession.heir === undefined
        ? `${name(succession.reigning)} reigns, with no heir.`
        : `${name(succession.reigning)} reigns; the heir is ${name(succession.heir)}${after.length ? `, followed by ${sentenceList(after)}` : ''}.`,
    );
  } else if (succession.heir !== undefined) {
    parts.push(`The throne stands empty; first in line is ${name(succession.heir)}.`);
  }
  const text = parts.join(' ');
  return text.length <= 600 ? text : `${text.slice(0, 599).trimEnd()}…`;
}
