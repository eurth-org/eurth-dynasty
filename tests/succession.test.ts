import { describe, expect, it } from 'vitest';
import { examples, halvard, lesnia, makeTree, maravel, person, rothmere, tamar, union, varenko } from '../src/dynasty/examples';
import { cleanTree, indexTree, laws, type Tree } from '../src/dynasty/model';
import { claimText, defaultFounder, lineOfSuccession, ofTheBlood, placeOf, reasonText, underLaw } from '../src/dynasty/succession';

/** The line as a list of ids, first in line first. */
const line = (tree: Tree): string[] => lineOfSuccession(tree).line.map((entry) => entry.id);
const excluded = (tree: Tree): Record<string, string> =>
  Object.fromEntries(lineOfSuccession(tree).excluded.map((entry) => [entry.id, entry.through ? `${entry.why} via ${entry.through}` : entry.why]));

describe('the five laws, on the House of Varenko', () => {
  it('absolute primogeniture: eldest child first, then that child’s line', () => {
    expect(line(varenko('absolute'))).toEqual(['ilsa', 'maelin', 'teo', 'vanko', 'aris', 'kosti', 'dobra', 'milan', 'radan', 'luka', 'neda']);
  });

  it('male-preference: sons and their lines before daughters and theirs', () => {
    expect(line(varenko('male-preference'))).toEqual(['vanko', 'aris', 'kosti', 'ilsa', 'teo', 'maelin', 'radan', 'luka', 'neda', 'dobra', 'milan']);
  });

  it('agnatic: men in the male line only', () => {
    const tree = varenko('agnatic');
    expect(line(tree)).toEqual(['vanko', 'aris', 'kosti', 'radan', 'luka']);
    expect(excluded(tree)).toEqual({
      ilsa: 'female',
      maelin: 'female',
      teo: 'female via ilsa',
      dobra: 'female',
      milan: 'female via dobra',
      neda: 'female',
    });
  });

  it('agnatic seniority: the older generation first, brothers before sons', () => {
    expect(line(varenko('seniority'))).toEqual(['radan', 'vanko', 'kosti', 'luka', 'aris']);
  });

  it('elective: the picks, in the order they were made', () => {
    const result = lineOfSuccession(varenko('elective'));
    expect(result.line.map((entry) => entry.id)).toEqual(['kosti', 'radan', 'ilsa']);
    expect(result.candidates).toContain('ressa');
    expect(result.candidates).not.toContain('teomir2');
    expect(result.candidates).not.toContain('teomir1');
  });

  it('names the heir and numbers the places from one', () => {
    const result = lineOfSuccession(varenko());
    expect(result.heir).toBe('ilsa');
    expect(result.founder).toBe('teomir1');
    expect(result.reigning).toBe('teomir2');
    expect(result.line.map((entry) => entry.place)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(placeOf(result, 'vanko')).toBe(4);
    expect(placeOf(result, 'ressa')).toBeUndefined();
  });

  it('says how each claim arises', () => {
    const tree = varenko();
    const result = lineOfSuccession(tree);
    expect(claimText(tree, result.line[0]!)).toBe('daughter of King Teomir II');
    expect(claimText(tree, result.line[1]!)).toBe('daughter of Princess Ilsa');
    expect(claimText(tree, result.line[3]!)).toBe('son of King Teomir II');
  });

  it('leaves those who married in out of the reckoning altogether', () => {
    const tree = varenko();
    const result = lineOfSuccession(tree);
    expect(result.excluded).toEqual([]);
    expect(ofTheBlood(tree, result, 'ressa')).toBe(false);
    expect(ofTheBlood(tree, result, 'aris')).toBe(true);
  });
});

describe('the dead and the reigning', () => {
  it('passes over the dead, but their children keep their place', () => {
    const tree = varenko();
    tree.people.find((p) => p.id === 'ilsa')!.died = '2022';
    expect(line(tree).slice(0, 4)).toEqual(['maelin', 'teo', 'vanko', 'aris']);
  });

  it('counts a person as dead with no date, too', () => {
    const tree = varenko();
    tree.people.find((p) => p.id === 'vanko')!.dead = true;
    expect(line(tree)).not.toContain('vanko');
    expect(line(tree)).toContain('aris');
  });

  it('never puts the reigning person in their own line', () => {
    for (const law of laws) expect(line(varenko(law))).not.toContain('teomir2');
  });

  it('puts a living founder first when nobody reigns', () => {
    const tree = makeTree({
      house: 'House of Test',
      people: [person('a', '', 'Ada', 'f', '1950'), person('b', '', 'Bea', 'f', '1975', { parent: 'a' })],
    });
    expect(line(tree)).toEqual(['a', 'b']);
  });
});

describe('the exclusions, on the House of Halvard', () => {
  it('with every exclusion on, only the unblemished remain', () => {
    const tree = halvard();
    expect(line(tree)).toEqual(['ylva', 'runa']);
    expect(excluded(tree)).toEqual({
      bram: 'illegitimate',
      signe: 'renounced',
      arvid: 'renounced via signe',
      halden: 'married-out',
      jory: 'born-out',
      edvin: 'adopted',
    });
  });

  it('illegitimacy off: the eldest son, born outside marriage, is the heir', () => {
    expect(line(halvard({ illegitimate: false }))).toEqual(['bram', 'ylva', 'runa']);
  });

  it('renunciation off: the renounced daughter and her son return', () => {
    expect(line(halvard({ renounced: false }))).toEqual(['signe', 'arvid', 'ylva', 'runa']);
  });

  it('marrying out off: the son and the child of his marriage return', () => {
    expect(line(halvard({ out: false }))).toEqual(['halden', 'jory', 'ylva', 'runa']);
  });

  it('adoption off: the adopted son takes his place by age', () => {
    expect(line(halvard({ adopted: false }))).toEqual(['ylva', 'runa', 'edvin']);
  });

  it('every exclusion off: everyone, in birth order', () => {
    expect(line(halvard({ illegitimate: false, renounced: false, out: false, adopted: false }))).toEqual([
      'bram',
      'signe',
      'arvid',
      'halden',
      'jory',
      'ylva',
      'runa',
      'edvin',
    ]);
  });

  it('a renunciation for oneself leaves the children in', () => {
    const tree = halvard();
    tree.people.find((p) => p.id === 'signe')!.renounced = 'self';
    expect(line(tree)).toEqual(['arvid', 'ylva', 'runa']);
  });

  it('a marriage out costs the children of that marriage their place, not the others', () => {
    const tree = halvard();
    tree.people.push(person('first', 'Lady', 'Idun', 'f', '1982'), person('elder', 'Lord', 'Stig', 'm', '2004', { union: 'h0' }));
    tree.unions.push(union('h0', 'halden', 'first', '2003', { ended: '2006' }));
    const cleaned = cleanTree(tree);
    expect(line(cleaned)).toEqual(['stig', 'ylva', 'runa'].map((id) => (id === 'stig' ? 'elder' : id)));
    expect(excluded(cleaned).jory).toBe('born-out');
  });

  it('gives each reason in words', () => {
    const tree = halvard();
    const result = lineOfSuccession(tree);
    const words = Object.fromEntries(result.excluded.map((entry) => [entry.id, reasonText(tree, entry)]));
    expect(words).toEqual({
      bram: 'born outside marriage',
      signe: 'renounced their place',
      arvid: 'descends from Lady Signe, who renounced for the whole line',
      halden: 'married out of the house',
      jory: 'born of a marriage the house does not recognise',
      edvin: 'adopted, not born to the house',
    });
  });

  it('an abdicated monarch has no place, but their children do', () => {
    const tree = varenko();
    const old = tree.people.find((p) => p.id === 'teomir2')!;
    old.abdicated = true;
    tree.reigning = 'ilsa';
    expect(line(tree).slice(0, 5)).toEqual(['maelin', 'teo', 'vanko', 'aris', 'kosti']);
    expect(excluded(tree).teomir2).toBe('abdicated');
  });
});

describe('the other example houses', () => {
  it('Maravel matches the Calderwyn example profile', () => {
    expect(line(maravel())).toEqual(['edric', 'liane', 'tobin', 'alaric']);
  });

  it('Rothmere: only daughters, so the crown goes to the brother’s sons', () => {
    const tree = rothmere();
    expect(line(tree)).toEqual(['ruprecht', 'konradin', 'matthias']);
    expect(excluded(tree)).toMatchObject({ clara: 'female', august: 'female via clara', sophie: 'female', wilhelmina: 'female' });
    expect(underLaw(tree, 'absolute').line.map((entry) => entry.id)).toEqual(['clara', 'august', 'sophie', 'ruprecht', 'konradin', 'matthias', 'wilhelmina']);
  });

  it('Tamar: brothers, then the next generation in order of line, then the next', () => {
    const tree = tamar();
    expect(line(tree)).toEqual(['rafiq', 'yusuf', 'karim', 'nadir', 'tariq', 'omar', 'zayd']);
    expect(underLaw(tree, 'agnatic').line.map((entry) => entry.id)).toEqual(['karim', 'zayd', 'nadir', 'rafiq', 'tariq', 'yusuf', 'omar']);
  });

  it('Lesnia: the Diet’s order, with the hetman first', () => {
    expect(line(lesnia())).toEqual(['jarek', 'wit', 'kasimir']);
  });

  it('every example has a heir and a reigning person who is alive', () => {
    for (const example of examples) {
      const result = lineOfSuccession(example.tree);
      const index = indexTree(example.tree);
      expect(result.heir, example.id).toBeDefined();
      expect(index.person.get(result.reigning!)?.died, example.id).toBeUndefined();
      expect(example.blurb.length, example.id).toBeGreaterThan(20);
    }
  });
});

describe('elective rules', () => {
  it('ignores picks who have died, reign, or gave up the throne', () => {
    const tree = lesnia();
    tree.picks = ['stanek', 'bogdan', 'wit', 'nobody', 'wit'];
    expect(line(cleanTree(tree))).toEqual(['wit']);
  });

  it('keeps out the renounced only while that rule is on', () => {
    const tree = lesnia();
    tree.people.find((p) => p.id === 'wit')!.renounced = 'self';
    expect(line(tree)).toEqual(['jarek', 'kasimir']);
    expect(excluded(tree)).toEqual({ wit: 'renounced' });
    tree.exclude.renounced = false;
    expect(line(tree)).toEqual(['jarek', 'wit', 'kasimir']);
  });
});

describe('sex not stated', () => {
  const tree = (law: Tree['law']) =>
    makeTree({
      house: 'House of Test',
      law,
      reigning: 'a',
      people: [
        person('a', '', 'Ansel', 'm', '1950'),
        person('b', '', 'Blake', 'x', '1975', { parent: 'a' }),
        person('c', '', 'Corin', 'm', '1978', { parent: 'a' }),
        person('d', '', 'Dale', 'm', '2000', { parent: 'b' }),
      ],
    });

  it('makes no difference under absolute primogeniture', () => {
    expect(line(tree('absolute'))).toEqual(['b', 'd', 'c']);
  });

  it('counts as not a son under male-preference', () => {
    expect(line(tree('male-preference'))).toEqual(['c', 'b', 'd']);
  });

  it('shuts the person and their line out under the agnatic laws, and says why', () => {
    const t = tree('agnatic');
    expect(line(t)).toEqual(['c']);
    expect(excluded(t)).toEqual({ b: 'sex-unknown', d: 'sex-unknown via b' });
    expect(reasonText(t, lineOfSuccession(t).excluded[0]!)).toBe('sex not stated, and this law needs it');
  });
});

describe('tangled trees', () => {
  it('gives a child of two cousins one place, the first they come to', () => {
    const tree = makeTree({
      house: 'House of Test',
      reigning: 'a',
      people: [
        person('a', '', 'Ada', 'f', '1920'),
        person('b', '', 'Bert', 'm', '1945', { parent: 'a' }),
        person('c', '', 'Cora', 'f', '1948', { parent: 'a' }),
        person('d', '', 'Dan', 'm', '1970', { parent: 'b' }),
        person('e', '', 'Eve', 'f', '1972', { parent: 'c' }),
        person('f', '', 'Finn', 'm', '1995', { union: 'u1' }),
      ],
      unions: [union('u1', 'd', 'e', '1994')],
    });
    expect(line(tree)).toEqual(['b', 'd', 'f', 'c', 'e']);
  });

  it('finds the open path when the first path to someone is cut', () => {
    // Under an agnatic law Finn has no claim through his mother, who is of the elder line,
    // but he has one through his father.
    const tree = makeTree({
      house: 'House of Test',
      law: 'agnatic',
      reigning: 'a',
      people: [
        person('a', '', 'Abel', 'm', '1920'),
        person('b', '', 'Bert', 'm', '1945', { parent: 'a', died: '2000' }),
        person('c', '', 'Carl', 'm', '1948', { parent: 'a' }),
        person('d', '', 'Dora', 'f', '1970', { parent: 'b' }),
        person('e', '', 'Egon', 'm', '1972', { parent: 'c' }),
        person('f', '', 'Finn', 'm', '1995', { union: 'u1' }),
      ],
      unions: [union('u1', 'd', 'e', '1994')],
    });
    expect(line(tree)).toEqual(['c', 'e', 'f']);
    expect(excluded(tree)).toEqual({ d: 'female' });
  });

  it('ends, and gives an answer, when someone is their own ancestor', () => {
    const tree = makeTree({
      house: 'House of Loop',
      reigning: 'a',
      founder: 'a',
      people: [person('a', '', 'Ouro', 'm', '1900', { parent: 'c' }), person('b', '', 'Boros', 'm', '1930', { parent: 'a' }), person('c', '', 'Cycle', 'f', '1960', { parent: 'b' })],
    });
    for (const law of laws) expect(() => lineOfSuccession({ ...tree, law })).not.toThrow();
    expect(line(tree)).toEqual(['b', 'c']);
  });

  it('copes with an empty tree and with a tree of strangers', () => {
    expect(lineOfSuccession(cleanTree({})).line).toEqual([]);
    expect(lineOfSuccession(cleanTree(null)).heir).toBeUndefined();
    const strangers = makeTree({ house: '', people: [person('a', '', 'A', 'x'), person('b', '', 'B', 'x')] });
    expect(line(strangers)).toEqual(['a']);
  });
});

describe('the founder, when not set', () => {
  it('is the reigning person’s most distant ancestor', () => {
    const tree = varenko();
    delete tree.founder;
    expect(defaultFounder(tree)).toBe('teomir1');
    expect(lineOfSuccession(tree).founder).toBe('teomir1');
  });

  it('prefers the ancestor who reigned, and a man under the agnatic laws', () => {
    const tree = varenko('agnatic');
    delete tree.founder;
    tree.people.find((p) => p.id === 'teomir1')!.reignFrom = undefined;
    delete tree.people.find((p) => p.id === 'teomir1')!.reignFrom;
    expect(defaultFounder(tree)).toBe('teomir1');
    expect(defaultFounder({ ...tree, law: 'absolute' })).toBe('teomir1');
  });

  it('is the reigning person when they have no parents in the tree', () => {
    const tree = halvard();
    delete tree.founder;
    expect(defaultFounder(tree)).toBe('osric');
  });

  it('is the head of the largest family when nobody reigns', () => {
    const tree = varenko();
    delete tree.founder;
    delete tree.reigning;
    expect(['teomir1', 'halina']).toContain(defaultFounder(tree));
  });
});
