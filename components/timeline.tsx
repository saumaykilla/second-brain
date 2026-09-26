'use client'

import { useState } from 'react'
import type { Attempt, Decision, ProjectFixture } from '@/lib/types'
import { RecordCard, StatusMark, markFor } from './states'

// Timeline + dead-end detail (f-b-04).
// Failed attempts show a red "dead end" mark, revisitable ones amber, decisions
// green (current) or grey (superseded). Opening a dead end reveals goal,
// approach, blockers with evidence, conditions, hours, and the alternative.

type Row =
  | { kind: 'attempt'; when: string; data: Attempt }
  | { kind: 'decision'; when: string; data: Decision }

export function Timeline({ fixture }: { fixture: ProjectFixture }) {
  const rows: Row[] = [
    ...fixture.attempts.map((a) => ({ kind: 'attempt' as const, when: a.startedAt, data: a })),
    ...fixture.decisions.map((d) => ({ kind: 'decision' as const, when: d.decidedAt, data: d })),
  ].sort((a, b) => a.when.localeCompare(b.when))

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={`${row.kind}-${row.data._id}`}>
          {row.kind === 'attempt' ? (
            <AttemptRow attempt={row.data} />
          ) : (
            <DecisionRow decision={row.data} />
          )}
        </li>
      ))}
    </ol>
  )
}

function when(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function AttemptRow({ attempt }: { attempt: Attempt }) {
  const [open, setOpen] = useState(false)
  return (
    <RecordCard>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-col gap-2 text-left"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusMark mark={markFor({ kind: 'attempt', status: attempt.status })} />
          <time dateTime={attempt.startedAt} className="text-sm text-muted-foreground">
            {when(attempt.startedAt)}
          </time>
        </div>
        <p className="font-medium">{attempt.approach}</p>
        <p className="text-sm text-muted-foreground">
          {attempt.hoursSpent} hours{attempt.alternative ? ` \u00b7 instead: ${attempt.alternative}` : ''}
        </p>
      </button>

      {open ? <DeadEndDetail attempt={attempt} /> : null}
    </RecordCard>
  )
}

export function DeadEndDetail({ attempt }: { attempt: Attempt }) {
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3 text-sm">
      <Detail label="Goal">{attempt.goal}</Detail>
      <Detail label="Approach">{attempt.approach}</Detail>

      <div className="flex flex-col gap-2">
        <p className="font-medium">Blockers</p>
        {attempt.blockers.map((b, i) => (
          <div key={i} className="rounded border border-border p-3">
            <p>
              <span className="font-medium text-dead-end">{b.type.replace('_', ' ')}:</span> {b.detail}
            </p>
            {b.evidence.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                {b.evidence.map((e, j) => (
                  <li key={j}>
                    <span className="font-medium text-foreground">{e.kind}:</span> {e.summary}
                    {e.url ? (
                      <>
                        {' '}
                        <a href={e.url} className="underline underline-offset-2">
                          link
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {attempt.conditions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Conditions to revisit</p>
          <ul className="flex flex-col gap-1">
            {attempt.conditions.map((c, i) => (
              <li key={i} className={c.met ? 'text-current' : 'text-muted-foreground'}>
                {c.met ? '\u2713' : '\u25cb'} {c.description}
                {c.met && c.metByDecisionId ? ` (met by ${c.metByDecisionId})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Detail label="Hours spent">{`${attempt.hoursSpent}h`}</Detail>
      {attempt.alternative ? <Detail label="What we did instead">{attempt.alternative}</Detail> : null}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="leading-relaxed">
      <span className="font-medium">{label}:</span> {children}
    </p>
  )
}

function DecisionRow({ decision }: { decision: Decision }) {
  return (
    <RecordCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusMark mark={markFor({ kind: 'decision', status: decision.status })} />
        <time dateTime={decision.decidedAt} className="text-sm text-muted-foreground">
          {when(decision.decidedAt)}
        </time>
      </div>
      <p className="font-medium">{decision.title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{decision.rationale}</p>
      {decision.status === 'superseded' && decision.supersededBy ? (
        <p className="text-xs text-muted-foreground">Superseded by {decision.supersededBy}</p>
      ) : null}
    </RecordCard>
  )
}
