import { EmptyState, PageHeader } from './states'

export function PlannedScreen({
  title,
  description,
  featureId,
  design,
}: {
  title: string
  description: string
  featureId: string
  design: string
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState title="Not built yet">
        <p>
          This screen is built in <code className="font-mono text-foreground">{featureId}</code>, following{' '}
          <code className="font-mono text-foreground">{design}</code>. See <code className="font-mono">docs/{featureId}.md</code>.
        </p>
      </EmptyState>
    </>
  )
}
