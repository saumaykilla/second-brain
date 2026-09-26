'use client'

import { useState } from 'react'
import { PageHeader, RecordCard, StatusMark, EmptyState, ErrorState, LoadingState } from '@/components/states'

interface Citation {
  kind: 'attempt' | 'decision' | 'doc'
  id: string
  title: string
  status: string
  supersededBy?: string
  url?: string
  provider?: 'github' | 'notion'
  excerpt?: string
}

interface AskResponse {
  ok: boolean
  answer: string
  citations: Citation[]
  unsupported: boolean
  error?: string
}

const EXAMPLES = ['Why did we drop that approach?', 'How does our API handle authentication?']

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<AskResponse | null>(null)

  async function onAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setStatus('loading')
    setResult(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = (await res.json()) as AskResponse
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Ask failed')
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  function markFor(c: Citation) {
    if (c.kind === 'decision') return c.status === 'superseded' ? 'superseded' : 'current'
    return c.status === 'revisitable' ? 'revisitable' : 'dead-end'
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ask the brain"
        description="Ask about the project. Answers come from recorded decisions and attempts and from the Notion pages and GitHub repositories connected on Sources. Every answer cites where it came from and never presents a superseded decision as current."
      />

      <form onSubmit={onAsk} className="flex flex-col gap-3">
        <label htmlFor="q" className="text-sm font-medium">
          Your question
        </label>
        <input
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={EXAMPLES[0]}
          className="w-full rounded-md border border-border bg-background p-3 outline-none focus:border-foreground"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!question.trim() || status === 'loading'}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Ask
          </button>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {status === 'loading' ? <LoadingState label="Reading project memory\u2026" /> : null}
      {status === 'error' ? <ErrorState title="Could not answer that">Try again.</ErrorState> : null}

      {status === 'done' && result?.unsupported ? (
        <EmptyState title="Not enough in memory">
          <p>
            I could not find a decision, attempt, or connected page that answers that, so I will not guess. Connect more on
            Sources if the answer lives in Notion or GitHub.
          </p>
        </EmptyState>
      ) : null}

      {status === 'done' && result && !result.unsupported ? (
        <section aria-label="Answer" className="flex flex-col gap-4">
          <RecordCard>
            <p className="leading-relaxed">{result.answer}</p>
          </RecordCard>
          <h2 className="font-serif text-xl">Citations</h2>
          <ul className="flex flex-col gap-3">
            {result.citations.map((c) => (
              <li key={`${c.kind}-${c.id}`}>
                <RecordCard>
                  {c.kind === 'doc' ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {c.provider === 'github' ? 'GitHub' : 'Notion'}
                        </span>
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
                            Open
                          </a>
                        ) : null}
                      </div>
                      <p className="font-medium">{c.title}</p>
                      {c.excerpt ? <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">{c.excerpt}</blockquote> : null}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <StatusMark mark={markFor(c) as never} />
                        <code className="font-mono text-xs text-muted-foreground">{c.id}</code>
                      </div>
                      <p className="font-medium">{c.title}</p>
                      {c.status === 'superseded' && c.supersededBy ? (
                        <p className="text-sm text-muted-foreground">Superseded by {c.supersededBy}. Not the current decision.</p>
                      ) : null}
                    </>
                  )}
                </RecordCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
