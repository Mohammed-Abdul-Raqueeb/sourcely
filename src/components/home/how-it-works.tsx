import { Braces, ListOrdered, MessageSquareText, Target } from 'lucide-react'
import { SectionHeading } from '@/components/ui/card'

/**
 * Section 3 — How it works.
 *
 * Four steps, and each one names what actually happens rather than a verb
 * from a marketing deck. "AI understands your requirements" is not a step;
 * "resolves it into a structured specification" is.
 */

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Describe the requirement',
    body: 'Plain language, the way you would brief a colleague. Part numbers optional — the whole point is that you may not have one.',
    detail: '"Stainless valve for a chilled water riser, threaded, under ₹5,000"',
  },
  {
    icon: Braces,
    title: 'It resolves into a specification',
    body: 'Material, connection type, size, pressure class, application and budget are extracted into structured fields you can see and correct.',
    detail: 'material=SS316 · connection=threaded · application=HVAC · max=₹5,000',
  },
  {
    icon: ListOrdered,
    title: 'The catalogue is ranked, not filtered',
    body: 'Hard constraints cut the field; everything else is scored. A near-miss stays visible and is labelled a near-miss instead of vanishing.',
    detail: 'BM25 + vector retrieval, then an eight-component weighted score',
  },
  {
    icon: Target,
    title: 'Every match explains itself',
    body: 'Which criteria matched, which did not, and by how much. Shortlist, compare, and send one quotation request for all of it.',
    detail: '94% — matches material, connection and budget; one size larger',
  },
] as const

export function HowItWorks() {
  return (
    <section className="section-y border-t border-border">
      <div className="container-page">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps, and none of them are a filter menu"
          description="The gap this closes is vocabulary. A buyer who cannot name the product cannot find it with checkboxes, however many you give them."
          align="center"
        />

        <ol className="relative mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {/* Connector — desktop only, sits behind the numbered markers. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-5 right-[12.5%] left-[12.5%] hidden h-px lg:block"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--border-strong) 40%, transparent 0%)',
              backgroundSize: '8px 1px',
              backgroundRepeat: 'repeat-x',
            }}
          />

          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-accent-text">
                  <step.icon className="size-4.5" aria-hidden />
                </span>
                <span className="font-mono text-[11px] font-semibold text-faint tnum lg:absolute lg:top-1 lg:left-12">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-4 text-[15px] leading-snug font-semibold text-text lg:mt-5">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.body}</p>

              <p className="mt-3 rounded-md border border-border bg-surface-2 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-text-2 tnum">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
