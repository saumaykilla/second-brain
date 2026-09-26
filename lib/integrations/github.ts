// GitHub integration: pull PRs, issues, and commits into the documents collection.
//
// Uses the GitHub REST API directly with a personal access token (GITHUB_TOKEN).
// Repos to ingest come from the `repos` argument or the GITHUB_REPOS env
// (comma-separated `owner/repo`). Each PR / issue / commit becomes a KnowledgeDoc.

import { readEnv } from '../env'
import { docId, ingestDocuments, normalizeText, type IngestReport, type RawDoc } from './ingest-docs'
import type { DocKind } from '../types'

const API = 'https://api.github.com'

function ghHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'second-brain-ingest',
  }
}

async function ghGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: ghHeaders(token) })
  if (!res.ok) throw new Error(`GitHub ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

interface GhIssue {
  number: number
  title: string
  body?: string
  html_url: string
  user?: { login: string }
  created_at: string
  updated_at: string
  pull_request?: unknown // present => it's a PR
  state: string
}
interface GhCommit {
  sha: string
  html_url: string
  commit: { message: string; author?: { name?: string; date?: string } }
}

function parseRepos(repos?: string[]): string[] {
  if (repos?.length) return repos
  const fromEnv = readEnv().GITHUB_REPOS
  return fromEnv ? fromEnv.split(',').map((r: string) => r.trim()).filter(Boolean) : []
}

export async function ingestGithub(
  projectId: string,
  opts: { repos?: string[]; perRepo?: number } = {},
): Promise<IngestReport> {
  const token = readEnv().GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set.')
  const repos = parseRepos(opts.repos)
  if (repos.length === 0) throw new Error('No repos to ingest. Pass repos or set GITHUB_REPOS (owner/repo,owner/repo).')
  const perRepo = opts.perRepo ?? 50

  const raw: RawDoc[] = []
  for (const repo of repos) {
    // Issues endpoint returns both issues and PRs; classify by pull_request field.
    const issues = await ghGet<GhIssue[]>(token, `/repos/${repo}/issues?state=all&per_page=${perRepo}&sort=updated`)
    for (const it of issues) {
      const isPr = Boolean(it.pull_request)
      const kind: DocKind = isPr ? 'pull_request' : 'issue'
      raw.push({
        _id: docId(projectId, 'github', `${repo}#${it.number}`),
        projectId,
        source: 'github',
        kind,
        sourceId: `${repo}#${it.number}`,
        title: `${isPr ? 'PR' : 'Issue'} #${it.number}: ${it.title}`,
        text: normalizeText(`${it.title}\n\n${it.body ?? ''}\nstate: ${it.state}`),
        url: it.html_url,
        author: it.user?.login,
        tags: [repo, it.state],
        createdAt: it.created_at,
        updatedAt: it.updated_at,
      })
    }

    const commits = await ghGet<GhCommit[]>(token, `/repos/${repo}/commits?per_page=${perRepo}`)
    for (const c of commits) {
      raw.push({
        _id: docId(projectId, 'github', `${repo}@${c.sha}`),
        projectId,
        source: 'github',
        kind: 'commit',
        sourceId: `${repo}@${c.sha}`,
        title: `Commit ${c.sha.slice(0, 7)}`,
        text: normalizeText(c.commit.message),
        url: c.html_url,
        author: c.commit.author?.name,
        tags: [repo],
        createdAt: c.commit.author?.date ?? new Date().toISOString(),
      })
    }
  }
  return ingestDocuments(projectId, raw)
}
