import type { ProjectFixture } from '@/lib/types'
import { RecordCard, StatusMark, markFor } from './states'

type Row = { id: string; when: string; title: string; detail: string; kind: 'attempt' | 'decision'; status: string }

export function FixtureSummary({ fixture }: { fixture: ProjectFixture }) {
  const rows: Row[] = [
    ...fixture.attempts.map((a) => ({
      id: a._id,
      when: a.startedAt,
      title: a.approach,
      detail: `${a.hoursSpent} hours${a.alternative ? ` · instead: ${a.alternative}` : ''}`,
      kind: 'attempt' as const,
      status: a.status,
    })),
    ...fixture.decisions.map((d) => ({
      id: d._id,
      when: d.decidedAt,
      title: d.title,
      detail: d.rationale,
      kind: 'decision' as const,
      status: d.status,
    })),
  ].sort((a, b) => a.when.localeCompare(b.when))

  return (
    <section aria-labelledby="fixture-heading" className="flex flex-col gap-4">
      <h2 id="fixture-heading" className="font-serif text-2xl">
        {fixture.project.name} fixture
      </h2>
      <ol className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id}>
            <RecordCard>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusMark mark={markFor({ kind: row.kind, status: row.status as never })} />
                <time dateTime={row.when} className="text-sm text-muted-foreground">
                  {new Date(row.when).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </time>
              </div>
              <p className="font-medium">{row.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{row.detail}</p>
            </RecordCard>
          </li>
        ))}
      </ol>
    </section>
  )
}
