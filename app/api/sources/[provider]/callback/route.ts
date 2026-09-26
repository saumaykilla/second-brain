import { appUrl } from '@/lib/env'
import { consumeOAuth, exchangeGithub, exchangeNotion, isSourceProvider, saveConnection } from '@/lib/sources'

export const dynamic = 'force-dynamic'

// GET /api/sources/:provider/callback?code&state -> store the token, go back to Sources (f-a-10).
// The token is written to MongoDB and never sent to the browser.
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  const back = (query: string) => Response.redirect(`${appUrl()}/sources?${query}`, 303)
  if (!isSourceProvider(provider)) return back('error=unknown_provider')

  const url = new URL(request.url)
  if (url.searchParams.get('error')) return back(`error=${provider}_access_denied`)
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  if (!code || !state) return back(`error=${provider}_oauth_failed`)

  const pending = await consumeOAuth(state)
  if (!pending || pending.provider !== provider) return back('error=invalid_state')

  try {
    const granted = provider === 'github' ? await exchangeGithub(code) : await exchangeNotion(code)
    await saveConnection(pending.projectId, provider, granted)
  } catch {
    return back(`error=${provider}_oauth_failed`)
  }
  return back(`connected=${provider}`)
}
