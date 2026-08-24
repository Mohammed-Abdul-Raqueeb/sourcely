import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Logo } from '@/components/layout/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { platformStats } from '@/server/metrics/platform-stats'

/**
 * Authentication shell.
 *
 * Split layout: the form owns the left column and never competes for
 * attention, the right column carries the reason to bother signing up. On
 * mobile the right column is dropped entirely rather than stacked below —
 * marketing copy under a form is scrolled past, not read.
 */

const REASONS = [
  'Shortlist across suppliers and send one quotation request',
  'Save a requirement and get told when new products match it',
  'Search history you can return to, with the filters intact',
  'Compare full specification sheets side by side',
] as const

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const stats = await platformStats()

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      {/* Form column ------------------------------------------------------- */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-8">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to site
            </Link>
          </div>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-5 py-8 md:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="px-5 py-6 text-center text-[12px] text-faint md:px-8">
          © 2026 Sourcely Commerce Technologies Pvt. Ltd.
        </footer>
      </div>

      {/* Brand column ------------------------------------------------------ */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-bg-subtle lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-accent-line to-transparent"
        />

        <div className="relative px-10 py-14 xl:px-14">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-accent-text uppercase">
            For procurement teams
          </p>

          <h2 className="mt-4 max-w-md font-display text-3xl leading-[1.15] font-semibold tracking-tight xl:text-4xl">
            Stop diffing datasheets in six browser tabs.
          </h2>

          <ul className="mt-8 space-y-3.5">
            {REASONS.map((reason) => (
              <li key={reason} className="flex gap-3">
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-soft text-accent-text"
                  aria-hidden
                >
                  <Check className="size-3" />
                </span>
                <span className="text-[14px] leading-relaxed text-muted">{reason}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block font-mono text-xl font-semibold text-text tnum">
                    {stat.value}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  )
}
