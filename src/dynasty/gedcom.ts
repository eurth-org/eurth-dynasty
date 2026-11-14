/**
 * GEDCOM in and out, so a tree made here opens in genealogy programs and a tree made there opens
 * here.
 *
 * Out: GEDCOM 5.5.1, the version nearly everything reads. People, families, titles, dates,
 * marriages, divorces, adoption, notes and links are standard tags. What GEDCOM has no word for
 * (the law, the house rules, who reigns, legitimacy, renunciation) goes in tags that start with
 * an underscore, which the standard sets aside for exactly this and other programs skip.
 *
 * In: 5.5.1 and 7.0, read forgivingly. A file from elsewhere is someone else's input: it is read
 * line by line, never run, and what comes out goes through cleanTree.
 */
import { cleanDate, cleanLink, cleanTree, dateParts, indexTree, laws, lawNames, MAX_PEOPLE, type Exclusions, type Law, type Tree } from './model';

/** The largest GEDCOM file the tool will read: 5 MB. */
export const MAX_GEDCOM_LENGTH = 5_000_000;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** "1958-03-12" as GEDCOM writes it: "12 MAR 1958". Years before 1 become "120 B.C.". */
export function toGedcomDate(date: string | undefined): string {
  const parts = dateParts(date);
  if (!parts) return '';
  const year = parts.year < 0 ? `${-parts.year} B.C.` : String(parts.year);
  const month = parts.month === undefined ? '' : `${MONTHS[parts.month - 1]} `;
  const day = parts.day === undefined || parts.month === undefined ? '' : `${parts.day} `;
  return `${day}${month}${year}`;
}

/**
 * A GEDCOM date as ours, or undefined. Approximations ("ABT 1850", "BEF 1900") keep their date,
 * ranges and periods keep their first, and phrases in brackets are skipped.
 */
export function fromGedcomDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value
    .toUpperCase()
    .replace(/@#D[A-Z ]+@/g, ' ')
    .replace(/\b(ABT|ABOUT|CAL|EST|BEF|AFT|FROM|BET|INT|GREGORIAN|JULIAN)\b\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const found = /^(?:(\d{1,2}) )?(?:(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.? )?(\d{1,5})(?:\/\d{1,2})?( ?B\.?C\.?(?:E\.?)?)?/.exec(text);
  if (!found) return undefined;
  const year = Number(found[3]) * (found[4] ? -1 : 1);
  const month = found[2] ? MONTHS.indexOf(found[2]) + 1 : undefined;
  const day = found[1] && month ? Number(found[1]) : undefined;
  return cleanDate(`${year}${month ? `-${month}` : ''}${month && day ? `-${day}` : ''}`);
}

/** The two ends of "FROM 1961 TO 1988"; either may be missing. */
function period(value: string | undefined): [string | undefined, string | undefined] {
  if (!value) return [undefined, undefined];
  const upper = value.toUpperCase();
  const to = /\bTO\b(.*)$/.exec(upper);
  const from = upper.replace(/\bTO\b.*$/, '');
  return [/\d/.test(from) ? fromGedcomDate(from) : undefined, to ? fromGedcomDate(to[1]) : undefined];
}

// ---------------------------------------------------------------------------------------------
// Out
// ---------------------------------------------------------------------------------------------

/** One line of text as GEDCOM lines: "@" doubled, and long text continued with CONC. */
function textLines(level: number, tag: string, text: string): string[] {
  const escaped = text.replace(/@/g, '@@');
  const lines: string[] = [];
  let rest = escaped;
  let first = true;
  while (rest.length > 200) {
    // Break where neither side is a space: programs differ on whether CONC keeps one.
    let at = 200;
    while (at > 100 && (rest[at] === ' ' || rest[at - 1] === ' ' || (rest[at - 1] === '@' && rest[at] === '@'))) at--;
    lines.push(`${first ? level : level + 1} ${first ? tag : 'CONC'} ${rest.slice(0, at)}`);
    rest = rest.slice(at);
    first = false;
  }
  lines.push(`${first ? level : level + 1} ${first ? tag : 'CONC'} ${rest}`);
  return lines;
}

/**
 * The tree as a GEDCOM 5.5.1 file.
 * @param tree a clean tree (see cleanTree)
 */
export function toGedcom(tree: Tree): string {
  const index = indexTree(tree);
  const out: string[] = [];
  const iref = new Map(tree.people.map((p, i) => [p.id, `@I${i + 1}@`]));

  // GEDCOM hangs every child on a family, so a child of one known parent gets a family of one.
  interface Family {
    ref: string;
    partners: string[];
    union?: string;
    children: string[];
  }
  const families: Family[] = [];
  const familyOfUnion = new Map<string, Family>();
  const familyOfParent = new Map<string, Family>();
  for (const u of tree.unions) {
    const family: Family = { ref: `@F${families.length + 1}@`, partners: [u.a, u.b], union: u.id, children: index.childrenOfUnion(u.id).map((p) => p.id) };
    families.push(family);
    familyOfUnion.set(u.id, family);
  }
  for (const p of tree.people) {
    if (p.union !== undefined || p.parent === undefined) continue;
    let family = familyOfParent.get(p.parent);
    if (!family) {
      family = { ref: `@F${families.length + 1}@`, partners: [p.parent], children: [] };
      families.push(family);
      familyOfParent.set(p.parent, family);
    }
    family.children.push(p.id);
  }

  out.push('0 HEAD', '1 SOUR DYNASTY', '2 NAME Dynasty, by Eurth', '2 VERS 1', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '1 SUBM @SUBM@');
  const about = [[tree.house, tree.realm].filter(Boolean).join(', '), `Succession law: ${lawNames[tree.law].toLowerCase()}.`].filter(Boolean).join('. ');
  out.push(...textLines(1, 'NOTE', about));
  out.push('1 _DYNASTY');
  if (tree.house) out.push(...textLines(2, '_HOUSE', tree.house));
  if (tree.realm) out.push(...textLines(2, '_REALM', tree.realm));
  out.push(`2 _LAW ${tree.law}`);
  const rules = (Object.keys(tree.exclude) as (keyof Exclusions)[]).filter((key) => tree.exclude[key]);
  out.push(`2 _RULES ${rules.length ? rules.join(' ') : 'none'}`);
  if (tree.reigning !== undefined) out.push(`2 _REIGN ${iref.get(tree.reigning)}`);
  if (tree.founder !== undefined) out.push(`2 _FOUND ${iref.get(tree.founder)}`);
  for (const pick of tree.picks) out.push(`2 _PICK ${iref.get(pick)}`);
  out.push('0 @SUBM@ SUBM', '1 NAME Dynasty');

  for (const p of tree.people) {
    out.push(`0 ${iref.get(p.id)} INDI`);
    out.push(...textLines(1, 'NAME', p.name || 'Unnamed'));
    if (p.title) {
      out.push(...textLines(1, 'TITL', p.title));
      if (p.reignFrom || p.reignTo) out.push(`2 DATE ${[p.reignFrom ? `FROM ${toGedcomDate(p.reignFrom)}` : '', p.reignTo ? `TO ${toGedcomDate(p.reignTo)}` : ''].filter(Boolean).join(' ')}`);
    } else if (p.reignFrom || p.reignTo) {
      out.push('1 EVEN', '2 TYPE Reign', `2 DATE ${[p.reignFrom ? `FROM ${toGedcomDate(p.reignFrom)}` : '', p.reignTo ? `TO ${toGedcomDate(p.reignTo)}` : ''].filter(Boolean).join(' ')}`);
    }
    out.push(`1 SEX ${p.sex === 'm' ? 'M' : p.sex === 'f' ? 'F' : 'U'}`);
    if (p.born) out.push('1 BIRT', `2 DATE ${toGedcomDate(p.born)}`);
    if (p.died) out.push('1 DEAT', `2 DATE ${toGedcomDate(p.died)}`);
    else if (p.dead) out.push('1 DEAT Y');
    const born = p.union !== undefined ? familyOfUnion.get(p.union) : p.parent !== undefined ? familyOfParent.get(p.parent) : undefined;
    if (born) out.push(`1 FAMC ${born.ref}`, `2 PEDI ${p.adopted ? 'adopted' : 'birth'}`);
    for (const family of families) {
      if (family.partners.includes(p.id)) out.push(`1 FAMS ${family.ref}`);
    }
    if (p.illegitimate) out.push('1 _ILLEG Y');
    if (p.renounced) out.push(`1 _RENO ${p.renounced.toUpperCase()}`);
    if (p.abdicated) out.push('1 _ABDI Y');
    if (p.link) out.push(...textLines(1, 'WWW', p.link));
    if (p.notes) out.push(...textLines(1, 'NOTE', p.notes));
  }

  for (const family of families) {
    out.push(`0 ${family.ref} FAM`);
    const partners = family.partners.map((id) => index.person.get(id)!);
    // GEDCOM 5.5.1 has a husband's place and a wife's and nothing else. A man takes the first and
    // a woman the second; otherwise the partners keep the order they were given in.
    let [first, second] = partners;
    if (second && (second.sex === 'm' || first!.sex === 'f') && first!.sex !== 'm' && second.sex !== 'f') [first, second] = [second, first];
    if (!second && first!.sex === 'f') [first, second] = [undefined, first];
    if (first) out.push(`1 HUSB ${iref.get(first.id)}`);
    if (second) out.push(`1 WIFE ${iref.get(second.id)}`);
    for (const child of family.children) out.push(`1 CHIL ${iref.get(child)}`);
    const u = family.union === undefined ? undefined : index.union.get(family.union);
    if (u) {
      out.push(...(u.married ? ['1 MARR', `2 DATE ${toGedcomDate(u.married)}`] : ['1 MARR Y']));
      if (u.ended) out.push('1 DIV', `2 DATE ${toGedcomDate(u.ended)}`);
      if (u.out) out.push('1 _OUT Y');
    }
  }
  out.push('0 TRLR');
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
// In
// ---------------------------------------------------------------------------------------------

interface Line {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  children: Line[];
}

/** Whether a text looks like a GEDCOM file at all. */
export const isGedcom = (text: string): boolean => /^\uFEFF?\s*0\s+HEAD\b/.test(text);

function parseLines(text: string): Line[] {
  const records: Line[] = [];
  const stack: Line[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
    const found = /^\s*(\d{1,2})\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?: (.*))?$/.exec(raw);
    if (!found) continue;
    const line: Line = { level: Number(found[1]), tag: found[3]!.toUpperCase(), value: found[4] ?? '', children: [], ...(found[2] ? { xref: found[2] } : {}) };
    while (stack.length && stack.at(-1)!.level >= line.level) stack.pop();
    const parent = stack.at(-1);
    if (parent && (line.tag === 'CONC' || line.tag === 'CONT')) {
      parent.value += (line.tag === 'CONT' ? ' ' : '') + line.value;
      continue;
    }
    if (parent) parent.children.push(line);
    else if (line.level === 0) records.push(line);
    else continue;
    stack.push(line);
  }
  return records;
}

const child = (line: Line | undefined, tag: string): Line | undefined => line?.children.find((c) => c.tag === tag);
const all = (line: Line | undefined, tag: string): Line[] => line?.children.filter((c) => c.tag === tag) ?? [];
const plain = (value: string): string => value.replace(/@@/g, '@');
const yes = (line: Line | undefined): boolean => line !== undefined && !/^(N|NO|FALSE)$/i.test(line.value.trim());

export interface GedcomResult {
  tree: Tree;
  /** Things the person should know: what was left behind, what was assumed. */
  warnings: string[];
  /** How many people the file held, before any were left behind. */
  found: number;
}

/**
 * Reads a GEDCOM file into a tree. It never throws: a file that isn't GEDCOM gives an empty tree
 * and a warning that says so.
 */
export function fromGedcom(text: string): GedcomResult {
  const warnings: string[] = [];
  if (typeof text !== 'string' || text.length > MAX_GEDCOM_LENGTH) {
    return { tree: cleanTree({}), warnings: ['That file is too big to read here: the limit is 5 MB.'], found: 0 };
  }
  if (!isGedcom(text)) {
    return { tree: cleanTree({}), warnings: ['That doesn’t look like a GEDCOM file: it should begin with “0 HEAD”.'], found: 0 };
  }
  const records = parseLines(text);
  const individuals = records.filter((r) => r.tag === 'INDI' && r.xref);
  const familyRecords = records.filter((r) => r.tag === 'FAM' && r.xref);
  const sharedNotes = new Map(records.filter((r) => (r.tag === 'NOTE' || r.tag === 'SNOTE') && r.xref).map((r) => [r.xref!, plain(r.value)]));

  if (individuals.length > MAX_PEOPLE) {
    warnings.push(`The file has ${individuals.length} people. Dynasty holds ${MAX_PEOPLE}, so only the first ${MAX_PEOPLE} were read.`);
  }
  const kept = individuals.slice(0, MAX_PEOPLE);
  const pid = new Map(kept.map((r, i) => [r.xref!, `p${i + 1}`]));

  // Families: two partners make a union; one makes that person the known parent of the children.
  interface Fam {
    union?: string;
    parent?: string;
  }
  const fams = new Map<string, Fam>();
  const unions: Record<string, unknown>[] = [];
  const childFamily = new Map<string, string>();
  for (const record of familyRecords) {
    const partners = [...new Set(record.children.filter((c) => c.tag === 'HUSB' || c.tag === 'WIFE').map((c) => pid.get(c.value.trim())))].filter((id): id is string => id !== undefined);
    const fam: Fam = {};
    if (partners.length >= 2) {
      const id = `u${unions.length + 1}`;
      const ended = child(record, 'DIV') ?? child(record, 'ANUL');
      unions.push({
        id,
        a: partners[0],
        b: partners[1],
        married: fromGedcomDate(child(child(record, 'MARR'), 'DATE')?.value),
        ended: fromGedcomDate(child(ended, 'DATE')?.value),
        out: yes(child(record, '_OUT')),
      });
      fam.union = id;
    } else if (partners.length === 1) {
      fam.parent = partners[0]!;
    }
    fams.set(record.xref!, fam);
    for (const c of all(record, 'CHIL')) {
      const id = pid.get(c.value.trim());
      if (id !== undefined && !childFamily.has(id)) childFamily.set(id, record.xref!);
    }
  }

  let severalParents = 0;
  const people = kept.map((record): Record<string, unknown> => {
    const id = pid.get(record.xref!)!;
    const nameLine = child(record, 'NAME');
    let name = plain(nameLine?.value ?? '').replace(/\//g, ' ');
    if (!name.trim()) name = [child(nameLine, 'GIVN')?.value, child(nameLine, 'SURN')?.value].filter(Boolean).join(' ');
    const titleLine = child(record, 'TITL');
    const reignLine = titleLine && child(titleLine, 'DATE') ? titleLine : all(record, 'EVEN').find((e) => /reign/i.test(child(e, 'TYPE')?.value ?? ''));
    const [reignFrom, reignTo] = period(child(reignLine, 'DATE')?.value);
    const sex = child(record, 'SEX')?.value.trim().toUpperCase();
    const death = child(record, 'DEAT');
    const died = fromGedcomDate(child(death, 'DATE')?.value);

    // The family the person was born into: the one marked "birth" if there are several.
    const famcs = all(record, 'FAMC').filter((f) => fams.has(f.value.trim()));
    if (famcs.length > 1) severalParents++;
    const famc = famcs.find((f) => /^birth$/i.test(child(f, 'PEDI')?.value.trim() ?? '')) ?? famcs[0];
    const famRef = famc?.value.trim() ?? childFamily.get(id);
    const fam = famRef === undefined ? undefined : fams.get(famRef);
    const adoptedHere = /^(adopted|foster)$/i.test(child(famc, 'PEDI')?.value.trim() ?? '') || all(record, 'ADOP').some((a) => child(a, 'FAMC')?.value.trim() === famRef);

    const notes = all(record, 'NOTE')
      .concat(all(record, 'SNOTE'))
      .map((n) => (sharedNotes.get(n.value.trim()) ?? plain(n.value)).trim())
      .filter(Boolean)
      .join(' ');
    const link = ['WWW', '_URL', 'URL', '_LINK']
      .flatMap((tag) => all(record, tag))
      .map((l) => cleanLink(plain(l.value)))
      .find(Boolean);
    const renounced = child(record, '_RENO')?.value.trim().toUpperCase();

    return {
      id,
      name,
      title: plain(titleLine?.value ?? child(nameLine, 'NPFX')?.value ?? ''),
      sex: sex === 'M' ? 'm' : sex === 'F' ? 'f' : 'x',
      born: fromGedcomDate(child(child(record, 'BIRT'), 'DATE')?.value),
      died,
      dead: death !== undefined || child(record, 'BURI') !== undefined || child(record, 'CREM') !== undefined,
      reignFrom,
      reignTo,
      notes,
      link,
      union: fam?.union,
      parent: fam?.union === undefined ? fam?.parent : undefined,
      adopted: adoptedHere,
      illegitimate: yes(child(record, '_ILLEG')),
      renounced: renounced === 'SELF' ? 'self' : renounced === 'LINE' ? 'line' : undefined,
      abdicated: yes(child(record, '_ABDI')),
    };
  });
  if (severalParents) {
    warnings.push(
      `${severalParents === 1 ? 'One person has' : `${severalParents} people have`} more than one set of parents in the file. Dynasty keeps one: the parents by birth, where the file says which.`,
    );
  }

  // What Dynasty itself wrote in the header, if this file came from here.
  const own = child(
    records.find((r) => r.tag === 'HEAD'),
    '_DYNASTY',
  );
  const ruleWords = child(own, '_RULES')?.value.toLowerCase().split(/\s+/);
  const law = child(own, '_LAW')?.value.trim().toLowerCase();
  const tree = cleanTree({
    house: plain(child(own, '_HOUSE')?.value ?? ''),
    realm: plain(child(own, '_REALM')?.value ?? ''),
    law: laws.includes(law as Law) ? law : 'absolute',
    exclude: ruleWords ? { illegitimate: ruleWords.includes('illegitimate'), renounced: ruleWords.includes('renounced'), out: ruleWords.includes('out'), adopted: ruleWords.includes('adopted') } : undefined,
    reigning: pid.get(child(own, '_REIGN')?.value.trim() ?? ''),
    founder: pid.get(child(own, '_FOUND')?.value.trim() ?? ''),
    picks: all(own, '_PICK').map((p) => pid.get(p.value.trim())),
    people,
    unions,
  });

  if (!individuals.length) warnings.push('The file has nobody in it.');
  else if (!own) warnings.push('Genealogy files don’t say who reigns or which law applies. Pick the reigning person and the law to see the line.');
  return { tree, warnings, found: individuals.length };
}
