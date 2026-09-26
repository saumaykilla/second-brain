import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { closeDb, getDb } from '../lib/db'
import { listFixtures } from '../lib/fixtures'

type StringIdDoc = { _id: string; [key: string]: unknown }

function upserts(docs: StringIdDoc[]): AnyBulkWriteOperation<StringIdDoc>[] {
  return docs.map((doc) => ({
    replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
  }))
}

const coll = (db: Db, name: string) => db.collection<StringIdDoc>(name)

async function main() {
  const db = await getDb()
  for (const fixture of listFixtures()) {
    const id = fixture.project._id
    await coll(db, 'projects').bulkWrite(upserts([fixture.project as unknown as StringIdDoc]))
    for (const [name, docs] of [
      ['messages', fixture.messages],
      ['attempts', fixture.attempts],
      ['decisions', fixture.decisions],
      ['entities', fixture.entities],
      ['edges', fixture.edges],
    ] as const) {
      if (docs.length) await coll(db, name).bulkWrite(upserts(docs as unknown as StringIdDoc[]))
      console.log(`${id}: ${name} ${docs.length}`)
    }
    const harness = coll(db, 'harness_configs')
    const active = await harness.findOne({ projectId: id, active: true })
    if (!active) {
      await harness.replaceOne({ _id: fixture.harness._id }, fixture.harness as unknown as StringIdDoc, { upsert: true })
      console.log(`${id}: harness v${fixture.harness.version} active`)
    } else {
      console.log(`${id}: harness v${active.version} already active`)
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
