'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader, RecordCard, EmptyState, ErrorState, LoadingState } from '@/components/states'

type NodeKind = 'attempt' | 'decision' | 'entity'
interface GNode { id: string; kind: NodeKind; label: string; status?: string }
interface GEdge { kind: string; from: string; to: string; explanation?: string }
interface GraphResponse { ok: boolean; nodes: GNode[]; edges: GEdge[] }

const COLUMN_X: Record<NodeKind, number> = { decision: 90, attempt: 330, entity: 570 }
const EDGE_COLOR: Record<string, string> = {
  unblocks: '#3f7d4e',
  blocked_by: '#b3372d',
  superseded_by: '#6b655c',
  alternative_to: '#b7791f',
  caused_by: '#1f1d1a',
}

export default function GraphPage() {
  const [data, setData] = useState<GraphResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [selected, setSelected] = useState<GNode | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/graph?projectId=orbit')
        setData((await res.json()) as GraphResponse)
        setStatus('done')
      } catch {
        setStatus('error')
      }
    })()
  }, [])

  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    if (!data) return pos
    const perKind: Record<NodeKind, number> = { decision: 0, attempt: 0, entity: 0 }
    for (const n of data.nodes) {
      const idx = perKind[n.kind]++
      pos.set(n.id, { x: COLUMN_X[n.kind], y: 60 + idx * 70 })
    }
    return pos
  }, [data])

  const height = useMemo(() => {
    if (!data) return 400
    const maxPerKind = Math.max(
      data.nodes.filter((n) => n.kind === 'decision').length,
      data.nodes.filter((n) => n.kind === 'attempt').length,
      data.nodes.filter((n) => n.kind === 'entity').length,
      1,
    )
    return 60 + maxPerKind * 70 + 40
  }, [data])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Memory graph"
        description="Decisions, attempts, and entities connected by caused-by, superseded-by, alternative-to, blocked-by, and unblocks edges. The App Runner decision unblocks the WebSockets dead end."
      />

      {status === 'loading' ? <LoadingState label="Building graph\u2026" /> : null}
      {status === 'error' ? <ErrorState title="Could not load the graph" /> : null}

      {status === 'done' && data ? (
        data.nodes.length === 0 ? (
          <EmptyState title="No graph data" />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-md border border-border">
              <svg width={680} height={height} role="img" aria-label="Memory graph">
                {data.edges.map((e, i) => {
                  const a = layout.get(e.from)
                  const b = layout.get(e.to)
                  if (!a || !b) return null
                  return (
                    <line
                      key={i}
                      x1={a.x + 60}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={EDGE_COLOR[e.kind] ?? '#999'}
                      strokeWidth={e.kind === 'unblocks' ? 2.5 : 1.5}
                      strokeDasharray={e.kind === 'unblocks' ? '4 3' : undefined}
                    />
                  )
                })}
                {data.nodes.map((n) => {
                  const p = layout.get(n.id)!
                  const fill =
                    n.kind === 'decision'
                      ? n.status === 'superseded'
                        ? '#e6dcc6'
                        : '#d5ecd9'
                      : n.kind === 'attempt'
                        ? n.status === 'revisitable'
                          ? '#f5e6c8'
                          : '#f3d3cf'
                        : '#eee7d6'
                  return (
                    <g key={n.id} onClick={() => setSelected(n)} style={{ cursor: 'pointer' }}>
                      <rect x={p.x} y={p.y - 16} width={120} height={32} rx={5} fill={fill} stroke="#d9cfbb" />
                      <text x={p.x + 60} y={p.y + 4} textAnchor="middle" fontSize={10} fill="#1f1d1a">
                        {n.label.length > 20 ? `${n.label.slice(0, 18)}\u2026` : n.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            {selected ? (
              <RecordCard>
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{selected.kind}</span>
                  <code className="font-mono text-xs text-muted-foreground">{selected.id}</code>
                </div>
                <p>{selected.label}</p>
                {selected.status ? <p className="text-sm text-muted-foreground">status: {selected.status}</p> : null}
              </RecordCard>
            ) : (
              <p className="text-sm text-muted-foreground">Select a node to open its record.</p>
            )}
          </div>
        )
      ) : null}
    </div>
  )
}
