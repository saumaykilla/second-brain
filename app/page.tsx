import Link from 'next/link'
import { Timeline } from '@/components/timeline'
import { EmptyState, ErrorState, PageHeader } from '@/components/states'
import { defaultProjectId } from '@/lib/env'
import { readProjectMemory, type ProjectMemory } from '@/lib/memory'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const projectId = defaultProjectId()
  let memory: ProjectMemory | null = null
  try {
    memory = await readProjectMemory(projectId)
  } catch {
    memory = null
  }
  const empty = memory !== null && memory.attempts.length === 0 && memory.decisions.length === 0
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Timeline"
        description="Your project's recorded decisions and attempts in order. Failed attempts are red, revisitable ones amber, current decisions green. Open a dead end to see the goal, approach, blockers, evidence, conditions, hours, and what the team did instead."
      />
      {memory === null ? <ErrorState title="Project memory is unavailable">Stored records could not be read.</ErrorState> : null}
      {empty ? (
        <EmptyState title="Nothing recorded yet">
          <p>
            Decisions and attempts appear here as they are captured. <Link href="/capture" className="underline underline-offset-4">Capture a message</Link>{' '}
            or connect Slack, and connect the docs and code to read on{' '}
            <Link href="/sources" className="underline underline-offset-4">Sources</Link>.
          </p>
        </EmptyState>
      ) : null}
      {memory && !empty ? <Timeline attempts={memory.attempts} decisions={memory.decisions} /> : null}
    </div>
  )
}
