// Validates the fact deck. Runs before every build so a broken card never ships.
import { FACTS } from '../src/data/index.ts'
import { CATEGORIES } from '../src/data/categories.ts'

const LIMITS = { title: 80, body: 320, takeaway: 150, source: 110 }
const problems = []
const ids = new Set()
const titles = new Set()

for (const fact of FACTS) {
  if (ids.has(fact.id)) problems.push(`${fact.id}: duplicate id`)
  ids.add(fact.id)
  if (titles.has(fact.title)) problems.push(`${fact.id}: duplicate title`)
  titles.add(fact.title)
  for (const field of ['title', 'body', 'takeaway', 'source', 'visual']) {
    const value = fact[field]
    if (typeof value !== 'string' || !value.trim()) problems.push(`${fact.id}: ${field} is empty`)
    else if (LIMITS[field] && value.length > LIMITS[field]) {
      problems.push(`${fact.id}: ${field} is ${value.length} characters (limit ${LIMITS[field]}), it may not fit on a small phone`)
    }
  }
}

for (const category of CATEGORIES) {
  if (!FACTS.some((fact) => fact.category === category.id)) problems.push(`${category.id}: topic has no facts`)
}

if (problems.length) {
  console.error(`Found ${problems.length} problem(s) in the fact deck:\n` + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Fact deck OK: ${FACTS.length} cards across ${CATEGORIES.length} topics.`)
