'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CatalogItem, SourceProvider } from '@/lib/sources/types'

export function SourcePicker({
  provider,
  account,
  items,
  selected,
}: {
  provider: SourceProvider
  account: string
  items: CatalogItem[]
  selected: string[]
}) {
  const router = useRouter()
  const [chosen, setChosen] = useState<string[]>(selected)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [summary, setSummary] = useState('')

  const noun = provider === 'github' ? 'repositories' : 'pages'

  function toggle(id: string) {
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setStatus('saving')
    setSummary('')
    try {
      const res = await fetch(`/api/sources/${provider}/selection`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: chosen }),
      })
      const data = (await res.json()) as { ok: boolean; synced?: number; chunks?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'selection_failed')
      setSummary(`${data.synced ?? 0} ${noun} read, ${data.chunks ?? 0} passages stored.`)
      setStatus('saved')
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        Connected as <span className="font-medium text-foreground">{account || provider}</span>. Choose the {noun}{' '}
        Second Brain may read.
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">No {noun} were returned for this account.</p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-index/50">
                <input type="checkbox" checked={chosen.includes(item.id)} onChange={() => toggle(item.id)} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.private ? <span className="text-xs text-muted-foreground">private</span> : null}
                {item.kind === 'database' ? <span className="text-xs text-muted-foreground">database</span> : null}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {status === 'saving' ? 'Reading sources…' : 'Save access'}
        </button>
        <span className="text-sm text-muted-foreground">
          {chosen.length} of {items.length} selected
        </span>
      </div>
      {status === 'saved' ? <p className="text-sm text-current">{summary}</p> : null}
      {status === 'error' ? <p className="text-sm text-dead-end">Those sources could not be saved. Try again.</p> : null}
    </form>
  )
}
