'use client'

import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, PageHeader, RecordCard } from '@/components/states'

interface CapturedMessage {
  _id: string
  author: string
  text: string
  postedAt: string
  label?: string
}

interface CaptureResponse {
  ok: boolean
  message?: CapturedMessage
  label?: string
  duplicate?: boolean
  error?: string
}

const LABELS: Record<string, string> = {
  decision: 'Decision',
  attempt_start: 'Attempt started',
  attempt_result: 'Attempt result',
  intent: 'Intent',
  question: 'Question',
  noise: 'Nothing to keep',
}

export default function CapturePage() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saved, setSaved] = useState<CaptureResponse | null>(null)
  const [recent, setRecent] = useState<CapturedMessage[] | null>(null)
  const [recentError, setRecentError] = useState(false)

  async function loadRecent() {
    try {
      const res = await fetch('/api/capture')
      const data = (await res.json()) as { ok: boolean; messages?: CapturedMessage[] }
      if (!res.ok || !data.ok) throw new Error()
      setRecent(data.messages ?? [])
      setRecentError(false)
    } catch {
      setRecentError(true)
    }
  }

  useEffect(() => {
    loadRecent()
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setStatus('saving')
    setSaved(null)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = (await res.json()) as CaptureResponse
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'capture_failed')
      setSaved(data)
      setStatus('saved')
      setText('')
      await loadRecent()
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Capture"
        description="Type or paste a message from your team and Second Brain saves it to project memory and labels what it is: a decision, an attempt, an intent, or a question."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="capture" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="capture"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="We decided to move search to Atlas Search after the Postgres LIKE spike was too slow."
          className="w-full resize-y rounded-md border border-border bg-background p-3 font-sans leading-relaxed outline-none focus:border-foreground"
        />
        <div>
          <button
            type="submit"
            disabled={!text.trim() || status === 'saving'}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            {status === 'saving' ? 'Saving…' : 'Save to memory'}
          </button>
        </div>
      </form>

      {status === 'error' ? <ErrorState title="Could not save that">Project memory could not be reached. Try again.</ErrorState> : null}
      {status === 'saved' && saved?.message ? (
        <RecordCard>
          <p className="text-sm font-medium text-current">
            Saved as {LABELS[saved.label ?? ''] ?? saved.label}
            {saved.duplicate ? ' (already recorded)' : ''}
          </p>
          <p className="leading-relaxed">{saved.message.text}</p>
        </RecordCard>
      ) : null}

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <h2 id="recent-heading" className="font-serif text-2xl">
          Recent captures
        </h2>
        {recent === null && !recentError ? <LoadingState label="Loading captures…" /> : null}
        {recentError ? <ErrorState title="Could not load captures" /> : null}
        {recent !== null && recent.length === 0 ? (
          <EmptyState title="Nothing captured yet">
            <p>Messages you save here, and messages from a connected Slack, appear in this list.</p>
          </EmptyState>
        ) : null}
        {recent && recent.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {recent.map((m) => (
              <li key={m._id}>
                <RecordCard>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{LABELS[m.label ?? ''] ?? m.label ?? 'Unlabeled'}</span>
                    <span>
                      {m.author} · {new Date(m.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-relaxed">{m.text}</p>
                </RecordCard>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
