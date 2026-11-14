import { describe, expect, it } from 'vitest';
import { examples, halvard, lesnia, makeTree, person, varenko } from '../src/dynasty/examples';
import { decodeTree, encodeTree, fitsInLink, LINK_PARAM, MAX_STATE, packTree, treeFromSearch, treeLink, unpackTree, withPlainIds } from '../src/dynasty/link';
import { cleanTree, type Tree } from '../src/dynasty/model';
import { fromSection, hasTree, toSection, TREE_FORMAT } from '../src/dynasty/profile';
import { lineOfSuccession } from '../src/dynasty/succession';

const names = (tree: Tree): string[] => {
  const byId = new Map(tree.people.map((p) => [p.id, p.name]));
  return lineOfSuccession(tree).line.map((place) => byId.get(place.id)!);
};

describe('the link', () => {
  it('brings every example back as it was', () => {
    for (const example of examples) {
      const back = decodeTree(encodeTree(example.tree));
      expect(back, example.id).toEqual(withPlainIds(example.tree));
      expect(names(back!), example.id).toEqual(names(example.tree));
      expect(back!.people.map((p) => p.name), example.id).toEqual(example.tree.people.map((p) => p.name));
    }
  });

  it('keeps every field of a person and a marriage', () => {
    const tree = makeTree({
      house: 'House of Everything',
      realm: 'Realm of Tests',
      law: 'male-preference',
      reigning: 'a',
      founder: 'a',
      exclude: { illegitimate: false, renounced: true, out: false, adopted: true },
      people: [
        person('a', 'Queen', 'Ada', 'f', '1900-01-02', { died: '1980-12-31', reignFrom: '1920', reignTo: '1980', notes: 'A note, with "quotes" & ünïcödé.', link: 'https://iiwiki.com/wiki/Ada' }),
        person('b', '', 'Bo', 'x', '', { dead: true }),
        person('c', 'Lord', 'Cy', 'm', '1925', { union: 'u', adopted: true, illegitimate: true, abdicated: true, renounced: 'self' }),
        person('d', '', 'Di', 'f', '-12', { parent: 'a', renounced: 'line' }),
      ],
      unions: [{ id: 'u', a: 'a', b: 'b', married: '1919-06', ended: '1930', out: true }],
    });
    const back = decodeTree(encodeTree(tree))!;
    expect(back).toEqual(withPlainIds(tree));
    expect(back.people[0]).toEqual({ ...tree.people[0], id: 'p1' });
    expect(back.people[2]).toEqual({ ...tree.people[2], id: 'p3', union: 'u1' });
    expect(back.people[3]).toEqual({ ...tree.people[3], id: 'p4', parent: 'p1' });
    expect(back.unions[0]).toEqual({ id: 'u1', a: 'p1', b: 'p2', married: '1919-06', ended: '1930', out: true });
    expect(back.exclude).toEqual(tree.exclude);
    expect(back.law).toBe('male-preference');
  });

  it('keeps the picks of an elective crown, in order', () => {
    const back = decodeTree(encodeTree(lesnia()))!;
    expect(names(back)).toEqual(['Jarek Ostrow', 'Wit', 'Kasimir']);
  });

  it('is short: about sixty characters a person', () => {
    const state = encodeTree(varenko());
    expect(state).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(state.length / varenko().people.length).toBeLessThan(70);
    expect(packTree(makeTree({ house: '', people: [person('a', '', 'Una', 'f')] }))).toEqual(['', '', 0, 15, 0, 0, [], [['Una', 2]], []]);
  });

  it('makes a link with the tree in the query string, and reads it back', () => {
    const link = treeLink(varenko())!;
    expect(link.startsWith(`https://dynasty.eurth.org/?${LINK_PARAM}=1.`)).toBe(true);
    expect(link).toMatch(/^https:\/\/[!-~]+$/);
    expect(link.length).toBeLessThanOrEqual(4000);
    expect(treeFromSearch(new URL(link).search)).toEqual(withPlainIds(varenko()));
    expect(treeLink(varenko(), 'http://localhost:4321/?old=1#hash')!.startsWith('http://localhost:4321/?d=1.')).toBe(true);
    expect(treeFromSearch('')).toBeNull();
    expect(treeFromSearch('?other=1')).toBeNull();
  });

  it('says when a tree is too big for a link', () => {
    const people = Array.from({ length: 200 }, (_, i) => person(`p${i}`, 'Prince', `Person number ${i}`, 'm', String(1000 + i), i ? { parent: 'p0' } : {}));
    const big = makeTree({ house: 'House of Many', people, reigning: 'p0' });
    expect(fitsInLink(big)).toBe(false);
    expect(treeLink(big)).toBeNull();
    expect(fitsInLink(varenko())).toBe(true);
    expect(encodeTree(varenko()).length).toBeLessThan(MAX_STATE);
  });

  it('never throws on a link it cannot read', () => {
    const junk = ['', '1.', '1.!!!', '2.e30', 'e30', '1.e30', '1.W10', '1.bnVsbA', `1.${'A'.repeat(9000)}`, '1.eyJhIjoxfQ', null, undefined];
    for (const text of junk) expect(decodeTree(text), String(text)).toBeNull();
    expect(unpackTree([1, 2, 3, 4, 5, 6, 7, [[], 'x', null, [{}, {}]], 'unions'])!.people).toHaveLength(4);
    expect(unpackTree([0, 0, 99, -1, 7, 'x', 'y', [['A', 1, '', '', '', 999, 5, 9]], [[1, 1], [9, 9], 'z']])).toMatchObject({ law: 'absolute', unions: [], picks: [] });
    expect(unpackTree('no')).toBeNull();
  });

  it('cleans what it reads: a link is someone else’s input', () => {
    const json = JSON.stringify(['<b>House</b>', '', 0, 15, 1, 0, [], [['<script>x</script>', 1, '', 'yesterday', '', 0, 0, 0, '', '', '', 'javascript:alert(1)']], []]);
    const state = `1.${btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
    const tree = decodeTree(state)!;
    expect(tree.house).toBe('b House /b');
    expect(tree.people[0]).toEqual({ id: 'p1', name: 'script x /script', sex: 'm' });
  });
});

describe('the profile section', () => {
  it('carries what the other tools read', () => {
    const section = toSection(varenko());
    expect(section).toMatchObject({
      house: 'House of Varenko',
      law: 'Absolute primogeniture',
      monarch: 'King Teomir II',
      heir: 'Princess Ilsa',
      summary: 'The House of Varenko reigns over the Kingdom of Ostaril under absolute primogeniture. King Teomir II reigns; the heir is Princess Ilsa, followed by Maelin and Teo.',
    });
    expect(section.succession!.slice(0, 4)).toEqual(['Princess Ilsa', 'Maelin', 'Teo', 'Prince Vanko']);
    expect(section.link).toMatch(/^https:\/\/dynasty\.eurth\.org\/\?d=1\./);
    expect(section.updated).toBeUndefined();
  });

  it('matches the Calderwyn example profile', () => {
    const section = toSection(examples.find((e) => e.id === 'maravel')!.tree);
    expect(section.house).toBe('House of Maravel');
    expect(section.law).toBe('Absolute primogeniture');
    expect(section.monarch).toBe('Queen Ysolde III');
    expect(section.heir).toBe('Prince Edric');
    expect(section.succession).toEqual(['Prince Edric', 'Princess Liane', 'Prince Tobin', 'Duke Alaric of Wynmere']);
  });

  it('carries the tree itself, and brings it back exactly', () => {
    for (const example of examples) {
      const section = toSection(example.tree);
      expect(section.format, example.id).toBe(TREE_FORMAT);
      expect(hasTree(section), example.id).toBe(true);
      // Through the file and back: JSON and all.
      expect(fromSection(JSON.parse(JSON.stringify(section))), example.id).toEqual(example.tree);
    }
    const section = toSection(halvard({ adopted: false }));
    expect(section.rules).toEqual({ illegitimate: true, renounced: true, out: true, adopted: false });
    expect(section.relations!.find((r) => r.out)).toEqual({ id: 'h3', a: 'halden', b: 'mara', married: '2007', out: true });
    expect(section.lawId).toBe('absolute');
    expect(section.reigning).toBe('osric');
  });

  it('stays within what the profile schema allows', () => {
    const people = Array.from({ length: 120 }, (_, i) => person(`p${i}`, 'T'.repeat(60), 'N'.repeat(80), 'm', String(1000 + i), i ? { parent: 'p0' } : {}));
    const section = toSection(makeTree({ house: 'H'.repeat(80), realm: 'R'.repeat(80), people, reigning: 'p0' }));
    expect(section.succession).toHaveLength(50);
    for (const name of [section.house!, section.law!, section.monarch!, section.heir!, ...section.succession!]) {
      expect(name.length).toBeGreaterThan(0);
      expect(name.length).toBeLessThanOrEqual(80);
    }
    expect(section.summary!.length).toBeLessThanOrEqual(600);
    // Too big for a link: the link is then the tool's own address.
    expect(section.link).toBe('https://dynasty.eurth.org/');
    expect(section.people).toHaveLength(120);
  });

  it('leaves out what a tree does not have', () => {
    const section = toSection(cleanTree({}));
    expect(section.house).toBeUndefined();
    expect(section.monarch).toBeUndefined();
    expect(section.heir).toBeUndefined();
    expect(section.succession).toEqual([]);
    expect(section.people).toEqual([]);
    expect(fromSection(section)).toEqual(cleanTree({}));
  });

  it('keeps keys it does not know, and replaces its own', () => {
    const previous = { house: 'Old name', heir: 'Somebody else', crest: 'a stag', nested: { kept: true }, updated: '2026-11-08T13:27:51.000Z' };
    const section = toSection(varenko(), { previous });
    expect(section.crest).toBe('a stag');
    expect(section.nested).toEqual({ kept: true });
    expect(section.updated).toBe('2026-11-08T13:27:51.000Z');
    expect(section.house).toBe('House of Varenko');
    expect(section.heir).toBe('Princess Ilsa');
    expect(toSection(varenko(), { previous: 'nonsense' }).house).toBe('House of Varenko');
    // A tree with no heir must not keep the old one.
    expect(toSection(cleanTree({}), { previous }).heir).toBeUndefined();
  });

  it('uses the address it is given for the link', () => {
    expect(toSection(varenko(), { base: 'https://example.org/dynasty/' }).link).toMatch(/^https:\/\/example\.org\/dynasty\/\?d=1\./);
    expect(toSection(varenko(), { base: 'http://localhost:4321/' }).link).toBeUndefined();
  });

  it('reads a section with names only as having no tree', () => {
    const namesOnly = { house: 'House of Maravel', law: 'Absolute primogeniture', monarch: 'Queen Ysolde III', heir: 'Prince Edric', succession: ['Prince Edric'] };
    expect(hasTree(namesOnly)).toBe(false);
    expect(fromSection(namesOnly)).toBeNull();
    for (const junk of [null, undefined, 'x', 3, [], { people: 'many' }]) expect(fromSection(junk)).toBeNull();
  });

  it('will not guess at a tree from a later version, and cleans what it reads', () => {
    expect(fromSection({ format: TREE_FORMAT + 1, people: [] })).toBeNull();
    const tree = fromSection({ people: [{ id: 'a', name: '<i>Ada</i>', sex: 'f', link: 'http://x.example' }, 'junk'], relations: [{ id: 'u', a: 'a', b: 'ghost' }], lawId: 'nonsense', reigning: 'ghost' })!;
    expect(tree.people).toEqual([{ id: 'a', name: 'i Ada /i', sex: 'f' }]);
    expect(tree.unions).toEqual([]);
    expect(tree.law).toBe('absolute');
    expect(tree.reigning).toBeUndefined();
  });
});
