'use client'

import { useEffect, useState } from 'react'
import { PageHeader, RecordCard, EmptyState, ErrorState, LoadingState } from '@/components/states'

interface Version {
  version: number
  parentVersion: number | null
  active: boolean
  change: string | null
  rejectedReason: string | null
  retrieval: { k: number; minScore: number; hybridWeight: number }
  scores: { deadEndPrecision: number; deadEndRecall: number; overall: number } | null
}

interface HarnessResponse {
  ok: boolean
  active: number
  versions: Version[]
}

export default function LabPage() {
  const [data, setData] = useState<HarnessResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [reflecting, setReflecting] = useState(false)
  const [reflectMsg, setReflectMsg] = useState<string | null>(null)

  async function load() {
    setStatus('loading')
    try {
      const res = await fetch('/api/harness')
      const json = (await res.json()) as HarnessResponse
      setData(json)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function runReflection() {
    setReflecting(true)
    setReflectMsg(null)
    try {
      const res = await fetch('/api/reflect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const json = (await res.json()) as { promoted: boolean; reason: string; change: string }
      setReflectMsg(`${json.change} — ${json.reason}`)
      // The timeline of versions only updates after a promotion.
      if (json.promoted) await load()
    } catch {
      setReflectMsg('Reflection failed.')
    } finally {
      setReflecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Harness Lab"
        description="The 'harness' is the AI config that powers Second Brain — the prompts, retrieval settings, and model routing. This lab shows each version, its eval score, and what changed. Reflection proposes one change, re-runs the evals, and promotes it only if the score improves without dropping precision — so the brain gets measurably better over time."
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runReflection}
          disabled={reflecting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {reflecting ? 'Running reflection\u2026' : 'Run reflection'}
        </button>
        {reflectMsg ? <span className="text-sm text-muted-foreground">{reflectMsg}</span> : null}
      </div>

      {status === 'loading' ? <LoadingState label="Loading versions\u2026" /> : null}
      {status === 'error' ? <ErrorState title="Could not load harness versions" /> : null}

      {status === 'done' && data && data.versions.length === 0 ? (
        <EmptyState title="No promoted versions yet">
          <p>This project runs on the default v1 settings. Versions appear here once reflection promotes or rejects a change.</p>
        </EmptyState>
      ) : null}

      {status === 'done' && data ? (
        <ol className="flex flex-col gap-3">
          {data.versions.map((v) => (
            <li key={v.version}>
              <RecordCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    v{v.version}
                    {v.active ? <span className="ml-2 text-sm text-current">active</span> : null}
                    {v.rejectedReason ? <span className="ml-2 text-sm text-dead-end">rejected</span> : null}
                  </span>
                  {v.parentVersion ? (
                    <span className="text-sm text-muted-foreground">from v{v.parentVersion}</span>
                  ) : null}
                </div>
                {v.change ? <p className="text-sm">Change: {v.change}</p> : null}
                {v.rejectedReason ? <p className="text-sm text-dead-end">Reason: {v.rejectedReason}</p> : null}
                <p className="text-sm text-muted-foreground">
                  retrieval: k={v.retrieval.k}, minScore={v.retrieval.minScore}, hybridWeight={v.retrieval.hybridWeight}
                </p>
                {v.scores ? (
                  <p className="text-sm">
                    precision {v.scores.deadEndPrecision} · recall {v.scores.deadEndRecall} · overall {v.scores.overall}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">no recorded score</p>
                )}
              </RecordCard>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
