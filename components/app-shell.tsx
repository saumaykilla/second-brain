import { NavLinks } from './nav-links'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b border-border bg-index md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex flex-col gap-4 p-4 md:sticky md:top-0 md:p-6">
          <p className="font-serif text-lg text-muted-foreground">Index</p>
          <NavLinks />
        </div>
      </aside>
      <main className="flex-1 border-margin md:border-l-2">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  )
}
