import { describe, expect, it } from 'vitest';
import { examples, varenko } from '../src/dynasty/examples';
import {
  ancestorsOf,
  cleanDate,
  cleanLink,
  cleanText,
  cleanTree,
  cloneTree,
  dateKey,
  descendantsOf,
  displayName,
  formatDate,
  indexTree,
  isDead,
  MAX_PEOPLE,
  newId,
  yearOf,
} from '../src/dynasty/model';

describe('text', () => {
  it('keeps plain text and drops markup and control characters', () => {
    expect(cleanText('  King   Teomir II ', 80)).toBe('King Teomir II');
    expect(cleanText('<script>alert(1)</script>', 80)).toBe('script alert(1) /script');
    expect(cleanText('a\u0000b\nc\u2028d', 80)).toBe('a b c d');
    expect(cleanText('abcdef', 3)).toBe('abc');
    expect(cleanText(42, 80)).toBe('');
  });
});

describe('dates', () => {
  it('accepts a year, a year and month, or a full date', () => {
    expect(cleanDate('1958')).toBe('1958');
    expect(cleanDate(1958)).toBe('1958');
    expect(cleanDate('1958-3')).toBe('1958-03');
    expect(cleanDate('1958-03-12')).toBe('1958-03-12');
    expect(cleanDate(' 1958-3-2 ')).toBe('1958-03-02');
  });

  it('accepts years our own calendar never had', () => {
    expect(cleanDate('-120')).toBe('-120');
    expect(cleanDate('12045')).toBe('12045');
    expect(cleanDate('0')).toBe('0');
  });

  it('refuses everything else', () => {
    for (const bad of ['', 'spring', '1958-13', '1958-00', '1958-02-40', '1958/03/12', '1e3', '1234567', null, undefined, 19.5, {}]) {
      expect(cleanDate(bad), String(bad)).toBeUndefined();
    }
  });

  it('sorts and prints them', () => {
    expect(dateKey('1958')!).toBeLessThan(dateKey('1958-03-12')!);
    expect(dateKey('-120')!).toBeLessThan(dateKey('-119')!);
    expect(dateKey('1958-03-12')!).toBeLessThan(dateKey('1958-04')!);
    expect(dateKey(undefined)).toBeUndefined();
    expect(formatDate('1958-03-12')).toBe('12 March 1958');
    expect(formatDate('1958-03')).toBe('March 1958');
    expect(formatDate('1958')).toBe('1958');
    expect(formatDate(undefined)).toBe('');
    expect(yearOf('1958-03-12')).toBe('1958');
  });
});

describe('links', () => {
  it('lets https links through and nothing else', () => {
    expect(cleanLink('https://iiwiki.com/wiki/House_of_Varenko')).toBe('https://iiwiki.com/wiki/House_of_Varenko');
    expect(cleanLink(' https://eurth.org/topic/1?x=1#post ')).toBe('https://eurth.org/topic/1?x=1#post');
    for (const bad of ['http://example.org', 'javascript:alert(1)', 'https://', 'https://localhost', 'https://a.b/"onclick', 'https://user:pass@a.b/', 'https://a.b/ c', 'data:text/html,x', 7, `https://a.b/${'x'.repeat(400)}`]) {
      expect(cleanLink(bad), String(bad)).toBeUndefined();
    }
  });
});

describe('cleanTree', () => {
  it('never throws, whatever it is given', () => {
    for (const junk of [null, undefined, 42, 'tree', [], { people: 'many' }, { people: [null, 3, 'x', {}] }, { unions: [{}] }]) {
      const tree = cleanTree(junk);
      expect(tree.people).toEqual([]);
      expect(tree.unions).toEqual([]);
      expect(tree.law).toBe('absolute');
      expect(tree.exclude).toEqual({ illegitimate: true, renounced: true, out: true, adopted: true });
    }
  });

  it('leaves a clean tree as it is', () => {
    for (const example of examples) expect(cleanTree(JSON.parse(JSON.stringify(example.tree))), example.id).toEqual(example.tree);
  });

  it('drops what it cannot mend and keeps what it can', () => {
    const tree = cleanTree({
      house: ' House of <b>Test</b> ',
      law: 'tanistry',
      reigning: 'ghost',
      founder: 'a',
      picks: ['a', 'a', 'ghost', 7],
      exclude: { illegitimate: false, out: 'no' },
      people: [
        { id: 'a', name: 'Ada', sex: 'f', born: '1950', died: 'never', link: 'http://insecure.example', surprise: true },
        { id: 'a', name: 'Duplicate', sex: 'm' },
        { id: 'bad id', name: 'Nobody' },
        { id: 'b', name: 'Ben', sex: 'robot', union: 'u1', adopted: true, renounced: 'maybe' },
        { id: 'c', name: 'Cy', union: 'nowhere', parent: 'a' },
        { id: 'd', name: 'Di', parent: 'd' },
        { id: 'e', name: 'Ed', parent: 'ghost', adopted: true },
      ],
      unions: [
        { id: 'u1', a: 'a', b: 'c', married: '1970', out: true },
        { id: 'u2', a: 'a', b: 'a' },
        { id: 'u3', a: 'a', b: 'ghost' },
        { id: 'u1', a: 'b', b: 'c' },
      ],
    });
    expect(tree.house).toBe('House of b Test /b');
    expect(tree.law).toBe('absolute');
    expect(tree.reigning).toBeUndefined();
    expect(tree.founder).toBe('a');
    expect(tree.picks).toEqual(['a']);
    expect(tree.exclude).toEqual({ illegitimate: false, renounced: true, out: true, adopted: true });
    expect(tree.people.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(tree.people[0]).toEqual({ id: 'a', name: 'Ada', sex: 'f', born: '1950' });
    expect(tree.people[1]).toEqual({ id: 'b', name: 'Ben', sex: 'x', union: 'u1', adopted: true });
    expect(tree.people[2]).toEqual({ id: 'c', name: 'Cy', sex: 'x' });
    expect(tree.people[3]).toEqual({ id: 'd', name: 'Di', sex: 'x' });
    expect(tree.people[4]).toEqual({ id: 'e', name: 'Ed', sex: 'x' });
    expect(tree.unions).toEqual([{ id: 'u1', a: 'a', b: 'c', married: '1970', out: true }]);
  });

  it('will not let a person be born of their own marriage', () => {
    const tree = cleanTree({
      people: [
        { id: 'a', name: 'A', union: 'u1' },
        { id: 'b', name: 'B' },
      ],
      unions: [{ id: 'u1', a: 'a', b: 'b' }],
    });
    expect(tree.people[0]!.union).toBeUndefined();
  });

  it('stops at the largest tree it will hold', () => {
    const people = Array.from({ length: MAX_PEOPLE + 50 }, (_, i) => ({ id: `p${i}`, name: `Person ${i}` }));
    expect(cleanTree({ people }).people).toHaveLength(MAX_PEOPLE);
  });

  it('a death date makes the "dead" tick unnecessary', () => {
    const tree = cleanTree({ people: [{ id: 'a', name: 'A', died: '1900', dead: true }, { id: 'b', name: 'B', dead: true }] });
    expect(tree.people[0]!.dead).toBeUndefined();
    expect(tree.people[1]!.dead).toBe(true);
    expect(tree.people.every(isDead)).toBe(true);
  });
});

describe('reading a tree', () => {
  const tree = varenko();
  const index = indexTree(tree);

  it('knows parents, children and partners', () => {
    expect(index.parents('ilsa')).toEqual(['teomir2', 'ressa']);
    expect(index.parents('teomir1')).toEqual([]);
    expect(index.children('teomir2').map((p) => p.id)).toEqual(['ilsa', 'vanko', 'kosti']);
    expect(index.children('ressa').map((p) => p.id)).toEqual(['ilsa', 'vanko', 'kosti']);
    expect(index.childrenOfUnion('u1').map((p) => p.id)).toEqual(['teomir2', 'dobra', 'radan']);
    expect(index.unions('ilsa').map((u) => u.id)).toEqual(['u5']);
    expect(index.partner(index.union.get('u5')!, 'ilsa')).toBe('emeric');
  });

  it('puts siblings in birth order, the undated last and in the order they were added', () => {
    const t = cleanTree({
      people: [
        { id: 'p', name: 'Parent' },
        { id: 'late', name: 'Undated one', parent: 'p' },
        { id: 'young', name: 'Young', parent: 'p', born: '2001' },
        { id: 'later', name: 'Undated two', parent: 'p' },
        { id: 'old', name: 'Old', parent: 'p', born: '1999-12-31' },
        { id: 'twin', name: 'Twin', parent: 'p', born: '2001' },
      ],
    });
    expect(indexTree(t).children('p').map((p) => p.id)).toEqual(['old', 'young', 'twin', 'late', 'later']);
  });

  it('puts a person’s marriages in order of date', () => {
    const t = cleanTree({
      people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
      unions: [
        { id: 'second', a: 'a', b: 'c', married: '1990' },
        { id: 'first', a: 'b', b: 'a', married: '1980' },
      ],
    });
    expect(indexTree(t).unions('a').map((u) => u.id)).toEqual(['first', 'second']);
  });

  it('finds ancestors and descendants, nearest first', () => {
    expect(ancestorsOf(index, 'maelin')).toEqual(['ilsa', 'emeric', 'teomir2', 'ressa', 'teomir1', 'halina']);
    expect(descendantsOf(index, 'teomir2')).toEqual(['ilsa', 'vanko', 'kosti', 'maelin', 'teo', 'aris']);
    expect(descendantsOf(index, 'aris')).toEqual([]);
  });

  it('names people with their titles', () => {
    expect(displayName(index.person.get('teomir2'))).toBe('King Teomir II');
    expect(displayName(index.person.get('maelin'))).toBe('Maelin');
    expect(displayName({ id: 'x', name: '', sex: 'x' })).toBe('Unnamed');
    expect(displayName(undefined)).toBe('Unknown');
  });

  it('copies a tree all the way down', () => {
    const copy = cloneTree(tree);
    expect(copy).toEqual(tree);
    copy.people[0]!.name = 'Changed';
    copy.exclude.out = false;
    copy.picks.push('ilsa');
    expect(tree.people[0]!.name).toBe('Teomir I');
    expect(tree.exclude.out).toBe(true);
    expect(tree.picks).toEqual([]);
  });

  it('makes ids nobody has yet', () => {
    expect(newId('p', [])).toBe('p1');
    expect(newId('p', ['p1', 'p2'])).toBe('p3');
    expect(newId('u', ['u2', 'x'])).toBe('u3');
    expect(newId('p', ['p3', 'p2'])).toBe('p4');
  });
});
