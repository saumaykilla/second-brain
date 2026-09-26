import { Timeline } from '@/components/timeline'
import { EmptyState, PageHeader } from '@/components/states'
import { getFixture } from '@/lib/fixtures'

export default function TimelinePage() {
  const orbit = getFixture('orbit')
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Timeline"
        description="Orbit's decisions and attempts over six weeks. Failed attempts are red, revisitable ones amber, current decisions green. Open a dead end to see the goal, approach, blockers, evidence, conditions, hours, and what the team did instead."
      />
      {orbit ? <Timeline fixture={orbit} /> : <EmptyState title="No Orbit fixture found" />}
    </div>
  )
}
