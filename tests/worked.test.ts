import { describe, expect, it } from 'vitest';
import { glossary } from '../src/content/glossary';
import { worked, workedById } from '../src/content/worked';
import { displayName, indexTree, laws } from '../src/dynasty/model';
import { lineOfSuccession, reasonText } from '../src/dynasty/succession';
import { checkTree } from '../src/dynasty/validate';

describe('the guide’s worked examples', () => {
  it('cover every succession law', () => {
    for (const law of laws) expect(worked.some((example) => example.law === law && example.tree.law === law), law).toBe(true);
  });

  for (const example of worked) {
    it(`${example.id}: the engine gives the line the guide gives`, () => {
      const index = indexTree(example.tree);
      const result = lineOfSuccession(example.tree);
      expect(example.tree.law).toBe(example.law);
      expect(result.line.map((place) => displayName(index.person.get(place.id)))).toEqual(example.line);
      if (example.leftOut) {
        expect(Object.fromEntries(result.excluded.map((entry) => [displayName(index.person.get(entry.id)), reasonText(example.tree, entry, index)]))).toEqual(example.leftOut);
      }
      // The guide names people; every name it uses in the line must be someone in the tree.
      expect(checkTree(example.tree).filter((note) => note.kind === 'problem')).toEqual([]);
    });
  }

  it('have ids of their own and something to say', () => {
    expect(new Set(worked.map((example) => example.id)).size).toBe(worked.length);
    for (const example of worked) {
      expect(example.title.length, example.id).toBeGreaterThan(5);
      expect(example.text.length, example.id).toBeGreaterThan(80);
    }
    expect(workedById('absolute').law).toBe('absolute');
    expect(() => workedById('nonsense')).toThrow();
  });
});

describe('the glossary', () => {
  it('is in alphabetical order, with an id for each term to link to', () => {
    const terms = glossary.map((entry) => entry.term);
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
    expect(new Set(glossary.map((entry) => entry.id)).size).toBe(glossary.length);
    for (const entry of glossary) {
      expect(entry.id, entry.term).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(entry.definition.length, entry.term).toBeGreaterThan(40);
      expect(entry.definition.endsWith('.'), entry.term).toBe(true);
    }
    expect(glossary.length).toBeGreaterThanOrEqual(40);
  });

  it('explains every law the tool offers', () => {
    const ids = new Set(glossary.map((entry) => entry.id));
    for (const id of ['absolute-primogeniture', 'male-preference-primogeniture', 'agnatic-primogeniture', 'agnatic-seniority', 'elective-monarchy', 'representation', 'renunciation', 'morganatic-marriage', 'legitimacy', 'adoption']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('only points at terms that exist', () => {
    const ids = new Set(glossary.map((entry) => entry.id));
    for (const entry of glossary) for (const other of entry.see ?? []) expect(ids.has(other), `${entry.id} -> ${other}`).toBe(true);
  });
});
