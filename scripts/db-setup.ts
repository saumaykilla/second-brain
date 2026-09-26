import { closeDb, getDb } from '../lib/db'
import { COLLECTIONS } from '../lib/types'
import type { SearchIndexSpec } from './db-setup-indexes'
import { EXTENDED_SEARCH_INDEXES, SEARCH_INDEXES, STANDARD_INDEXES } from './db-setup-indexes'

async function createSearchIndexes(
  db: Awaited<ReturnType<typeof getDb>>,
  specs: SearchIndexSpec[],
  { optional = false }: { optional?: boolean } = {},
) {
  for (const spec of specs) {
    const coll = db.collection(spec.collection)
    try {
      const current = await coll.listSearchIndexes(spec.name).toArray()
      if (current.length) {
        console.log(`search index ${spec.collection}.${spec.name} exists (${(current[0] as { status?: string }).status ?? 'unknown'})`)
        continue
      }
      await coll.createSearchIndex({ name: spec.name, type: spec.type, definition: spec.definition })
      console.log(`created search index ${spec.collection}.${spec.name}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (optional) {
        console.warn(`skipped optional search index ${spec.collection}.${spec.name}: ${msg}`)
      } else {
        throw error
      }
    }
  }
}

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

  // Core search indexes (fit the M0 free-tier limit of three).
  await createSearchIndexes(db, SEARCH_INDEXES)
  // Extended text indexes (need a paid tier; skipped gracefully on M0).
  await createSearchIndexes(db, EXTENDED_SEARCH_INDEXES, { optional: true })

  console.log(`db setup complete for ${db.databaseName}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
