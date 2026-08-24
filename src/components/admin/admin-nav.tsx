'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  ChevronDown,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Package,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Tags,
  Users,
} from 'lucide-react'
import type { Role } from '@/lib/domain/account'
import { cn } from '@/lib/cn'
import { logoutAction } from '@/server/actions/auth'

/**
 * Admin sidebar.
 *
 * Grouped by what the operator is doing — running the catalogue, serving
 * buyers, or tuning the engine — rather than by which table each page reads.
 * The last group is the one most admin panels omit and this product needs
 * most: search quality is a product surface here, not an implementation
 * detail (ARCHITECTURE.md §3.2).
 */

interface Entry {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
  exact?: boolean
  /** Hidden from staff. The page enforces this too; this only avoids a dead link. */
  adminOnly?: boolean
}

export function AdminNav({
  counts,
  role,
}: {
  counts: { products: number; rfqsAwaiting: number; failedSearches: number; users: number }
  role: Role
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const allGroups: { title: string; items: Entry[] }[] = [
    {
      title: 'Overview',
      items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
    },
    {
      title: 'Catalogue',
      items: [
        { href: '/admin/products', label: 'Products', icon: Package, badge: counts.products },
        { href: '/admin/inventory', label: 'Inventory', icon: Boxes },
        { href: '/admin/categories', label: 'Categories', icon: Tags },
        { href: '/admin/brands', label: 'Brands & sellers', icon: Tags },
      ],
    },
    {
      title: 'Demand',
      items: [
        { href: '/admin/rfq', label: 'Quotations', icon: FileText, badge: counts.rfqsAwaiting },
        { href: '/admin/customers', label: 'Customers', icon: Users, badge: counts.users },
      ],
    },
    {
      title: 'Search quality',
      items: [
        {
          href: '/admin/search-analytics',
          label: 'Search analytics',
          icon: Search,
          badge: counts.failedSearches,
        },
        { href: '/admin/ai', label: 'Ranking & AI', icon: Sparkles },
        { href: '/admin/reports', label: 'Reports', icon: Gauge },
      ],
    },
    {
      title: 'System',
      items: [
        { href: '/admin/audit', label: 'Audit trail', icon: ScrollText, adminOnly: true },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  // Groups that end up empty after filtering are dropped, so a staff account
  // never sees a "System" heading with nothing under it.
  const groups = allGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((entry) => !entry.adminOnly || role === 'admin'),
    }))
    .filter((group) => group.items.length > 0)

  const isActive = (entry: Entry) =>
    entry.exact ? pathname === entry.href : pathname.startsWith(entry.href)

  const activeLabel =
    groups.flatMap((group) => group.items).find(isActive)?.label ?? 'Dashboard'

  const list = (
    <nav aria-label="Admin" className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-faint uppercase">
            {group.title}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((entry) => {
              const active = isActive(entry)
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
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
                          entry.href === '/admin/rfq' || entry.href === '/admin/search-analytics'
                            ? 'bg-accent text-accent-ink'
                            : 'bg-surface-3 text-muted'
                        )}
                      >
                        {entry.badge > 999 ? '999+' : entry.badge}
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
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Package className="size-4 shrink-0 text-faint" aria-hidden />
          View storefront
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-text"
        >
          <span className="flex items-center gap-2">
            <LayoutDashboard className="size-4 text-accent-text" aria-hidden />
            {activeLabel}
          </span>
          <ChevronDown
            className={cn('size-4 text-muted transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>
        {open && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-3 animate-fade-up">
            {list}
          </div>
        )}
      </div>

      <div className="hidden lg:block">{list}</div>
    </>
  )
}
