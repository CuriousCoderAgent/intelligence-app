import type { Category, CategoryId } from '../types.ts'
import topics from '../../content/topics.json'

export const CATEGORIES: Category[] = topics

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]))

/** Falls back to the first topic so an unknown id can never crash a card. */
export const categoryOf = (id: CategoryId): Category => BY_ID.get(id) ?? CATEGORIES[0]
