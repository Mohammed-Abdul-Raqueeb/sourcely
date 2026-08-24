import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { ContentBody, ContentHeader } from '@/components/content/page-shell'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Sourcing is free for buyers. Suppliers pay to list, quote and see the demand data behind their categories.',
}

/**
 * Pricing.
 *
 * The structural point this page has to make is that buyers are not the ones
 * paying. A procurement engineer evaluating the platform needs to know that in
 * the first sentence, because "free" on a B2B tool usually means a trial that
 * expires halfway through an evaluation.
 *
 * Plan prices are the platform's own list pricing — a product decision, and the
 * one number on this page that is written rather than computed. Everything
 * presented as a fact about usage or performance comes from the database; see
 * `platformStats()`.
 */

interface Plan {
  name: string
  audience: string
  price: string
  cadence?: string
  description: string
  cta: { label: string; href: string }
  featured?: boolean
  features: { label: string; included: boolean }[]
}

const PLANS: Plan[] = [
  {
    name: 'Buyer',
    audience: 'For procurement teams',
    price: 'Free',
    description:
      'Everything on the buying side, permanently. There is no trial to expire and no line count to hit.',
    cta: { label: 'Create an account', href: '/register' },
    features: [
      { label: 'Unlimited search and AI assistant', included: true },
      { label: 'Specification comparison', included: true },
      { label: 'Saved products and shortlists', included: true },
      { label: 'Saved searches with alerts', included: true },
      { label: 'Unlimited quotation requests', included: true },
      { label: 'Quotation history and messaging', included: true },
      { label: 'Supplier verification data', included: true },
      { label: 'Priority quotation routing', included: false },
    ],
  },
  {
    name: 'Supplier',
    audience: 'For distributors and manufacturers',
    price: '₹9,500',
    cadence: 'per month',
    description:
      'List a catalogue, respond to quotations, and see what buyers searched for before they found you.',
    featured: true,
    cta: { label: 'Talk to us', href: '/contact' },
    features: [
      { label: 'Up to 2,000 listed products', included: true },
      { label: 'Structured specification import', included: true },
      { label: 'Quotation console and messaging', included: true },
      { label: 'Search demand for your categories', included: true },
      { label: 'Zero-result reports — demand you are missing', included: true },
      { label: 'Verified supplier badge', included: true },
      { label: 'Priority quotation routing', included: true },
      { label: 'Dedicated account manager', included: false },
    ],
  },
  {
    name: 'Enterprise',
    audience: 'For large catalogues and groups',
    price: 'Custom',
    description:
      'Unlimited catalogue, ERP integration, and the ranking configuration for your own categories.',
    cta: { label: 'Talk to us', href: '/contact' },
    features: [
      { label: 'Unlimited products and users', included: true },
      { label: 'ERP and PIM integration', included: true },
      { label: 'Category ranking configuration', included: true },
      { label: 'Full search and quotation exports', included: true },
      { label: 'Audit trail and access controls', included: true },
      { label: 'Single sign-on', included: true },
      { label: 'Priority quotation routing', included: true },
      { label: 'Dedicated account manager', included: true },
    ],
  },
]

const FAQS = [
  {
    question: 'Why is the buyer side free?',
    answer:
      'Because the value is on the other side. A supplier pays for reach and for the demand data — including what buyers searched for and did not find. Charging buyers would reduce the searches that produce it.',
  },
  {
    question: 'Do you take a commission on orders?',
    answer:
      'No. Sourcely is not in the transaction: quotations are priced by the supplier and settled directly. A commission would give the platform a reason to rank by margin rather than by fit, which would undermine the entire premise.',
  },
  {
    question: 'Does ranking depend on the plan?',
    answer:
      'No, and this is the one thing worth being unambiguous about. The score is computed from specification fit, price, availability and supplier reliability. No plan can buy a position, and no paid placement exists anywhere in the results.',
  },
  {
    question: 'What are the payment terms?',
    answer:
      'Supplier plans are billed monthly or annually in advance, in INR, exclusive of GST. Annual billing is two months cheaper. Cancel any time and listings stay live to the end of the paid period.',
  },
]

export default function PricingPage() {
  return (
    <>
      <ContentHeader
        eyebrow="Pricing"
        title="Free to buy. Suppliers pay for reach."
        lede="Search, comparison, the AI assistant and quotation requests cost buyers nothing, permanently. Nothing on this page changes where a product ranks."
      />

      <ContentBody>
        {/* Plans ------------------------------------------------------------ */}
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'flex flex-col rounded-xl border p-6',
                plan.featured
                  ? 'border-accent-line bg-accent-soft shadow-[0_0_0_1px_var(--accent-line)]'
                  : 'border-border bg-surface-1'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight text-text">
                    {plan.name}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-muted">{plan.audience}</p>
                </div>
                {plan.featured && (
                  <Badge tone="accent" size="sm">
                    Most common
                  </Badge>
                )}
              </div>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-semibold text-text tnum">
                  {plan.price}
                </span>
                {plan.cadence && (
                  <span className="text-[13px] text-muted">{plan.cadence}</span>
                )}
              </p>
              {plan.cadence && (
                <p className="mt-0.5 text-[11.5px] text-faint">excl. GST</p>
              )}

              <p className="mt-4 text-[13.5px] leading-relaxed text-text-2">
                {plan.description}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5">
                    {feature.included ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                    ) : (
                      <Minus className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                    )}
                    <span
                      className={cn(
                        'text-[13px] leading-snug',
                        feature.included ? 'text-text-2' : 'text-faint'
                      )}
                    >
                      {feature.label}
                    </span>
                    <span className="sr-only">
                      {feature.included ? 'included' : 'not included'}
                    </span>
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={plan.cta.href}
                size="sm"
                variant={plan.featured ? 'primary' : 'outline'}
                className="mt-7 w-full"
              >
                {plan.cta.label}
              </ButtonLink>
            </div>
          ))}
        </div>

        {/* The commitment that matters --------------------------------------- */}
        <div className="mt-6 rounded-xl border border-border p-6">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            No plan buys a ranking
          </h2>
          <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-muted">
            Results are ordered by a weighted score over specification fit, price,
            availability, application suitability and supplier reliability. Plan tier
            is not one of the inputs, there is no sponsored placement, and the
            breakdown shown beside every result is the actual computation. If a
            product ranks first, it is because it scored first.{' '}
            <Link href="/about">How the scoring works</Link>.
          </p>
        </div>

        {/* Pricing FAQ -------------------------------------------------------- */}
        <div className="mt-12 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-[14.5px] font-semibold text-text">{faq.question}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{faq.answer}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[13px] text-faint">
          More questions? <Link href="/faq" className="text-accent-text underline decoration-border underline-offset-[3px] hover:decoration-accent">Read the FAQ</Link>{' '}
          or <Link href="/contact" className="text-accent-text underline decoration-border underline-offset-[3px] hover:decoration-accent">get in touch</Link>.
        </p>
      </ContentBody>
    </>
  )
}
