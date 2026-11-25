import type { FactDraft } from '../../types.ts'

export const math: FactDraft[] = [
  {
    title: 'In a room of 23 people, two probably share a birthday',
    body: 'With 23 people the chance that at least two share a birthday is 50.7%. With 70 people it is 99.9%. The trick is that 23 people form 253 different pairs, and any one of those pairs could match.',
    takeaway: 'Intuition counts people. Probability counts pairs.',
    source: 'Standard probability; first posed by Richard von Mises (1939)',
    visual: 'a party crowd with glowing lines linking every pair of guests, one pair highlighted and sharing a birthday cake',
  },
  {
    title: 'Every shuffled deck has probably never existed before',
    body: 'A deck of 52 cards can be arranged in about 8 followed by 67 zeros ways. That is far more than the number of atoms on Earth. Shuffle well and you are almost certainly holding an order no deck has ever been in.',
    takeaway: 'A small number of items can hide an astronomically large number of arrangements.',
    source: '52 factorial; Persi Diaconis, shuffling research',
    visual: 'playing cards exploding upward from a pair of hands into a galaxy-like spiral of cards',
  },
  {
    title: 'In the Monty Hall game, always switch',
    body: 'Pick one of three doors. The host, who knows where the prize is, opens another door to show a goat and offers you a switch. Switching wins two times in three. When a columnist published this in 1990, thousands of readers, many with PhDs, wrote to say she was wrong. She was right.',
    takeaway: 'Your first pick is right one time in three. The host\'s move does not change that.',
    source: 'Marilyn vos Savant, Parade (1990)',
    visual: 'three closed doors on a retro game-show stage, one opened to reveal a goat, a contestant frozen between the other two',
  },
  {
    title: '0.999... is exactly 1',
    body: 'It is the same number written two ways. One third is 0.333... forever. Multiply both sides by three and you get 1 on one side and 0.999... on the other. There is no gap between them to squeeze another number into.',
    takeaway: 'An infinite process can have an exact, finite answer.',
    source: 'Standard real analysis',
    visual: 'an endless corridor of identical glowing doorways receding to a vanishing point that resolves into one bright doorway',
  },
  {
    title: 'Fold a sheet of paper 42 times and it reaches the Moon',
    body: 'Each fold doubles the thickness. Starting at 0.1 mm, 42 doublings give about 440,000 km, more than the distance to the Moon. In practice the record for folding paper in half is 12 times, set by a student in 2002.',
    takeaway: 'We badly underestimate doubling. Use that when thinking about debt, savings and viruses.',
    source: 'Arithmetic; Britney Gallivan (2002)',
    visual: 'a folded stack of paper rising from a desk like a tower through the clouds toward the Moon',
  },
  {
    title: 'Zero had to be invented',
    body: 'In 628 CE the Indian mathematician Brahmagupta wrote the first known rules for calculating with zero as a number in its own right, such as a number minus itself. The Sanskrit word shunya passed into Arabic as sifr, which gave English both "zero" and "cipher".',
    takeaway: 'Treating "nothing" as a number made place value, algebra and eventually computing possible.',
    source: 'Brahmagupta, Brahmasphutasiddhanta (628 CE)',
    visual: 'an ancient Indian scholar writing on a palm-leaf manuscript by lamplight, a luminous empty circle hovering above the page',
  },
  {
    title: 'Four colours are enough for any map',
    body: 'Any map can be coloured with four colours so that no two neighbouring regions match. The idea was proposed in 1852 and resisted proof until 1976, when a computer checked nearly two thousand cases. It was the first major theorem proved by machine.',
    takeaway: 'Many mathematicians were uneasy: no person could check the whole proof by hand.',
    source: 'Appel & Haken, Illinois Journal of Mathematics (1977)',
    visual: 'an intricate imaginary map of many countries coloured in exactly four hues with no two neighbours alike',
  },
  {
    title: 'Real-world numbers start with 1 about 30% of the time',
    body: 'In many sets of data, such as river lengths, populations and company accounts, the first digit is 1 about 30% of the time and 9 less than 5%. This is Benford\'s law. Invented numbers rarely follow it.',
    takeaway: 'Auditors and investigators use it to flag accounts that may have been made up.',
    source: 'Frank Benford (1938); first noted by Simon Newcomb (1881)',
    visual: 'an accountant\'s desk with tall ledgers and a magnifying glass, one column of entries glowing brighter than the rest',
  },
  {
    title: 'NASA flies to other planets using just 15 decimals of pi',
    body: 'Pi has been computed to more than 100 trillion digits. NASA\'s navigators use 3.141592653589793. About 40 digits would give the circumference of the observable universe to within the width of a hydrogen atom.',
    takeaway: 'Know how much precision the job needs. Beyond that, extra digits are decoration.',
    source: 'NASA Jet Propulsion Laboratory, Marc Rayman',
    visual: 'a spacecraft tracing a perfect circular arc around a ringed planet with a trail of tiny glowing beads fading behind it',
  },
  {
    title: '1729: the dullest number that was not',
    body: 'Visiting Srinivasa Ramanujan in hospital, G. H. Hardy remarked that his taxi number, 1729, seemed rather dull. Ramanujan replied at once that it is the smallest number that is the sum of two cubes in two different ways: 1 and 12, or 9 and 10.',
    takeaway: 'Deep familiarity makes patterns visible that everyone else walks past.',
    source: 'G. H. Hardy, Ramanujan (1940)',
    visual: 'a 1910s London taxi waiting outside a hospital at dusk, two pairs of glowing cubes floating above it',
  },
]
