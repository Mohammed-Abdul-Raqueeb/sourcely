import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SectionHeading } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'
import { MatchBadge } from '@/components/ui/match-score'
import type { ComparisonDemo } from '@/server/catalog/demo'

/**
 * Section 6 — Comparison.
 *
 * Cells that differ across the row are emphasised; identical cells recede.
 * A comparison table where every value shouts equally is a table the reader
 * has to diff by eye, which is the work they came here to avoid.
 */
export function ComparisonSection({ demo }: { demo: ComparisonDemo }) {
  return (
    <section className="section-y border-t border-border bg-bg-subtle">
      <div className="container-page">
        <SectionHeading
          eyebrow="Comparison"
          title="Where they actually differ, not where they happen to differ"
          description="Pick up to four products and their specification sheets line up. Rows where every product agrees are dimmed, so the differences are the only thing left to read."
        />

        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto scrollbar-slim">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <caption className="sr-only">
                Specification comparison of {demo.columns.length} products
              </caption>

              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="w-40 px-4 py-4 text-left align-bottom text-[11px] font-semibold tracking-wider text-faint uppercase sm:w-48"
                  >
                    Specification
                  </th>
                  {demo.columns.map((column) => (
                    <th key={column.sku} scope="col" className="px-4 py-4 text-left align-bottom">
                      <MatchBadge percent={column.match} showLabel={false} />
                      <p className="mt-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                        {column.brand}
                      </p>
                      <Link
                        href={`/products/${column.slug}`}
                        className="mt-0.5 block text-[13px] leading-snug font-semibold text-text hover:text-accent-text"
                      >
                        {column.name}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {demo.rows.map((row) => {
                  const values = row.values.map((value) => value ?? '—')
                  const allSame = values.every((value) => value === values[0])

                  return (
                    <tr key={row.label} className={cn(!allSame && 'bg-surface-2/40')}>
                      <th
                        scope="row"
                        className="px-4 py-3 text-left text-[13px] font-medium text-muted"
                      >
                        {row.label}
                      </th>
                      {values.map((value, index) => (
                        <td
                          key={`${row.label}-${index}`}
                          className={cn(
                            'px-4 py-3 font-mono text-[13px] tnum',
                            allSame ? 'text-faint' : 'font-medium text-text'
                          )}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Verdict ---------------------------------------------------------- */}
          <div className="flex gap-3.5 border-t border-accent-line bg-accent-soft/50 p-5">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full border border-accent-line bg-surface text-accent-text"
              aria-hidden
            >
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-accent-text uppercase">
                Assistant summary
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{demo.verdict}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/products" variant="secondary" size="sm">
            Browse products to compare
          </ButtonLink>
          <p className="text-[13px] text-faint">Up to four at a time</p>
        </div>
      </div>
    </section>
  )
}
