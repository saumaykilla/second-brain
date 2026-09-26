import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import type { HarnessConfig } from '../types'

// Owner: shared (f-sh-03). Real implementation.
//
// Order: the project's active version in the database, then the project's
// fixture harness (offline tests), then the v1 configuration from the sample
// fixture with the project id swapped in. The last step means a new project
// has retrieval and model settings before reflection has promoted anything;
// it carries no sample records, only configuration.
export async function getActiveHarness(projectId: string): Promise<HarnessConfig> {
  if (isDbConfigured()) {
    const harness = await (await collection('harness_configs')).findOne({ projectId, active: true })
    if (harness) return harness
  }
  const fixture = getFixture(projectId)?.harness
  if (fixture) return fixture
  const template = getFixture('orbit')?.harness
  if (!template) throw new Error(`No active harness for project ${projectId}`)
  return { ...template, _id: `${projectId}-harness-v${template.version}`, projectId }
}
