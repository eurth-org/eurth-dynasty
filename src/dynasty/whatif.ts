/**
 * What if: one person, one event, and what it does to the line. Nothing here changes the tree it
 * is given; it works on a copy and hands that back with the answer.
 */
import { cloneTree, displayName, indexTree, isDead, lawNames, laws, newId, type Law, type Tree } from './model';
import { lineOfSuccession, type Succession } from './succession';

export const eventKinds = ['dies', 'abdicates', 'renounces', 'marries-out'] as const;
export type EventKind = (typeof eventKinds)[number];

export interface WhatIfEvent {
  person: string;
  kind: EventKind;
}

/** "King Teomir II dies", for the list of choices. */
export const eventNames: Record<EventKind, string> = {
  dies: 'dies',
  abdicates: 'abdicates',
  renounces: 'renounces',
  'marries-out': 'marries out',
};

export interface Move {
  id: string;
  /** Place before and after; undefined for "not in the line". */
  before?: number;
  after?: number;
}

export interface OtherLaw {
  law: Law;
  /** Who would reign after the event under that law. */
  reigning?: string;
  heir?: string;
}

export interface WhatIf {
  event: WhatIfEvent;
  /** The tree after the event. */
  tree: Tree;
  before: Succession;
  after: Succession;
  /** The crown changes hands. */
  crownPasses: boolean;
  /** Everyone whose place changed, including those who entered or left the line. */
  moves: Move[];
  /** The laws under which someone else would reign (or, when the crown stays put, be heir). */
  otherLaws: OtherLaw[];
  /** The answer in a sentence: "Princess Ilsa succeeds King Teomir II." */
  headline: string;
  /** What else is worth saying, a sentence each. */
  details: string[];
}

/**
 * The tree after an event. The founder is pinned first, so the line is reckoned from the same
 * ancestor before and after.
 *
 * - dies: the person is dead. If they reigned, the heir reigns.
 * - abdicates: a reigning person gives up the throne and the heir reigns; their children keep
 *   their place. For anyone else it is a renunciation for themselves alone.
 * - renounces: the person gives up their place for themselves and their descendants. A reigning
 *   person who renounces also leaves the throne.
 * - marries out: the person makes a marriage the house does not recognise.
 */
export function applyEvent(tree: Tree, event: WhatIfEvent): Tree {
  const next = cloneTree(tree);
  const person = next.people.find((p) => p.id === event.person);
  if (!person) return next;
  const founder = lineOfSuccession(tree).founder;
  if (founder !== undefined) next.founder = founder;
  const reigned = next.reigning === person.id;

  switch (event.kind) {
    case 'dies':
      if (!isDead(person)) person.dead = true;
      break;
    case 'abdicates':
      if (reigned) person.abdicated = true;
      else if (!person.renounced) person.renounced = 'self';
      break;
    case 'renounces':
      person.renounced = 'line';
      if (reigned) person.abdicated = true;
      break;
    case 'marries-out': {
      const spouse = newId(
        'p',
        next.people.map((p) => p.id),
      );
      next.people.push({ id: spouse, name: `Spouse of ${person.name || 'Unnamed'}`, sex: 'x' });
      next.unions.push({
        id: newId(
          'u',
          next.unions.map((u) => u.id),
        ),
        a: person.id,
        b: spouse,
        out: true,
      });
      break;
    }
  }

  if (reigned && event.kind !== 'marries-out') {
    delete next.reigning;
    const heir = lineOfSuccession(next).heir;
    if (heir !== undefined) {
      next.reigning = heir;
      next.picks = next.picks.filter((id) => id !== heir);
    }
  }
  return next;
}

/** What an event does: who reigns, the new line, who moved, and how other laws would differ. */
export function whatIf(tree: Tree, event: WhatIfEvent): WhatIf {
  const index = indexTree(tree);
  const name = (id: string | undefined): string => displayName(id === undefined ? undefined : index.person.get(id));
  const before = lineOfSuccession(tree);
  const next = applyEvent(tree, event);
  const after = lineOfSuccession(next);
  const crownPasses = before.reigning !== after.reigning;

  const was = new Map(before.line.map((entry) => [entry.id, entry.place]));
  const is = new Map(after.line.map((entry) => [entry.id, entry.place]));
  const moves: Move[] = [];
  for (const id of new Set([...was.keys(), ...is.keys()])) {
    const b = was.get(id);
    const a = is.get(id);
    if (a !== b && index.person.has(id)) moves.push({ id, ...(b === undefined ? {} : { before: b }), ...(a === undefined ? {} : { after: a }) });
  }

  // Other laws are only worth a mention when the event settles something: who reigns, or who is heir.
  const settles = crownPasses || before.heir !== after.heir;
  const otherLaws: OtherLaw[] = [];
  for (const law of laws) {
    if (!settles || law === tree.law || law === 'elective' || tree.law === 'elective') continue;
    const other = lineOfSuccession(applyEvent({ ...tree, law }, event));
    const differs = crownPasses ? other.reigning !== after.reigning : other.heir !== after.heir;
    if (differs) otherLaws.push({ law, ...(other.reigning === undefined ? {} : { reigning: other.reigning }), ...(other.heir === undefined ? {} : { heir: other.heir }) });
  }

  const who = name(event.person);
  const details: string[] = [];
  let headline: string;
  if (!index.person.has(event.person)) {
    headline = 'Nothing changes.';
  } else if (crownPasses) {
    headline = after.reigning === undefined ? `${who} leaves no heir, and the throne stands empty.` : `${name(after.reigning)} succeeds ${who}.`;
    if (after.heir !== undefined) details.push(`The new heir is ${name(after.heir)}.`);
    else if (after.reigning !== undefined) details.push('There is no heir after that.');
  } else if (before.heir !== after.heir) {
    headline = after.heir === undefined ? 'The line is left empty: there is no heir.' : `${name(after.heir)} becomes the heir.`;
  } else if (moves.length) {
    const left = moves.filter((move) => move.after === undefined).length;
    headline = left ? `${left === 1 ? name(moves.find((move) => move.after === undefined)!.id) + ' leaves' : `${left} people leave`} the line; the heir is unchanged.` : 'The line changes below the heir.';
  } else {
    headline = 'Nothing changes.';
    if (event.kind === 'renounces' || (event.kind === 'abdicates' && before.reigning !== event.person)) {
      details.push(tree.exclude.renounced ? `${who} had no place in the line to give up.` : 'Your rules ignore renunciations, so nobody loses their place.');
    } else if (event.kind === 'marries-out') {
      details.push(
        before.reigning === event.person
          ? `${who} stays on the throne. Children of the new marriage would have no place${tree.exclude.out ? '' : ', if your rules counted marriages out'}.`
          : tree.exclude.out
            ? `${who} had no place in the line to lose.`
            : 'Your rules ignore marriages out, so nobody loses their place.',
      );
    } else if (event.kind === 'dies') {
      details.push(`${who} had no place in the line.`);
    }
  }

  if (event.kind === 'marries-out' && before.reigning === event.person && headline !== 'Nothing changes.') {
    details.push(`${who} stays on the throne.`);
  }

  for (const other of otherLaws) {
    const lawName = lawNames[other.law].toLowerCase();
    if (crownPasses) {
      details.push(other.reigning === undefined ? `Under ${lawName}, nobody would be left to reign.` : `Under ${lawName}, ${name(other.reigning)} would reign instead.`);
    } else {
      details.push(other.heir === undefined ? `Under ${lawName}, there would be no heir.` : `Under ${lawName}, the heir would be ${name(other.heir)}.`);
    }
  }

  return { event, tree: next, before, after, crownPasses, moves, otherLaws, headline, details };
}

/** Everyone an event can happen to: the living. The reigning person comes first. */
export function eventPeople(tree: Tree): string[] {
  const living = tree.people.filter((p) => !isDead(p)).map((p) => p.id);
  return tree.reigning !== undefined && living.includes(tree.reigning) ? [tree.reigning, ...living.filter((id) => id !== tree.reigning)] : living;
}

/** "King Teomir II dies", "Prince Vanko marries out". */
export function eventLabel(tree: Tree, event: WhatIfEvent): string {
  return `${displayName(tree.people.find((p) => p.id === event.person))} ${eventNames[event.kind]}`;
}
