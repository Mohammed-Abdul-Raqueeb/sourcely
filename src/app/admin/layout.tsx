import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { initials } from '@/lib/format'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { AdminNav } from '@/components/admin/admin-nav'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · Sourcely' },
  robots: { index: false, follow: false },
}

/**
 * Admin shell.
 *
 * `requireRole('staff')` runs here, before any child page renders. Middleware
 * already bounced requests with no plausible token, but middleware runs on the
 * Edge and cannot reach the session store — so it cannot tell a revoked session
 * from a live one, nor a customer from an admin with certainty. This is the
 * authoritative check. See ARCHITECTURE.md §7.
 *
 * A customer who reaches this route is redirected to /404 rather than shown a
 * 403: confirming the admin area exists is a hint worth withholding.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireRole('staff', '/admin')

  const admin = getAdminRepository()
  const catalog = getCatalogRepository()

  const [products, rfqs, events, users] = await Promise.all([
    catalog.listAll(),
    admin.listAllRfqs(200),
    admin.listAllSearchEvents(500),
    admin.countUsers(),
  ])

  const rfqsAwaiting = rfqs.filter((rfq) =>
    ['submitted', 'under_review'].includes(rfq.status)
  ).length

  const failedSearches = events.filter((event) => event.resultCount === 0).length

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-4">
          <Logo href="/admin" />

          <Badge tone="accent" size="sm" icon={<ShieldCheck className="size-3" aria-hidden />}>
            {user.role === 'admin' ? 'Admin' : 'Staff'}
          </Badge>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="hidden rounded-md px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
            >
              Storefront
            </Link>
            <ThemeToggle />
            <span
              className="ml-1 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-mono text-[11px] font-semibold text-text-2"
              title={`${user.name} · ${user.email}`}
            >
              {initials(user.name)}
            </span>
          </div>
        </div>
      </header>

      <div className="container-page w-full flex-1 py-6 lg:py-9">
        <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-9">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <AdminNav
              counts={{
                products: products.length,
                rfqsAwaiting,
                failedSearches,
                users,
              }}
              role={user.role}
            />
          </div>

          <main id="main" className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
