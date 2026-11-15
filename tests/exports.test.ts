import { describe, expect, it } from 'vitest';
import { examples, halvard, lesnia, makeTree, person, union, varenko } from '../src/dynasty/examples';
import { fromGedcom, fromGedcomDate, isGedcom, MAX_GEDCOM_LENGTH, toGedcom, toGedcomDate } from '../src/dynasty/gedcom';
import { withPlainIds } from '../src/dynasty/link';
import { cleanTree, type Tree } from '../src/dynasty/model';
import { lineOfSuccession } from '../src/dynasty/succession';
import { ahnentafel, ahnentafelNumbers, ahnentafelSubject, chartGrid, membersTable, successionList, toWikitext, treeChart, wikiEscape, wikiFormats } from '../src/dynasty/wikitext';

/** GEDCOM has a husband's place and a wife's, so partners can come back the other way round. */
const settled = (tree: Tree): Tree => ({ ...tree, unions: tree.unions.map((u) => (u.a < u.b ? u : { ...u, a: u.b, b: u.a })) });
const lineNames = (tree: Tree): string[] => {
  const byId = new Map(tree.people.map((p) => [p.id, p.name]));
  return lineOfSuccession(tree).line.map((place) => byId.get(place.id)!);
};

describe('GEDCOM dates', () => {
  it('writes them the GEDCOM way', () => {
    expect(toGedcomDate('1958-03-12')).toBe('12 MAR 1958');
    expect(toGedcomDate('1958-03')).toBe('MAR 1958');
    expect(toGedcomDate('1958')).toBe('1958');
    expect(toGedcomDate('-120')).toBe('120 B.C.');
    expect(toGedcomDate(undefined)).toBe('');
  });

  it('reads them back, approximations and all', () => {
    expect(fromGedcomDate('12 MAR 1958')).toBe('1958-03-12');
    expect(fromGedcomDate('mar 1958')).toBe('1958-03');
    expect(fromGedcomDate('1958')).toBe('1958');
    expect(fromGedcomDate('ABT 1850')).toBe('1850');
    expect(fromGedcomDate('BEF 3 JUN 1900')).toBe('1900-06-03');
    expect(fromGedcomDate('BET 1840 AND 1850')).toBe('1840');
    expect(fromGedcomDate('FROM 1961 TO 1988')).toBe('1961');
    expect(fromGedcomDate('@#DJULIAN@ 5 FEB 1650/51')).toBe('1650-02-05');
    expect(fromGedcomDate('120 B.C.')).toBe('-120');
    expect(fromGedcomDate('44 BCE')).toBe('-44');
    expect(fromGedcomDate('(a long time ago)')).toBeUndefined();
    expect(fromGedcomDate('')).toBeUndefined();
    expect(fromGedcomDate(undefined)).toBeUndefined();
  });
});

describe('GEDCOM out', () => {
  const text = toGedcom(varenko());

  it('is a GEDCOM 5.5.1 file from head to trailer', () => {
    expect(isGedcom(text)).toBe(true);
    expect(text.startsWith('0 HEAD\n1 SOUR DYNASTY\n')).toBe(true);
    expect(text).toContain('1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n1 SUBM @SUBM@\n');
    expect(text.endsWith('0 TRLR\n')).toBe(true);
    for (const line of text.trimEnd().split('\n')) {
      expect(line).toMatch(/^\d+ (@[A-Z0-9]+@ )?[A-Z_0-9]+( .*)?$/);
      expect(line.length).toBeLessThanOrEqual(255);
    }
  });

  it('writes people, titles, reigns, dates and families with standard tags', () => {
    expect(text).toContain('0 @I1@ INDI\n1 NAME Teomir I\n1 TITL King\n2 DATE FROM 1961 TO 1988\n1 SEX M\n1 BIRT\n2 DATE 1930\n1 DEAT\n2 DATE 1988\n1 FAMS @F1@\n');
    expect(text).toContain('0 @I3@ INDI\n1 NAME Teomir II\n1 TITL King\n2 DATE FROM 1958'.replace('1958', '1988'));
    expect(text).toContain('0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I2@\n1 CHIL @I3@\n1 CHIL @I5@\n1 CHIL @I7@\n1 MARR\n2 DATE 1956\n');
    expect(text).toContain('1 FAMC @F2@\n2 PEDI birth\n');
    // A woman of the house and the man who married in: he still takes the husband's place.
    expect(text).toContain('0 @F3@ FAM\n1 HUSB @I6@\n1 WIFE @I5@\n');
  });

  it('keeps what GEDCOM has no word for in tags of its own', () => {
    expect(text).toContain('1 _DYNASTY\n2 _HOUSE House of Varenko\n2 _REALM Kingdom of Ostaril\n2 _LAW absolute\n2 _RULES illegitimate renounced out adopted\n2 _REIGN @I3@\n2 _FOUND @I1@\n');
    const halvardText = toGedcom(halvard({ adopted: false }));
    expect(halvardText).toContain('2 _RULES illegitimate renounced out\n');
    expect(halvardText).toContain('1 _ILLEG Y\n');
    expect(halvardText).toContain('1 _RENO LINE\n');
    expect(halvardText).toContain('1 _OUT Y\n');
    expect(halvardText).toContain('2 PEDI adopted\n');
    // A child of one known parent hangs on a family of one.
    expect(halvardText).toMatch(/0 @F5@ FAM\n1 HUSB @I1@\n1 CHIL @I3@\n0 TRLR/);
    expect(toGedcom(lesnia())).toContain('2 _PICK @I8@\n2 _PICK @I5@\n2 _PICK @I6@\n');
  });

  it('continues long notes on further lines, and doubles the at sign', () => {
    const note = `Write to ada@example.org. ${'A long story about the house and its doings. '.repeat(9)}`.trim();
    const tree = makeTree({ house: 'House of Notes', people: [person('a', '', 'Ada', 'f', '', { notes: note })] });
    const out = toGedcom(tree);
    expect(out).toContain('1 NOTE Write to ada@@example.org.');
    expect(out).toContain('\n2 CONC ');
    expect(fromGedcom(out).tree.people[0]!.notes).toBe(note);
  });
});

describe('GEDCOM in', () => {
  it('brings every example back as it left', () => {
    for (const example of examples) {
      const result = fromGedcom(toGedcom(example.tree));
      expect(result.warnings, example.id).toEqual([]);
      expect(result.found, example.id).toBe(example.tree.people.length);
      expect(settled(result.tree), example.id).toEqual(settled(withPlainIds(example.tree)));
      expect(lineNames(result.tree), example.id).toEqual(lineNames(example.tree));
    }
  });

  it('keeps every field through a round trip', () => {
    const tree = makeTree({
      house: 'House of Everything',
      realm: 'Realm of Tests',
      law: 'seniority',
      reigning: 'a',
      founder: 'a',
      exclude: { illegitimate: false, renounced: true, out: false, adopted: true },
      people: [
        person('a', 'Queen', 'Ada', 'f', '1900-01-02', { died: '1980-12-31', reignFrom: '1920', reignTo: '1980', notes: 'A note.', link: 'https://iiwiki.com/wiki/Ada' }),
        person('b', '', 'Bo', 'x', '', { dead: true, reignFrom: '1890' }),
        person('c', 'Lord', 'Cy', 'm', '1925', { union: 'u', adopted: true, illegitimate: true, abdicated: true, renounced: 'self' }),
        person('d', '', 'Di', 'f', '-12', { parent: 'a', renounced: 'line' }),
      ],
      unions: [union('u', 'a', 'b', '1919-06', { ended: '1930', out: true })],
    });
    expect(settled(fromGedcom(toGedcom(tree)).tree)).toEqual(settled(withPlainIds(tree)));
  });

  it('reads a file from another program', () => {
    const file = [
      '\uFEFF0 HEAD',
      '1 SOUR OtherTree',
      '1 GEDC',
      '2 VERS 5.5.1',
      '1 CHAR UTF-8',
      '0 @I0001@ INDI',
      '1 NAME Henry /Tudor/',
      '2 GIVN Henry',
      '2 SURN Tudor',
      '2 NPFX King',
      '1 SEX M',
      '1 BIRT',
      '2 DATE 28 JUN 1491',
      '2 PLAC Greenwich',
      '1 DEAT',
      '2 DATE 28 JAN 1547',
      '1 FAMS @F1@',
      '1 FAMS @F2@',
      '1 NOTE @N1@',
      '0 @I0002@ INDI',
      '1 NAME Catherine of Aragon',
      '1 SEX F',
      '1 BIRT',
      '2 DATE ABT 1485',
      '1 BURI',
      '1 FAMS @F1@',
      '0 @I0003@ INDI',
      '1 NAME Mary //',
      '1 SEX F',
      '1 BIRT',
      '2 DATE 18 FEB 1516',
      '1 FAMC @F1@',
      '1 WWW https://example.org/mary',
      '0 @I0004@ INDI',
      '1 NAME Anne /Boleyn/',
      '1 SEX F',
      '1 FAMS @F2@',
      '0 @I0005@ INDI',
      '1 NAME Elizabeth',
      '1 SEX F',
      '1 BIRT',
      '2 DATE 7 SEP 1533',
      '1 NOTE A note that runs',
      '2 CONT onto a second line',
      '2 CONC , and on.',
      '0 @I0006@ INDI',
      '1 NAME Ward /Unknown/',
      '1 FAMC @F2@',
      '2 PEDI adopted',
      '1 FAMC @F1@',
      '2 PEDI birth',
      '0 @F1@ FAM',
      '1 HUSB @I0001@',
      '1 WIFE @I0002@',
      '1 CHIL @I0003@',
      '1 CHIL @I0006@',
      '1 MARR',
      '2 DATE 11 JUN 1509',
      '1 ANUL',
      '2 DATE 23 MAY 1533',
      '0 @F2@ FAM',
      '1 HUSB @I0001@',
      '1 WIFE @I0004@',
      '1 CHIL @I0005@',
      '1 CHIL @I0006@',
      '1 MARR',
      '2 DATE 25 JAN 1533',
      '0 @N1@ NOTE Defender of the Faith.',
      '0 TRLR',
    ].join('\r\n');
    const { tree, warnings, found } = fromGedcom(file);
    expect(found).toBe(6);
    expect(tree.people).toEqual([
      { id: 'p1', name: 'Henry Tudor', title: 'King', sex: 'm', born: '1491-06-28', died: '1547-01-28', notes: 'Defender of the Faith.' },
      { id: 'p2', name: 'Catherine of Aragon', sex: 'f', born: '1485', dead: true },
      { id: 'p3', name: 'Mary', sex: 'f', born: '1516-02-18', link: 'https://example.org/mary', union: 'u1' },
      { id: 'p4', name: 'Anne Boleyn', sex: 'f' },
      { id: 'p5', name: 'Elizabeth', sex: 'f', born: '1533-09-07', notes: 'A note that runs onto a second line, and on.', union: 'u2' },
      { id: 'p6', name: 'Ward Unknown', sex: 'x', union: 'u1' },
    ]);
    expect(tree.unions).toEqual([
      { id: 'u1', a: 'p1', b: 'p2', married: '1509-06-11', ended: '1533-05-23' },
      { id: 'u2', a: 'p1', b: 'p4', married: '1533-01-25' },
    ]);
    expect(warnings).toEqual([
      'One person has more than one set of parents in the file. Dynasty keeps one: the parents by birth, where the file says which.',
      'Genealogy files don’t say who reigns or which law applies. Pick the reigning person and the law to see the line.',
    ]);
    tree.reigning = 'p1';
    // Ward has no birth date, so comes after the dated children.
    expect(lineNames(tree)).toEqual(['Mary', 'Elizabeth', 'Ward Unknown']);
  });

  it('takes a lone parent as the known parent, and children listed only on the family', () => {
    const file = ['0 HEAD', '0 @A@ INDI', '1 NAME Ada', '0 @B@ INDI', '1 NAME Bea', '0 @F@ FAM', '1 WIFE @A@', '1 CHIL @B@', '1 CHIL @GHOST@', '0 TRLR'].join('\n');
    expect(fromGedcom(file).tree.people).toEqual([
      { id: 'p1', name: 'Ada', sex: 'x' },
      { id: 'p2', name: 'Bea', sex: 'x', parent: 'p1' },
    ]);
  });

  it('never throws, and says what is wrong', () => {
    expect(fromGedcom('not a gedcom file')).toMatchObject({ found: 0, warnings: ['That doesn’t look like a GEDCOM file: it should begin with “0 HEAD”.'] });
    expect(fromGedcom('x'.repeat(MAX_GEDCOM_LENGTH + 1)).warnings).toEqual(['That file is too big to read here: the limit is 5 MB.']);
    expect(fromGedcom('0 HEAD\n0 TRLR').warnings).toEqual(['The file has nobody in it.']);
    expect(fromGedcom(undefined as unknown as string).tree).toEqual(cleanTree({}));
    const mess = '0 HEAD\nrubbish\n1\n0 @I1@ INDI\n9 DEEP\n1 NAME <b>Ada</b> /O@@Hara/\n1 FAMC @NOPE@\n1 SEX Q\n1 BIRT\n2 DATE yesterday\n0 @F1@ FAM\n1 HUSB @I1@\n1 WIFE @I1@\n1 CHIL @I1@\n0 TRLR';
    expect(fromGedcom(mess).tree.people).toEqual([{ id: 'p1', name: 'b Ada b O@Hara', sex: 'x' }]);
  });

  it('reads no more people than it holds, and says so', () => {
    const lines = ['0 HEAD'];
    for (let i = 1; i <= 520; i++) lines.push(`0 @I${i}@ INDI`, `1 NAME Person ${i}`);
    lines.push('0 TRLR');
    const result = fromGedcom(lines.join('\n'));
    expect(result.found).toBe(520);
    expect(result.tree.people).toHaveLength(500);
    expect(result.warnings[0]).toBe('The file has 520 people. Dynasty holds 500, so only the first 500 were read.');
  });
});

describe('wikitext', () => {
  it('escapes whatever could be read as markup', () => {
    expect(wikiEscape('[[Link|text]] {{Template}} <b>x</b> & more')).toBe('&#91;&#91;Link&#124;text&#93;&#93; &#123;&#123;Template&#125;&#125; &lt;b&gt;x&lt;/b&gt; &amp; more');
    expect(wikiEscape("O'Brien")).toBe("O'Brien");
    expect(wikiEscape("''bold''")).toBe('&#39;&#39;bold&#39;&#39;');
    expect(wikiEscape('~~~~ __TOC__ https://x.example')).toBe('&#126;&#126;&#126;&#126; _&#95;TOC_&#95; https:&#47;/x.example');
    expect(wikiEscape('#1 son')).toBe('&#35;1 son');
    expect(wikiEscape('-dash')).toBe('&#45;dash');
  });

  it('gives a table of the members', () => {
    const table = membersTable(varenko());
    const rows = table.split('\n');
    expect(rows[0]).toBe('{| class="wikitable sortable"');
    expect(rows[1]).toBe('|+ Members of the House of Varenko');
    expect(rows[2]).toBe('! Name !! Born !! Died !! Parents !! Married !! Place in line');
    expect(rows[4]).toBe('| King Teomir I || 1930 || 1988 ||  || Queen Halina (1956) || Reigned 1961–1988');
    expect(rows).toContain("| King Teomir II || 1958 ||  || King Teomir I and Queen Halina || Queen Ressa (1985) || '''Reigning''' since 1988");
    expect(rows).toContain("| Princess Ilsa || 1986 ||  || King Teomir II and Queen Ressa || Lord Emeric (2012) || '''Heir''' (1)");
    expect(rows).toContain('| Maelin || 2014 ||  || Princess Ilsa and Lord Emeric ||  || 2');
    expect(rows).toContain('| Queen Ressa || 1960 ||  ||  || King Teomir II (1985) || —');
    expect(rows.at(-1)).toBe('|}');
    expect(rows.filter((row) => row === '|-')).toHaveLength(varenko().people.length);
  });

  it('says how a child came into the family, and why someone has no place', () => {
    const table = membersTable(halvard());
    expect(table).toContain('| Lord Bram || 1975 ||  || Duke Osric (born outside marriage) ||  || No place: born outside marriage');
    expect(table).toContain('| Lord Edvin || 1990 ||  || Duke Osric and Duchess Elin (adopted) ||  || No place: adopted, not born to the house');
  });

  it('gives the line of succession as a numbered list', () => {
    expect(successionList(varenko()).split('\n').slice(0, 4)).toEqual([
      "* '''King Teomir II''' (born 1958), reigning since 1988",
      '# Princess Ilsa (born 1986), daughter of King Teomir II',
      '# Maelin (born 2014), daughter of Princess Ilsa',
      '# Teo (born 2017), son of Princess Ilsa',
    ]);
    const empty = lesnia();
    empty.picks = [];
    delete empty.reigning;
    expect(successionList(empty)).toBe("* ''The throne stands empty.''\n: ''Nobody has been chosen yet.''");
  });

  it('puts it all together under headings', () => {
    const text = toWikitext(halvard());
    expect(text.startsWith("== House of Halvard ==\n'''The House of Halvard''' reigns over the Duchy of Skarn. The succession follows absolute primogeniture.\n\n=== Members ===\n{|")).toBe(true);
    expect(text).toContain('\n=== Line of succession ===\n');
    expect(text).toContain('\n=== Not in the line ===\n* Lord Bram: born outside marriage\n');
    expect(text.endsWith('\n')).toBe(true);
    expect(toWikitext(varenko())).not.toContain('Not in the line');
  });

  it('links a person to their page, and lets nothing typed become markup', () => {
    const tree = makeTree({
      house: 'House of [[Trouble]]',
      reigning: 'a',
      people: [person('a', 'King', 'Bob {{evil}} | x', 'm', '1950', { link: 'https://iiwiki.com/wiki/Bob' }), person('b', '', "''Bold''", 'f', '1980', { parent: 'a' })],
    });
    const text = toWikitext(tree);
    expect(text).toContain('[https://iiwiki.com/wiki/Bob King Bob &#123;&#123;evil&#125;&#125; &#124; x]');
    expect(text).toContain('== House of &#91;&#91;Trouble&#93;&#93; ==');
    expect(text).not.toContain('{{');
    expect(text).not.toContain('[[');
    expect(text).not.toContain("''Bold''");
  });

  it('writes something sensible for every example', () => {
    for (const example of examples) {
      const text = toWikitext(example.tree);
      expect(text, example.id).not.toMatch(/undefined|NaN/);
      expect(text.split('\n').filter((line) => line === '|-'), example.id).toHaveLength(example.tree.people.length);
    }
  });
});

describe('wikitext for the tree templates', () => {
  const small = () =>
    makeTree({
      house: 'House of Small',
      reigning: 'k',
      people: [person('k', 'King', 'Hal', 'm', '1950'), person('q', 'Queen', 'Ann', 'f', '1952'), person('a', '', 'Ada', 'f', '1975', { union: 'u' }), person('b', '', 'Bo', 'm', '1978', { union: 'u' })],
      unions: [union('u', 'k', 'q', '1974')],
    });

  it('writes a couple and their children the way the template’s own examples do', () => {
    expect(treeChart(small())).toBe(
      [
        '{{Tree chart/start|summary=Family tree of the House of Small}}',
        "{{Tree chart|P1 |v|P2 |P1='''Reigning'''<br>King Hal<br>b. 1950|P2=Queen Ann<br>b. 1952}}",
        '{{Tree chart| |,|-|^|-|.}}',
        "{{Tree chart|P3 | |P4 |P3='''Heir'''<br>Ada<br>b. 1975|boxstyle_P3=border-width: 3px;|P4='''2nd in line'''<br>Bo<br>b. 1978}}",
        '{{Tree chart/end}}',
      ].join('\n'),
    );
  });

  it('writes the same rows under the Family tree template’s name', () => {
    const chart = treeChart(small());
    const family = treeChart(small(), 'Family tree');
    expect(family).toBe(chart.replaceAll('{{Tree chart', '{{Family tree'));
    expect(family.startsWith('{{Family tree/start|')).toBe(true);
    expect(family.endsWith('{{Family tree/end}}')).toBe(true);
  });

  it('gives every person one box, three tiles wide, with nothing on top of another', () => {
    for (const example of examples) {
      const chart = chartGrid(example.tree);
      const names = chart.rows.flat().filter((tile) => chart.boxes.has(tile));
      expect(names.sort(), example.id).toEqual([...chart.boxes.keys()].sort());
      expect(chart.boxes.size, example.id).toBe(example.tree.people.length);
      for (const row of chart.rows) {
        const width = row.reduce((sum, tile) => sum + (chart.boxes.has(tile) ? 3 : 1), 0);
        expect(width, example.id).toBeLessThanOrEqual(chart.columns);
        // A row holds boxes or the lines between generations; boxes in a row never touch.
        row.forEach((tile, i) => {
          if (chart.boxes.has(tile) && i > 0) expect(chart.boxes.has(row[i - 1]!), example.id).toBe(false);
        });
      }
    }
  });

  it('joins every line to a box or to another line: no loose ends', () => {
    const reach: Record<string, string> = { ',': 'SE', '.': 'SW', '`': 'NE', "'": 'NW', '^': 'NEW', v: 'SEW', ')': 'NSE', '(': 'NSW', '+': 'NSEW', '-': 'EW', '!': 'NS' };
    const back: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' };
    const step: Record<string, [number, number]> = { N: [-1, 0], S: [1, 0], E: [0, 1], W: [0, -1] };
    for (const example of examples) {
      const chart = chartGrid(example.tree);
      // Lay the rows out tile by tile, a box filling three.
      const grid = chart.rows.map((row) => row.flatMap((tile) => (chart.boxes.has(tile) ? ['#', '#', '#'] : [tile])));
      grid.forEach((row, r) => {
        row.forEach((tile, c) => {
          // A straight line may stop short (it is drawn through); corners and junctions may not.
          if (tile === '#' || tile === ' ' || tile === '-' || tile === '!') return;
          for (const side of reach[tile]!) {
            const [dr, dc] = step[side]!;
            const next = grid[r + dr]?.[c + dc];
            const joined = next === '#' || (next !== undefined && next !== ' ' && reach[next]!.includes(back[side]!));
            expect(joined, `${example.id} row ${r} tile ${c} "${tile}" going ${side} meets "${next}"`).toBe(true);
          }
        });
      });
    }
  });

  it('gives each level of lines its own row, so one family’s line can’t be read as another’s', () => {
    // Duke Osric has a son by himself and five children by his marriage: two rows of lines.
    const chart = chartGrid(halvard());
    expect(chart.rows.map((row) => row.join('|'))).toEqual([
      ' | | | | | | | | | | | |P1|v|P2',
      " |,|-|-|-|-|-|-|-|-|-|-|-|'| |!",
      ' |!| | | |,|-|-|-|-|-|-|-|v|-|^|-|-|-|-|-|v|-|-|-|-|-|-|-|.',
      'P3| |P4|v|P5| |P7|v|P8| |P10|v|P11| |P13',
      ' | | | | | | |!| | | | | | | |!| | | | | | | |!',
      ' | | | | | |P6| | | | | |P9| | | | | |P12',
    ]);
    expect(chart.heir).toBe('P10');
  });

  it('says in each box what the card says, and lets nothing typed become markup', () => {
    const tree = small();
    tree.people[2]!.name = 'Ada {{evil}} | [[x]]';
    tree.people[2]!.link = 'https://iiwiki.com/wiki/Ada';
    const chart = chartGrid(cleanTree(tree));
    expect(chart.boxes.get('P1')).toBe("'''Reigning'''<br>King Hal<br>b. 1950");
    expect(chart.boxes.get('P3')).toBe("'''Heir'''<br>[https://iiwiki.com/wiki/Ada Ada &#123;&#123;evil&#125;&#125; &#124; &#91;&#91;x&#93;&#93;]<br>b. 1975");
    const text = treeChart(cleanTree(tree));
    expect(text).not.toContain('{{evil');
    expect(text).not.toContain('[[x');
  });

  it('copes with nobody, with one person, and with a tangle', () => {
    expect(treeChart(cleanTree({}))).toBe('{{Tree chart/start|summary=Family tree}}\n{{Tree chart/end}}');
    expect(treeChart(makeTree({ house: '', reigning: 'a', people: [person('a', '', 'Una', 'f')] }))).toBe(
      "{{Tree chart/start|summary=Family tree}}\n{{Tree chart|P1 |P1='''Reigning'''<br>Una}}\n{{Tree chart/end}}",
    );
    const loop = makeTree({ house: 'House of Loop', people: [person('a', '', 'Ouro', 'm', '', { parent: 'c' }), person('b', '', 'Boros', 'm', '', { parent: 'a' }), person('c', '', 'Cycle', 'f', '', { parent: 'b' })] });
    expect(() => treeChart(loop)).not.toThrow();
    expect(chartGrid(loop).boxes.size).toBe(3);
  });
});

describe('wikitext for the Ahnentafel template', () => {
  it('numbers ancestors: a father is twice the number, a mother one more', () => {
    const numbers = ahnentafelNumbers(varenko(), 'maelin');
    expect(Object.fromEntries([...numbers].map(([n, p]) => [n, p.id]))).toEqual({ 1: 'maelin', 2: 'emeric', 3: 'ilsa', 6: 'teomir2', 7: 'ressa', 12: 'teomir1', 13: 'halina' });
  });

  it('writes the template with the person in bold and dates after each name', () => {
    expect(ahnentafel(varenko(), 'maelin')).toBe(
      [
        '{{Ahnentafel',
        '|collapsed=no',
        "|1=1. '''Maelin''' (born 2014)",
        '|2=2. Lord Emeric (born 1984)',
        '|3=3. Princess Ilsa (born 1986)',
        '|6=6. King Teomir II (born 1958)',
        '|7=7. Queen Ressa (born 1960)',
        '|12=12. King Teomir I (1930–1988)',
        '|13=13. Queen Halina (1933–2001)',
        '}}',
      ].join('\n'),
    );
  });

  it('puts one known parent in the right place, and the first of two unknowns in the father’s', () => {
    const tree = makeTree({
      house: 'House of Test',
      people: [person('me', '', 'Me', 'x', '', { parent: 'mum' }), person('mum', '', 'Mum', 'f', '', { union: 'u' }), person('gx', '', 'First', 'x'), person('gy', '', 'Second', 'x')],
      unions: [union('u', 'gx', 'gy')],
    });
    expect(Object.fromEntries([...ahnentafelNumbers(tree, 'me')].map(([n, p]) => [n, p.id]))).toEqual({ 1: 'me', 3: 'mum', 6: 'gx', 7: 'gy' });
  });

  it('stops at five generations, and ends when someone is their own ancestor', () => {
    const people = Array.from({ length: 9 }, (_, i) => person(`g${i}`, '', `Generation ${i}`, 'm', '', i < 8 ? { parent: `g${i + 1}` } : {}));
    const deep = makeTree({ house: 'House of Deep', people });
    expect([...ahnentafelNumbers(deep, 'g0').keys()]).toEqual([1, 2, 4, 8, 16]);
    const loop = makeTree({ house: 'House of Loop', people: [person('a', '', 'Ouro', 'm', '', { parent: 'b' }), person('b', '', 'Boros', 'm', '', { parent: 'a' })] });
    expect([...ahnentafelNumbers(loop, 'a').keys()]).toEqual([1, 2, 4, 8, 16]);
    expect(ahnentafelNumbers(loop, 'nobody').size).toBe(0);
  });

  it('is of the reigning person unless someone else is asked for', () => {
    expect(ahnentafelSubject(varenko())).toBe('teomir2');
    expect(ahnentafelSubject(varenko(), 'aris')).toBe('aris');
    expect(ahnentafelSubject(varenko(), 'ghost')).toBe('teomir2');
    const nobody = varenko();
    delete nobody.reigning;
    expect(ahnentafelSubject(nobody)).toBe('teomir1');
    expect(ahnentafelSubject(cleanTree({}))).toBeUndefined();
  });
});

describe('wikitext, whichever shape is asked for', () => {
  it('offers four shapes', () => {
    expect(wikiFormats.map((format) => format.id)).toEqual(['tree-chart', 'family-tree', 'ahnentafel', 'table']);
  });

  it('puts the tree, then the line of succession, then who is left out', () => {
    const chart = toWikitext(halvard(), { format: 'tree-chart' });
    expect(chart).toContain('\n=== Family tree ===\n{{Tree chart/start|');
    expect(chart).toContain('{{Tree chart/end}}\n\n=== Line of succession ===\n');
    expect(chart).toContain('\n=== Not in the line ===\n* Lord Bram: born outside marriage\n');
    expect(chart).not.toContain('{| class="wikitable');
    expect(toWikitext(halvard(), { format: 'family-tree' })).toContain('\n=== Family tree ===\n{{Family tree/start|');
    const ancestry = toWikitext(varenko(), { format: 'ahnentafel', subject: 'aris' });
    expect(ancestry).toContain("\n=== Ancestry of Aris ===\n{{Ahnentafel\n|collapsed=no\n|1=1. '''Aris''' (born 2020)\n");
    expect(ancestry).toContain('\n=== Line of succession ===\n');
    expect(toWikitext(varenko(), { format: 'ahnentafel' })).toContain('=== Ancestry of King Teomir II ===');
    expect(toWikitext(varenko(), { format: 'table' })).toBe(toWikitext(varenko()));
    expect(toWikitext(cleanTree({}), { format: 'ahnentafel' })).not.toContain('Ahnentafel');
  });

  it('never leaves a template open, in any shape, for any example', () => {
    for (const example of examples) {
      for (const format of wikiFormats) {
        const text = toWikitext(example.tree, { format: format.id });
        expect((text.match(/\{\{/g) ?? []).length, `${example.id} ${format.id}`).toBe((text.match(/\}\}/g) ?? []).length);
        expect(text, `${example.id} ${format.id}`).not.toMatch(/undefined|NaN/);
      }
    }
  });
});
