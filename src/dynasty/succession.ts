/**
 * Who inherits. One pure function from a tree to its line of succession: the same tree always
 * gives the same line, and nothing here touches the page.
 *
 * The line descends from a founder. The engine walks the founder's descendants in the order the
 * law gives, and each living person who isn't shut out takes the next place. The dead are passed
 * over, but their children keep the place their parent would have had: that is what
 * "representation" means, and every hereditary law here uses it.
 */
import { ancestorsOf, descendantsOf, displayName, indexTree, isDead, type Law, type Person, type Tree, type TreeIndex } from './model';

/** Why someone descended from the founder has no place in the line. */
export type Why =
  | 'abdicated'
  | 'renounced'
  | 'married-out'
  | 'born-out'
  | 'illegitimate'
  | 'adopted'
  | 'female'
  | 'sex-unknown';

export interface Excluded {
  id: string;
  why: Why;
  /**
   * The ancestor whose own exclusion cut this person's line. Absent when the reason is the
   * person's own.
   */
  through?: string;
}

export interface Place {
  id: string;
  /** 1 for the heir. */
  place: number;
  /** The parent the claim comes through. Absent for the founder and under an elective law. */
  via?: string;
  /** Generations below the founder. */
  generation: number;
}

export interface Succession {
  law: Law;
  /** The ancestor the line descends from. */
  founder?: string;
  reigning?: string;
  /** First in line: the person who would reign next. */
  heir?: string;
  line: Place[];
  /** Living descendants of the founder with no place, and why. */
  excluded: Excluded[];
  /** Under an elective law: everyone who could be picked. */
  candidates: string[];
}

interface Cut {
  why: Why;
  /** The person at whom the line was cut. */
  at: string;
}

const agnatic = (law: Law): boolean => law === 'agnatic' || law === 'seniority';

/**
 * The founder when none is set: the reigning person's most distant ancestor in the tree (the one
 * who reigned, then a man under the agnatic laws, then whoever was added first). With no reigning
 * person, the parentless person with the most descendants.
 */
export function defaultFounder(tree: Tree, index: TreeIndex = indexTree(tree)): string | undefined {
  if (tree.reigning !== undefined && index.person.has(tree.reigning)) {
    const depth = new Map<string, number>([[tree.reigning, 0]]);
    let layer = [tree.reigning];
    for (let d = 1; layer.length; d++) {
      const next: string[] = [];
      for (const id of layer) {
        for (const parent of index.parents(id)) {
          if (depth.has(parent)) continue;
          depth.set(parent, d);
          next.push(parent);
        }
      }
      layer = next;
    }
    const roots = [...depth.keys()].filter((id) => index.parents(id).length === 0);
    const score = (id: string): number[] => {
      const p = index.person.get(id)!;
      return [depth.get(id) ?? 0, p.reignFrom !== undefined ? 1 : 0, agnatic(tree.law) && p.sex === 'm' ? 1 : 0, -(index.position.get(id) ?? 0)];
    };
    return roots.sort((x, y) => compare(score(y), score(x)))[0] ?? tree.reigning;
  }
  let best: string | undefined;
  let most = -1;
  for (const p of tree.people) {
    if (index.parents(p.id).length) continue;
    const count = descendantsOf(index, p.id).length;
    if (count > most) {
      most = count;
      best = p.id;
    }
  }
  return best ?? tree.people[0]?.id;
}

const compare = (x: number[], y: number[]): number => {
  for (let i = 0; i < x.length; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
};

/** The children of a person in the order the law looks at them. */
function inOrder(index: TreeIndex, parent: string, law: Law): Person[] {
  const children = index.children(parent);
  if (law === 'absolute' || law === 'elective') return children;
  // Sons first. Under the agnatic laws the daughters are still walked, to say why they have no place.
  return [...children.filter((c) => c.sex === 'm'), ...children.filter((c) => c.sex !== 'm')];
}

/**
 * The line of succession under the tree's own law and rules.
 * @param tree a clean tree (see cleanTree)
 */
export function lineOfSuccession(tree: Tree): Succession {
  const index = indexTree(tree);
  const reigning = tree.reigning !== undefined && index.person.has(tree.reigning) ? tree.reigning : undefined;
  const founder = tree.founder !== undefined && index.person.has(tree.founder) ? tree.founder : defaultFounder(tree, index);
  const base = { law: tree.law, ...(founder === undefined ? {} : { founder }), ...(reigning === undefined ? {} : { reigning }) };

  if (tree.law === 'elective') return { ...base, ...elective(tree, index, reigning) };
  if (founder === undefined) return { ...base, line: [], excluded: [], candidates: [] };

  const ex = tree.exclude;
  const male = agnatic(tree.law);
  const placed: Place[] = [];
  const reasons = new Map<string, Excluded>();
  const open = new Set<string>();
  const shut = new Set<string>();

  /** What, in the person's own record, takes them out, whatever their descent. */
  const own = (p: Person): Why | undefined => {
    if (p.abdicated) return 'abdicated';
    if (ex.renounced && p.renounced) return 'renounced';
    if (ex.out && index.unions(p.id).some((u) => u.out)) return 'married-out';
    if (male && p.sex === 'f') return 'female';
    if (male && p.sex !== 'm') return 'sex-unknown';
    return undefined;
  };

  /** What in the way a child was born or brought into the family cuts the child and their line. */
  const birth = (p: Person): Why | undefined => {
    if (ex.illegitimate && p.illegitimate) return 'illegitimate';
    if (ex.adopted && p.adopted) return 'adopted';
    if (ex.out && p.union !== undefined && index.union.get(p.union)?.out) return 'born-out';
    return undefined;
  };

  /** Whether a person's own exclusion also binds their descendants. */
  const bindsLine = (p: Person): Why | undefined => {
    if (ex.renounced && p.renounced === 'line') return 'renounced';
    if (male && p.sex === 'f') return 'female';
    if (male && p.sex !== 'm') return 'sex-unknown';
    return undefined;
  };

  // Each person is walked at most once with an open path and once with a cut one, so the walk
  // ends even when someone is their own ancestor. A person reached twice (their parents were
  // cousins, say) keeps the first open place they come to.
  const walk = (p: Person, via: string | undefined, generation: number, inherited: Cut | undefined): void => {
    const bornCut = via === undefined ? undefined : birth(p);
    const cut: Cut | undefined = inherited ?? (bornCut ? { why: bornCut, at: p.id } : undefined);
    if (cut) {
      if (open.has(p.id) || shut.has(p.id)) return;
      shut.add(p.id);
    } else {
      if (open.has(p.id)) return;
      open.add(p.id);
    }

    const mine = own(p);
    if (!isDead(p) && p.id !== reigning) {
      if (!cut && !mine) {
        reasons.delete(p.id);
        placed.push({ id: p.id, place: 0, generation, ...(via === undefined ? {} : { via }) });
      } else if (mine) {
        // Their own reason says more than an ancestor's.
        reasons.set(p.id, { id: p.id, why: mine });
      } else if (cut && !reasons.has(p.id)) {
        reasons.set(p.id, cut.at === p.id ? { id: p.id, why: cut.why } : { id: p.id, why: cut.why, through: cut.at });
      }
    }

    const binds = bindsLine(p);
    const below: Cut | undefined = cut ?? (binds ? { why: binds, at: p.id } : undefined);
    for (const child of inOrder(index, p.id, tree.law)) walk(child, p.id, generation + 1, below);
  };

  const first = index.person.get(founder);
  if (first) walk(first, undefined, 0, undefined);

  // Under seniority the whole older generation comes before the younger one: brothers before
  // sons, uncles before nephews. Within a generation the elder line keeps its lead.
  const ordered = tree.law === 'seniority' ? [...placed].sort((x, y) => x.generation - y.generation) : placed;
  const line = ordered.map((entry, i) => ({ ...entry, place: i + 1 }));
  const inLine = new Set(line.map((entry) => entry.id));
  const excluded = [...reasons.values()].filter((entry) => !inLine.has(entry.id));
  return { ...base, line, excluded, candidates: [], ...(line[0] ? { heir: line[0].id } : {}) };
}

/** Under an elective law nobody inherits: the line is the user's own picks, in their order. */
function elective(tree: Tree, index: TreeIndex, reigning: string | undefined): Pick<Succession, 'line' | 'excluded' | 'candidates' | 'heir'> {
  const eligible = (p: Person): boolean =>
    !isDead(p) && p.id !== reigning && !p.abdicated && !(tree.exclude.renounced && p.renounced !== undefined);
  const candidates = tree.people.filter(eligible).map((p) => p.id);
  const can = new Set(candidates);
  const picks = tree.picks.filter((id) => can.has(id));
  const line = picks.map((id, i) => ({ id, place: i + 1, generation: 0 }));
  // Only those who can't be picked are listed as left out; not being picked is no exclusion.
  const excluded: Excluded[] = tree.people
    .filter((p) => !isDead(p) && p.id !== reigning && !can.has(p.id))
    .map((p) => ({ id: p.id, why: p.abdicated ? 'abdicated' : 'renounced' }));
  return { line, excluded, candidates, ...(line[0] ? { heir: line[0].id } : {}) };
}

/** The same tree under another law, with everything else as it is. */
export const underLaw = (tree: Tree, law: Law): Succession => lineOfSuccession({ ...tree, law });

/** A person's place in the line, or undefined when they have none. */
export const placeOf = (succession: Succession, id: string): number | undefined => succession.line.find((entry) => entry.id === id)?.place;

/**
 * Why a person has no place, in words. "They" throughout: the tree doesn't always know a
 * person's sex, and the sentence should read the same either way.
 */
export function reasonText(tree: Tree, excluded: Excluded, index: TreeIndex = indexTree(tree)): string {
  const through = excluded.through === undefined ? undefined : displayName(index.person.get(excluded.through));
  switch (excluded.why) {
    case 'abdicated':
      return 'gave up the throne';
    case 'renounced':
      return through ? `descends from ${through}, who renounced for the whole line` : 'renounced their place';
    case 'married-out':
      return 'married out of the house';
    case 'born-out':
      return through ? `descends from ${through}, born of a marriage the house does not recognise` : 'born of a marriage the house does not recognise';
    case 'illegitimate':
      return through ? `descends from ${through}, who was born outside marriage` : 'born outside marriage';
    case 'adopted':
      return through ? `descends from ${through}, who was adopted` : 'adopted, not born to the house';
    case 'female':
      return through ? `descends through a woman, ${through}` : 'the law passes over women';
    case 'sex-unknown':
      return through ? `descends through ${through}, whose sex is not stated` : 'sex not stated, and this law needs it';
  }
}

/** How a person in the line is related to the one their claim comes through. */
export function claimText(tree: Tree, place: Place, index: TreeIndex = indexTree(tree)): string {
  const person = index.person.get(place.id);
  if (!person) return '';
  if (tree.law === 'elective') return place.place === 1 ? 'first choice' : `choice ${place.place}`;
  if (place.via === undefined) return 'founder of the line';
  const word = person.sex === 'm' ? 'son' : person.sex === 'f' ? 'daughter' : 'child';
  return `${word} of ${displayName(index.person.get(place.via))}`;
}

/** Whether a person descends from the founder at all, by any path. Spouses who married in do not. */
export function ofTheBlood(tree: Tree, succession: Succession, id: string, index: TreeIndex = indexTree(tree)): boolean {
  return succession.founder !== undefined && (id === succession.founder || ancestorsOf(index, id).includes(succession.founder));
}
