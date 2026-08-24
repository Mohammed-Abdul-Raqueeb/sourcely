import type { Metadata } from 'next'
import Link from 'next/link'
import { getCatalogRepository } from '@/server/repositories'
import { platformStats } from '@/server/metrics/platform-stats'
import { ContentBody, ContentHeader, Prose } from '@/components/content/page-shell'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Sourcely computes its match scores instead of generating them, and what that means for a buyer relying on the number.',
}

/**
 * About.
 *
 * Deliberately about the mechanism rather than the company. Every claim here is
 * checkable against the code, and the figures come from the same
 * `platformStats()` the homepage uses — nothing on this page is a number
 * somebody typed in.
 */
export default async function AboutPage() {
  const [stats, catalogue] = await Promise.all([
    platformStats(),
    getCatalogRepository().stats(),
  ])

  return (
    <>
      <ContentHeader
        eyebrow="About"
        title="A search engine that shows its working"
        lede="Industrial procurement runs on specifications, and most catalogue search treats them as prose. Sourcely treats them as data — which is what makes it possible to say why a product fits, rather than only that it ranked highly."
      />

      <ContentBody>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Prose>
            <h2>The problem</h2>
            <p>
              A buyer sourcing a DN50 stainless steel ball valve for a chilled-water
              line knows exactly what they need. What they get from most catalogues
              is a keyword box, forty facets, and a results list ordered by something
              nobody explains. The specification — the part that decides whether the
              product is usable at all — sits in a PDF datasheet three clicks away.
            </p>
            <p>
              So the buyer emails five suppliers, describes the requirement in prose
              five times, and waits. The catalogue was never the bottleneck. The
              translation between how a requirement is stated and how a product is
              indexed was.
            </p>

            <h2>What we built instead</h2>
            <p>
              Every product carries typed specifications — material, connection type,
              nominal diameter, pressure rating, ingress protection — governed by a
              central registry rather than free text. That registry is what makes the
              rest possible: it drives the facets, the comparison table, the
              vocabulary the assistant understands, and the weights used to rank.
            </p>
            <p>
              You describe the requirement in your own words. That description is
              parsed into a structured intent: category, specifications, budget,
              application, and anything you have ruled out. The catalogue is filtered
              on the hard constraints, and everything that survives is scored against
              eight weighted components.
            </p>

            <h2>The language model never decides anything</h2>
            <p>
              This is the part worth being precise about, because it is unusual. When
              a language model is configured, it does exactly two jobs: it turns your
              sentence into that structured intent, and it rephrases results the
              engine has already computed.
            </p>
            <p>
              It does not filter the catalogue. It does not rank. It does not price
              anything, and it never produces the match percentage. Those come from
              deterministic code — <code>src/server/catalog/scoring.ts</code> — that
              you can read. Turn the model off entirely and the same query returns
              the same products in the same order with the same scores. Only the
              prose gets terser.
            </p>
            <p>
              The reasoning is simple. A number a model generated is a number that
              can be wrong in ways nobody can audit, and a buyer is going to commit
              real money on the strength of that figure. It has to be reproducible.
            </p>

            <h2>Why the score is never 100%</h2>
            <p>
              Match percentages are banded between 42 and 97 — not because the
              arithmetic cannot reach 100, but because a perfect match is a claim
              nobody can stand behind. There is always a requirement the buyer did
              not state. The panel beside each result lists what matched,{' '}
              <strong>what did not</strong>, and what the catalogue has no data for.
              A recommendation surface that hides its misses is marketing.
            </p>

            <h2>What happens next</h2>
            <p>
              There is no cart. Industrial supply is quoted, not checked out: price
              depends on quantity, delivery, GST treatment and the relationship. So a
              shortlist becomes a quotation request, and the platform carries it
              through pricing and response with the specification still attached —
              which is the part that usually gets lost in an email thread.
            </p>
            <p>
              Read the <Link href="/faq">frequently asked questions</Link>, or try it
              directly. The assistant needs no account.
            </p>
          </Prose>

          {/* Sidebar — every figure computed, none written here ---------------- */}
          <aside className="lg:pt-1">
            <div className="rounded-xl border border-border bg-surface-1 p-5">
              <h2 className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
                In the catalogue now
              </h2>
              <dl className="mt-4 space-y-3.5">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dd className="font-mono text-lg font-semibold text-text tnum">
                      {stat.value}
                    </dd>
                    <dt className="text-[12px] text-muted">{stat.label}</dt>
                  </div>
                ))}
                <div>
                  <dd className="font-mono text-lg font-semibold text-text tnum">
                    {catalogue.categories}
                  </dd>
                  <dt className="text-[12px] text-muted">Categories and subcategories</dt>
                </div>
              </dl>
              <p className="mt-4 border-t border-border pt-3 text-[11.5px] leading-relaxed text-faint">
                Read from the database at request time, not written into this page.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-border p-5">
              <p className="text-[13.5px] leading-relaxed text-text-2">
                Describe a requirement and watch the engine work through it.
              </p>
              <ButtonLink href="/assistant" size="sm" className="mt-3.5 w-full">
                Open the assistant
              </ButtonLink>
              <p className="mt-2.5 text-center text-[11.5px] text-faint">No account needed</p>
            </div>
          </aside>
        </div>
      </ContentBody>
    </>
  )
}
