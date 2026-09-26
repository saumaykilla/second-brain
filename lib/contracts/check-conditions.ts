import { randomUUID } from 'node:crypto'
import { collection, isDbConfigured } from '../db'
import { getFixture } from '../fixtures'
import { chat, modelConfigured, parseJsonObject } from '../ingest/model'
import { overlap, tokens } from '../ingest/text'
import { getActiveHarness } from './get-active-harness'
import type { Attempt, ConditionTransition, Decision } from '../types'

// Owner: Capture lane (f-a-07). Real implementation.
//
// A new decision may satisfy a condition a failed attempt was waiting on. For
// the decision's project: load the attempts that still have unmet conditions,
// ask the harness judge (prompts.conditions) which conditions
// the decision satisfies, mark those conditions met, flip the attempt to
// revisitable, and add one `unblocks` edge. Replaying the same decision is a
// no-op because met conditions are skipped. Offline (no database) the fixture's
// `unblocks` edges answer, as before; with no model key a lexical check stands in.

interface ConditionVerdict {
  met: number[]
  explanation: string
}

function lexicalVerdict(decision: Decision, attempt: Attempt): ConditionVerdict {
  const decisionTokens = tokens(`${decision.title} ${decision.rationale}`)
  const met: number[] = []
  attempt.conditions.forEach((c, i) => {
    if (!c.met && overlap(decisionTokens, tokens(c.description)) >= 2) met.push(i)
  })
  return { met, explanation: met.length ? `${decision.title} addresses what this attempt was waiting on.` : '' }
}

async function modelVerdict(decision: Decision, attempt: Attempt, harness: Awaited<ReturnType<typeof getActiveHarness>>): Promise<ConditionVerdict> {
  const open = attempt.conditions.map((c, i) => ({ index: i, description: c.description, met: c.met })).filter((c) => !c.met)
  if (open.length === 0) return { met: [], explanation: '' }
  const reply = await chat(
    harness.routing.judge,
    `${harness.prompts.conditions}\nReturn strict JSON {"met":[condition index numbers that the decision satisfies],"explanation":one sentence}. ` +
      'Only list a condition when the decision clearly changes the thing the condition names. If none, return {"met":[],"explanation":""}.',
    JSON.stringify({
      decision: { title: decision.title, rationale: decision.rationale },
      attempt: { goal: attempt.goal, approach: attempt.approach, blockers: attempt.blockers.map((b) => b.detail) },
      conditions: open,
    }),
    true,
  )
  const parsed = parseJsonObject(reply) as Partial<ConditionVerdict>
  const met = Array.isArray(parsed.met) ? parsed.met.map(Number).filter((i) => open.some((c) => c.index === i)) : []
  return { met, explanation: String(parsed.explanation ?? '') }
}

export async function checkConditions(projectId: string, decisionId: string): Promise<ConditionTransition[]> {
  if (!isDbConfigured()) {
    const fixture = getFixture(projectId)
    if (!fixture) return []
    return fixture.edges
      .filter((edge) => edge.kind === 'unblocks' && edge.from.kind === 'decision' && edge.from.id === decisionId)
      .map((edge) => ({ attemptId: edge.to.id, decisionId, explanation: edge.explanation ?? 'This decision may satisfy a condition of the attempt.' }))
  }

  const decisions = await collection('decisions')
  const decision = (await decisions.findOne({ _id: decisionId, projectId })) as Decision | null
  if (!decision) return []
  const harness = await getActiveHarness(projectId)

  // Every attempt in the project that is still waiting on a condition. The
  // decision may satisfy a condition without reading like the attempt, so this
  // is not limited by the dead-end retrieval cutoff.
  const attempts = await collection('attempts')
  const candidates = (await attempts
    .find({ projectId, status: { $in: ['active', 'resolved'] }, 'conditions.met': false })
    .limit(100)
    .toArray()) as Attempt[]
  const edges = await collection('edges')
  const transitions: ConditionTransition[] = []

  for (const candidate of candidates) {
    if (candidate.projectId !== projectId) continue
    if (!candidate.conditions.some((c) => !c.met)) continue
    let verdict: ConditionVerdict
    if (modelConfigured()) {
      try {
        verdict = await modelVerdict(decision, candidate, harness)
      } catch {
        verdict = lexicalVerdict(decision, candidate)
      }
    } else {
      verdict = lexicalVerdict(decision, candidate)
    }
    if (verdict.met.length === 0) continue

    const conditions = candidate.conditions.map((c, i) => (verdict.met.includes(i) ? { ...c, met: true, metByDecisionId: decisionId } : c))
    const explanation = verdict.explanation || `${decision.title} satisfies a condition of this attempt.`
    await attempts.updateOne({ _id: candidate._id, projectId }, { $set: { conditions, status: 'revisitable' } })
    const existing = await edges.findOne({ projectId, kind: 'unblocks', 'from.id': decisionId, 'to.id': candidate._id })
    if (!existing) {
      await edges.insertOne({
        _id: randomUUID(),
        projectId,
        kind: 'unblocks',
        from: { kind: 'decision', id: decisionId },
        to: { kind: 'attempt', id: candidate._id },
        explanation,
      })
    }
    transitions.push({ attemptId: candidate._id, decisionId, explanation })
  }
  return transitions
}
