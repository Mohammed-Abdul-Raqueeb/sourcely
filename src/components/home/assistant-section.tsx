import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SectionHeading } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { MatchRing } from '@/components/ui/match-score'
import { ProductArtwork, parseArtwork } from '@/components/catalog/product-artwork'
import type { AssistantDemo } from '@/server/catalog/demo'

/**
 * Section 2 — the assistant, shown doing the hard part.
 *
 * The conversation deliberately opens with an under-specified request so the
 * follow-up question is visible. Anyone can demo a one-shot query; knowing
 * which single question to ask is the actual product.
 */
export function AssistantSection({ demo }: { demo: AssistantDemo }) {
  return (
    <section className="section-y border-t border-border bg-bg-subtle">
      <div className="container-page">
        <SectionHeading
          eyebrow="The assistant"
          title="It asks the one question that narrows everything"
          description="Buyers rarely give a full specification up front, and interrogating them with a form loses them. The assistant asks for the single field that most reduces the result set, then ranks what remains."
          action={
            <ButtonLink href="/assistant" variant="secondary" trailingIcon={<ArrowUpRight className="size-4" aria-hidden />}>
              Open the assistant
            </ButtonLink>
          }
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8">
          {/* Conversation --------------------------------------------------- */}
          <div className="rounded-xl border border-border bg-surface p-5 md:p-6">
            <ol className="space-y-5">
              {demo.turns.map((turn, index) => (
                <li
                  key={index}
                  className={cn('flex gap-3', turn.role === 'user' && 'flex-row-reverse')}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full border',
                      turn.role === 'assistant'
                        ? 'border-accent-line bg-accent-soft text-accent-text'
                        : 'border-border bg-surface-2 text-muted'
                    )}
                    aria-hidden
                  >
                    {turn.role === 'assistant' ? (
                      <Sparkles className="size-4" />
                    ) : (
                      <User className="size-4" />
                    )}
                  </span>

                  <div
                    className={cn(
                      'max-w-[85%] rounded-xl px-4 py-3 text-[14px] leading-relaxed',
                      turn.role === 'assistant'
                        ? 'rounded-tl-sm border border-border bg-surface-2 text-text-2'
                        : 'rounded-tr-sm bg-accent text-accent-ink'
                    )}
                  >
                    <span className="sr-only">{turn.role === 'user' ? 'Buyer: ' : 'Assistant: '}</span>
                    {turn.content}
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
                Resolved into
              </p>
              <div className="flex flex-wrap gap-1.5">
                {demo.chips.map((chip) => (
                  <span
                    key={`${chip.qualifier}-${chip.label}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2.5"
                  >
                    <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">
                      {chip.qualifier}
                    </span>
                    <span className="text-xs font-medium text-text">{chip.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Results -------------------------------------------------------- */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between px-1">
              <p className="text-sm font-medium text-text">
                {demo.totalMatches} matching products
              </p>
              <p className="text-[12px] text-faint">Top 3 by specification fit</p>
            </div>

            {demo.results.map((result) => (
              <article
                key={result.sku}
                className="group relative flex gap-4 rounded-xl border border-border bg-surface p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
              >
                <div className="hidden w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:block">
                  {parseArtwork(result.imageUrl) ? (
                    <ProductArtwork url={result.imageUrl} label={result.imageAlt} showFrame={false} />
                  ) : (
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={result.imageUrl}
                        alt={result.imageAlt}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
                        {result.brand}
                      </p>
                      <h3 className="mt-0.5 text-sm leading-snug font-semibold text-text">
                        <Link
                          href={`/products/${result.slug}`}
                          className="before:absolute before:inset-0 hover:text-accent-text"
                        >
                          {result.name}
                        </Link>
                      </h3>
                    </div>
                    <MatchRing percent={result.match} size={42} strokeWidth={2.5} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {result.specs.map((spec) => (
                      <span
                        key={spec}
                        className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-2 tnum"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2.5 border-l-2 border-accent-line pl-2.5 text-[12px] leading-relaxed text-muted">
                    {result.reason}
                  </p>

                  <p className="mt-3 font-mono text-[15px] font-semibold text-text tnum">
                    {result.price}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
