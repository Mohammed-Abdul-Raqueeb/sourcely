import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, Search, Sparkles } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository } from '@/server/repositories'
import { initials } from '@/lib/format'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { ButtonLink } from '@/components/ui/button'
import { ShortlistProvider } from '@/components/catalog/shortlist'
import { AccountNav } from '@/components/account/account-nav'
import { ShortlistSync } from '@/components/account/shortlist-sync'

export const metadata: Metadata = {
  title: { default: 'Account', template: '%s · Account · Sourcely' },
  robots: { index: false, follow: false },
}

/**
 * Customer area shell.
 *
 * `requireUser` is called here rather than relying on middleware. Middleware
 * cannot reach the session store, so it can only reject requests with no
 * plausible token — the authoritative check is this one, and it runs before
 * any child page renders. See ARCHITECTURE.md §7.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser('/account')
  const activity = getActivityRepository()

  const [saved, rfqs, unread, conversations] = await Promise.all([
    activity.listSavedProducts(user.id),
    activity.listRfqs(user.id),
    activity.unreadCount(user.id),
    activity.listConversations(user.id, 50),
  ])

  const openRfqs = rfqs.filter(
    (rfq) => !['accepted', 'declined', 'expired'].includes(rfq.status)
  ).length

  return (
    <ShortlistProvider>
      <ShortlistSync />

      <div className="flex min-h-dvh flex-col">
        {/* Header --------------------------------------------------------- */}
        <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
          <div className="container-page flex h-16 items-center gap-4">
            <Logo />

            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
            <span className="hidden text-[13px] font-medium text-muted sm:block">
              Buyer workspace
            </span>

            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/products"
                className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text sm:inline-flex"
              >
                <Search className="size-4" aria-hidden />
                Catalogue
              </Link>

              <Link
                href="/account/notifications"
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
                className="relative grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Bell className="size-4" aria-hidden />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent font-mono text-[9px] font-bold text-accent-ink tnum">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>

              <ThemeToggle />

              <ButtonLink
                href="/assistant"
                size="sm"
                className="ml-1 hidden sm:inline-flex"
                leadingIcon={<Sparkles className="size-4" aria-hidden />}
              >
                Ask AI
              </ButtonLink>

              <Link
                href="/account/settings"
                className="ml-1 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-mono text-[11px] font-semibold text-text-2 transition-colors hover:border-accent-line hover:text-text"
                aria-label="Account settings"
                title={user.name}
              >
                {initials(user.name)}
              </Link>
            </div>
          </div>
        </header>

        {/* Body ----------------------------------------------------------- */}
        <div className="container-page w-full flex-1 py-6 lg:py-10">
          <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <AccountNav
                counts={{
                  saved: saved.length,
                  rfqs: openRfqs,
                  unread,
                  conversations: conversations.length,
                }}
              />
            </div>

            <main id="main" className="min-w-0">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ShortlistProvider>
  )
}
