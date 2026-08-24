import type { ReactNode } from 'react'
import { ShortlistProvider } from '@/components/catalog/shortlist'
import { CompareTray } from '@/components/catalog/compare-tray'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

/**
 * Public site shell.
 *
 * The shortlist provider wraps the whole public area so a visitor can collect
 * products across pages without an account. Header and tray are client
 * components; everything they contain stays server-rendered.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <ShortlistProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <CompareTray />
      </div>
    </ShortlistProvider>
  )
}
