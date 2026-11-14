import { describe, expect, it } from 'vitest';
import { addChild, addPerson, addPick, addSpouse, marry, movePick, removePerson, removePick, removeUnion, setParents, startTree, updateHouse, updatePerson, updateUnion } from '../src/dynasty/edit';
import { halvard, lesnia, varenko } from '../src/dynasty/examples';
import { cleanTree, indexTree } from '../src/dynasty/model';
import { lineOfSuccession } from '../src/dynasty/succession';

const line = (tree: ReturnType<typeof varenko>) => lineOfSuccession(tree).line.map((place) => place.id);

describe('editing', () => {
  it('starts with one person on the throne', () => {
    const tree = startTree();
    expect(tree.people).toEqual([{ id: 'p1', name: 'First of the line', sex: 'x' }]);
    expect(tree.reigning).toBe('p1');
    expect(cleanTree(tree)).toEqual(tree);
  });

  it('never changes the tree it is given', () => {
    const tree = varenko();
    addPerson(tree);
    updatePerson(tree, 'ilsa', { name: 'Changed' });
    removePerson(tree, 'ilsa');
    setParents(tree, 'aris', null);
    addChild(tree, 'kosti');
    addSpouse(tree, 'kosti');
    marry(tree, 'kosti', 'neda');
    updateUnion(tree, 'u1', { out: true });
    removeUnion(tree, 'u2');
    updateHouse(tree, { law: 'agnatic', exclude: { out: false } });
    expect(tree).toEqual(varenko());
  });

  it('adds a person with an id nobody has', () => {
    const { tree, id } = addPerson(varenko(), { name: 'Cousin Odd', sex: 'm' });
    expect(tree.people.at(-1)).toEqual({ id, name: 'Cousin Odd', sex: 'm' });
    expect(varenko().people.some((p) => p.id === id)).toBe(false);
    expect(addPerson(startTree()).id).toBe('p2');
  });

  it('changes a person’s details, and empties what is cleared', () => {
    let tree = updatePerson(varenko(), 'ilsa', { name: ' Ilsa the Bold ', title: '', born: '1986-05-04', notes: 'A note.', renounced: 'self' });
    const ilsa = () => tree.people.find((p) => p.id === 'ilsa')!;
    expect(ilsa()).toEqual({ id: 'ilsa', name: 'Ilsa the Bold', sex: 'f', born: '1986-05-04', notes: 'A note.', renounced: 'self', union: 'u2' });
    tree = updatePerson(tree, 'ilsa', { renounced: undefined, notes: '', dead: true });
    expect(ilsa()).toEqual({ id: 'ilsa', name: 'Ilsa the Bold', sex: 'f', born: '1986-05-04', dead: true, union: 'u2' });
    tree = updatePerson(tree, 'ilsa', { died: '2020' });
    expect(ilsa().dead).toBeUndefined();
    expect(ilsa().died).toBe('2020');
    tree = updatePerson(tree, 'ilsa', { born: 'not a date', link: 'http://nope.example' });
    expect(ilsa().born).toBeUndefined();
    expect(ilsa().link).toBeUndefined();
    expect(updatePerson(tree, 'nobody', { name: 'X' })).toBe(tree);
  });

  it('adds a child to the marriage when there is one, and to the parent when not', () => {
    const inMarriage = addChild(varenko(), 'kosti');
    expect(inMarriage.tree.people.at(-1)).toEqual({ id: inMarriage.id, name: 'New child', sex: 'x', parent: 'kosti' });
    const ofUnion = addChild(varenko(), 'ilsa');
    expect(ofUnion.tree.people.at(-1)).toMatchObject({ union: 'u5' });
    expect(indexTree(ofUnion.tree).children('emeric').map((p) => p.id)).toContain(ofUnion.id);
    expect(line(ofUnion.tree).slice(0, 4)).toEqual(['ilsa', 'maelin', 'teo', ofUnion.id]);
    expect(addChild(varenko(), 'nobody')).toEqual({ tree: varenko(), id: '' });
  });

  it('adds a spouse, and marries two people already there', () => {
    const spouse = addSpouse(varenko(), 'kosti');
    expect(spouse.tree.people.at(-1)).toMatchObject({ id: spouse.id, name: 'New spouse' });
    expect(spouse.tree.unions.at(-1)).toEqual({ id: spouse.union, a: 'kosti', b: spouse.id });
    const wed = marry(varenko(), 'kosti', 'neda', { married: '2024', out: true });
    expect(wed.tree.unions.at(-1)).toEqual({ id: wed.id, a: 'kosti', b: 'neda', married: '2024', out: true });
    expect(line(wed.tree)).not.toContain('kosti');
    expect(marry(varenko(), 'kosti', 'kosti').id).toBe('');
    expect(marry(varenko(), 'kosti', 'ghost').id).toBe('');
  });

  it('changes and removes a marriage, and the children keep a parent', () => {
    const changed = updateUnion(varenko(), 'u5', { married: '2011-06-01', ended: '2019', out: true });
    expect(changed.unions.find((u) => u.id === 'u5')).toEqual({ id: 'u5', a: 'ilsa', b: 'emeric', married: '2011-06-01', ended: '2019', out: true });
    expect(updateUnion(changed, 'u5', { out: false, ended: '' }).unions.find((u) => u.id === 'u5')).toEqual({ id: 'u5', a: 'ilsa', b: 'emeric', married: '2011-06-01' });
    const removed = removeUnion(varenko(), 'u5');
    expect(removed.unions.some((u) => u.id === 'u5')).toBe(false);
    expect(removed.people.find((p) => p.id === 'maelin')).toMatchObject({ parent: 'ilsa' });
    expect(removed.people.find((p) => p.id === 'maelin')!.union).toBeUndefined();
    expect(line(removed)).toEqual(line(varenko()));
    expect(removeUnion(varenko(), 'nope')).toEqual(varenko());
  });

  it('removes a person and every mention of them', () => {
    const tree = removePerson(varenko(), 'teomir2');
    expect(tree.people.some((p) => p.id === 'teomir2')).toBe(false);
    expect(tree.reigning).toBeUndefined();
    expect(tree.unions.some((u) => u.id === 'u2')).toBe(false);
    // His children are now the queen's alone, and no longer of the blood.
    expect(tree.people.find((p) => p.id === 'ilsa')).toMatchObject({ parent: 'ressa' });
    expect(line(tree)).toEqual(['dobra', 'milan', 'radan', 'luka', 'neda']);
    const elective = removePerson(lesnia(), 'jarek');
    expect(elective.picks).toEqual(['wit', 'kasimir']);
    expect(removePerson(halvard(), 'osric').people.find((p) => p.id === 'bram')!.parent).toBeUndefined();
    expect(removePerson(varenko(), 'nobody')).toEqual(varenko());
    expect(cleanTree(tree)).toEqual(tree);
  });

  it('sets a person’s parents', () => {
    const adopted = setParents(varenko(), 'aris', { union: 'u5' });
    expect(adopted.people.find((p) => p.id === 'aris')).toMatchObject({ union: 'u5' });
    const single = setParents(varenko(), 'aris', { parent: 'kosti' });
    expect(single.people.find((p) => p.id === 'aris')).toMatchObject({ parent: 'kosti' });
    expect(single.people.find((p) => p.id === 'aris')!.union).toBeUndefined();
    const none = setParents(varenko(), 'aris', null);
    expect(indexTree(none).parents('aris')).toEqual([]);
    // Nobody is born of their own marriage.
    expect(indexTree(setParents(varenko(), 'ilsa', { union: 'u5' })).parents('ilsa')).toEqual([]);
  });

  it('keeps the list of candidates in the order it is put in', () => {
    let tree = lesnia();
    tree = addPick(tree, 'danuta');
    expect(tree.picks).toEqual(['jarek', 'wit', 'kasimir', 'danuta']);
    expect(addPick(tree, 'danuta')).toBe(tree);
    expect(addPick(tree, 'ghost')).toBe(tree);
    tree = movePick(tree, 'danuta', -1);
    tree = movePick(tree, 'danuta', -1);
    expect(tree.picks).toEqual(['jarek', 'danuta', 'wit', 'kasimir']);
    expect(movePick(tree, 'jarek', -1)).toBe(tree);
    expect(movePick(tree, 'kasimir', 1)).toBe(tree);
    expect(movePick(tree, 'jarek', 1).picks).toEqual(['danuta', 'jarek', 'wit', 'kasimir']);
    expect(removePick(tree, 'wit').picks).toEqual(['jarek', 'danuta', 'kasimir']);
    expect(removePick(tree, 'ghost')).toBe(tree);
  });

  it('changes the house, the law and the rules', () => {
    const tree = updateHouse(varenko(), { house: ' House of Elsewhere ', realm: '', law: 'agnatic', reigning: 'vanko', founder: '', exclude: { adopted: false } });
    expect(tree.house).toBe('House of Elsewhere');
    expect(tree.realm).toBeUndefined();
    expect(tree.law).toBe('agnatic');
    expect(tree.reigning).toBe('vanko');
    expect(tree.founder).toBeUndefined();
    expect(tree.exclude).toEqual({ illegitimate: true, renounced: true, out: true, adopted: false });
    expect(updateHouse(varenko(), { reigning: 'ghost' }).reigning).toBeUndefined();
  });
});
