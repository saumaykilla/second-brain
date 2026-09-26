// Memory graph data (f-b-09, R28).
//
// Builds nodes (decisions, attempts, entities) and edges (caused_by,
// superseded_by, alternative_to, blocked_by, unblocks) for a project from the
// fixture (or DB when configured). Selecting a node resolves to its record.

import { collection, isDbConfigured } from './db'
import { getFixture } from './fixtures'
import type { Attempt, Decision, Edge, Entity, NodeKind } from './types'

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  status?: string
}

export interface GraphEdge {
  kind: Edge['kind']
  from: string
  to: string
  explanation?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export async function getGraph(projectId: string): Promise<GraphData> {
  let attempts: Attempt[]
  let decisions: Decision[]
  let entities: Entity[]
  let edges: Edge[]

  if (isDbConfigured()) {
    attempts = (await (await collection('attempts')).find({ projectId }).toArray()) as Attempt[]
    decisions = (await (await collection('decisions')).find({ projectId }).toArray()) as Decision[]
    entities = (await (await collection('entities')).find({ projectId }).toArray()) as Entity[]
    edges = (await (await collection('edges')).find({ projectId }).toArray()) as Edge[]
  } else {
    const fixture = getFixture(projectId)
    attempts = fixture?.attempts ?? []
    decisions = fixture?.decisions ?? []
    entities = fixture?.entities ?? []
    edges = fixture?.edges ?? []
  }

  const nodes: GraphNode[] = [
    ...attempts.map((a) => ({ id: a._id, kind: 'attempt' as const, label: a.approach, status: a.status })),
    ...decisions.map((d) => ({ id: d._id, kind: 'decision' as const, label: d.title, status: d.status })),
    ...entities.map((e) => ({ id: e._id, kind: 'entity' as const, label: e.name })),
  ]

  return {
    nodes,
    edges: edges.map((e) => ({ kind: e.kind, from: e.from.id, to: e.to.id, explanation: e.explanation })),
  }
}
