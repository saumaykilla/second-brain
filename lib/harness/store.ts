// Harness version persistence + history (f-b-07, f-b-08).
//
// Reads version history and persists a promoted version, deactivating the old
// active one. Works against Atlas when configured; against the fixture (single
// v1) otherwise so the Lab screen has data offline.

import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import type { HarnessConfig } from '../types'

export async function listHarnessVersions(projectId: string): Promise<HarnessConfig[]> {
  if (isDbConfigured()) {
    return (await (await collection('harness_configs')).find({ projectId }).sort({ version: 1 }).toArray()) as HarnessConfig[]
  }
  const fixture = getFixture(projectId)
  return fixture ? [fixture.harness] : []
}

/** Persist a promoted version and make it the only active one (R19). */
export async function promoteVersion(projectId: string, version: HarnessConfig): Promise<void> {
  if (!isDbConfigured()) return
  const configs = await collection('harness_configs')
  await configs.updateMany({ projectId, active: true }, { $set: { active: false } })
  await configs.updateOne(
    { projectId, version: version.version },
    { $set: { ...version, active: true } },
    { upsert: true },
  )
}

/** Record a rejected candidate so the reason is not lost (R22, AE5). */
export async function recordRejection(projectId: string, candidate: HarnessConfig): Promise<void> {
  if (!isDbConfigured()) return
  await (await collection('harness_configs')).updateOne(
    { projectId, version: candidate.version },
    { $set: { ...candidate, active: false } },
    { upsert: true },
  )
}
