import { ArrowRight, Clock, FileCheck2, GitCompare, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { SectionHeading } from '@/components/ui/card'
import { ButtonLink } from '@/components/ui/button'

/**
 * Section 7 — Why this beats a filter menu.
 *
 * Framed as before/after rather than a feature list, because the value is not
 * "we have AI" — it is that the old flow wastes an afternoon and this one does
 * not. The lead card carries the argument; the rest support it.
 */

const BENEFITS = [
  {
    icon: ScanSearch,
    title: 'You do not need the part name',
    body: 'Describe the duty. The engine infers category and specification from what the product has to do, not from a term you would have to already know.',
  },
  {
    icon: FileCheck2,
    title: 'Matched on the specification sheet',
    body: 'Material, connection, pressure class, size and application are typed fields, so a match is a fact about the product rather than a keyword coincidence.',
  },
  {
    icon: GitCompare,
    title: 'Trade-offs, stated plainly',
    body: 'Compare up to four side by side and get a written summary of where they differ — including which one is simply the cheapest way to meet the spec.',
  },
  {
    icon: ShieldCheck,
    title: 'Misses are shown as misses',
    body: 'A near match is labelled a near match, with the reason. Nothing is quietly upgraded to fit your query.',
  },
  {
    icon: Clock,
    title: 'One enquiry, not eleven',
    body: 'Shortlist across suppliers and send a single quotation request. Median first response across the platform is 4.2 hours.',
  },
] as const

export function WhyAi() {
  return (
    <section className="section-y border-t border-border">
      <div className="container-page">
        <SectionHeading
          eyebrow="Why it matters"
          title="The problem was never too few filters"
          description="A catalogue with forty checkboxes still asks the buyer to already know the answer. That assumption is what costs a procurement team an afternoon per line item."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {/* Lead card: the before/after argument -------------------------- */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 lg:row-span-2">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-grid opacity-40 mask-fade-b"
            />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-muted uppercase">
                Before
              </span>

              <ol className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-muted">
                <li className="flex gap-2.5">
                  <span className="font-mono text-faint tnum">01</span>
                  Guess the search term. Get 4,000 results or none.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-faint tnum">02</span>
                  Narrow with checkboxes that assume you know the answer.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-faint tnum">03</span>
                  Open six tabs. Diff the datasheets by eye.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-faint tnum">04</span>
                  Email four suppliers separately. Wait two days.
                </li>
              </ol>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <ArrowRight className="size-4 rotate-90 text-accent" aria-hidden />
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-[10px] font-semibold tracking-wider text-accent-text uppercase">
                <Sparkles className="size-3" aria-hidden />
                After
              </span>

              <ol className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-text-2">
                <li className="flex gap-2.5">
                  <span className="font-mono text-accent-text tnum">01</span>
                  Describe the duty in one sentence.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-accent-text tnum">02</span>
                  Answer one follow-up question, by tapping a chip.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-accent-text tnum">03</span>
                  Read a ranked shortlist that explains itself.
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-accent-text tnum">04</span>
                  Send one quotation request for all of it.
                </li>
              </ol>

              <p className="mt-6 border-t border-border pt-5 font-mono text-[11px] text-faint tnum">
                Median time to shortlist: 6 min 40 s
              </p>
            </div>
          </div>

          {/* Benefit cards -------------------------------------------------- */}
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <span className="grid size-9 place-items-center rounded-lg border border-border bg-surface-2 text-accent-text">
                <benefit.icon className="size-4" aria-hidden />
              </span>
              <h3 className="mt-3.5 text-[14px] font-semibold text-text">{benefit.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{benefit.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <ButtonLink href="/about" variant="ghost" size="sm" trailingIcon={<ArrowRight className="size-4" aria-hidden />}>
            How the ranking model works
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}
