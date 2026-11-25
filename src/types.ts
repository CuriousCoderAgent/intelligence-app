/** A topic id from content/topics.json, e.g. "sci". */
export type CategoryId = string

export interface Category {
  id: CategoryId
  name: string
  /** Deep background colour of the card. */
  ground: string
  /** Bright tint used for labels, line art and highlights. */
  accent: string
  /** Colour words fed into the image prompt so pictures match the card. */
  palette: string
  /** Which line-art style to draw when a card has no picture. */
  motif: string
}

/** What the feed needs to place a card. Known up front for the whole deck. */
export interface CardRef {
  id: string
  category: CategoryId
}

/** A card's full text. Loaded on demand, one pack at a time. */
export interface Fact extends CardRef {
  /** The hook. One line, reads on its own. */
  title: string
  /** The fact itself: two or three sentences. */
  body: string
  /** Why it matters, or how to use it. */
  takeaway: string
  /** Where it comes from (name and year, no links). */
  source: string
}
