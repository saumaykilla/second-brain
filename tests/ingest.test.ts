import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkConditions, checkDeadEnds, ingestMessage } from '@/lib/contracts'
import { closeDb, getDb } from '@/lib/db'
import { classifyByRules, parseLabel } from '@/lib/ingest/classify'
import { AttemptExtraction, DecisionExtraction, extractRecord, hoursIn } from '@/lib/ingest/extract'
import { getFixture } from '@/lib/fixtures'

const harness = getFixture('orbit')!.harness
const BLOCKER_TYPES = ['technical_limit', 'cost', 'performance', 'library_bug', 'licensing', 'org_constraint', 'time']

describe('classification (f-a-01)', () => {
  it('parses model replies into one of the six labels', () => {
    expect(parseLabel('attempt_result')).toBe('attempt_result')
    expect(parseLabel('Label: decision.')).toBe(null)
    expect(parseLabel('DECISION')).toBe('decision')
    expect(parseLabel('banana')).toBe(null)
  })

  it('labels the fixture messages correctly with the rule fallback', () => {
    const labeled = getFixture('orbit')!.messages
    let right = 0
    for (const m of labeled) if (classifyByRules(m.text) === m.label) right++
    expect(right / labeled.length).toBeGreaterThanOrEqual(0.85)
    expect(classifyByRules('Heading to lunch at 12:30.')).toBe('noise')
  })
})

describe('extraction (f-a-02)', () => {
  it('coerces unknown blocker types and outcomes to allowed values', () => {
    const parsed = AttemptExtraction.parse({ goal: 'g', approach: 'a', outcome: 'exploded', blockers: [{ type: 'weird', detail: 'd' }], hoursSpent: '9' })
    expect(parsed.outcome).toBe('failed')
    expect(parsed.blockers[0].type).toBe('technical_limit')
    expect(parsed.hoursSpent).toBe(9)
    expect(DecisionExtraction.parse({ title: 't', rationale: 'r', replaces: null }).replaces).toBeUndefined()
  })

  it('extracts the Postgres LIKE result offline with blockers, evidence, and 9 hours', async () => {
    delete process.env.OPENROUTER_API_KEY
    const result = await extractRecord(
      'Postgres LIKE search is 2.4s p95 on 200k tasks, benchmark attached. Moving search to Atlas Search. Spent 9 hours on it.',
      'attempt_result',
      harness,
    )
    expect(result?.kind).toBe('attempt')
    if (result?.kind !== 'attempt') return
    expect(result.attempt.hoursSpent).toBe(9)
    expect(BLOCKER_TYPES).toContain(result.attempt.blockers[0].type)
    expect(result.attempt.blockers[0].type).toBe('performance')
    expect(result.attempt.evidence[0].kind).toBe('benchmark')
    expect(result.attempt.alternative).toContain('Atlas Search')
    expect(hoursIn('lost about 2 days')).toBe(16)
  })
})

const hasDb = Boolean(process.env.MONGODB_URI)
const projectId = `ingest-test-${Date.now().toString(36)}`

describe.skipIf(!hasDb)('ingest pipeline (f-a-03, MongoDB)', { timeout: 30_000 }, () => {
  beforeAll(() => {
    process.env.EMBEDDINGS = 'local'
    delete process.env.OPENROUTER_API_KEY
  })
  afterAll(async () => {
    const db = await getDb()
    for (const name of ['messages', 'attempts', 'decisions', 'entities', 'edges', 'traces']) {
      await db.collection(name).deleteMany({ projectId })
    }
    await closeDb()
  })

  const base = { projectId, source: 'web' as const, author: 'priya' }

  it('merges a start and a result in one thread into one attempt with a trace per step', async () => {
    const start = await ingestMessage({ ...base, sourceId: 'm1', threadId: 'th-realtime', text: 'Starting on live board updates. Going to try WebSockets straight from our serverless functions.', postedAt: '2026-03-01T10:00:00.000Z' })
    expect(start.label).toBe('attempt_start')
    expect(start.attemptIds).toEqual([])

    const result = await ingestMessage({ ...base, sourceId: 'm2', threadId: 'th-realtime', text: 'Tried WebSockets on the serverless functions for 2 days. Connections drop at the 10s timeout, socket hang up in the logs. Moving to Server-Sent Events.', postedAt: '2026-03-03T10:00:00.000Z' })
    expect(result.label).toBe('attempt_result')
    expect(result.attemptIds).toHaveLength(1)

    const db = await getDb()
    const attempts = await db.collection('attempts').find({ projectId }).toArray()
    expect(attempts).toHaveLength(1)
    const attempt = attempts[0]
    expect(attempt.outcome).toBe('failed')
    expect(attempt.hoursSpent).toBe(16)
    expect(BLOCKER_TYPES).toContain(attempt.blockers[0].type)
    expect(attempt.sourceMessageIds).toHaveLength(2)
    expect(attempt.startedAt).toBe('2026-03-01T10:00:00.000Z')
    expect(Array.isArray(attempt.embedding) && attempt.embedding.length).toBe(1536)

    const traces = await db.collection('traces').find({ projectId, messageId: result.message._id }).toArray()
    expect(traces.map((t) => t.step)).toEqual(['classify', 'extract', 'store'])
  })

  it('stores noise and creates nothing, and replaying a message is a no-op', async () => {
    const noise = await ingestMessage({ ...base, sourceId: 'm3', threadId: 'th-random', text: 'Heading to lunch at 12:30.' })
    expect(noise.label).toBe('noise')
    const db = await getDb()
    expect(await db.collection<{ _id: string; projectId: string }>('messages').countDocuments({ projectId, _id: noise.message._id })).toBe(1)
    expect(await db.collection('attempts').countDocuments({ projectId })).toBe(1)

    const replay = await ingestMessage({ ...base, sourceId: 'm2', threadId: 'th-realtime', text: 'anything' })
    expect(replay.duplicate).toBe(true)
    expect(await db.collection('messages').countDocuments({ projectId })).toBe(3)
    expect(await db.collection('attempts').countDocuments({ projectId })).toBe(1)
  })

  it('marks an earlier decision superseded when a later one replaces it', async () => {
    const sessions = await ingestMessage({ ...base, sourceId: 'd1', threadId: 'th-auth', text: 'Decision: we will use server sessions for auth.', postedAt: '2026-03-04T10:00:00.000Z' })
    const jwt = await ingestMessage({ ...base, sourceId: 'd2', threadId: 'th-auth', text: 'Decision: auth moves to JWT tokens instead of server sessions.', postedAt: '2026-03-10T10:00:00.000Z' })
    const better = await ingestMessage({ ...base, sourceId: 'd3', threadId: 'th-auth', text: 'Decision: switching auth to Better Auth, replacing JWT tokens.', postedAt: '2026-03-20T10:00:00.000Z' })
    expect(sessions.decisionIds).toHaveLength(1)
    expect(jwt.decisionIds).toHaveLength(1)
    expect(better.decisionIds).toHaveLength(1)

    const db = await getDb()
    const byId = new Map((await db.collection('decisions').find({ projectId }).toArray()).map((d) => [String(d._id), d]))
    expect(byId.get(sessions.decisionIds[0])).toMatchObject({ status: 'superseded', supersededBy: jwt.decisionIds[0] })
    expect(byId.get(jwt.decisionIds[0])).toMatchObject({ status: 'superseded', supersededBy: better.decisionIds[0] })
    expect(byId.get(better.decisionIds[0])?.status).toBe('active')
    expect(await db.collection('edges').countDocuments({ projectId, kind: 'superseded_by' })).toBe(2)
    expect(Array.isArray(byId.get(better.decisionIds[0])?.embedding)).toBe(true)
  })

  it('a decision that meets a condition reopens the dead end once (f-a-07)', async () => {
    const db = await getDb()
    const before = await db.collection<{ _id: string; projectId: string; status: string }>('attempts').findOne({ projectId })
    expect(before?.status).toBe('active')
    await db.collection<{ _id: string }>('attempts').updateOne(
      { _id: before!._id },
      { $set: { conditions: [{ description: 'Serverless platform must allow long-lived connections without the 10s timeout, or the realtime service runs as a long-running container.', met: false }] } },
    )

    const unrelated = await ingestMessage({ ...base, sourceId: 'd4', threadId: 'th-pdf', text: 'Decision: we will use the MIT licensed pdf-lib for PDF export.', postedAt: '2026-03-21T10:00:00.000Z' })
    expect(unrelated.transitions).toEqual([])

    const appRunner = await ingestMessage({ ...base, sourceId: 'd5', threadId: 'th-infra', text: 'Decision: the realtime service moves to AWS App Runner as a long-running container, so connections are no longer cut by the serverless timeout.', postedAt: '2026-03-22T10:00:00.000Z' })
    expect(appRunner.transitions).toHaveLength(1)
    expect(appRunner.transitions[0].attemptId).toBe(before!._id)

    const after = await db.collection<{ _id: string; status: string; conditions: Array<{ met: boolean; metByDecisionId?: string }> }>('attempts').findOne({ _id: before!._id })
    expect(after?.status).toBe('revisitable')
    expect(after?.conditions[0]).toMatchObject({ met: true, metByDecisionId: appRunner.decisionIds[0] })
    expect(await db.collection('edges').countDocuments({ projectId, kind: 'unblocks', 'to.id': before!._id })).toBe(1)

    const replay = await checkConditions(projectId, appRunner.decisionIds[0])
    expect(replay).toEqual([])
    expect(await db.collection('edges').countDocuments({ projectId, kind: 'unblocks' })).toBe(1)
  })

  it('warns about the stored dead end from Check', async () => {
    const matches = await checkDeadEnds(projectId, 'Let\u2019s add socket.io WebSockets on our serverless functions so the board updates live.')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].attempt.projectId).toBe(projectId)
    expect(matches[0].hoursSaved).toBe(16)
    expect(await checkDeadEnds(`${projectId}-other`, 'WebSockets on serverless functions')).toEqual([])
  })
})
