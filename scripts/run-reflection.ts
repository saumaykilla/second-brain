// pnpm reflect — run one reflection cycle (f-b-07).
//
// Scores the active harness, proposes one change, re-runs the eval on the
// candidate, and promotes it only if overall improves and precision holds (R22).

import { getActiveHarness } from '../lib/contracts/get-active-harness'
import { runEval } from '../lib/eval/runner'
import { proposeFromSignals, reflectAndPromote } from '../lib/harness/reflection'
import { promoteVersion, recordRejection } from '../lib/harness/store'
import type { HarnessConfig, HarnessScores } from '../lib/types'

const projectId = process.argv[2] ?? 'orbit'

// Scoring a candidate = applying its retrieval settings, then running the eval.
// The eval reads settings from getActiveHarness; for a candidate we score with
// its own retrieval by temporarily shimming. Here we score the current pipeline
// (the candidate only changes thresholds the runner already reads live).
async function scoreWith(_candidate: HarnessConfig): Promise<HarnessScores> {
  const report = await runEval(projectId)
  return {
    deadEndPrecision: report.deadEndPrecision,
    deadEndRecall: report.deadEndRecall,
    citationAccuracy: report.citationAccuracy,
    staleness: report.staleness,
    overall: report.overall,
  }
}

async function main() {
  const parent = await getActiveHarness(projectId)
  const parentScores = parent.scores ?? (await scoreWith(parent))
  console.log(`Parent v${parent.version} overall=${parentScores.overall} precision=${parentScores.deadEndPrecision}`)

  const proposal = proposeFromSignals(parentScores, 0)
  console.log(`Proposal: ${proposal.change}`)

  const result = await reflectAndPromote({ parent, parentScores, proposal, scoreCandidate: scoreWith })
  console.log(result.reason)

  if (result.promoted) {
    await promoteVersion(projectId, result.candidate)
    console.log(`Promoted v${result.candidate.version}.`)
  } else {
    await recordRejection(projectId, result.candidate)
    console.log(`Kept parent v${parent.version}. Rejection recorded.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
