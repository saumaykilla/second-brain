// OAuth for GitHub and Notion (f-a-10). The browser only ever sees the
// provider's authorize URL and a redirect back to /sources. Client secrets
// and access tokens stay in the server environment and in MongoDB.

import { randomUUID } from 'node:crypto'
import { appUrl, readEnv } from '../env'
import { integrations, oauthStates } from './store'
import type { Integration, PublicConnection, SourceProvider } from './types'

const STATE_TTL_MS = 15 * 60 * 1000

export function redirectUri(provider: SourceProvider): string {
  return `${appUrl()}/api/sources/${provider}/callback`
}

export function oauthConfigured(provider: SourceProvider): boolean {
  const env = readEnv()
  return provider === 'github'
    ? Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    : Boolean(env.NOTION_CLIENT_ID && env.NOTION_CLIENT_SECRET)
}

export function githubAuthorizeUrl(clientId: string, redirect: string, state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('scope', 'repo read:user')
  url.searchParams.set('state', state)
  return url.toString()
}

export function notionAuthorizeUrl(clientId: string, redirect: string, state: string): string {
  const url = new URL('https://api.notion.com/v1/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('owner', 'user')
  url.searchParams.set('redirect_uri', redirect)
  url.searchParams.set('state', state)
  return url.toString()
}

/** Store a one-time state and return the provider authorize URL. */
export async function beginOAuth(projectId: string, provider: SourceProvider): Promise<string> {
  const env = readEnv()
  const clientId = provider === 'github' ? env.GITHUB_CLIENT_ID : env.NOTION_CLIENT_ID
  if (!clientId) throw new Error(`${provider}_oauth_not_configured`)
  const state = randomUUID()
  await (await oauthStates()).insertOne({ state, projectId, provider, createdAt: new Date() })
  const redirect = redirectUri(provider)
  return provider === 'github'
    ? githubAuthorizeUrl(clientId, redirect, state)
    : notionAuthorizeUrl(clientId, redirect, state)
}

/** Consume a state exactly once. Returns null when unknown or expired. */
export async function consumeOAuth(state: string): Promise<{ projectId: string; provider: SourceProvider } | null> {
  if (!state) return null
  const found = await (await oauthStates()).findOneAndDelete({ state })
  if (!found) return null
  if (Date.now() - found.createdAt.getTime() > STATE_TTL_MS) return null
  return { projectId: found.projectId, provider: found.provider }
}

export interface Granted {
  accessToken: string
  account: string
}

export async function exchangeGithub(code: string): Promise<Granted> {
  const env = readEnv()
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new Error('github_oauth_not_configured')
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri('github'),
    }),
  })
  if (!res.ok) throw new Error(`github_oauth_failed: ${res.status}`)
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error('github_oauth_failed: no token')
  const user = await fetch('https://api.github.com/user', {
    headers: { authorization: `Bearer ${data.access_token}`, accept: 'application/vnd.github+json' },
  })
  if (!user.ok) throw new Error(`github_user_failed: ${user.status}`)
  const profile = (await user.json()) as { login?: string }
  return { accessToken: data.access_token, account: profile.login ?? 'GitHub' }
}

export async function exchangeNotion(code: string): Promise<Granted> {
  const env = readEnv()
  if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) throw new Error('notion_oauth_not_configured')
  const basic = Buffer.from(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri('notion') }),
  })
  if (!res.ok) throw new Error(`notion_oauth_failed: ${res.status}`)
  const data = (await res.json()) as { access_token?: string; workspace_name?: string }
  if (!data.access_token) throw new Error('notion_oauth_failed: no token')
  return { accessToken: data.access_token, account: data.workspace_name ?? 'Notion' }
}

export async function saveConnection(projectId: string, provider: SourceProvider, granted: Granted): Promise<void> {
  await (await integrations()).updateOne(
    { projectId, provider },
    {
      $set: { accessToken: granted.accessToken, account: granted.account, updatedAt: new Date() },
      $setOnInsert: { selected: [] },
    },
    { upsert: true },
  )
}

export async function loadConnection(projectId: string, provider: SourceProvider): Promise<Integration | null> {
  return (await integrations()).findOne({ projectId, provider, accessToken: { $exists: true } })
}

export async function removeConnection(projectId: string, provider: SourceProvider): Promise<void> {
  await (await integrations()).deleteOne({ projectId, provider })
}

export function publicConnection(doc: Integration | null): PublicConnection {
  if (!doc) return { connected: false, account: '', selected: [] }
  return { connected: true, account: doc.account, selected: [...(doc.selected ?? [])] }
}
