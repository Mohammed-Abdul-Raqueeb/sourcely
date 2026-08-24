import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import type { PlatformStat } from '@/lib/site'
import { HeroDemo, type HeroScenario } from './hero-demo'

/**
 * Section 1 — Hero.
 *
 * The claim on the left is verified by the panel on the right: the demo runs
 * the real engine over the real catalogue. The stats row is the trust bridge
 * between them.
 */
export function Hero({ scenarios, stats }: { scenarios: HeroScenario[]; stats: PlatformStat[] }) {
  return (
    <section className="relative overflow-hidden">
      {/* Engineering-grid texture, faded out well before it meets content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid mask-fade-b opacity-[0.55]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-line to-transparent"
      />

      <div className="container-page relative pt-14 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-28">
        {/* grid-cols-[minmax(0,1fr)] below lg: without it the single stacked
            column sizes to the badge pill's unwrapped intrinsic width and the
            whole hero clips at narrow viewports. */}
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          {/* Copy ---------------------------------------------------------- */}
          <div className="min-w-0 max-w-xl">
            <div className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-border bg-surface/70 py-1.5 pr-3.5 pl-2 backdrop-blur sm:rounded-full">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold tracking-wider text-accent-text uppercase">
                <Sparkles className="size-3" aria-hidden />
                New
              </span>
              <span className="text-[13px] text-muted">
                Specification-matched search for industrial buyers
              </span>
            </div>

            <h1 className="mt-6 font-display text-[2.6rem] leading-[1.04] font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.1rem]">
              Find the right product.{' '}
              <span className="text-accent-text">Faster.</span>
            </h1>

            <p className="mt-6 text-[17px] leading-relaxed text-muted md:text-lg">
              Describe what you need the way you would say it to a colleague.
              Sourcely reads the requirement, matches it against verified
              supplier specifications, and tells you exactly why each product
              fits — before you send a single enquiry.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href="/assistant"
                size="lg"
                leadingIcon={<Sparkles className="size-4" aria-hidden />}
              >
                Ask AI to find a product
              </ButtonLink>
              <ButtonLink
                href="/products"
                size="lg"
                variant="secondary"
                leadingIcon={<Search className="size-4" aria-hidden />}
              >
                Explore products
              </ButtonLink>
            </div>

            <p className="mt-4 flex items-center gap-1.5 text-[13px] text-faint">
              <ArrowRight className="size-3.5" aria-hidden />
              No account needed to search or compare
            </p>

            {/* Trust row -------------------------------------------------- */}
            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block font-mono text-xl font-semibold text-text tnum">
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-tight text-muted">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live demo ------------------------------------------------------ */}
          <div className="min-w-0 lg:pl-4">
            <HeroDemo scenarios={scenarios} />
          </div>
        </div>
      </div>
    </section>
  )
}
