import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass } from 'lucide-react'
import { SITE } from '@/lib/site'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Page not found' }

/**
 * The 404 everyone lands on — a mistyped URL, a retired product, and, by
 * design, a customer probing /admin (the middleware rewrites those here and
 * `requireRole` redirects here; a 404 confirms nothing about what exists).
 *
 * Renders inside the root layout only, so it carries its own minimal chrome:
 * the wordmark home link stands in for the header this page does not have.
 */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <Link
        href="/"
        className="font-display text-xl font-bold tracking-tight text-text hover:text-accent-text"
      >
        {SITE.name}
      </Link>

      <div className="mt-10 flex max-w-md flex-col items-center text-center">
        <div className="grid size-14 place-items-center rounded-full border border-border bg-surface-2 text-muted">
          <Compass className="size-6" aria-hidden />
        </div>

        <p className="mt-6 font-mono text-[13px] font-medium tracking-widest text-faint">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text">
          That page does not exist
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          The address may be mistyped, or the page may have been moved or retired.
          The catalogue is the fastest way back to what you were looking for.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <ButtonLink href="/products">Browse the catalogue</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Go to the homepage
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
