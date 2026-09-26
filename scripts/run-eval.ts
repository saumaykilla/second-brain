// pnpm eval — run the 40-case eval set and print scores (f-b-06).
import { runEval, EVAL_COUNTS } from '../lib/eval/runner'

const projectId = process.argv[2] ?? 'orbit'

async function main() {
  console.log(`Eval set: ${EVAL_COUNTS.total} cases`, EVAL_COUNTS)
  const report = await runEval(projectId)
  console.log('\nScores:')
  console.log(`  dead-end precision : ${report.deadEndPrecision}`)
  console.log(`  dead-end recall    : ${report.deadEndRecall}`)
  console.log(`  citation accuracy  : ${report.citationAccuracy}`)
  console.log(`  condition accuracy : ${report.conditionAccuracy}`)
  console.log(`  staleness          : ${report.staleness}`)
  console.log(`  avg hours saved    : ${report.avgHoursSaved}`)
  console.log(`  overall            : ${report.overall}`)
  if (report.failures.length) {
    console.log(`\n${report.failures.length} failing case(s):`)
    for (const f of report.failures) console.log(`  - ${f}`)
  } else {
    console.log('\nAll cases passed.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
