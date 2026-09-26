'use client'

import { useState } from 'react'
import { PageHeader, RecordCard, EmptyState, ErrorState, LoadingState } from '@/components/states'

type Source = 'notion' | 'slack' | 'github'
interface Result {
  id: string
  title: string
  snippet: string
  source: string
  kind: string
  url: string | null
  author: string | null
  tags: string[]
  score: number
}

const SOURCES: { key: Source; label: string }[] = [
  { key: 'notion', label: 'Notion' },
  { key: 'slack', label: 'Slack' },
  { key: 'github', label: 'GitHub' },
]

export default function KnowledgePage() {
  const [query, setQuery] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<Result[]>([])

  function toggle(s: Source) {
    setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: 'orbit', query, sources: sources.length ? sources : undefined }),
      })
      const data = (await res.json()) as { ok: boolean; results: Result[] }
      if (!res.ok || !data.ok) throw new Error('search failed')
      setResults(data.results)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Knowledge search"
        description="Semantic search across everything Second Brain has ingested — Notion pages, Slack messages, and GitHub PRs/issues/commits. Powered by Atlas Vector Search over embeddings."
      />

      <form onSubmit={onSearch} className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. how do we handle realtime updates?"
          className="w-full rounded-md border border-border bg-background p-3 outline-none focus:border-foreground"
        />
        <div className="flex flex-wrap items-center gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`rounded-full border px-3 py-1 text-sm ${
                sources.includes(s.key) ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={!query.trim() || status === 'loading'}
            className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
          >
            Search
          </button>
        </div>
      </form>

      {status === 'loading' ? <LoadingState label="Searching knowledge\u2026" /> : null}
      {status === 'error' ? (
        <ErrorState title="Search failed">
          <p>Knowledge search needs a database with ingested documents. Configure Atlas and run an ingest or the dummy seed.</p>
        </ErrorState>
      ) : null}
      {status === 'done' && results.length === 0 ? (
        <EmptyState title="No results">
          <p>Nothing ingested yet, or no match. Run <code className="font-mono">pnpm seed:dummy</code> or an integration ingest to fill the knowledge base.</p>
        </EmptyState>
      ) : null}

      {status === 'done' && results.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {results.map((r) => (
            <li key={r.id}>
              <RecordCard>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {r.source} · {r.kind}
                  </span>
                  <span className="text-sm text-muted-foreground">{Math.round(r.score * 100)}% match</span>
                </div>
                <p className="font-medium">
                  {r.url ? (
                    <a href={r.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{r.snippet}</p>
                {r.author ? <p className="text-xs text-muted-foreground">by {r.author}</p> : null}
              </RecordCard>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
