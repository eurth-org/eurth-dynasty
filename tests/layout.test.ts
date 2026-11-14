import { describe, expect, it } from 'vitest';
import { describeLine, describeTree, lifeText, ordinal, realmWithThe, rulesText, summarise, withThe } from '../src/dynasty/describe';
import { examples, halvard, lesnia, makeTree, person, union, varenko } from '../src/dynasty/examples';
import { CARD_HEIGHT, CARD_WIDTH, layoutTree, neighbours, readingOrder, SPOUSE_GAP, type Layout } from '../src/dynasty/layout';
import { cleanTree, indexTree, type Tree } from '../src/dynasty/model';
import { cardText, drawingLayout, escapeXml, needsTallCards, palettes, TALL_CARD_HEIGHT, treeSvg, wrapName } from '../src/dynasty/render';
import { lineOfSuccession } from '../src/dynasty/succession';

const card = (layout: Layout, id: string) => layout.cards.find((c) => c.id === id)!;

function overlaps(layout: Layout): string[] {
  const found: string[] = [];
  layout.cards.forEach((a, i) => {
    for (const b of layout.cards.slice(i + 1)) {
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) found.push(`${a.id}/${b.id}`);
    }
  });
  return found;
}

function sound(tree: Tree, layout: Layout, label: string): void {
  expect(layout.cards.map((c) => c.id).sort(), label).toEqual(tree.people.map((p) => p.id).sort());
  expect(overlaps(layout), label).toEqual([]);
  for (const c of layout.cards) {
    expect(c.x, label).toBeGreaterThanOrEqual(0);
    expect(c.y, label).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width, label).toBeLessThanOrEqual(layout.width);
    expect(c.y + c.height, label).toBeLessThanOrEqual(layout.height);
  }
  for (const link of layout.links) {
    expect(link.points.length, label).toBeGreaterThanOrEqual(2);
    for (const [x, y] of link.points) {
      expect(Number.isFinite(x) && Number.isFinite(y), label).toBe(true);
    }
  }
}

/** A made-up family of any size, the same every time: each person has up to three children. */
function bigFamily(count: number): Tree {
  const people = [person('p0', '', 'Founder', 'm', '1000')];
  const unions = [];
  for (let i = 1; i < count; i++) {
    const parent = Math.floor((i - 1) / 3);
    if (i % 4 === 0) {
      // A spouse who married in.
      people.push(person(`p${i}`, '', `Spouse ${i}`, 'f'));
      unions.push(union(`u${i}`, `p${parent}`, `p${i}`));
    } else {
      people.push(person(`p${i}`, '', `Child ${i}`, i % 2 ? 'm' : 'f', String(1000 + i), { parent: `p${parent}` }));
    }
  }
  return makeTree({ house: 'House of Many', people, unions, reigning: 'p0' });
}

describe('layout', () => {
  it('places everyone in every example once, with no card on another', () => {
    for (const example of examples) sound(example.tree, layoutTree(example.tree), example.id);
  });

  it('puts generations in rows', () => {
    const layout = layoutTree(varenko());
    expect(layout.rows).toBe(4);
    const rows = (ids: string[]) => ids.map((id) => card(layout, id).row);
    expect(rows(['teomir1', 'halina'])).toEqual([0, 0]);
    expect(rows(['teomir2', 'ressa', 'dobra', 'petar', 'radan', 'ysabet'])).toEqual([1, 1, 1, 1, 1, 1]);
    expect(rows(['ilsa', 'emeric', 'vanko', 'sunniva', 'kosti', 'milan', 'luka', 'neda'])).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    expect(rows(['maelin', 'teo', 'aris'])).toEqual([3, 3, 3]);
    expect(card(layout, 'teomir2').y).toBeGreaterThan(card(layout, 'teomir1').y + CARD_HEIGHT);
  });

  it('puts spouses side by side', () => {
    const layout = layoutTree(varenko());
    for (const u of varenko().unions) {
      const [a, b] = [card(layout, u.a), card(layout, u.b)];
      expect(a.y, u.id).toBe(b.y);
      expect(Math.abs(a.x - b.x), u.id).toBe(CARD_WIDTH + SPOUSE_GAP);
    }
  });

  it('puts siblings in birth order, left to right', () => {
    for (const example of examples) {
      const layout = layoutTree(example.tree);
      const index = indexTree(example.tree);
      for (const u of example.tree.unions) {
        const xs = index.childrenOfUnion(u.id).map((kid) => card(layout, kid.id).x);
        expect(xs, `${example.id} ${u.id}`).toEqual([...xs].sort((a, b) => a - b));
      }
    }
    const tamar = examples.find((e) => e.id === 'tamar')!.tree;
    const layout = layoutTree(tamar);
    const xs = ['hasim', 'rafiq', 'samira', 'yusuf'].map((id) => card(layout, id).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('draws a marriage line for each union and a line down to each child', () => {
    const tree = varenko();
    const layout = layoutTree(tree);
    expect(layout.links.filter((l) => l.kind === 'marriage').map((l) => l.union).sort()).toEqual(tree.unions.map((u) => u.id).sort());
    const withParents = tree.people.filter((p) => p.union || p.parent).map((p) => p.id).sort();
    expect(layout.links.filter((l) => l.child).map((l) => l.child).sort()).toEqual(withParents);
    // Each drop ends on the top edge of the child's card, in the middle.
    for (const link of layout.links.filter((l) => l.kind === 'descent' && l.child)) {
      const c = card(layout, link.child!);
      expect(link.points.at(-1)).toEqual([c.x + c.width / 2, c.y]);
    }
    // Every segment runs straight across or straight down.
    for (const link of layout.links) {
      for (let i = 1; i < link.points.length; i++) {
        const [x1, y1] = link.points[i - 1]!;
        const [x2, y2] = link.points[i]!;
        expect(x1 === x2 || y1 === y2).toBe(true);
      }
    }
  });

  it('dashes the line to an adopted child and to one born outside marriage', () => {
    const layout = layoutTree(halvard());
    expect(layout.links.filter((l) => l.dashed).map((l) => l.child).sort()).toEqual(['bram', 'edvin']);
    expect((treeSvg(halvard()).match(/stroke-dasharray/g) ?? []).length).toBe(2);
    expect(treeSvg(varenko())).not.toContain('stroke-dasharray');
  });

  it('gives the same layout every time', () => {
    expect(layoutTree(varenko())).toEqual(layoutTree(varenko()));
  });

  it('copes with nobody, and with one person', () => {
    expect(layoutTree(cleanTree({}))).toEqual({ width: 0, height: 0, rows: 0, cards: [], links: [] });
    const one = layoutTree(makeTree({ house: '', people: [person('a', '', 'Una', 'f')] }));
    expect(one.cards).toHaveLength(1);
    expect(one.rows).toBe(1);
    expect(one.links).toEqual([]);
  });

  it('sets a first spouse to the left and later ones to the right', () => {
    const tree = makeTree({
      house: 'House of Thrice',
      people: [
        person('k', 'King', 'Hal', 'm', '1500'),
        person('w1', 'Queen', 'Ann', 'f'),
        person('w2', 'Queen', 'Bet', 'f'),
        person('w3', 'Queen', 'Cat', 'f'),
        person('c1', '', 'Mary', 'f', '1520', { union: 'u1' }),
        person('c2', '', 'Liz', 'f', '1533', { union: 'u2' }),
        person('c3', '', 'Ned', 'm', '1537', { union: 'u3' }),
      ],
      unions: [union('u1', 'k', 'w1', '1509'), union('u2', 'k', 'w2', '1533'), union('u3', 'k', 'w3', '1536')],
      reigning: 'k',
    });
    const layout = layoutTree(tree);
    sound(tree, layout, 'thrice');
    const xs = ['w1', 'k', 'w2', 'w3'].map((id) => card(layout, id).x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const kids = ['c1', 'c2', 'c3'].map((id) => card(layout, id).x);
    expect(kids).toEqual([...kids].sort((a, b) => a - b));
    // The third marriage has someone between the partners, so its line dips under the cards.
    expect(layout.links.find((l) => l.union === 'u3' && l.kind === 'marriage')!.points).toHaveLength(4);
  });

  it('joins two families with a cross link, and lines the in-laws up with their child', () => {
    const tree = makeTree({
      house: 'House of Two',
      founder: 'g',
      reigning: 'k',
      people: [
        person('g', 'King', 'Gram', 'm', '1900', { died: '1960' }),
        person('f', 'King', 'Fen', 'm', '1930', { parent: 'g', died: '1990' }),
        person('k', 'King', 'Kay', 'm', '1960', { parent: 'f' }),
        person('q', 'Queen', 'Quin', 'f', '1962', { union: 'in' }),
        person('qf', 'Duke', 'Other', 'm', '1935'),
        person('qm', 'Duchess', 'Another', 'f', '1937'),
        person('qs', 'Lady', 'Sister', 'f', '1965', { union: 'in' }),
        person('c', 'Prince', 'Cub', 'm', '1990', { union: 'kq' }),
      ],
      unions: [union('kq', 'k', 'q', '1988'), union('in', 'qf', 'qm', '1960')],
    });
    const layout = layoutTree(tree);
    sound(tree, layout, 'two families');
    expect(card(layout, 'q').row).toBe(card(layout, 'k').row);
    expect(card(layout, 'qf').row).toBe(card(layout, 'f').row);
    expect(card(layout, 'qs').row).toBe(card(layout, 'q').row);
    const cross = layout.links.filter((l) => l.kind === 'cross');
    expect(cross.map((l) => l.child)).toEqual(['q']);
    const q = card(layout, 'q');
    expect(cross[0]!.points.at(-1)).toEqual([q.x + q.width / 2, q.y]);
  });

  it('keeps cousins who marry side by side', () => {
    const tree = makeTree({
      house: 'House of Close',
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
    const layout = layoutTree(tree);
    sound(tree, layout, 'cousins');
    expect(Math.abs(card(layout, 'd').x - card(layout, 'e').x)).toBe(CARD_WIDTH + SPOUSE_GAP);
    expect(layout.links.filter((l) => l.kind === 'cross').map((l) => l.child)).toEqual(['e']);
  });

  it('ends when someone is their own ancestor', () => {
    const tree = makeTree({
      house: 'House of Loop',
      people: [person('a', '', 'Ouro', 'm', '', { parent: 'c' }), person('b', '', 'Boros', 'm', '', { parent: 'a' }), person('c', '', 'Cycle', 'f', '', { parent: 'b' })],
    });
    const layout = layoutTree(tree);
    expect(layout.cards).toHaveLength(3);
    expect(overlaps(layout)).toEqual([]);
  });

  it('lays out the largest tree it accepts, quickly', () => {
    const tree = bigFamily(500);
    const started = performance.now();
    const layout = layoutTree(tree);
    const took = performance.now() - started;
    sound(tree, layout, 'big');
    expect(took).toBeLessThan(1500);
    const line = performance.now();
    expect(lineOfSuccession(tree).line.length).toBeGreaterThan(50);
    expect(performance.now() - line).toBeLessThan(500);
  });

  it('accepts other card sizes', () => {
    const layout = layoutTree(varenko(), { cardWidth: 120, cardHeight: 40 });
    expect(layout.cards.every((c) => c.width === 120 && c.height === 40)).toBe(true);
    expect(overlaps(layout)).toEqual([]);
  });
});

describe('moving between people with the arrow keys', () => {
  const tree = varenko();
  const layout = layoutTree(tree);

  it('goes along the row, up to a parent and down to the eldest child', () => {
    expect(neighbours(layout, tree, 'teomir2')).toEqual({ right: 'ressa', up: 'teomir1', down: 'ilsa' });
    expect(neighbours(layout, tree, 'ressa')).toMatchObject({ left: 'teomir2', down: 'ilsa' });
    expect(neighbours(layout, tree, 'ressa').up).toBeUndefined();
    expect(neighbours(layout, tree, 'aris')).toMatchObject({ up: 'vanko' });
    expect(neighbours(layout, tree, 'aris').down).toBeUndefined();
    expect(neighbours(layout, tree, 'nobody')).toEqual({});
  });

  it('can reach everyone from the founder', () => {
    const seen = new Set(['teomir1']);
    const queue = ['teomir1'];
    while (queue.length) {
      const next = neighbours(layout, tree, queue.shift()!);
      for (const id of [next.left, next.right, next.up, next.down]) {
        if (id !== undefined && !seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
      }
    }
    expect(seen.size).toBe(tree.people.length);
  });

  it('reads top row first, left to right', () => {
    const order = readingOrder(layout);
    expect(order.slice(0, 2)).toEqual(['teomir1', 'halina']);
    expect(order).toHaveLength(tree.people.length);
    expect(order.at(-1)).toBe('aris');
  });
});

describe('the cards', () => {
  it('mark the reigning person and the heir with words', () => {
    const tree = varenko();
    const succession = lineOfSuccession(tree);
    const text = (id: string) => cardText(tree, succession, tree.people.find((p) => p.id === id)!);
    expect(text('teomir2')).toMatchObject({ tag: 'Reigning since 1988', reigning: true, heir: false, name: ['King Teomir II'], dates: 'b. 1958' });
    expect(text('teomir2').label).toBe('King Teomir II, Reigning since 1988, born 1958');
    expect(text('ilsa')).toMatchObject({ tag: 'Heir', heir: true, place: 1 });
    expect(text('maelin')).toMatchObject({ tag: '2nd in line', place: 2, heir: false });
    expect(text('teomir1')).toMatchObject({ tag: 'Reigned 1961–1988', dates: '1930–1988' });
    expect(text('teomir1').label).toBe('King Teomir I, Reigned 1961 to 1988, 1930 to 1988');
    expect(text('ressa')).toMatchObject({ tag: '', dates: 'b. 1960' });
  });

  it('say why someone has no place, when the reason is their own', () => {
    const tree = halvard();
    const succession = lineOfSuccession(tree);
    const tag = (id: string) => cardText(tree, succession, tree.people.find((p) => p.id === id)!).tag;
    expect(tag('bram')).toBe('Born outside marriage');
    expect(tag('signe')).toBe('Renounced');
    expect(tag('arvid')).toBe('');
    expect(tag('halden')).toBe('Married out');
    expect(tag('edvin')).toBe('Adopted');
  });

  it('speak of choices under an elective law', () => {
    const tree = lesnia();
    const succession = lineOfSuccession(tree);
    const tag = (id: string) => cardText(tree, succession, tree.people.find((p) => p.id === id)!).tag;
    expect(tag('jarek')).toBe('First choice');
    expect(tag('wit')).toBe('2nd choice');
  });

  it('wrap long names onto two lines and cut what still does not fit', () => {
    expect(wrapName('King Teomir II')).toEqual(['King Teomir II']);
    expect(wrapName('Hereditary Princess Clara')).toEqual(['Hereditary Princess', 'Clara']);
    expect(wrapName('Grand Duchess Wilhelmina Alexandrina of Valdenau and the Isles')).toEqual(['Grand Duchess', 'Wilhelmina Alexandrina…']);
    expect(wrapName('Supercalifragilisticexpialidocious')).toEqual(['Supercalifragilisticex…']);
    expect(wrapName('')).toEqual([]);
    expect(needsTallCards(varenko())).toBe(false);
    const rothmere = examples.find((e) => e.id === 'rothmere')!.tree;
    expect(needsTallCards(rothmere)).toBe(true);
    expect(drawingLayout(rothmere).cards[0]!.height).toBe(TALL_CARD_HEIGHT);
  });
});

describe('the drawing', () => {
  it('is one well-formed SVG with a title and a description', () => {
    for (const example of examples) {
      for (const palette of [palettes.dark, palettes.light]) {
        const svg = treeSvg(example.tree, { palette });
        expect(svg, example.id).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+" width="\d+" height="\d+" role="img" aria-labelledby="dynasty-title dynasty-desc">/);
        expect(svg, example.id).not.toMatch(/NaN|undefined|Infinity/);
        expect(svg, example.id).toContain('<title id="dynasty-title">Family tree of the House of');
        expect(svg, example.id).toContain('<desc id="dynasty-desc">Family tree of the House of');
        expect(svg.endsWith('</svg>'), example.id).toBe(true);
        // As many closing tags as opening ones.
        expect((svg.match(/<svg/g) ?? []).length, example.id).toBe((svg.match(/<\/svg>/g) ?? []).length);
        expect((svg.match(/<g[ >]/g) ?? []).length, example.id).toBe((svg.match(/<\/g>/g) ?? []).length);
      }
    }
  });

  it('marks the heir with a word and a ring, and the reigning person with a word and a crown', () => {
    const svg = treeSvg(varenko());
    expect(svg).toContain('>HEIR</text>');
    expect(svg).toContain('>REIGNING SINCE 1988</text>');
    expect((svg.match(/stroke-width="3"/g) ?? []).length).toBe(1);
    expect((svg.match(/d="M1 11L2 3/g) ?? []).length).toBe(1);
    expect(svg).toContain('House of Varenko');
    expect(svg).toContain('Kingdom of Ostaril · Absolute primogeniture');
  });

  it('uses only the colours it was given', () => {
    const palette = { surface: '#010101', surfaceRaised: '#020202', ink: '#030303', inkMuted: '#040404', lineStrong: '#050505', accentText: '#060606', crown: '#070707' };
    const colours = new Set(treeSvg(varenko(), { palette }).match(/#[0-9a-f]{6}\b/gi));
    expect([...colours].sort()).toEqual(Object.values(palette).sort());
  });

  it('escapes whatever was typed', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
    const tree = makeTree({ house: 'House of "Quote" & Sons', people: [person('a', 'Sir', `O'Brien & "Co"`, 'm')], reigning: 'a' });
    const svg = treeSvg(tree);
    expect(svg).toContain('House of &quot;Quote&quot; &amp; Sons');
    expect(svg).toContain('Sir O&#39;Brien &amp; &quot;Co&quot;');
    expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;)/);
  });

  it('can leave the heading off, and draws an empty tree without fuss', () => {
    const withHeading = treeSvg(varenko());
    const without = treeSvg(varenko(), { heading: false });
    expect(without).not.toContain('font-size="28"');
    expect(withHeading.length).toBeGreaterThan(without.length);
    expect(treeSvg(cleanTree({}))).toContain('Nobody here yet.');
  });
});

describe('the description', () => {
  it('gives the line of succession as text', () => {
    expect(describeLine(varenko())).toBe(
      [
        'House of Varenko, Kingdom of Ostaril',
        'Succession law: absolute primogeniture. The eldest child inherits, daughter or son.',
        'Left out by the house rules: those born outside marriage, those who renounced, those who married out, and the children of such marriages and adopted children.',
        'Reigning: King Teomir II (born 1958, reigning since 1988).',
        'Heir: Princess Ilsa (born 1986), daughter of King Teomir II.',
        '',
        'Line of succession:',
        '1. Princess Ilsa, daughter of King Teomir II',
        '2. Maelin, daughter of Princess Ilsa',
        '3. Teo, son of Princess Ilsa',
        '4. Prince Vanko, son of King Teomir II',
        '5. Aris, son of Prince Vanko',
        '6. Prince Kosti, son of King Teomir II',
        '7. Princess Dobra, daughter of King Teomir I',
        '8. Lord Milan of Lask, son of Princess Dobra',
        '9. Prince Radan, son of King Teomir I',
        '10. Prince Luka, son of Prince Radan',
        '11. Princess Neda, daughter of Prince Radan',
      ].join('\n'),
    );
  });

  it('lists those left out, with reasons', () => {
    const text = describeLine(halvard());
    expect(text).toContain('Left out:\n- Lord Bram: born outside marriage\n- Lady Signe: renounced their place\n- Lord Arvid: descends from Lady Signe, who renounced for the whole line');
    expect(text).toContain('Heir: Lady Ylva (born 1984), daughter of Duke Osric.');
  });

  it('handles an elective crown and an empty throne', () => {
    const text = describeLine(lesnia());
    expect(text).toContain('Succession law: elective monarchy. No one inherits: you pick the candidates, in order.');
    expect(text).toContain('Heir: Hetman Jarek Ostrow (born 1980).');
    expect(text).toContain('1. Hetman Jarek Ostrow, first choice\n2. Prince Wit, choice 2');
    const empty = lesnia();
    empty.picks = [];
    delete empty.reigning;
    expect(describeLine(empty)).toContain('Reigning: nobody. The throne stands empty.\nHeir: nobody has been chosen yet.');
  });

  it('describes the picture in a paragraph', () => {
    expect(describeTree(varenko())).toBe(
      'Family tree of the House of Varenko, Kingdom of Ostaril: 19 people in 4 generations. The law is absolute primogeniture. King Teomir II reigns. The heir is Princess Ilsa. The line of succession: Princess Ilsa, Maelin, Teo, Prince Vanko, Aris, Prince Kosti, Princess Dobra, Lord Milan of Lask, Prince Radan, Prince Luka, and 1 more.',
    );
    expect(describeTree(cleanTree({}))).toBe('An empty family tree.');
  });

  it('sums a house up for the profile in under 600 characters', () => {
    expect(summarise(varenko())).toBe(
      'The House of Varenko reigns over the Kingdom of Ostaril under absolute primogeniture. King Teomir II reigns; the heir is Princess Ilsa, followed by Maelin and Teo.',
    );
    for (const example of examples) expect(summarise(example.tree).length, example.id).toBeLessThanOrEqual(600);
    const long = makeTree({ house: 'x'.repeat(80), realm: 'y'.repeat(80), reigning: 'a', people: [person('a', 't'.repeat(60), 'n'.repeat(80), 'm'), person('b', 't'.repeat(60), 'n'.repeat(80), 'm', '', { parent: 'a' }), person('c', 't'.repeat(60), 'n'.repeat(80), 'm', '', { parent: 'b' }), person('d', 't'.repeat(60), 'n'.repeat(80), 'm', '', { parent: 'c' })] });
    expect(summarise(long).length).toBeLessThanOrEqual(600);
  });

  it('has its small words right', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
    expect(withThe('House of Varenko')).toBe('the House of Varenko');
    expect(withThe('Varenko')).toBe('Varenko');
    expect(realmWithThe('Kingdom of Ostaril')).toBe('the Kingdom of Ostaril');
    expect(realmWithThe('Ostaril')).toBe('Ostaril');
    expect(lifeText(person('a', '', 'A', 'x', '1900', { died: '1950' }))).toBe('1900 to 1950');
    expect(lifeText(person('a', '', 'A', 'x', '1900', { dead: true }))).toBe('born 1900, since died');
    expect(lifeText(person('a', '', 'A', 'x'))).toBe('');
    expect(rulesText({ ...varenko(), exclude: { illegitimate: false, renounced: false, out: false, adopted: false } })).toBe('The house rules leave nobody out.');
  });
});
