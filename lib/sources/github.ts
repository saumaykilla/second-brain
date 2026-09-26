// GitHub reads for connected repositories (f-a-10). Lists the repositories
// the person can see and reads text files from a granted repository.

import type { CatalogItem, SourceFile } from './types'

const TEXT_SUFFIXES = [
  '.md', '.mdx', '.txt', '.rst',
  '.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.go', '.rs', '.java', '.kt', '.rb', '.swift', '.cs',
  '.yml', '.yaml', '.toml', '.json', '.sql', '.graphql', '.proto', '.sh',
]
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'vendor', '__pycache__', 'coverage', 'var'])
const SKIP_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'uv.lock', 'poetry.lock', 'Cargo.lock'])
export const MAX_FILES = 80
export const MAX_FILE_CHARS = 20_000
const MAX_FILE_BYTES = 200_000

export function wantedPath(path: string, size?: number): boolean {
  const parts = path.split('/')
  if (parts.some((part) => SKIP_DIRS.has(part))) return false
  const name = parts[parts.length - 1]
  if (SKIP_FILES.has(name)) return false
  if (size !== undefined && size > MAX_FILE_BYTES) return false
  return TEXT_SUFFIXES.some((suffix) => name.endsWith(suffix)) || name === 'Dockerfile' || name === 'Makefile'
}

function headers(token: string, accept = 'application/vnd.github+json'): HeadersInit {
  return { authorization: `Bearer ${token}`, accept, 'x-github-api-version': '2022-11-28' }
}

export async function listGithubRepos(token: string): Promise<CatalogItem[]> {
  const url = new URL('https://api.github.com/user/repos')
  url.searchParams.set('per_page', '100')
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('affiliation', 'owner,collaborator,organization_member')
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) throw new Error(`github_list_failed: ${res.status}`)
  const data = (await res.json()) as Array<{ full_name?: string; private?: boolean; html_url?: string }>
  return data
    .filter((item) => item.full_name)
    .map((item) => ({ id: item.full_name!, label: item.full_name!, url: item.html_url, private: Boolean(item.private) }))
}

interface TreeItem {
  path?: string
  type?: string
  size?: number
}

/** Read the text files of one repository on its default branch. */
export async function fetchGithubFiles(token: string, repo: string): Promise<SourceFile[]> {
  const meta = await fetch(`https://api.github.com/repos/${repo}`, { headers: headers(token) })
  if (!meta.ok) throw new Error(`github_repo_failed: ${meta.status}`)
  const branch = ((await meta.json()) as { default_branch?: string }).default_branch ?? 'main'

  const tree = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
    headers: headers(token),
  })
  if (!tree.ok) throw new Error(`github_tree_failed: ${tree.status}`)
  const items = (((await tree.json()) as { tree?: TreeItem[] }).tree ?? [])
    .filter((item) => item.type === 'blob' && item.path && wantedPath(item.path, item.size))
    .sort((a, b) => (a.path! < b.path! ? -1 : 1))
    .slice(0, MAX_FILES)

  const results = await mapConcurrent(items, FETCH_CONCURRENCY, async (item): Promise<SourceFile | null> => {
    const path = item.path!
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`, {
      headers: headers(token, 'application/vnd.github.raw+json'),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`github_file_failed: ${res.status}`)
    const text = (await res.text()).slice(0, MAX_FILE_CHARS)
    if (!text.trim()) return null
    return { docId: path, title: `${repo}/${path}`, url: `https://github.com/${repo}/blob/${branch}/${path}`, text }
  })
  return results.filter((file): file is SourceFile => file !== null)
}

const FETCH_CONCURRENCY = 8

/** Run `work` over `items` with at most `limit` in flight, keeping order. */
export async function mapConcurrent<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await work(items[index])
    }
  })
  await Promise.all(workers)
  return out
}
