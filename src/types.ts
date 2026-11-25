export type CategoryId =
  | 'self' | 'geo' | 'sci' | 'space' | 'pol' | 'tech'
  | 'gk' | 'hist' | 'soc' | 'math' | 'eng' | 'econ'

export interface Category {
  id: CategoryId
  name: string
  /** Deep background colour of the card. */
  ground: string
  /** Bright tint used for labels, line art and highlights. */
  accent: string
  /** Colour words fed into the image prompt so pictures match the card. */
  palette: string
}

export interface Fact {
  /** Stable id, e.g. "sci-03". Also the image file name. */
  id: string
  category: CategoryId
  /** The hook. One line, reads on its own. */
  title: string
  /** The fact itself: two or three sentences. */
  body: string
  /** Why it matters, or how to use it. */
  takeaway: string
  /** Where it comes from (name and year, no links). */
  source: string
  /** Scene description for the illustration. */
  visual: string
}

/** A fact as written in a category file, before id and category are attached. */
export type FactDraft = Omit<Fact, 'id' | 'category'>
