import { SourcePicker } from '@/components/source-picker'
import { EmptyState, ErrorState, PageHeader, RecordCard } from '@/components/states'
import { defaultProjectId } from '@/lib/env'
import { sourcesOverview, type ProviderOverview } from '@/lib/sources'

export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  github_oauth_not_configured: 'GitHub sign-in is not configured on this server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
  notion_oauth_not_configured: 'Notion sign-in is not configured on this server. Set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.',
  github_oauth_failed: 'GitHub did not finish connecting. Try again.',
  notion_oauth_failed: 'Notion did not finish connecting. Try again.',
  github_access_denied: 'GitHub access was not granted.',
  notion_access_denied: 'Notion access was not granted.',
  invalid_state: 'That sign-in link expired. Start again from Connect.',
  db_not_configured: 'MONGODB_URI is not set, so connections cannot be stored.',
  unknown_provider: 'That provider is not supported.',
}

function ProviderSection({ view, label }: { view: ProviderOverview; label: string }) {
  const action = view.connected ? `Reconnect ${label}` : `Connect ${label}`
  return (
    <section aria-labelledby={`${view.provider}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${view.provider}-heading`} className="font-serif text-2xl">
          {label}
        </h2>
        {view.configured ? (
          <a
            href={`/api/sources/${view.provider}/connect`}
            className="rounded-md border border-foreground px-4 py-2 text-sm font-medium hover:bg-index/60"
          >
            {action}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">Sign-in not configured</span>
        )}
      </div>
      <RecordCard>
        {view.connected ? (
          <SourcePicker provider={view.provider} account={view.account} items={view.items} selected={view.selected} />
        ) : (
          <p className="text-muted-foreground">
            Not connected. {label} content is not read until you connect and choose what to share.
          </p>
        )}
        {view.reason === `${view.provider}_list_failed` ? (
          <p className="text-sm text-dead-end">The {label} list could not be loaded. Reconnect and try again.</p>
        ) : null}
      </RecordCard>
    </section>
  )
}

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>
}) {
  const query = await searchParams
  const projectId = defaultProjectId()
  let overview: Awaited<ReturnType<typeof sourcesOverview>> | null = null
  try {
    overview = await sourcesOverview(projectId)
  } catch {
    overview = null
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Sources"
        description="Connect your Notion and GitHub, then choose the pages and repositories Second Brain may read. Ask answers from that content and cites the page or file."
      />

      {query.error ? <ErrorState title="Could not connect">{ERRORS[query.error] ?? 'Something went wrong.'}</ErrorState> : null}
      {query.connected ? (
        <p className="rounded-md border border-current/40 p-4 text-current">
          {query.connected === 'github' ? 'GitHub' : 'Notion'} is connected. Choose what to share below.
        </p>
      ) : null}

      {overview === null ? (
        <ErrorState title="Sources are unavailable">Stored connections could not be read.</ErrorState>
      ) : (
        <>
          <ProviderSection view={overview.github} label="GitHub" />
          <ProviderSection view={overview.notion} label="Notion" />

          <section aria-labelledby="synced-heading" className="flex flex-col gap-4">
            <h2 id="synced-heading" className="font-serif text-2xl">
              What Second Brain can read
            </h2>
            {overview.docs.length === 0 ? (
              <EmptyState title="Nothing synced yet">
                <p>Save a selection above and the files and pages will appear here.</p>
              </EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {overview.docs.map((doc) => (
                  <li key={`${doc.provider}:${doc.sourceId}:${doc.docId}`} className="flex items-center justify-between gap-4 px-4 py-3">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="truncate underline-offset-4 hover:underline">
                      {doc.title}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {doc.provider === 'github' ? 'GitHub' : 'Notion'} · {doc.chunks} passages
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
