/**
 * The guide's worked examples. Each is a real tree and the line of succession the guide says it
 * gives. The guide draws them from here, and tests/worked.test.ts runs the engine over every one,
 * so the page can never claim something the tool doesn't do.
 */
import { halvard, rothmere, tamar, varenko } from '../dynasty/examples';
import type { Law, Tree } from '../dynasty/model';

export interface Worked {
  id: string;
  law: Law;
  title: string;
  /** What the example shows, as the guide puts it. */
  text: string;
  tree: Tree;
  /** The line of succession, by name with title, first in line first. */
  line: string[];
  /** Who is left out and why, where the example is about that. */
  leftOut?: Record<string, string>;
}

const with_ = (tree: Tree, change: (tree: Tree) => void): Tree => {
  change(tree);
  return tree;
};

export const worked: Worked[] = [
  {
    id: 'absolute',
    law: 'absolute',
    title: 'Absolute primogeniture',
    text: 'King Teomir II has three children, and the eldest is a daughter. She is the heir, and her children follow her before her brothers get a look in: a line runs all the way down one branch before it moves to the next. Only when the king’s own descendants run out does it pass to his sister Dobra, then his brother Radan.',
    tree: varenko('absolute'),
    line: ['Princess Ilsa', 'Maelin', 'Teo', 'Prince Vanko', 'Aris', 'Prince Kosti', 'Princess Dobra', 'Lord Milan of Lask', 'Prince Radan', 'Prince Luka', 'Princess Neda'],
  },
  {
    id: 'male-preference',
    law: 'male-preference',
    title: 'Male-preference primogeniture',
    text: 'The same family, but now sons come before daughters at every step. Prince Vanko jumps ahead of his elder sister, and takes his son with him. Ilsa is not shut out: she follows her brothers, and within her own branch her son Teo passes his elder sister Maelin. The king’s brother Radan likewise moves ahead of their sister Dobra.',
    tree: varenko('male-preference'),
    line: ['Prince Vanko', 'Aris', 'Prince Kosti', 'Princess Ilsa', 'Teo', 'Maelin', 'Prince Radan', 'Prince Luka', 'Princess Neda', 'Princess Dobra', 'Lord Milan of Lask'],
  },
  {
    id: 'agnatic',
    law: 'agnatic',
    title: 'Agnatic primogeniture',
    text: 'Men in the male line only. The line is the male-preference one with every woman removed, and with her every descendant: Teo is a boy, but his claim would come through his mother, so he has none. Six of the eleven are gone.',
    tree: varenko('agnatic'),
    line: ['Prince Vanko', 'Aris', 'Prince Kosti', 'Prince Radan', 'Prince Luka'],
    leftOut: {
      'Princess Ilsa': 'the law passes over women',
      Maelin: 'the law passes over women',
      Teo: 'descends through a woman, Princess Ilsa',
      'Princess Dobra': 'the law passes over women',
      'Lord Milan of Lask': 'descends through a woman, Princess Dobra',
      'Princess Neda': 'the law passes over women',
    },
  },
  {
    id: 'seniority',
    law: 'seniority',
    title: 'Agnatic seniority',
    text: 'Still men in the male line, but a whole generation is used up before the next begins. The king’s brother Radan comes before the king’s own sons; then the sons’ generation in order of branch (Vanko, Kosti, then Radan’s son Luka); and only then the grandson, Aris.',
    tree: varenko('seniority'),
    line: ['Prince Radan', 'Prince Vanko', 'Prince Kosti', 'Prince Luka', 'Aris'],
  },
  {
    id: 'elective',
    law: 'elective',
    title: 'Elective monarchy',
    text: 'Nobody inherits. Here the electors have ranked three candidates, and they did not go by age or sex: the youngest son first, then his uncle, then the eldest daughter. The line is exactly the list, and nobody else has a place until they are chosen.',
    tree: varenko('elective'),
    line: ['Prince Kosti', 'Prince Radan', 'Princess Ilsa'],
  },
  {
    id: 'representation',
    law: 'absolute',
    title: 'A dead heir’s children keep her place',
    text: 'Suppose Princess Ilsa dies before her father. Her place does not pass to her brother: her children stand where she stood. Maelin becomes the heir, ahead of her uncle Vanko. This is representation, and every hereditary law here uses it.',
    tree: with_(varenko('absolute'), (tree) => {
      tree.people.find((p) => p.id === 'ilsa')!.died = '2024';
    }),
    line: ['Maelin', 'Teo', 'Prince Vanko', 'Aris', 'Prince Kosti', 'Princess Dobra', 'Lord Milan of Lask', 'Prince Radan', 'Prince Luka', 'Princess Neda'],
  },
  {
    id: 'only-daughters',
    law: 'agnatic',
    title: 'A ruler with only daughters',
    text: 'Grand Duke Leopold II has two daughters and a grandson, and under agnatic primogeniture none of them counts. The line goes sideways to the sons of his late brother Anselm. This is the oldest succession crisis there is: a ruler tempted to change the law for his own child, and a nephew with every reason to object.',
    tree: rothmere(),
    line: ['Prince Ruprecht', 'Prince Konradin', 'Prince Matthias'],
    leftOut: {
      'Hereditary Princess Clara': 'the law passes over women',
      'August Arden': 'descends through a woman, Hereditary Princess Clara',
      'Princess Sophie': 'the law passes over women',
      'Princess Wilhelmina': 'the law passes over women',
    },
  },
  {
    id: 'brothers-first',
    law: 'seniority',
    title: 'Brothers before sons',
    text: 'Emir Hasim has two sons, but under seniority his brothers Rafiq and Yusuf come first. After the brothers, the next generation takes its turn in order of branch: Hasim’s sons, then Rafiq’s, then Yusuf’s. The Emir’s grandson waits behind all of them.',
    tree: tamar(),
    line: ['Sheikh Rafiq', 'Sheikh Yusuf', 'Sheikh Karim', 'Sheikh Nadir', 'Sheikh Tariq', 'Sheikh Omar', 'Sheikh Zayd'],
  },
  {
    id: 'exclusions',
    law: 'absolute',
    title: 'The house rules, all switched on',
    text: 'Duke Osric has five children and, with every rule on, one heir. Bram was born before the marriage; Signe renounced for herself and her heirs, which takes her son Arvid with her; Halden married against the council’s wishes, which costs him his place and the child of that marriage his; Edvin was adopted. That leaves Ylva, the fourth child, and her daughter.',
    tree: halvard(),
    line: ['Lady Ylva', 'Lady Runa'],
    leftOut: {
      'Lord Bram': 'born outside marriage',
      'Lady Signe': 'renounced their place',
      'Lord Arvid': 'descends from Lady Signe, who renounced for the whole line',
      'Lord Halden': 'married out of the house',
      'Jory Quill': 'born of a marriage the house does not recognise',
      'Lord Edvin': 'adopted, not born to the house',
    },
  },
  {
    id: 'illegitimacy-off',
    law: 'absolute',
    title: 'A house that counts its natural children',
    text: 'Switch the illegitimacy rule off and Bram, the eldest, is the heir. Plenty of houses in history worked this way, or legitimised a favoured child after the fact; the choice is yours.',
    tree: halvard({ illegitimate: false }),
    line: ['Lord Bram', 'Lady Ylva', 'Lady Runa'],
  },
  {
    id: 'renounce-self',
    law: 'absolute',
    title: 'Renouncing for yourself alone',
    text: 'A renunciation can bind the whole line or only the person. If Signe had renounced for herself alone, her son Arvid would keep the place she gave up, and would stand first.',
    tree: with_(halvard(), (tree) => {
      tree.people.find((p) => p.id === 'signe')!.renounced = 'self';
    }),
    line: ['Lord Arvid', 'Lady Ylva', 'Lady Runa'],
  },
  {
    id: 'adoption-on',
    law: 'absolute',
    title: 'A house that lets adopted children inherit',
    text: 'Switch the adoption rule off and Edvin takes his place by age, after his elder sister’s line. Rome’s emperors chose their successors this way for a century; most later European houses would not hear of it.',
    tree: halvard({ adopted: false }),
    line: ['Lady Ylva', 'Lady Runa', 'Lord Edvin'],
  },
];

export const workedById = (id: string): Worked => {
  const found = worked.find((example) => example.id === id);
  if (!found) throw new Error(`No worked example called "${id}"`);
  return found;
};
