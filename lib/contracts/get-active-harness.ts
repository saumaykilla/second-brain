import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import type { HarnessConfig } from '../types'

// Owner: shared (f-sh-03). Real implementation.
export async function getActiveHarness(projectId: string): Promise<HarnessConfig> {
  if (isDbConfigured()) {
    const harness = await (await collection('harness_configs')).findOne({ projectId, active: true })
    if (harness) return harness
  }
  const fixture = getFixture(projectId)?.harness
  if (!fixture) throw new Error(`No active harness for project ${projectId}`)
  return fixture
}
