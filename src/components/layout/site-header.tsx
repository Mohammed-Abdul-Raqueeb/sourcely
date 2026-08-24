'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, LayoutDashboard, Menu, Search, Sparkles, User, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PRIMARY_NAV, SITE } from '@/lib/site'
import { ButtonLink, IconButton } from '@/components/ui/button'
import { useShortlist } from '@/components/catalog/shortlist'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

/**
 * Public site header.
 *
 * Five destinations and one primary CTA — see ARCHITECTURE.md section 4. The
 * header gains a border and a blur only once the page has scrolled, so the
 * hero reads as full-bleed at rest.
 *
 * Account state comes from the shortlist provider's post-mount session
 * reconcile, the same mechanism that fills the bookmark badge. The static
 * HTML always says "Sign in"; the swap happens client-side once the session
 * endpoint answers, which is what lets every marketing page stay prerendered.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { saved, ready, user } = useShortlist()

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the drawer on navigation, and lock body scroll while it is open.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  function firstNameOf(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name
  }

  function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
    return `${first}${last}`.toUpperCase() || '·'
  }

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled
            ? 'border-b border-border bg-bg/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="container-page flex h-16 items-center gap-6 lg:h-18">
          <Logo />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-text'
                        : 'text-muted hover:bg-surface-2 hover:text-text'
                    )}
                  >
                    {item.label}
                    {isActive(item.href) && (
                      <span
                        className="absolute inset-x-3 -bottom-0.5 h-px bg-accent"
                        aria-hidden
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <IconButton
              label="Search products"
              size="sm"
              className="hidden sm:grid"
              onClick={() => {
                window.location.href = '/products'
              }}
            >
              <Search className="size-4" aria-hidden />
            </IconButton>

            <Link
              href="/account/saved"
              aria-label={`Shortlist${ready && saved.length > 0 ? `, ${saved.length} saved` : ''}`}
              className="relative grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Bookmark className="size-4" aria-hidden />
              {ready && saved.length > 0 && (
                <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-accent font-mono text-[9px] font-bold text-accent-ink tnum">
                  {saved.length > 9 ? '9+' : saved.length}
                </span>
              )}
            </Link>

            <ThemeToggle />

            {user ? (
              <>
                {user.role !== 'customer' && (
                  <Link
                    href="/admin"
                    className="ml-1 hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text md:inline-flex"
                  >
                    <LayoutDashboard className="size-4" aria-hidden />
                    Admin
                  </Link>
                )}
                <Link
                  href="/account"
                  aria-label={`Account — signed in as ${user.name}`}
                  className="ml-1 hidden items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2 md:inline-flex"
                >
                  <span
                    aria-hidden
                    className="grid size-6 place-items-center rounded-full border border-accent-line bg-accent-soft text-[10px] font-bold text-accent-text"
                  >
                    {initialsOf(user.name)}
                  </span>
                  {firstNameOf(user.name)}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text md:inline-flex"
              >
                <User className="size-4" aria-hidden />
                Sign in
              </Link>
            )}

            <ButtonLink
              href="/assistant"
              size="sm"
              className="ml-1 hidden sm:inline-flex"
              leadingIcon={<Sparkles className="size-4" aria-hidden />}
            >
              Ask AI
            </ButtonLink>

            <IconButton
              label={menuOpen ? 'Close menu' : 'Open menu'}
              size="sm"
              className="lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </IconButton>
          </div>
        </div>
      </header>

      {/* Mobile drawer ----------------------------------------------------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            aria-label="Mobile"
            className="absolute inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-border bg-bg p-5 shadow-float animate-fade-up"
          >
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-lg px-4 py-3 transition-colors',
                      isActive(item.href) ? 'bg-surface-2' : 'hover:bg-surface-2'
                    )}
                  >
                    <span className="text-[15px] font-semibold text-text">{item.label}</span>
                    {item.description && (
                      <span className="text-[13px] text-muted">{item.description}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-border pt-5">
              {user ? (
                <>
                  <ButtonLink href="/account" variant="secondary" fullWidth>
                    My account
                  </ButtonLink>
                  {user.role !== 'customer' ? (
                    <ButtonLink href="/admin" variant="secondary" fullWidth>
                      Admin console
                    </ButtonLink>
                  ) : (
                    <ButtonLink href="/account/rfq" variant="secondary" fullWidth>
                      My RFQs
                    </ButtonLink>
                  )}
                </>
              ) : (
                <>
                  <ButtonLink href="/login" variant="secondary" fullWidth>
                    Sign in
                  </ButtonLink>
                  <ButtonLink href="/register" variant="secondary" fullWidth>
                    Create account
                  </ButtonLink>
                </>
              )}
              <ButtonLink
                href="/assistant"
                fullWidth
                className="col-span-2"
                leadingIcon={<Sparkles className="size-4" aria-hidden />}
              >
                Ask the AI assistant
              </ButtonLink>
            </div>

            {user && (
              <p className="mt-3 text-center text-xs text-muted">
                Signed in as {user.name}
              </p>
            )}

            <p className="mt-5 text-center text-xs text-faint">
              {SITE.legalName}
            </p>
          </nav>
        </div>
      )}
    </>
  )
}
