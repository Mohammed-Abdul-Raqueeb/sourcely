'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  Bookmark,
  ChevronDown,
  Clock,
  Columns3,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logoutAction } from '@/server/actions/auth'

/**
 * Account sidebar.
 *
 * Grouped rather than a flat list of nine links — "Discover", "Activity",
 * "Account" is how a buyer actually thinks about these, and a nine-item flat
 * menu reads as an admin panel.
 *
 * On mobile it collapses into a single disclosure so the page content is not
 * pushed below the fold by navigation.
 */

interface NavEntry {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Rendered as a count pill. */
  badge?: number
  exact?: boolean
}

interface NavGroup {
  title: string
  items: NavEntry[]
}

export function AccountNav({
  counts,
}: {
  counts: { saved: number; rfqs: number; unread: number; conversations: number }
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const groups: NavGroup[] = [
    {
      title: 'Overview',
      items: [{ href: '/account', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
    },
    {
      title: 'Discover',
      items: [
        { href: '/account/assistant', label: 'Conversations', icon: Sparkles, badge: counts.conversations },
        { href: '/account/searches', label: 'Search history', icon: Search },
        { href: '/account/recent', label: 'Recently viewed', icon: Clock },
      ],
    },
    {
      title: 'Activity',
      items: [
        { href: '/account/saved', label: 'Shortlist', icon: Bookmark, badge: counts.saved },
        { href: '/account/comparisons', label: 'Comparisons', icon: Columns3 },
        { href: '/account/rfq', label: 'Quotations', icon: FileText, badge: counts.rfqs },
        { href: '/account/notifications', label: 'Notifications', icon: Bell, badge: counts.unread },
      ],
    },
    {
      title: 'Account',
      items: [{ href: '/account/settings', label: 'Settings', icon: Settings }],
    },
  ]

  const isActive = (entry: NavEntry) =>
    entry.exact ? pathname === entry.href : pathname.startsWith(entry.href)

  const activeLabel =
    groups.flatMap((group) => group.items).find(isActive)?.label ?? 'Dashboard'

  const list = (
    <nav aria-label="Account" className="space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            {group.title}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((entry) => {
              const active = isActive(entry)
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors',
                      active
                        ? 'bg-surface-2 text-text'
                        : 'text-muted hover:bg-surface-2/60 hover:text-text'
                    )}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
                        aria-hidden
                      />
                    )}
                    <entry.icon
                      className={cn('size-4 shrink-0', active ? 'text-accent-text' : 'text-faint')}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{entry.label}</span>
                    {entry.badge != null && entry.badge > 0 && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tnum',
                          entry.href === '/account/notifications'
                            ? 'bg-accent text-accent-ink'
                            : 'bg-surface-3 text-muted'
                        )}
                      >
                        {entry.badge > 99 ? '99+' : entry.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <div className="border-t border-border pt-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LogOut className="size-4 shrink-0 text-faint" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  )

  return (
    <>
      {/* Mobile disclosure ------------------------------------------------- */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text"
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard className="size-4 text-accent-text" aria-hidden />
            {activeLabel}
          </span>
          <ChevronDown
            className={cn('size-4 text-muted transition-transform', mobileOpen && 'rotate-180')}
            aria-hidden
          />
        </button>

        {mobileOpen && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3 animate-fade-up">
            {list}
          </div>
        )}
      </div>

      <div className="hidden lg:block">{list}</div>
    </>
  )
}
