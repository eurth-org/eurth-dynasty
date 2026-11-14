/**
 * Example houses. All of them are invented, in invented realms: any likeness to a real family is
 * a coincidence, and to a real succession crisis, an inevitability.
 *
 * The guide's worked examples (src/content/guide.ts) are built from these, and the tests check
 * every law against them.
 */
import { cleanTree, defaultExclusions, type Law, type Person, type Sex, type Tree, type Union } from './model';

type PersonExtra = Partial<Omit<Person, 'id' | 'name' | 'sex' | 'title'>>;

/** A person, written briefly: id, title, name, sex, born, and anything else. */
export const person = (id: string, title: string, name: string, sex: Sex, born?: string, extra: PersonExtra = {}): Person => ({
  id,
  name,
  sex,
  ...(title ? { title } : {}),
  ...(born ? { born } : {}),
  ...extra,
});

/** A marriage: id, the two partners, the year, and anything else. */
export const union = (id: string, a: string, b: string, married?: string, extra: Partial<Omit<Union, 'id' | 'a' | 'b' | 'married'>> = {}): Union => ({
  id,
  a,
  b,
  ...(married ? { married } : {}),
  ...extra,
});

/** A tree from its parts, cleaned like any other. */
export const makeTree = (parts: Partial<Tree> & { house: string; people: Person[] }): Tree =>
  cleanTree({ unions: [], law: 'absolute', exclude: defaultExclusions(), picks: [], ...parts });

export interface Example {
  id: string;
  /** What the example shows, in a sentence. */
  blurb: string;
  tree: Tree;
}

/**
 * The House of Varenko, Kingdom of Ostaril: three generations below the old king, with a
 * daughter born first. The guide runs this one family through all five laws.
 */
export function varenko(law: Law = 'absolute'): Tree {
  return makeTree({
    house: 'House of Varenko',
    realm: 'Kingdom of Ostaril',
    law,
    reigning: 'teomir2',
    founder: 'teomir1',
    picks: law === 'elective' ? ['kosti', 'radan', 'ilsa'] : [],
    people: [
      person('teomir1', 'King', 'Teomir I', 'm', '1930', { died: '1988', reignFrom: '1961', reignTo: '1988' }),
      person('halina', 'Queen', 'Halina', 'f', '1933', { died: '2001' }),
      person('teomir2', 'King', 'Teomir II', 'm', '1958', { union: 'u1', reignFrom: '1988' }),
      person('ressa', 'Queen', 'Ressa', 'f', '1960'),
      person('dobra', 'Princess', 'Dobra', 'f', '1961', { union: 'u1' }),
      person('petar', 'Count', 'Petar of Lask', 'm', '1957'),
      person('radan', 'Prince', 'Radan', 'm', '1964', { union: 'u1' }),
      person('ysabet', 'Princess', 'Ysabet', 'f', '1967'),
      person('ilsa', 'Princess', 'Ilsa', 'f', '1986', { union: 'u2' }),
      person('emeric', 'Lord', 'Emeric', 'm', '1984'),
      person('vanko', 'Prince', 'Vanko', 'm', '1989', { union: 'u2' }),
      person('sunniva', 'Lady', 'Sunniva', 'f', '1990'),
      person('kosti', 'Prince', 'Kosti', 'm', '1993', { union: 'u2' }),
      person('milan', 'Lord', 'Milan of Lask', 'm', '1990', { union: 'u3' }),
      person('luka', 'Prince', 'Luka', 'm', '1995', { union: 'u4' }),
      person('neda', 'Princess', 'Neda', 'f', '1998', { union: 'u4' }),
      person('maelin', '', 'Maelin', 'f', '2014', { union: 'u5' }),
      person('teo', '', 'Teo', 'm', '2017', { union: 'u5' }),
      person('aris', '', 'Aris', 'm', '2020', { union: 'u6' }),
    ],
    unions: [
      union('u1', 'teomir1', 'halina', '1956'),
      union('u2', 'teomir2', 'ressa', '1985'),
      union('u3', 'dobra', 'petar', '1988'),
      union('u4', 'radan', 'ysabet', '1993'),
      union('u5', 'ilsa', 'emeric', '2012'),
      union('u6', 'vanko', 'sunniva', '2018'),
    ],
  });
}

/**
 * The House of Halvard, Duchy of Skarn: one duke, five children, and a reason for almost every
 * one of them to be left out. The guide uses it for the exclusions.
 */
export function halvard(exclude: Partial<Tree['exclude']> = {}): Tree {
  return makeTree({
    house: 'House of Halvard',
    realm: 'Duchy of Skarn',
    law: 'absolute',
    reigning: 'osric',
    founder: 'osric',
    exclude: { ...defaultExclusions(), ...exclude },
    people: [
      person('osric', 'Duke', 'Osric', 'm', '1950', { reignFrom: '1979' }),
      person('elin', 'Duchess', 'Elin', 'f', '1952'),
      person('bram', 'Lord', 'Bram', 'm', '1975', { parent: 'osric', illegitimate: true, notes: 'Son of the Duke and Tove Lund, before his marriage.' }),
      person('signe', 'Lady', 'Signe', 'f', '1978', { union: 'h1', renounced: 'line', notes: 'Renounced in 2001 for herself and her heirs, to marry abroad.' }),
      person('caius', 'Prince', 'Caius of Merrow', 'm', '1974'),
      person('arvid', 'Lord', 'Arvid', 'm', '2003', { union: 'h2' }),
      person('halden', 'Lord', 'Halden', 'm', '1981', { union: 'h1' }),
      person('mara', '', 'Mara Quill', 'f', '1983', { notes: 'An actress. The ducal council did not approve.' }),
      person('jory', '', 'Jory Quill', 'm', '2008', { union: 'h3' }),
      person('ylva', 'Lady', 'Ylva', 'f', '1984', { union: 'h1' }),
      person('torsten', 'Lord', 'Torsten', 'm', '1982'),
      person('runa', 'Lady', 'Runa', 'f', '2010', { union: 'h4' }),
      person('edvin', 'Lord', 'Edvin', 'm', '1990', { union: 'h1', adopted: true, notes: 'A ward of the Duke, adopted in 1996.' }),
    ],
    unions: [
      union('h1', 'osric', 'elin', '1977'),
      union('h2', 'signe', 'caius', '2001'),
      union('h3', 'halden', 'mara', '2007', { out: true }),
      union('h4', 'ylva', 'torsten', '2008'),
    ],
  });
}

/**
 * The House of Maravel, Kingdom of Calderwyn, as in the Calderwyn example profile: Queen
 * Ysolde III, her three children and her brother.
 */
export function maravel(): Tree {
  return makeTree({
    house: 'House of Maravel',
    realm: 'Kingdom of Calderwyn',
    law: 'absolute',
    reigning: 'ysolde',
    founder: 'aldous',
    people: [
      person('aldous', 'King', 'Aldous IV', 'm', '1931', { died: '1999', reignFrom: '1962', reignTo: '1999' }),
      person('maren', 'Queen', 'Maren', 'f', '1936', { died: '2015' }),
      person('ysolde', 'Queen', 'Ysolde III', 'f', '1961', { union: 'm1', reignFrom: '1999' }),
      person('garrick', 'Prince', 'Garrick of Eskmouth', 'm', '1958', { notes: 'Prince consort.' }),
      person('alaric', 'Duke', 'Alaric of Wynmere', 'm', '1965', { union: 'm1' }),
      person('edric', 'Prince', 'Edric', 'm', '1988', { union: 'm2' }),
      person('liane', 'Princess', 'Liane', 'f', '1991', { union: 'm2' }),
      person('tobin', 'Prince', 'Tobin', 'm', '1996', { union: 'm2' }),
    ],
    unions: [union('m1', 'aldous', 'maren', '1959'), union('m2', 'ysolde', 'garrick', '1986')],
  });
}

/**
 * The House of Rothmere, Grand Duchy of Valdenau: an agnatic house whose Grand Duke has only
 * daughters, so the crown is heading for his brother's branch.
 */
export function rothmere(): Tree {
  return makeTree({
    house: 'House of Rothmere',
    realm: 'Grand Duchy of Valdenau',
    law: 'agnatic',
    reigning: 'leopold',
    founder: 'konrad',
    people: [
      person('konrad', 'Grand Duke', 'Konrad III', 'm', '1921', { died: '1990', reignFrom: '1948', reignTo: '1990' }),
      person('adela', 'Grand Duchess', 'Adela', 'f', '1925', { died: '2004' }),
      person('leopold', 'Grand Duke', 'Leopold II', 'm', '1950', { union: 'r1', reignFrom: '1990' }),
      person('irmina', 'Grand Duchess', 'Irmina', 'f', '1954'),
      person('anselm', 'Prince', 'Anselm', 'm', '1953', { union: 'r1', died: '2019' }),
      person('odila', 'Princess', 'Odila', 'f', '1956'),
      person('wilhelmina', 'Princess', 'Wilhelmina', 'f', '1957', { union: 'r1' }),
      person('clara', 'Hereditary Princess', 'Clara', 'f', '1979', { union: 'r2' }),
      person('sophie', 'Princess', 'Sophie', 'f', '1982', { union: 'r2' }),
      person('felix', 'Lord', 'Felix Arden', 'm', '1977'),
      person('august', '', 'August Arden', 'm', '2009', { union: 'r4' }),
      person('ruprecht', 'Prince', 'Ruprecht', 'm', '1981', { union: 'r3' }),
      person('matthias', 'Prince', 'Matthias', 'm', '1985', { union: 'r3' }),
      person('helene', 'Princess', 'Helene', 'f', '1984'),
      person('konradin', 'Prince', 'Konradin', 'm', '2012', { union: 'r5' }),
    ],
    unions: [
      union('r1', 'konrad', 'adela', '1948'),
      union('r2', 'leopold', 'irmina', '1977'),
      union('r3', 'anselm', 'odila', '1979'),
      union('r4', 'clara', 'felix', '2006'),
      union('r5', 'ruprecht', 'helene', '2010'),
    ],
  });
}

/**
 * The House of Tamar, Emirate of Sarhad: agnatic seniority. The Emir's brothers stand before
 * his sons, and the sons of an elder brother before the sons of a younger.
 */
export function tamar(): Tree {
  return makeTree({
    house: 'House of Tamar',
    realm: 'Emirate of Sarhad',
    law: 'seniority',
    reigning: 'hasim',
    founder: 'idris',
    people: [
      person('idris', 'Emir', 'Idris the Elder', 'm', '1925', { died: '1995', reignFrom: '1951', reignTo: '1995' }),
      person('hasim', 'Emir', 'Hasim', 'm', '1950', { parent: 'idris', reignFrom: '1995' }),
      person('rafiq', 'Sheikh', 'Rafiq', 'm', '1953', { parent: 'idris' }),
      person('samira', 'Sheikha', 'Samira', 'f', '1955', { parent: 'idris' }),
      person('yusuf', 'Sheikh', 'Yusuf', 'm', '1960', { parent: 'idris' }),
      person('karim', 'Sheikh', 'Karim', 'm', '1975', { parent: 'hasim' }),
      person('nadir', 'Sheikh', 'Nadir', 'm', '1979', { parent: 'hasim' }),
      person('tariq', 'Sheikh', 'Tariq', 'm', '1978', { parent: 'rafiq' }),
      person('omar', 'Sheikh', 'Omar', 'm', '1986', { parent: 'yusuf' }),
      person('zayd', 'Sheikh', 'Zayd', 'm', '2001', { parent: 'karim' }),
    ],
  });
}

/**
 * The Crown of Lesnia: an elective monarchy. The Diet has ranked three candidates, and the late
 * king's eldest son is not the first of them.
 */
export function lesnia(): Tree {
  return makeTree({
    house: 'House of Wojnar',
    realm: 'Crown of Lesnia',
    law: 'elective',
    reigning: 'bogdan',
    founder: 'stanek',
    picks: ['jarek', 'wit', 'kasimir'],
    people: [
      person('stanek', 'King', 'Stanek II', 'm', '1928', { died: '1991', reignFrom: '1960', reignTo: '1991' }),
      person('ludmila', 'Queen', 'Ludmila', 'f', '1932', { died: '2010' }),
      person('bogdan', 'King', 'Bogdan', 'm', '1955', { union: 'l1', reignFrom: '1991', notes: 'Elected by the Diet of 1991.' }),
      person('zofia', 'Queen', 'Zofia', 'f', '1958'),
      person('wit', 'Prince', 'Wit', 'm', '1959', { union: 'l1' }),
      person('kasimir', 'Prince', 'Kasimir', 'm', '1983', { union: 'l2' }),
      person('danuta', 'Princess', 'Danuta', 'f', '1986', { union: 'l2' }),
      person('jarek', 'Hetman', 'Jarek Ostrow', 'm', '1980', { notes: 'Grand Hetman of the Crown, and the Diet’s favourite.' }),
    ],
    unions: [union('l1', 'stanek', 'ludmila', '1953'), union('l2', 'bogdan', 'zofia', '1981'), union('l3', 'danuta', 'jarek', '2011')],
  });
}

/** The houses on the Examples page, in the order they are shown. */
export const examples: Example[] = [
  {
    id: 'varenko',
    blurb: 'Absolute primogeniture: the king’s eldest child is a daughter, and she is the heir.',
    tree: varenko(),
  },
  {
    id: 'maravel',
    blurb: 'A reigning queen, her three children and her brother, as in the Calderwyn example profile.',
    tree: maravel(),
  },
  {
    id: 'rothmere',
    blurb: 'Agnatic primogeniture: the Grand Duke has only daughters, so his nephew is the heir.',
    tree: rothmere(),
  },
  {
    id: 'tamar',
    blurb: 'Agnatic seniority: the Emir’s brothers come before his sons.',
    tree: tamar(),
  },
  {
    id: 'lesnia',
    blurb: 'An elective crown: the Diet has ranked its candidates, and blood is no promise.',
    tree: lesnia(),
  },
  {
    id: 'halvard',
    blurb: 'Every exclusion at once: an illegitimate son, a renunciation, a marriage out and an adoption.',
    tree: halvard(),
  },
];

export const exampleById = (id: string): Example | undefined => examples.find((example) => example.id === id);
