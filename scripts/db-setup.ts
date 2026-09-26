import { closeDb, getDb } from '../lib/db'
import { COLLECTIONS } from '../lib/types'
import { SEARCH_INDEXES, STANDARD_INDEXES } from './db-setup-indexes'

async function main() {
  const db = await getDb()
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name))

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) {
      await db.createCollection(name)
      console.log(`created collection ${name}`)
    }
    const indexes = STANDARD_INDEXES[name]
    if (indexes?.length) await db.collection(name).createIndexes(indexes)
  }

  for (const spec of SEARCH_INDEXES) {
    const coll = db.collection(spec.collection)
    const current = await coll.listSearchIndexes(spec.name).toArray()
    if (current.length) {
      console.log(`search index ${spec.collection}.${spec.name} exists (${(current[0] as { status?: string }).status ?? 'unknown'})`)
      continue
    }
    await coll.createSearchIndex({ name: spec.name, type: spec.type, definition: spec.definition })
    console.log(`created search index ${spec.collection}.${spec.name}`)
  }

  console.log(`db setup complete for ${db.databaseName}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
