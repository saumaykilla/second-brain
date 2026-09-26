// Dummy data generator for a rich, realistic "Second Brain" demo.
//
// Produces hundreds of KnowledgeDocs across Notion / Slack / GitHub plus extra
// attempts and decisions, for a fictional product team ("Orbit"). Content is
// templated but varied so vector search returns meaningful, distinct results.
// The seed script embeds each doc with the real embedding model and upserts.

import type { Attempt, Decision, DocKind, DocSource, KnowledgeDoc } from '../types'

const PEOPLE = ['priya', 'marco', 'aisha', 'devon', 'lena', 'sam', 'noah', 'kira']
const REPOS = ['orbit/api', 'orbit/web', 'orbit/infra']
const CHANNELS = ['C-eng', 'C-product', 'C-design', 'C-incidents']

const TOPICS = [
  { area: 'search', tech: 'Atlas Search', problem: 'full-text search over tasks' },
  { area: 'realtime', tech: 'Server-Sent Events', problem: 'live task-board updates' },
  { area: 'auth', tech: 'Better Auth', problem: 'session management and revocation' },
  { area: 'billing', tech: 'Stripe', problem: 'usage-based invoicing' },
  { area: 'summaries', tech: 'GPT-4o', problem: 'auto-summarizing support tickets' },
  { area: 'exports', tech: 'headless Chrome', problem: 'PDF export of task boards' },
  { area: 'notifications', tech: 'Web Push', problem: 'browser notifications for mentions' },
  { area: 'analytics', tech: 'ClickHouse', problem: 'per-project usage analytics' },
  { area: 'onboarding', tech: 'product tours', problem: 'first-run activation' },
  { area: 'permissions', tech: 'RBAC', problem: 'role-based access to boards' },
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString()
}

/** A deterministic pseudo-random so runs are reproducible. */
function seeded(i: number): number {
  const x = Math.sin(i * 99991) * 10000
  return x - Math.floor(x)
}

export interface DummySet {
  documents: Omit<KnowledgeDoc, 'embedding' | 'ingestedAt'>[]
  attempts: Attempt[]
  decisions: Decision[]
}

export function generateDummy(projectId: string, count = 500): DummySet {
  const documents: DummySet['documents'] = []

  // Notion notes: design docs, RFCs, runbooks, meeting notes.
  const noteTypes = ['RFC', 'Design doc', 'Runbook', 'Meeting notes', 'Postmortem', 'Spec']
  const notionCount = Math.round(count * 0.3)
  for (let i = 0; i < notionCount; i++) {
    const t = pick(TOPICS, i)
    const noteType = pick(noteTypes, i)
    documents.push({
      _id: `${projectId}:notion:seed-${i}`,
      projectId,
      source: 'notion',
      kind: 'note',
      sourceId: `seed-notion-${i}`,
      title: `${noteType}: ${t.tech} for ${t.problem}`,
      text: `${noteType} covering ${t.problem}. We evaluated ${t.tech} for the ${t.area} area. Context, trade-offs, rollout plan, and open questions about performance, cost, and maintenance are discussed. Owner: ${pick(PEOPLE, i)}.`,
      url: `https://notion.so/orbit/${t.area}-${i}`,
      author: pick(PEOPLE, i),
      tags: ['notion', noteType.toLowerCase(), t.area],
      createdAt: daysAgo(Math.floor(seeded(i) * 120)),
      updatedAt: daysAgo(Math.floor(seeded(i + 1) * 60)),
    })
  }

  // Slack messages: discussions, questions, decisions-in-passing.
  const slackCount = Math.round(count * 0.4)
  const phrases = [
    (t: (typeof TOPICS)[number]) => `has anyone looked at ${t.tech} for ${t.problem}? curious about latency`,
    (t) => `we should probably standardize on ${t.tech} for ${t.area}`,
    (t) => `${t.problem} is flaky again in staging, opening an incident`,
    (t) => `PSA: rolling out ${t.tech} behind a flag this week`,
    (t) => `why did we move away from the old ${t.area} approach?`,
    (t) => `${t.tech} costs jumped last month, need to review usage`,
  ]
  for (let i = 0; i < slackCount; i++) {
    const t = pick(TOPICS, i)
    const channel = pick(CHANNELS, i)
    documents.push({
      _id: `${projectId}:slack:seed-${i}`,
      projectId,
      source: 'slack',
      kind: 'message',
      sourceId: `${channel}:seed.${i}`,
      title: `Message in ${channel}`,
      text: pick(phrases, i)(t),
      author: pick(PEOPLE, i),
      tags: ['slack', channel, t.area],
      createdAt: daysAgo(Math.floor(seeded(i + 7) * 90)),
    })
  }

  // GitHub: PRs, issues, commits.
  const ghCount = count - documents.length
  const ghKinds: DocKind[] = ['pull_request', 'issue', 'commit']
  for (let i = 0; i < ghCount; i++) {
    const t = pick(TOPICS, i)
    const repo = pick(REPOS, i)
    const kind = pick(ghKinds, i)
    const n = 100 + i
    const title =
      kind === 'commit'
        ? `Commit: ${t.area} - tune ${t.tech}`
        : `${kind === 'pull_request' ? 'PR' : 'Issue'} #${n}: ${t.problem} via ${t.tech}`
    documents.push({
      _id: `${projectId}:github:seed-${i}`,
      projectId,
      source: 'github',
      kind,
      sourceId: kind === 'commit' ? `${repo}@seed${i}` : `${repo}#${n}`,
      title,
      text: `${title}. Work in ${repo} on the ${t.area} area using ${t.tech}. Includes tests and a rollout note. ${kind === 'issue' ? 'Reported by a customer; needs triage.' : 'Reviewed and merged.'}`,
      url: `https://github.com/${repo}/pull/${n}`,
      author: pick(PEOPLE, i),
      tags: [repo, t.area, kind],
      createdAt: daysAgo(Math.floor(seeded(i + 13) * 100)),
    })
  }

  // A handful of extra attempts + decisions so Timeline/Graph are richer.
  const attempts: Attempt[] = TOPICS.slice(0, 5).map((t, i) => ({
    _id: `${projectId}:seed-attempt-${i}`,
    projectId,
    goal: `Ship ${t.problem}`,
    approach: `First attempt at ${t.problem} using a naive ${t.area} implementation`,
    outcome: i % 2 === 0 ? 'failed' : 'abandoned',
    blockers: [
      {
        type: i % 2 === 0 ? 'performance' : 'cost',
        detail: `The naive ${t.area} approach did not meet targets in production.`,
        evidence: [{ kind: 'benchmark', summary: `${t.area} p95 exceeded budget` }],
      },
    ],
    evidence: [{ kind: 'benchmark', summary: `${t.area} benchmark` }],
    conditions: [{ description: `A managed ${t.tech} option is approved`, met: false }],
    alternative: t.tech,
    hoursSpent: 4 + i * 2,
    authors: [pick(PEOPLE, i)],
    sourceMessageIds: [],
    entityIds: [],
    status: 'active',
    startedAt: daysAgo(80 - i * 5),
  }))

  const decisions: Decision[] = TOPICS.slice(0, 5).map((t, i) => ({
    _id: `${projectId}:seed-decision-${i}`,
    projectId,
    title: `Adopt ${t.tech} for ${t.area}`,
    rationale: `After the earlier attempt, we chose ${t.tech} to solve ${t.problem}.`,
    status: 'active',
    authors: [pick(PEOPLE, i + 2)],
    sourceMessageIds: [],
    entityIds: [],
    decidedAt: daysAgo(70 - i * 5),
  }))

  return { documents, attempts, decisions }
}
