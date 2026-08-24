import { CornerDownRight, Quote } from 'lucide-react'
import { SectionHeading } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import type { DiscoveryExample } from '@/server/catalog/demo'

/**
 * Section 4 — Smart product discovery.
 *
 * Four real requests, each shown with the structure the parser actually
 * extracted and the number of products that survived ranking. These are
 * generated at build time by the live engine, so the section cannot drift
 * away from the product's real behaviour.
 */
export function Discovery({ examples }: { examples: DiscoveryExample[] }) {
  return (
    <section className="section-y border-t border-border bg-bg-subtle">
      <div className="container-page">
        <SectionHeading
          eyebrow="Natural language search"
          title="Sentences in. Structured specifications out."
          description="These are live. Each request below was parsed by the engine when this page was built, and the filters shown are what it produced — not an illustration of what it might produce."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {examples.map((example) => (
            <article
              key={example.query}
              className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <div className="flex gap-3">
                <Quote className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                <p className="text-[15px] leading-relaxed text-text italic">
                  {example.query}
                </p>
              </div>

              <div className="mt-4 flex gap-3 border-t border-border pt-4">
                <CornerDownRight className="mt-1 size-4 shrink-0 text-accent" aria-hidden />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {example.chips.length > 0 ? (
                      example.chips.map((chip) => (
                        <span
                          key={`${chip.qualifier}-${chip.label}`}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2.5"
                        >
                          <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">
                            {chip.qualifier}
                          </span>
                          <span className="text-xs font-medium text-text">{chip.label}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-faint">
                        No structure extracted — ranked on similarity alone
                      </span>
                    )}
                  </div>

                  <p className="mt-3 font-mono text-[11px] text-faint tnum">
                    {example.resultCount} products ranked
                    {example.topMatch > 0 && ` · best match ${example.topMatch}%`}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-surface/50 px-6 py-8 text-center">
          <p className="max-w-lg text-sm leading-relaxed text-muted">
            Every chip is removable. If the assistant infers something you did
            not mean, take it off and the ranking recalculates — you are never
            stuck arguing with a search box.
          </p>
          <ButtonLink href="/assistant" size="sm">
            Try it with your own requirement
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
