/**
 * Things worth a gentle word: dates that can't be, a reigning person who has died, a person who
 * is their own ancestor. None of them stops the tool; a story is allowed its oddities.
 */
import { ancestorsOf, dateParts, descendantsOf, displayName, indexTree, isDead, type Tree, type TreeIndex } from './model';
import { lineOfSuccession } from './succession';

export type NoteCode =
  | 'own-ancestor'
  | 'born-before-parent'
  | 'born-after-parent-died'
  | 'died-before-born'
  | 'married-before-born'
  | 'married-after-death'
  | 'reign-backwards'
  | 'reigning-dead'
  | 'no-reigning'
  | 'no-heir'
  | 'no-picks'
  | 'sex-needed';

export interface Note {
  code: NoteCode;
  /** "problem": the record contradicts itself. "hint": something is missing that the tool could use. */
  kind: 'problem' | 'hint';
  /** The people the note is about, to select them from it. */
  people: string[];
  text: string;
}

/** The easter egg's line, for a person who is their own grandparent. */
export const GRANDPARENT_TOAST = 'That’s a song, not a succession.';

/** Everyone who is their own ancestor by birth or adoption. */
export function ownAncestors(tree: Tree, index: TreeIndex = indexTree(tree)): string[] {
  return tree.people.filter((p) => index.parents(p.id).some((parent) => parent === p.id || ancestorsOf(index, parent).includes(p.id))).map((p) => p.id);
}

/**
 * Everyone who is their own grandparent: by blood (a parent's parent), or by marriage, the way
 * the song has it (the narrator marries a widow, whose daughter marries his father).
 * A step-parent counts as a parent here, which is the whole joke.
 */
export function ownGrandparents(tree: Tree, index: TreeIndex = indexTree(tree)): string[] {
  const parentsAndSteps = (id: string): Set<string> => {
    const found = new Set<string>();
    for (const parent of index.parents(id)) {
      found.add(parent);
      for (const u of index.unions(parent)) found.add(index.partner(u, parent));
    }
    return found;
  };
  return tree.people
    .filter((p) => {
      for (const parent of parentsAndSteps(p.id)) {
        if (parent !== p.id && parentsAndSteps(parent).has(p.id)) return true;
      }
      return false;
    })
    .map((p) => p.id);
}

const year = (date: string | undefined): number | undefined => dateParts(date)?.year;

/** Everything worth pointing out about a tree, problems first. */
export function checkTree(tree: Tree): Note[] {
  const index = indexTree(tree);
  const name = (id: string): string => displayName(index.person.get(id));
  const problems: Note[] = [];
  const hints: Note[] = [];

  for (const id of ownAncestors(tree, index)) {
    problems.push({ code: 'own-ancestor', kind: 'problem', people: [id], text: `${name(id)} is their own ancestor. The line stops where the circle closes.` });
  }

  for (const p of tree.people) {
    const born = year(p.born);
    const died = year(p.died);
    if (born !== undefined && died !== undefined && died < born) {
      problems.push({ code: 'died-before-born', kind: 'problem', people: [p.id], text: `${name(p.id)} dies before being born.` });
    }
    const from = year(p.reignFrom);
    const to = year(p.reignTo);
    if (from !== undefined && to !== undefined && to < from) {
      problems.push({ code: 'reign-backwards', kind: 'problem', people: [p.id], text: `${name(p.id)}’s reign ends before it begins.` });
    }
    if (born === undefined) continue;
    for (const parentId of index.parents(p.id)) {
      const parent = index.person.get(parentId);
      if (!parent || p.adopted) continue;
      const parentBorn = year(parent.born);
      const parentDied = year(parent.died);
      if (parentBorn !== undefined && born <= parentBorn) {
        problems.push({ code: 'born-before-parent', kind: 'problem', people: [p.id, parentId], text: `${name(p.id)} is born before their parent ${name(parentId)}.` });
      } else if (parentDied !== undefined && born > parentDied + (parent.sex === 'f' ? 0 : 1)) {
        problems.push({
          code: 'born-after-parent-died',
          kind: 'problem',
          people: [p.id, parentId],
          text: `${name(p.id)} is born after their parent ${name(parentId)} has died.`,
        });
      }
    }
  }

  for (const u of tree.unions) {
    const married = year(u.married);
    if (married === undefined) continue;
    for (const id of [u.a, u.b]) {
      const p = index.person.get(id);
      const born = year(p?.born);
      const died = year(p?.died);
      if (born !== undefined && married < born) {
        problems.push({ code: 'married-before-born', kind: 'problem', people: [id], text: `${name(id)} marries before being born.` });
      } else if (died !== undefined && married > died) {
        problems.push({ code: 'married-after-death', kind: 'problem', people: [id], text: `${name(id)} marries after dying.` });
      }
    }
  }

  const reigning = tree.reigning === undefined ? undefined : index.person.get(tree.reigning);
  if (reigning && isDead(reigning)) {
    problems.push({ code: 'reigning-dead', kind: 'problem', people: [reigning.id], text: `${name(reigning.id)} reigns, but is recorded as dead.` });
  }

  if (tree.people.length) {
    const succession = lineOfSuccession(tree);
    if (!reigning) hints.push({ code: 'no-reigning', kind: 'hint', people: [], text: 'Nobody reigns yet. Pick the person on the throne.' });
    if (tree.law === 'elective' && !tree.picks.length) {
      hints.push({ code: 'no-picks', kind: 'hint', people: [], text: 'Nobody has been chosen yet. Under an elective law, you pick the candidates.' });
    } else if (succession.heir === undefined) {
      hints.push({ code: 'no-heir', kind: 'hint', people: [], text: 'There is no heir: nobody living has a place in the line.' });
    }
    if (tree.law !== 'absolute' && tree.law !== 'elective' && succession.founder !== undefined) {
      const unknown = [succession.founder, ...descendantsOf(index, succession.founder)].filter((id) => {
        const p = index.person.get(id);
        return p !== undefined && p.sex === 'x' && !isDead(p);
      });
      if (unknown.length) {
        hints.push({
          code: 'sex-needed',
          kind: 'hint',
          people: unknown,
          text: `This law tells sons from daughters, and ${unknown.length === 1 ? `${name(unknown[0]!)} has` : `${unknown.length} people have`} no sex stated.`,
        });
      }
    }
  }

  return [...problems, ...hints];
}
