// Read a project's recorded memory for the screens (f-b-10). Database when
// configured; the fixture only offline. Never mixes the two.

import { collection, isDbConfigured } from './db'
import { getFixture } from './fixtures'
import type { Attempt, Decision, Message } from './types'

export interface ProjectMemory {
  attempts: Attempt[]
  decisions: Decision[]
}

export async function readProjectMemory(projectId: string): Promise<ProjectMemory> {
  if (isDbConfigured()) {
    const [attempts, decisions] = await Promise.all([
      (await collection('attempts')).find({ projectId }).sort({ startedAt: -1 }).limit(200).toArray(),
      (await collection('decisions')).find({ projectId }).sort({ decidedAt: -1 }).limit(200).toArray(),
    ])
    return { attempts: attempts as Attempt[], decisions: decisions as Decision[] }
  }
  const fixture = getFixture(projectId)
  return { attempts: fixture?.attempts ?? [], decisions: fixture?.decisions ?? [] }
}

export async function readRecentMessages(projectId: string, limit = 20): Promise<Message[]> {
  if (!isDbConfigured()) return []
  return (await collection('messages')).find({ projectId }).sort({ postedAt: -1 }).limit(limit).toArray() as Promise<Message[]>
}
