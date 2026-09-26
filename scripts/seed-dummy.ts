// Seed a large, realistic dummy dataset into Atlas WITH real embeddings.
//
// Usage (needs MONGODB_URI + OPENAI_API_KEY):
//   pnpm seed:dummy [projectId] [count]
//   pnpm seed:dummy orbit 500
//
// Generates ~count knowledge documents (Notion/Slack/GitHub) plus extra
// attempts and decisions, embeds every document with the active harness's
// embedding model, and upserts into the documents / attempts / decisions
// collections. Idempotent: re-running replaces the same seeded ids.

import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { closeDb, getDb, isDbConfigured } from '../lib/db'
import { embed } from '../lib/models'
import { readEnv } from '../lib/env'
import { getActiveHarness } from '../lib/contracts/get-active-harness'
import { generateDummy } from '../lib/seed/dummy-data'
import type { KnowledgeDoc } from '../lib/types'

type StringIdDoc = { _id: string; [key: string]: unknown }
const upserts = (docs: StringIdDoc[]): AnyBulkWriteOperation<StringIdDoc>[] =>
  docs.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } }))
const coll = (db: Db, name: string) => db.collection<StringIdDoc>(name)

async function main() {
  const projectId = process.argv[2] || 'orbit'
  const count = Number(process.argv[3] || '500')

  if (!isDbConfigured()) throw new Error('MONGODB_URI is not set.')
  if (!readEnv().OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set — real embeddings are required for vector search.')
  }

  const db = await getDb()
  const harness = await getActiveHarness(projectId).catch(() => undefined)
  const { documents, attempts, decisions } = generateDummy(projectId, count)

  console.log(`Embedding ${documents.length} documents (this calls the embedding API)...`)
  const embedded: KnowledgeDoc[] = []
  const nowIso = new Date().toISOString()
  let done = 0
  for (const item of documents) {
    const embedding = await embed(`${item.title}\n\n${item.text}`, harness)
    embedded.push({ ...item, embedding, ingestedAt: nowIso })
    done += 1
    if (done % 50 === 0) console.log(`  embedded ${done}/${documents.length}`)
  }

  // Embed the extra attempts/decisions too so they show up in vector search.
  for (const a of attempts) a.embedding = await embed(`${a.goal} ${a.approach}`, harness)
  for (const d of decisions) d.embedding = await embed(`${d.title} ${d.rationale}`, harness)

  await coll(db, 'documents').bulkWrite(upserts(embedded as unknown as StringIdDoc[]))
  await coll(db, 'attempts').bulkWrite(upserts(attempts as unknown as StringIdDoc[]))
  await coll(db, 'decisions').bulkWrite(upserts(decisions as unknown as StringIdDoc[]))

  // Ensure the project exists so the app has a name to show.
  await coll(db, 'projects').bulkWrite(
    upserts([{ _id: projectId, name: 'Orbit', description: 'A team task app with rich seeded knowledge.' }]),
  )

  console.log(
    `Seeded ${embedded.length} documents, ${attempts.length} attempts, ${decisions.length} decisions into "${db.databaseName}" (project=${projectId}).`,
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
