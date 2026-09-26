import orbit from '@/fixtures/orbit.json'
import type { ProjectFixture } from './types'

const fixtures: Record<string, ProjectFixture> = {
  orbit: orbit as ProjectFixture,
}

export function getFixture(projectId: string): ProjectFixture | undefined {
  return fixtures[projectId]
}

export function listFixtures(): ProjectFixture[] {
  return Object.values(fixtures)
}
