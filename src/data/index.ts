import type { CategoryId, Fact, FactDraft } from '../types.ts'
import { self } from './facts/self.ts'
import { geo } from './facts/geo.ts'
import { sci } from './facts/sci.ts'
import { space } from './facts/space.ts'
import { pol } from './facts/pol.ts'
import { tech } from './facts/tech.ts'
import { gk } from './facts/gk.ts'
import { hist } from './facts/hist.ts'
import { soc } from './facts/soc.ts'
import { math } from './facts/math.ts'
import { eng } from './facts/eng.ts'
import { econ } from './facts/econ.ts'

/**
 * Ids come from position in the file ("sci-03" is the third science fact), so
 * always ADD new facts at the end of a file. Reordering or deleting would shift
 * ids, which are also image file names and saved-card keys.
 */
const withIds = (category: CategoryId, drafts: FactDraft[]): Fact[] =>
  drafts.map((d, i) => ({ ...d, category, id: `${category}-${String(i + 1).padStart(2, '0')}` }))

export const FACTS: Fact[] = [
  ...withIds('self', self),
  ...withIds('geo', geo),
  ...withIds('sci', sci),
  ...withIds('space', space),
  ...withIds('pol', pol),
  ...withIds('tech', tech),
  ...withIds('gk', gk),
  ...withIds('hist', hist),
  ...withIds('soc', soc),
  ...withIds('math', math),
  ...withIds('eng', eng),
  ...withIds('econ', econ),
]

export const FACT_BY_ID = new Map(FACTS.map((f) => [f.id, f]))
