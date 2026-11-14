import { describe, expect, it } from 'vitest';
import { examples, halvard, lesnia, makeTree, person, union, varenko } from '../src/dynasty/examples';
import { cleanTree } from '../src/dynasty/model';
import { checkTree, GRANDPARENT_TOAST, ownAncestors, ownGrandparents } from '../src/dynasty/validate';
import { applyEvent, eventKinds, eventLabel, eventPeople, whatIf } from '../src/dynasty/whatif';

const ids = (line: { id: string }[]) => line.map((entry) => entry.id);

describe('what if, on the House of Varenko', () => {
  it('the king dies: his eldest child reigns, and the other laws disagree', () => {
    const tree = varenko();
    const result = whatIf(tree, { person: 'teomir2', kind: 'dies' });
    expect(result.crownPasses).toBe(true);
    expect(result.tree.reigning).toBe('ilsa');
    expect(result.after.heir).toBe('maelin');
    expect(result.headline).toBe('Princess Ilsa succeeds King Teomir II.');
    expect(result.details).toEqual([
      'The new heir is Maelin.',
      'Under male-preference primogeniture, Prince Vanko would reign instead.',
      'Under agnatic primogeniture, Prince Vanko would reign instead.',
      'Under agnatic seniority, Prince Radan would reign instead.',
    ]);
    expect(ids(result.after.line)).toEqual(['maelin', 'teo', 'vanko', 'aris', 'kosti', 'dobra', 'milan', 'radan', 'luka', 'neda']);
    // The tree that was asked about is left as it was.
    expect(tree).toEqual(varenko());
  });

  it('the king abdicates: the same heir reigns, and he takes no place in the line', () => {
    const result = whatIf(varenko(), { person: 'teomir2', kind: 'abdicates' });
    expect(result.tree.reigning).toBe('ilsa');
    expect(result.tree.people.find((p) => p.id === 'teomir2')!.abdicated).toBe(true);
    expect(ids(result.after.line)).not.toContain('teomir2');
    expect(result.headline).toBe('Princess Ilsa succeeds King Teomir II.');
  });

  it('the king renounces for his line: the crown leaves his branch', () => {
    const result = whatIf(varenko(), { person: 'teomir2', kind: 'renounces' });
    expect(result.tree.reigning).toBe('dobra');
    expect(result.headline).toBe('Princess Dobra succeeds King Teomir II.');
    expect(ids(result.after.line)).toEqual(['milan', 'radan', 'luka', 'neda']);
  });

  it('the heir steps aside for herself: her children move up', () => {
    const result = whatIf(varenko(), { person: 'ilsa', kind: 'abdicates' });
    expect(result.crownPasses).toBe(false);
    expect(result.tree.reigning).toBe('teomir2');
    expect(result.headline).toBe('Maelin becomes the heir.');
    expect(ids(result.after.line).slice(0, 3)).toEqual(['maelin', 'teo', 'vanko']);
    expect(result.details).toContain('Under male-preference primogeniture, the heir would be Prince Vanko.');
  });

  it('the heir renounces: she and her children leave the line', () => {
    const result = whatIf(varenko(), { person: 'ilsa', kind: 'renounces' });
    expect(result.headline).toBe('Prince Vanko becomes the heir.');
    expect(result.moves.filter((move) => move.after === undefined).map((move) => move.id)).toEqual(['ilsa', 'maelin', 'teo']);
    expect(result.moves.find((move) => move.id === 'vanko')).toEqual({ id: 'vanko', before: 4, after: 1 });
  });

  it('a prince marries out: he leaves the line, his existing child stays', () => {
    const result = whatIf(varenko(), { person: 'vanko', kind: 'marries-out' });
    expect(result.headline).toBe('Prince Vanko leaves the line; the heir is unchanged.');
    expect(ids(result.after.line)).toEqual(['ilsa', 'maelin', 'teo', 'aris', 'kosti', 'dobra', 'milan', 'radan', 'luka', 'neda']);
    expect(result.tree.people).toHaveLength(varenko().people.length + 1);
    expect(result.tree.people.at(-1)!.name).toBe('Spouse of Vanko');
    expect(result.tree.unions.at(-1)).toMatchObject({ a: 'vanko', out: true });
    expect(cleanTree(result.tree)).toEqual(result.tree);
  });

  it('someone far down the line dies: the heir is unchanged', () => {
    const result = whatIf(varenko(), { person: 'kosti', kind: 'dies' });
    expect(result.headline).toBe('Prince Kosti leaves the line; the heir is unchanged.');
    expect(result.moves.find((move) => move.id === 'dobra')).toEqual({ id: 'dobra', before: 7, after: 6 });
  });

  it('says so when nothing changes, and why', () => {
    expect(whatIf(varenko(), { person: 'ressa', kind: 'dies' })).toMatchObject({ headline: 'Nothing changes.', details: ['Queen Ressa had no place in the line.'] });
    expect(whatIf(varenko(), { person: 'ressa', kind: 'renounces' }).details).toEqual(['Queen Ressa had no place in the line to give up.']);
    expect(whatIf(varenko(), { person: 'teomir2', kind: 'marries-out' })).toMatchObject({
      headline: 'Nothing changes.',
      details: ['King Teomir II stays on the throne. Children of the new marriage would have no place.'],
    });
    expect(whatIf(varenko(), { person: 'nobody', kind: 'dies' }).headline).toBe('Nothing changes.');
  });

  it('respects the rules that are switched off', () => {
    const tree = varenko();
    tree.exclude.renounced = false;
    tree.exclude.out = false;
    expect(whatIf(tree, { person: 'ilsa', kind: 'renounces' })).toMatchObject({
      headline: 'Nothing changes.',
      details: ['Your rules ignore renunciations, so nobody loses their place.'],
    });
    expect(whatIf(tree, { person: 'vanko', kind: 'marries-out' }).details).toEqual(['Your rules ignore marriages out, so nobody loses their place.']);
  });

  it('keeps reckoning from the same founder when none was set', () => {
    const tree = varenko();
    delete tree.founder;
    const result = whatIf(tree, { person: 'teomir2', kind: 'dies' });
    expect(result.after.founder).toBe('teomir1');
    expect(result.tree.reigning).toBe('ilsa');
  });
});

describe('what if, elsewhere', () => {
  it('an elected king dies: the first choice reigns and leaves the list', () => {
    const result = whatIf(lesnia(), { person: 'bogdan', kind: 'dies' });
    expect(result.tree.reigning).toBe('jarek');
    expect(result.tree.picks).toEqual(['wit', 'kasimir']);
    expect(result.headline).toBe('Hetman Jarek Ostrow succeeds King Bogdan.');
    expect(result.details).toEqual(['The new heir is Prince Wit.']);
  });

  it('the last of a line dies: the throne stands empty', () => {
    const tree = makeTree({ house: 'House of One', reigning: 'a', people: [person('a', 'Queen', 'Una', 'f', '1950')] });
    const result = whatIf(tree, { person: 'a', kind: 'dies' });
    expect(result.tree.reigning).toBeUndefined();
    expect(result.headline).toBe('Queen Una leaves no heir, and the throne stands empty.');
  });

  it('lists the living, the reigning person first', () => {
    const people = eventPeople(varenko());
    expect(people[0]).toBe('teomir2');
    expect(people).not.toContain('teomir1');
    expect(people).not.toContain('halina');
    expect(people).toHaveLength(17);
    expect(eventLabel(varenko(), { person: 'vanko', kind: 'marries-out' })).toBe('Prince Vanko marries out');
  });

  it('answers every event for every living person in every example without tripping', () => {
    for (const example of examples) {
      for (const id of eventPeople(example.tree)) {
        for (const kind of eventKinds) {
          const result = whatIf(example.tree, { person: id, kind });
          expect(result.headline.length, `${example.id} ${id} ${kind}`).toBeGreaterThan(5);
          expect(cleanTree(result.tree), `${example.id} ${id} ${kind}`).toEqual(result.tree);
        }
      }
    }
  });

  it('applyEvent on someone already dead changes nothing about them', () => {
    const after = applyEvent(varenko(), { person: 'teomir1', kind: 'dies' });
    expect(after.people.find((p) => p.id === 'teomir1')).toEqual(varenko().people.find((p) => p.id === 'teomir1'));
  });
});

describe('checks', () => {
  it('finds nothing to say about the examples', () => {
    for (const example of examples) expect(checkTree(example.tree), example.id).toEqual([]);
  });

  it('says nothing about an empty tree', () => {
    expect(checkTree(cleanTree({}))).toEqual([]);
  });

  it('notices dates that cannot be', () => {
    const tree = makeTree({
      house: 'House of Muddle',
      reigning: 'a',
      people: [
        person('a', '', 'Ada', 'f', '1950', { died: '1940', reignFrom: '1980', reignTo: '1970' }),
        person('b', '', 'Bo', 'm', '1945', { parent: 'a' }),
        person('c', '', 'Cy', 'm', '1900', { died: '1960' }),
        person('d', '', 'Di', 'f', '1965', { union: 'u1' }),
        person('e', '', 'Em', 'f', '1930', { died: '1950' }),
        person('f', '', 'Flo', 'f', '1951', { parent: 'c' }),
        person('g', '', 'Gus', 'm', '1962', { parent: 'c', adopted: true }),
      ],
      unions: [union('u1', 'c', 'e', '1890'), union('u2', 'c', 'a', '1961')],
    });
    const codes = checkTree(tree).map((note) => `${note.code}:${note.people.join('+')}`);
    expect(codes).toEqual([
      'died-before-born:a',
      'reign-backwards:a',
      'born-before-parent:b+a',
      'born-after-parent-died:d+c',
      'born-after-parent-died:d+e',
      'married-before-born:c',
      'married-before-born:e',
      'married-after-death:c',
      'married-after-death:a',
      'reigning-dead:a',
    ]);
    expect(checkTree(tree)[0]!.text).toBe('Ada dies before being born.');
  });

  it('allows a child born within a year of the father’s death, but not the mother’s', () => {
    const tree = makeTree({
      house: 'House of Late',
      people: [
        person('f', '', 'Father', 'm', '1900', { died: '1930' }),
        person('m', '', 'Mother', 'f', '1900', { died: '1931' }),
        person('c', '', 'Child', 'x', '1931', { union: 'u1' }),
      ],
      unions: [union('u1', 'f', 'm')],
      reigning: 'c',
    });
    expect(checkTree(tree).filter((note) => note.kind === 'problem')).toEqual([]);
    tree.people.find((p) => p.id === 'c')!.born = '1932';
    expect(checkTree(tree).map((note) => `${note.code}:${note.people.join('+')}`)).toEqual(['born-after-parent-died:c+f', 'born-after-parent-died:c+m', 'no-heir:']);
  });

  it('gives hints for what is missing', () => {
    const tree = varenko('agnatic');
    delete tree.reigning;
    tree.people.find((p) => p.id === 'aris')!.sex = 'x';
    const notes = checkTree(tree);
    expect(notes.map((note) => note.code)).toEqual(['no-reigning', 'sex-needed']);
    expect(notes[1]!.text).toBe('This law tells sons from daughters, and Aris has no sex stated.');
    expect(notes.every((note) => note.kind === 'hint')).toBe(true);

    const elective = lesnia();
    elective.picks = [];
    expect(checkTree(elective).map((note) => note.code)).toEqual(['no-picks']);

    const alone = makeTree({ house: 'House of One', reigning: 'a', people: [person('a', '', 'Una', 'f')] });
    expect(checkTree(alone).map((note) => note.code)).toEqual(['no-heir']);
  });
});

describe('the easter egg', () => {
  it('finds a person who is their own ancestor', () => {
    const tree = makeTree({
      house: 'House of Loop',
      people: [person('a', '', 'Ouro', 'm', '', { parent: 'c' }), person('b', '', 'Boros', 'm', '', { parent: 'a' }), person('c', '', 'Cycle', 'f', '', { parent: 'b' })],
    });
    expect(ownAncestors(tree)).toEqual(['a', 'b', 'c']);
    expect(ownGrandparents(tree)).toEqual([]);
    expect(checkTree(tree).filter((note) => note.code === 'own-ancestor')).toHaveLength(3);
  });

  it('finds a person who is their own grandparent by blood', () => {
    const tree = makeTree({
      house: 'House of Loop',
      people: [person('a', '', 'Grand', 'm', '', { parent: 'b' }), person('b', '', 'Parent', 'f', '', { parent: 'a' })],
    });
    expect(ownGrandparents(tree)).toEqual(['a', 'b']);
  });

  it('finds the one from the song: he married a widow, and her daughter married his father', () => {
    const tree = makeTree({
      house: 'House of Latham',
      people: [
        person('father', '', 'Father', 'm'),
        person('me', '', 'Narrator', 'm', '', { parent: 'father' }),
        person('widow', '', 'Widow', 'f'),
        person('daughter', '', 'Daughter', 'f', '', { parent: 'widow' }),
      ],
      unions: [union('u1', 'me', 'widow'), union('u2', 'father', 'daughter')],
    });
    expect(ownGrandparents(tree)).toContain('me');
    expect(ownAncestors(tree)).toEqual([]);
    expect(GRANDPARENT_TOAST).toBe('That’s a song, not a succession.');
  });

  it('leaves ordinary families alone, however many times they marry', () => {
    for (const example of examples) {
      expect(ownGrandparents(example.tree), example.id).toEqual([]);
      expect(ownAncestors(example.tree), example.id).toEqual([]);
    }
    expect(ownGrandparents(halvard())).toEqual([]);
  });
});
