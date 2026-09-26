'use client'

import { useState } from 'react'
import { PageHeader, RecordCard, StatusMark, EmptyState, ErrorState, LoadingState } from '@/components/states'

interface CheckMatch {
  attemptId: string
  goal: string
  approach: string
  outcome: string
  status: string
  confidence: number
  reason: string
  hoursSaved: number
  alternative: string | null
  blocker: { type: string; detail: string } | null
  evidence: Array<{ kind: string; summary: string; url: string | null }>
}

interface CheckResponse {
  ok: boolean
  matched: boolean
  matches: CheckMatch[]
  error?: string
}

const PLACEHOLDER = 'Let\u2019s add WebSockets so the board shows live updates for everyone on the team.'

export default function CheckIdeaPage() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({})

  async function onCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setStatus('loading')
    setResult(null)
    setFeedbackGiven({})
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = (await res.json()) as CheckResponse
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Check failed')
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  async function markNotRelevant(attemptId: string) {
    setFeedbackGiven((f) => ({ ...f, [attemptId]: 'not_relevant' }))
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target: { kind: 'check', id: attemptId },
          verdict: 'not_relevant',
        }),
      })
    } catch {
      // Feedback is best-effort; keep the optimistic UI state.
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Check an idea"
        description="Paste a plan. Second Brain warns you if the team already hit a dead end with the same approach, with the proof and what they did instead."
      />

      <form onSubmit={onCheck} className="flex flex-col gap-3">
        <label htmlFor="plan" className="text-sm font-medium">
          Your plan
        </label>
        <textarea
          id="plan"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={PLACEHOLDER}
          className="w-full resize-y rounded-md border border-border bg-background p-3 font-sans leading-relaxed outline-none focus:border-foreground"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!text.trim() || status === 'loading'}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Check for dead ends
          </button>
        </div>
      </form>

      {status === 'loading' ? <LoadingState label="Searching project memory\u2026" /> : null}

      {status === 'error' ? (
        <ErrorState title="Could not check that idea">
          <p>Something went wrong reaching project memory. Try again.</p>
        </ErrorState>
      ) : null}

      {status === 'done' && result && !result.matched ? (
        <EmptyState title="No matching dead end">
          <p>This looks like a genuinely new approach. The team has not recorded a failure for it.</p>
        </EmptyState>
      ) : null}

      {status === 'done' && result && result.matched ? (
        <section aria-label="Matching dead ends" className="flex flex-col gap-4">
          {result.matches.map((m) => (
            <RecordCard key={m.attemptId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusMark mark={m.status === 'revisitable' ? 'revisitable' : 'dead-end'} />
                <span className="text-sm text-muted-foreground">{Math.round(m.confidence * 100)}% match</span>
              </div>
              <p className="font-medium">Tried: {m.approach}</p>
              {m.blocker ? (
                <p className="text-sm leading-relaxed">
                  <span className="font-medium text-dead-end">Why it failed ({m.blocker.type.replace('_', ' ')}):</span>{' '}
                  {m.blocker.detail}
                </p>
              ) : null}
              {m.evidence.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {m.evidence.map((e, i) => (
                    <li key={i}>
                      <span className="font-medium text-foreground">Evidence ({e.kind}):</span> {e.summary}
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
              {m.alternative ? (
                <p className="text-sm leading-relaxed">
                  <span className="font-medium text-current">What the team did instead:</span> {m.alternative}
                </p>
              ) : null}
              <p className="text-sm">
                <span className="font-medium">Estimated hours saved:</span> {m.hoursSaved}h
              </p>
              <div className="flex items-center gap-3 pt-1">
                {feedbackGiven[m.attemptId] ? (
                  <span className="text-sm text-muted-foreground">Thanks — marked not relevant.</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => markNotRelevant(m.attemptId)}
                    className="text-sm text-muted-foreground underline underline-offset-4"
                  >
                    Not relevant
                  </button>
                )}
              </div>
            </RecordCard>
          ))}
        </section>
      ) : null}
    </div>
  )
}
