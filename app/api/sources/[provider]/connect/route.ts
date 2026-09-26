import { appUrl, defaultProjectId } from '@/lib/env'
import { isDbConfigured } from '@/lib/db'
import { beginOAuth, isSourceProvider, oauthConfigured } from '@/lib/sources'

export const dynamic = 'force-dynamic'

// GET /api/sources/:provider/connect -> send the browser to the provider (f-a-10).
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  const back = (reason: string) => Response.redirect(`${appUrl()}/sources?error=${reason}`, 303)
  if (!isSourceProvider(provider)) return back('unknown_provider')
  if (!oauthConfigured(provider)) return back(`${provider}_oauth_not_configured`)
  if (!isDbConfigured()) return back('db_not_configured')
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || defaultProjectId()
  try {
    const url = await beginOAuth(projectId, provider)
    return Response.redirect(url, 303)
  } catch {
    return back(`${provider}_oauth_failed`)
  }
}
