import type { Metadata } from 'next'
import Link from 'next/link'
import { ContentBody, ContentHeader } from '@/components/content/page-shell'
import { ButtonLink } from '@/components/ui/button'
import { MAX_COMPARE } from '@/lib/compare'

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'How matching works, what the AI does and does not do, how quotations are handled, and what happens to your data.',
}

/**
 * FAQ.
 *
 * Native `<details>` rather than a client component: this is static content
 * that must be expandable with JavaScript disabled, findable by in-page browser
 * search, and present in the HTML for a crawler. A React accordion would give
 * up all three for an animation.
 */

interface Entry {
  question: string
  answer: React.ReactNode
}

interface Group {
  title: string
  entries: Entry[]
}

const GROUPS: Group[] = [
  {
    title: 'How matching works',
    entries: [
      {
        question: 'What does the match percentage actually mean?',
        answer: (
          <>
            <p>
              It is a weighted score across eight components: specification match,
              semantic similarity, keyword relevance, price fit, application fit,
              availability, demand, and supplier reliability. Specification match
              carries the most weight, and the weighting shifts by category —
              ingress protection matters more for an enclosure than for a valve.
            </p>
            <p>
              The figure is computed by deterministic code, not generated. The same
              query against the same catalogue always produces the same number, and
              the breakdown beside each result shows the component scores that
              produced it.
            </p>
          </>
        ),
      },
      {
        question: 'Why is nothing ever a 100% match?',
        answer: (
          <p>
            Scores are banded between 42% and 97%. A perfect match is a claim nobody
            can honestly make — there is always a requirement that was not stated, an
            installation constraint, a preferred brand. Presenting 100% would imply
            the system knows everything about your application, and it does not.
          </p>
        ),
      },
      {
        question: 'Does it hide products that do not match?',
        answer: (
          <p>
            Only two things filter absolutely: a stated maximum price and an explicit
            in-stock requirement, plus anything you have ruled out by name. Everything
            else is scored rather than excluded, so if you ask for stainless steel you
            still see the bronze alternative — clearly labelled as a substitute rather
            than silently dropped. The criteria panel marks every miss.
          </p>
        ),
      },
      {
        question: 'What if my search returns nothing?',
        answer: (
          <p>
            Zero-result searches are recorded and reviewed. They are the most useful
            signal the platform generates: each one is either a sourcing gap — the
            catalogue genuinely lacks the product — or a vocabulary gap, where the
            parser did not recognise a term. The two need different fixes, and the
            parsed intent recorded alongside the query is what separates them.
          </p>
        ),
      },
    ],
  },
  {
    title: 'The AI assistant',
    entries: [
      {
        question: 'What does the language model actually do?',
        answer: (
          <>
            <p>
              Two things. It converts your description into a structured requirement,
              and it rephrases results that have already been computed.
            </p>
            <p>
              It has no write authority over anything a buyer relies on. It does not
              choose which products are shown, does not order them, does not compute
              the match score, and never touches a price. Those are all deterministic
              server-side code.
            </p>
          </>
        ),
      },
      {
        question: 'What happens if the AI is unavailable?',
        answer: (
          <p>
            The assistant keeps working. A built-in parser handles the same
            vocabulary — specifications, units, budgets, negations like &ldquo;not
            brass&rdquo; — and the ranking engine is unchanged, because the model was
            never part of it. Explanations become templated rather than conversational,
            and the interface says so rather than pretending nothing changed.
          </p>
        ),
      },
      {
        question: 'Can I trust it not to invent a product?',
        answer: (
          <p>
            Every product shown is a record from the catalogue, retrieved by the search
            engine and rendered from the database. The model is never asked to produce a
            product, a specification or a price, so there is nothing for it to
            fabricate.
          </p>
        ),
      },
      {
        question: 'Why does it ask a follow-up question?',
        answer: (
          <p>
            Only when one question would meaningfully narrow the results. The
            assistant picks the specification whose answer eliminates the most
            candidates — measured by the spread of values across the current result
            set, weighted by how much that specification matters in the category. If
            no question would help, it does not ask one.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Buying and quotations',
    entries: [
      {
        question: 'Why is there no cart or checkout?',
        answer: (
          <p>
            Industrial supply is quoted, not transacted at list price. What you pay
            depends on quantity, delivery location, GST treatment and often the
            relationship. A checkout button would have to invent a number. Instead a
            shortlist becomes a quotation request that carries the specification with
            it, and suppliers respond with real pricing and lead times.
          </p>
        ),
      },
      {
        question: 'How long does a quotation take?',
        answer: (
          <p>
            It depends on the supplier and the line count. You are notified in the app
            and by email when pricing is ready, and the request itself shows its status
            throughout — submitted, under review, quoted. Nothing requires you to keep
            checking.
          </p>
        ),
      },
      {
        question: 'Are the prices shown final?',
        answer: (
          <p>
            No. Catalogue prices are indicative list prices, shown so you can compare
            like with like and filter by budget. GST is stated separately per product.
            The binding number is the one on a quotation.
          </p>
        ),
      },
      {
        question: 'How many products can I compare at once?',
        answer: (
          <p>
            Up to {MAX_COMPARE} side by side. The comparison table shows every
            specification either product declares, highlights the rows where they
            differ, and flags where one has data the other does not — an absent
            specification is not the same as a worse one.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Accounts and data',
    entries: [
      {
        question: 'Do I need an account to search?',
        answer: (
          <p>
            No. Search, the assistant and comparison all work signed out, and a
            shortlist you build anonymously is carried over if you create an account
            later. An account is needed to request a quotation, because a quotation has
            to reach somebody.
          </p>
        ),
      },
      {
        question: 'What do you store about my searches?',
        answer: (
          <p>
            Searches are recorded with their result counts to measure where the
            catalogue and the parser fall short. Signed in, your own history is visible
            on your dashboard and you can clear it at any time. See the{' '}
            <Link href="/legal/privacy">privacy policy</Link> for the full picture.
          </p>
        ),
      },
      {
        question: 'How are passwords handled?',
        answer: (
          <p>
            Hashed with bcrypt at cost factor 12 and never stored or logged in any
            recoverable form. Sign-in takes the same time whether or not the address is
            registered, so the form cannot be used to discover who has an account.
            Changing your password signs out every other device.
          </p>
        ),
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <>
      <ContentHeader
        eyebrow="FAQ"
        title="Frequently asked questions"
        lede="How the matching works, what the AI is and is not allowed to do, and what happens to a quotation once you send it."
      />

      <ContentBody>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="max-w-[68ch] space-y-12">
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h2 className="font-display text-xl font-semibold tracking-tight text-text">
                  {group.title}
                </h2>

                <div className="mt-4 divide-y divide-border border-y border-border">
                  {group.entries.map((entry) => (
                    <details key={entry.question} className="group py-1">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[14.5px] font-medium text-text marker:hidden [&::-webkit-details-marker]:hidden">
                        {entry.question}
                        {/* Rotates on open via the parent's [open] state — no JS. */}
                        <span
                          aria-hidden
                          className="shrink-0 text-faint transition-transform duration-200 group-open:rotate-45"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path
                              d="M7 1v12M1 7h12"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </summary>
                      <div className="pb-4 text-[14px] leading-[1.7] text-muted [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-accent-text [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-[3px]">
                        {entry.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="lg:pt-1">
            <div className="rounded-xl border border-border bg-surface-1 p-5 lg:sticky lg:top-24">
              <p className="text-[13.5px] font-medium text-text">Still unanswered?</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                The assistant answers questions about the catalogue directly, and it
                needs no account.
              </p>
              <ButtonLink href="/assistant" size="sm" className="mt-4 w-full">
                Ask the assistant
              </ButtonLink>
              <ButtonLink
                href="/contact"
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Contact us
              </ButtonLink>
            </div>
          </aside>
        </div>
      </ContentBody>
    </>
  )
}
