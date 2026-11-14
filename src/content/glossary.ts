/**
 * The glossary: the words of succession and genealogy, a sentence or two each. The glossary page
 * shows them and gives the set to search engines; the tool links to them by id.
 */
export interface Term {
  id: string;
  term: string;
  definition: string;
  /** Related terms, by id. */
  see?: string[];
}

export const glossary: Term[] = [
  { id: 'abdication', term: 'Abdication', definition: 'Giving up the throne while alive. The crown passes to the heir as if the monarch had died, and the monarch’s children keep their places in the line.', see: ['renunciation'] },
  { id: 'absolute-primogeniture', term: 'Absolute primogeniture', definition: 'The eldest child inherits, whether daughter or son, and that child’s whole line comes before the next child’s. Sweden adopted it in 1980, and most European monarchies have followed.', see: ['primogeniture', 'male-preference-primogeniture'] },
  { id: 'adoption', term: 'Adoption', definition: 'Taking a child into a family by law. Most hereditary houses give an adopted child no place in the line; some, like the emperors of second-century Rome, chose their heirs exactly this way.' },
  { id: 'agnate', term: 'Agnate', definition: 'A relative through the male line only: a man’s sons, his sons’ sons, his brothers by the same father, and so on.', see: ['cognate', 'agnatic-primogeniture'] },
  { id: 'agnatic-primogeniture', term: 'Agnatic primogeniture', definition: 'Only men descended through men inherit, eldest line first. Women and their descendants are passed over entirely. Often called Salic law.', see: ['salic-law', 'agnate'] },
  { id: 'agnatic-seniority', term: 'Agnatic seniority', definition: 'Men in the male line inherit by generation: a ruler’s brothers come before his sons, and the next generation waits until the older one is used up. It keeps children off the throne, at the price of short reigns and restless nephews.', see: ['agnate'] },
  { id: 'ahnentafel', term: 'Ahnentafel', definition: 'A numbered table of one person’s ancestors: the person is 1, the father 2, the mother 3, and any person’s father is twice their number. German for “ancestor table”.', see: ['pedigree'] },
  { id: 'appanage', term: 'Appanage', definition: 'Land, a title or an income given to a younger child of the ruler, to keep them in state and out of the succession.', see: ['cadet-branch'] },
  { id: 'cadet-branch', term: 'Cadet branch', definition: 'A line descended from a younger son of the house. Cadet branches wait in the wings, and inherit when the senior line dies out.', see: ['collateral-line'] },
  { id: 'claimant', term: 'Claimant', definition: 'Someone who asserts a right to a throne. The word takes no side on whether the right is good.', see: ['pretender'] },
  { id: 'cognate', term: 'Cognate', definition: 'A relative by blood through either parent. Cognatic succession lets claims pass through women, and in some forms to them.', see: ['agnate'] },
  { id: 'collateral-line', term: 'Collateral line', definition: 'Relatives who share an ancestor with the ruler but do not descend from the ruler: brothers, sisters, cousins and their children.', see: ['cadet-branch'] },
  { id: 'consort', term: 'Consort', definition: 'The husband or wife of a reigning monarch. A consort shares the rank but not the right to rule, and has no place in the line of succession.' },
  { id: 'dowager', term: 'Dowager', definition: 'The widow of a ruler or peer, so called to tell her from the wife of the present one: a queen dowager, a dowager duchess.', see: ['consort'] },
  { id: 'dynast', term: 'Dynast', definition: 'A member of a reigning house who has a place in its line of succession, or would have if enough others died.' },
  { id: 'dynasty', term: 'Dynasty', definition: 'A line of rulers from one family, or the family itself. A dynasty ends when the crown passes to another house, which with female succession can happen without anyone losing a battle.', see: ['house'] },
  { id: 'elective-monarchy', term: 'Elective monarchy', definition: 'A monarchy whose ruler is chosen, usually for life, by a body of electors, instead of inheriting. The Holy Roman Empire, Poland-Lithuania and the papacy all worked this way; Malaysia and the Vatican still do.', see: ['elector', 'tanistry'] },
  { id: 'elector', term: 'Elector', definition: 'A person with a vote in choosing the monarch. In the Holy Roman Empire the seven prince-electors were fixed by the Golden Bull of 1356.', see: ['elective-monarchy'] },
  { id: 'founder', term: 'Founder', definition: 'The ancestor from whom a line of succession is reckoned. Only the founder’s descendants have places; who counts as the founder is a matter of law, and sometimes of argument.' },
  { id: 'gedcom', term: 'GEDCOM', definition: 'The file format genealogy programs use to exchange family trees, kept by FamilySearch since 1984. Dynasty reads and writes it.' },
  { id: 'heir-apparent', term: 'Heir apparent', definition: 'The person first in line whose place cannot be taken by anyone’s birth: under primogeniture, the ruler’s eldest eligible child.', see: ['heir-presumptive'] },
  { id: 'heir-presumptive', term: 'Heir presumptive', definition: 'The person first in line for now, who would be displaced if the ruler had a child with a better claim: a brother, say, or a daughter where sons come first.', see: ['heir-apparent'] },
  { id: 'house', term: 'House', definition: 'A royal or noble family taken as a line through time, usually named for a place or a founder. Traditionally a child belongs to the father’s house.', see: ['dynasty', 'cadet-branch'] },
  { id: 'house-law', term: 'House law', definition: 'A family’s own rules on who belongs to it, whom its members may marry and who succeeds. In much of Europe house laws had the force of law, and some still do.', see: ['morganatic-marriage'] },
  { id: 'interregnum', term: 'Interregnum', definition: 'The time between one reign and the next, when the throne stands empty. Elective monarchies have one at every succession.', see: ['regency'] },
  { id: 'issue', term: 'Issue', definition: 'A person’s children and all their descendants. “Died without issue” means the line ended there.' },
  { id: 'legitimacy', term: 'Legitimacy', definition: 'Being born to parents married to each other. In most hereditary systems only legitimate children could inherit titles and thrones.', see: ['legitimation'] },
  { id: 'legitimation', term: 'Legitimation', definition: 'Making a child born outside marriage legitimate afterwards, by the parents’ later marriage or by a ruler’s decree. Whether that restores a place in the line depends on the house.', see: ['legitimacy'] },
  { id: 'line-of-succession', term: 'Line of succession', definition: 'Everyone entitled to the throne, in the order they would take it. Each death, birth, marriage or renunciation can reorder it.' },
  { id: 'male-preference-primogeniture', term: 'Male-preference primogeniture', definition: 'Sons inherit before daughters, eldest first, but a daughter inherits when she has no living brothers and no dead brother left heirs. Britain used it until the Succession to the Crown Act 2013; Spain and Monaco still do.', see: ['primogeniture', 'absolute-primogeniture'] },
  { id: 'morganatic-marriage', term: 'Morganatic marriage', definition: 'A marriage between a dynast and someone of lower rank, valid as a marriage, in which the spouse and children take neither the dynast’s rank nor any place in the succession.', see: ['house-law'] },
  { id: 'pedigree', term: 'Pedigree', definition: 'A chart or record of a person’s ancestry. The word comes from the French for “crane’s foot”, after the branching mark scribes drew.', see: ['ahnentafel'] },
  { id: 'personal-union', term: 'Personal union', definition: 'Two or more states sharing one monarch while staying separate states. They come apart when their succession laws disagree, as Britain and Hanover did in 1837.' },
  { id: 'pretender', term: 'Pretender', definition: 'A claimant to a throne that is abolished or held by someone else. From the French for “claimant”: it does not mean the claim is false.', see: ['claimant'] },
  { id: 'primogeniture', term: 'Primogeniture', definition: 'Inheritance by the firstborn, with each child’s descendants ranking before the next child. The realm passes whole to one heir, which is the point of it.', see: ['absolute-primogeniture', 'male-preference-primogeniture', 'agnatic-primogeniture', 'ultimogeniture'] },
  { id: 'proximity-of-blood', term: 'Proximity of blood', definition: 'Ranking heirs by how few steps separate them from the last ruler, so that a living younger son beats the child of a dead elder son. The rival of representation in many medieval disputes.', see: ['representation'] },
  { id: 'regency', term: 'Regency', definition: 'Rule by a regent on behalf of a monarch who is a child, absent or unable to rule. The monarch still reigns; the regent governs.', see: ['regent'] },
  { id: 'regent', term: 'Regent', definition: 'The person who governs during a regency: often the monarch’s mother, the next adult in line, or a council.', see: ['regency'] },
  { id: 'regnal-name', term: 'Regnal name', definition: 'The name a monarch reigns under, which need not be their own. It comes with a number when others have used it before.' },
  { id: 'renunciation', term: 'Renunciation', definition: 'Giving up one’s place in the line of succession, for oneself alone or for one’s descendants too. Often the price of a marriage or a foreign throne.', see: ['abdication'] },
  { id: 'representation', term: 'Representation', definition: 'The rule that a dead heir’s descendants take the place the heir would have had. It is why a grandchild by the eldest son comes before a living younger son.', see: ['proximity-of-blood', 'primogeniture'] },
  { id: 'salic-law', term: 'Salic law', definition: 'The rule shutting women, and descent through women, out of the succession. Named for a Frankish law code, and pressed into service in fourteenth-century France to keep the English kings off the throne.', see: ['agnatic-primogeniture', 'semi-salic-law'] },
  { id: 'semi-salic-law', term: 'Semi-Salic law', definition: 'Agnatic succession with an escape: when every male of the house is gone, the nearest woman, or her line, inherits.', see: ['salic-law'] },
  { id: 'tanistry', term: 'Tanistry', definition: 'The Gaelic custom of electing an heir, the tanist, from the ruling kin during the ruler’s lifetime. Any man whose father, grandfather or great-grandfather had ruled could be chosen.', see: ['elective-monarchy'] },
  { id: 'ultimogeniture', term: 'Ultimogeniture', definition: 'Inheritance by the youngest child. The elder ones have left to make their own way by the time the parent dies; the youngest has stayed at home.', see: ['primogeniture'] },
  { id: 'usurper', term: 'Usurper', definition: 'Someone who takes a throne without the right to it, in the eyes of whoever is using the word. Successful usurpers are called founders.', see: ['founder', 'pretender'] },
];

export const termById = (id: string): Term | undefined => glossary.find((entry) => entry.id === id);
