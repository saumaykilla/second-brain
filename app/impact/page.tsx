'use client'

import { useEffect, useState } from 'react'
import { PageHeader, RecordCard, EmptyState, ErrorState, LoadingState } from '@/components/states'

interface ImpactResponse {
  ok: boolean
  warningsSent: number
  warningsAccepted?: number
  hoursSaved: number
  note?: string
  precisionTrend: Array<{ version: number; precision: number; overall: number }>
}

export default function ImpactPage() {
  const [data, setData] = useState<ImpactResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/impact?projectId=orbit')
        setData((await res.json()) as ImpactResponse)
        setStatus('done')
      } catch {
        setStatus('error')
      }
    })()
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Impact"
        description="Warnings sent, hours saved from accepted warnings, and how dead-end precision has trended across harness versions."
      />

      {status === 'loading' ? <LoadingState label="Loading impact\u2026" /> : null}
      {status === 'error' ? <ErrorState title="Could not load impact" /> : null}

      {status === 'done' && data ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RecordCard>
              <p className="text-sm text-muted-foreground">Warnings sent</p>
              <p className="font-serif text-3xl">{data.warningsSent}</p>
            </RecordCard>
            <RecordCard>
              <p className="text-sm text-muted-foreground">Accepted</p>
              <p className="font-serif text-3xl">{data.warningsAccepted ?? '\u2014'}</p>
            </RecordCard>
            <RecordCard>
              <p className="text-sm text-muted-foreground">Hours saved</p>
              <p className="font-serif text-3xl text-current">{data.hoursSaved}h</p>
            </RecordCard>
          </div>

          {data.note ? <EmptyState title="No warnings recorded yet">{data.note}</EmptyState> : null}

          <section aria-label="Precision trend" className="flex flex-col gap-3">
            <h2 className="font-serif text-xl">Precision trend</h2>
            {data.precisionTrend.length === 0 ? (
              <EmptyState title="No scored versions yet">
                Run reflection in the Harness Lab to record eval scores.
              </EmptyState>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.precisionTrend.map((p) => (
                  <li key={p.version}>
                    <RecordCard>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{p.version}</span>
                        <span className="text-sm">
                          precision {p.precision} · overall {p.overall}
                        </span>
                      </div>
                    </RecordCard>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
