// Lists what is already in the deck, so new cards do not repeat old ones.
//   npm run list            every topic with its card count
//   npm run list -- sci     every card id and title in one topic
import { loadDeckOrExit } from './lib/deck.mjs'

const { topics, facts } = loadDeckOrExit()
const wanted = process.argv[2]

if (!wanted) {
  for (const topic of topics) {
    const count = facts.filter((fact) => fact.category === topic.id).length
    console.log(`${topic.id.padEnd(8)} ${String(count).padStart(5)}  ${topic.name}`)
  }
  console.log(`${'total'.padEnd(8)} ${String(facts.length).padStart(5)}`)
  console.log('\nRun `npm run list -- <topic id>` to see the cards in a topic.')
} else if (!topics.some((topic) => topic.id === wanted)) {
  console.error(`No topic "${wanted}". Topics: ${topics.map((topic) => topic.id).join(', ')}`)
  process.exit(1)
} else {
  for (const fact of facts.filter((fact) => fact.category === wanted)) {
    console.log(`${fact.id}  ${fact.title}`)
  }
}
