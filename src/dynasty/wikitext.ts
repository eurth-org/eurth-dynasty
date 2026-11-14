/**
 * Wikitext for IIWiki: the house as a table of its members and a numbered line of succession.
 *
 * This is the plain version, which works on any MediaWiki site because it uses no templates.
 * A version for IIWiki's own family tree templates waits on knowing which of them it has.
 *
 * Whatever a person typed is escaped, so a name can't open a link, a template or a table cell.
 */
import { withThe } from './describe';
import { displayName, formatDate, indexTree, isDead, lawNames, yearOf, type Person, type Tree, type TreeIndex } from './model';
import { claimText, lineOfSuccession, reasonText, type Succession } from './succession';

/** Text that MediaWiki shows as typed and never reads as markup. */
export function wikiEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\|/g, '&#124;')
    .replace(/'{2,}/g, (run) => '&#39;'.repeat(run.length))
    .replace(/~{3,}/g, (run) => '&#126;'.repeat(run.length))
    .replace(/__/g, '_&#95;')
    .replace(/:\/\//g, ':&#47;/')
    .replace(/^([*#:;=!\-+ ])/, (first) => `&#${first.charCodeAt(0)};`);
}

/** A person's name, linked to their page when they have one. */
function wikiName(person: Person | undefined): string {
  const name = wikiEscape(displayName(person));
  return person?.link ? `[${person.link} ${name}]` : name;
}

const status = (tree: Tree, succession: Succession, person: Person, index: TreeIndex): string => {
  if (succession.reigning === person.id) return `'''Reigning'''${person.reignFrom ? ` since ${yearOf(person.reignFrom)}` : ''}`;
  const place = succession.line.find((entry) => entry.id === person.id)?.place;
  if (place === 1) return tree.law === 'elective' ? "'''First choice'''" : "'''Heir''' (1)";
  if (place !== undefined) return String(place);
  if (person.reignFrom) return `Reigned ${yearOf(person.reignFrom)}–${yearOf(person.reignTo)}`;
  const excluded = succession.excluded.find((entry) => entry.id === person.id);
  if (excluded) return `No place: ${wikiEscape(reasonText(tree, excluded, index))}`;
  return isDead(person) ? '' : '—';
};

/** The members of the house as a sortable table. */
export function membersTable(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const rows = ['{| class="wikitable sortable"', `|+ ${wikiEscape(tree.house ? `Members of ${withThe(tree.house)}` : 'Members of the house')}`, '! Name !! Born !! Died !! Parents !! Married !! Place in line'];
  for (const person of tree.people) {
    const parents = index.parents(person.id).map((id) => wikiName(index.person.get(id)));
    const how = person.adopted ? ' (adopted)' : person.illegitimate ? ' (born outside marriage)' : '';
    const spouses = index.unions(person.id).map((u) => {
      const year = yearOf(u.married);
      return `${wikiName(index.person.get(index.partner(u, person.id)))}${year ? ` (${year})` : ''}`;
    });
    const died = person.died ? formatDate(person.died) : person.dead ? 'yes' : '';
    rows.push('|-', `| ${[wikiName(person), formatDate(person.born), died, parents.length ? parents.join(' and ') + how : '', spouses.join('<br>'), status(tree, succession, person, index)].join(' || ')}`);
  }
  rows.push('|}');
  return rows.join('\n');
}

/** The line of succession as a numbered list, with the reigning person above it. */
export function successionList(tree: Tree, succession: Succession = lineOfSuccession(tree), index: TreeIndex = indexTree(tree)): string {
  const lines: string[] = [];
  const reigning = succession.reigning === undefined ? undefined : index.person.get(succession.reigning);
  lines.push(reigning ? `* '''${wikiName(reigning)}'''${reigning.born ? ` (born ${yearOf(reigning.born)})` : ''}, reigning${reigning.reignFrom ? ` since ${yearOf(reigning.reignFrom)}` : ''}` : "* ''The throne stands empty.''");
  for (const place of succession.line) {
    const person = index.person.get(place.id);
    const claim = claimText(tree, place, index);
    lines.push(`# ${wikiName(person)}${person?.born ? ` (born ${yearOf(person.born)})` : ''}${claim ? `, ${wikiEscape(claim)}` : ''}`);
  }
  if (!succession.line.length) lines.push(tree.law === 'elective' ? ": ''Nobody has been chosen yet.''" : ": ''There is no heir.''");
  return lines.join('\n');
}

/**
 * The whole export: a heading, a sentence on the law, the table, the line, and who is left out.
 * @param tree a clean tree (see cleanTree)
 */
export function toWikitext(tree: Tree): string {
  const index = indexTree(tree);
  const succession = lineOfSuccession(tree);
  const house = wikiEscape(tree.house || 'The house');
  const out: string[] = [`== ${house} ==`];
  out.push(
    `${tree.house ? `'''${wikiEscape(withThe(tree.house)).replace(/^the /, 'The ')}'''` : "'''The house'''"}${tree.realm ? ` reigns over ${wikiEscape(tree.realm)}` : ' reigns'}. The succession follows ${lawNames[tree.law].toLowerCase()}.`,
    '',
    '=== Members ===',
    membersTable(tree, succession, index),
    '',
    '=== Line of succession ===',
    successionList(tree, succession, index),
  );
  if (succession.excluded.length) {
    out.push('', '=== Not in the line ===');
    for (const entry of succession.excluded) out.push(`* ${wikiName(index.person.get(entry.id))}: ${wikiEscape(reasonText(tree, entry, index))}`);
  }
  return `${out.join('\n')}\n`;
}
