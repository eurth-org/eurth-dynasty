/**
 * Changing a tree: every button in the tool comes down to one of these. Each takes a tree and
 * gives back a new one, cleaned, and leaves the old one as it was, which is what makes undo a
 * matter of keeping the old one.
 */
import { cleanTree, cloneTree, emptyTree, indexTree, newId, type Person, type Tree, type Union } from './model';

export interface Added {
  tree: Tree;
  /** The id of what was added. */
  id: string;
}

const personIds = (tree: Tree): string[] => tree.people.map((p) => p.id);
const unionIds = (tree: Tree): string[] => tree.unions.map((u) => u.id);

/** A tree to begin from: one person, on the throne. */
export function startTree(): Tree {
  return cleanTree({ ...emptyTree(), people: [{ id: 'p1', name: 'First of the line', sex: 'x' }], reigning: 'p1' });
}

/** Adds a person joined to nobody. */
export function addPerson(tree: Tree, person: Partial<Omit<Person, 'id'>> = {}): Added {
  const id = newId('p', personIds(tree));
  const next = cloneTree(tree);
  next.people.push({ name: 'New person', sex: 'x', ...person, id });
  return { tree: cleanTree(next), id };
}

/** Changes a person's own details. Parents are changed with setParents. */
export function updatePerson(tree: Tree, id: string, changes: Partial<Omit<Person, 'id' | 'union' | 'parent'>>): Tree {
  const next = cloneTree(tree);
  const at = next.people.findIndex((p) => p.id === id);
  if (at < 0) return tree;
  const person: Record<string, unknown> = { ...next.people[at], ...changes };
  // An emptied field is a field taken away.
  for (const key of Object.keys(person)) if (person[key] === '' || person[key] === false || person[key] === undefined) delete person[key];
  if (person.died) delete person.dead;
  next.people[at] = person as unknown as Person;
  return cleanTree(next);
}

/**
 * Removes a person, their marriages with them, and every mention of them. Their children stay,
 * as children of the other parent where there is one.
 */
export function removePerson(tree: Tree, id: string): Tree {
  if (!tree.people.some((p) => p.id === id)) return tree;
  const next = cloneTree(tree);
  const gone = next.unions.filter((u) => u.a === id || u.b === id);
  for (const u of gone) {
    const other = u.a === id ? u.b : u.a;
    for (const p of next.people) {
      if (p.union === u.id) {
        delete p.union;
        p.parent = other;
      }
    }
  }
  next.unions = next.unions.filter((u) => !gone.includes(u));
  next.people = next.people.filter((p) => p.id !== id);
  for (const p of next.people) if (p.parent === id) delete p.parent;
  return cleanTree(next);
}

/** Says who a person's parents are: a marriage, one known parent, or nobody in the tree. */
export function setParents(tree: Tree, id: string, parents: { union: string } | { parent: string } | null): Tree {
  const next = cloneTree(tree);
  const person = next.people.find((p) => p.id === id);
  if (!person) return tree;
  delete person.union;
  delete person.parent;
  if (parents && 'union' in parents) person.union = parents.union;
  else if (parents) person.parent = parents.parent;
  return cleanTree(next);
}

/**
 * Adds a child. With a marriage named, or when the parent has exactly one, the child is of that
 * marriage; otherwise the parent is the one known parent.
 */
export function addChild(tree: Tree, parentId: string, unionId?: string): Added {
  const index = indexTree(tree);
  if (!index.person.has(parentId)) return { tree, id: '' };
  const mine = index.unions(parentId);
  const union = unionId !== undefined ? mine.find((u) => u.id === unionId) : mine.length === 1 ? mine[0] : undefined;
  return addPerson(tree, { name: 'New child', ...(union ? { union: union.id } : { parent: parentId }) });
}

/** Adds a new person and marries them to this one. */
export function addSpouse(tree: Tree, id: string): Added & { union: string } {
  if (!tree.people.some((p) => p.id === id)) return { tree, id: '', union: '' };
  const added = addPerson(tree, { name: 'New spouse' });
  const union = newId('u', unionIds(tree));
  const next = cloneTree(added.tree);
  next.unions.push({ id: union, a: id, b: added.id });
  return { tree: cleanTree(next), id: added.id, union };
}

/** Marries two people already in the tree. Nothing happens if they are the same person. */
export function marry(tree: Tree, a: string, b: string, details: Partial<Omit<Union, 'id' | 'a' | 'b'>> = {}): Added {
  const ids = new Set(personIds(tree));
  if (a === b || !ids.has(a) || !ids.has(b)) return { tree, id: '' };
  const id = newId('u', unionIds(tree));
  const next = cloneTree(tree);
  next.unions.push({ ...details, id, a, b });
  return { tree: cleanTree(next), id };
}

/** Changes a marriage's dates or whether the house recognises it. */
export function updateUnion(tree: Tree, id: string, changes: Partial<Omit<Union, 'id' | 'a' | 'b'>>): Tree {
  const next = cloneTree(tree);
  const at = next.unions.findIndex((u) => u.id === id);
  if (at < 0) return tree;
  const union: Record<string, unknown> = { ...next.unions[at], ...changes };
  for (const key of Object.keys(union)) if (union[key] === '' || union[key] === false || union[key] === undefined) delete union[key];
  next.unions[at] = union as unknown as Union;
  return cleanTree(next);
}

/** Removes a marriage. Its children stay, as children of the first partner. */
export function removeUnion(tree: Tree, id: string): Tree {
  const union = tree.unions.find((u) => u.id === id);
  if (!union) return tree;
  const next = cloneTree(tree);
  for (const p of next.people) {
    if (p.union === id) {
      delete p.union;
      p.parent = union.a;
    }
  }
  next.unions = next.unions.filter((u) => u.id !== id);
  return cleanTree(next);
}

/** Under an elective law: adds a candidate to the end of the list. */
export function addPick(tree: Tree, id: string): Tree {
  if (tree.picks.includes(id) || !tree.people.some((p) => p.id === id)) return tree;
  return cleanTree({ ...cloneTree(tree), picks: [...tree.picks, id] });
}

export function removePick(tree: Tree, id: string): Tree {
  return tree.picks.includes(id) ? cleanTree({ ...cloneTree(tree), picks: tree.picks.filter((pick) => pick !== id) }) : tree;
}

/** Moves a candidate one place up (-1) or down (1) the list. */
export function movePick(tree: Tree, id: string, by: -1 | 1): Tree {
  const at = tree.picks.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= tree.picks.length) return tree;
  const picks = [...tree.picks];
  [picks[at], picks[to]] = [picks[to]!, picks[at]!];
  return cleanTree({ ...cloneTree(tree), picks });
}

/** Changes the house, the realm, the law, the rules, who reigns or who the line descends from. */
export function updateHouse(tree: Tree, changes: Partial<Pick<Tree, 'house' | 'realm' | 'law' | 'reigning' | 'founder'>> & { exclude?: Partial<Tree['exclude']> }): Tree {
  const next: Record<string, unknown> = { ...cloneTree(tree), ...changes, exclude: { ...tree.exclude, ...changes.exclude } };
  for (const key of ['realm', 'reigning', 'founder']) if (next[key] === '' || next[key] === undefined) delete next[key];
  return cleanTree(next);
}
