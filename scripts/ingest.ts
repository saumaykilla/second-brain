// CLI ingest: pull external knowledge into Atlas.
//
// Usage (needs MONGODB_URI + OPENAI_API_KEY + the source token in env):
//   pnpm ingest notion [projectId] [limit]
//   pnpm ingest github [projectId] [owner/repo,owner/repo]
//   pnpm ingest slack  [projectId] [C123,C456]
//
// Reads .env.local automatically (via the pnpm script's --env-file flags).

import { ingestNotion } from '../lib/integrations/notion'
import { ingestGithub } from '../lib/integrations/github'
import { ingestSlack } from '../lib/integrations/slack'
import { closeDb } from '../lib/db'

async function main() {
  const [source, projectArg, extra] = process.argv.slice(2)
  const projectId = projectArg || 'orbit'
  if (!source) {
    console.error('Usage: pnpm ingest <notion|github|slack> [projectId] [extra]')
    process.exit(1)
  }

  let report
  if (source === 'notion') {
    report = await ingestNotion(projectId, { limit: extra ? Number(extra) : undefined })
  } else if (source === 'github') {
    const repos = extra ? extra.split(',').map((r: string) => r.trim()) : undefined
    report = await ingestGithub(projectId, { repos })
  } else if (source === 'slack') {
    const channels = (extra ?? '').split(',').map((c: string) => c.trim()).filter(Boolean)
    report = await ingestSlack(projectId, { channels })
  } else {
    console.error(`Unknown source: ${source}`)
    process.exit(1)
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeDb)
