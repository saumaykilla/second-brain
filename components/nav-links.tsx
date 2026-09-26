'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV_ITEMS = [
  { href: '/', label: 'Timeline' },
  { href: '/capture', label: 'Capture' },
  { href: '/ask', label: 'Ask' },
  { href: '/check', label: 'Check' },
  { href: '/graph', label: 'Graph' },
  { href: '/lab', label: 'Lab' },
  { href: '/impact', label: 'Impact' },
] as const

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main">
      <ul className="flex flex-wrap gap-1 md:flex-col">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-md px-3 py-1.5 text-[15px] transition-colors hover:bg-background/60 ${
                  active ? 'bg-background/70 font-medium text-foreground' : 'text-foreground/80'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
