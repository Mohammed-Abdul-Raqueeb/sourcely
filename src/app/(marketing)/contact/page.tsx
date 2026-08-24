import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Clock, Mail, MessageSquare, Phone } from 'lucide-react'
import { CONTACT, SITE, formattedAddress, siteDetailsConfigured } from '@/lib/site'
import { ContentBody, ContentHeader } from '@/components/content/page-shell'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach Sourcely about sourcing, quotations or the platform itself.',
}

/**
 * Contact.
 *
 * Every detail is read from the environment and rendered only when it is set.
 * An unconfigured deployment says so plainly instead of publishing a
 * convincing-looking address and phone number that nobody answers — see
 * `siteDetailsConfigured()` in src/lib/site.ts.
 *
 * There is no contact form. A form here would either need a mail transport
 * configured to go anywhere at all, or would accept a message and silently
 * discard it. The routes below all lead somewhere real.
 */
export default function ContactPage() {
  const address = formattedAddress()
  const configured = siteDetailsConfigured()

  interface Channel {
    icon: typeof Mail
    label: string
    value: string
    href: string
    note: string
  }

  // Built by pushing rather than filtering a sparse literal: an empty string is
  // falsy but is still a `string`, so `cond && {…}` widens the element type to
  // `'' | Channel` and every property access below stops type-checking.
  const channels: Channel[] = []

  if (CONTACT.salesEmail) {
    channels.push({
      icon: Mail,
      label: 'Sourcing and quotations',
      value: CONTACT.salesEmail,
      href: `mailto:${CONTACT.salesEmail}`,
      note: 'Specifications, availability, pricing on a live requirement.',
    })
  }

  if (CONTACT.supportEmail) {
    channels.push({
      icon: MessageSquare,
      label: 'Account and platform support',
      value: CONTACT.supportEmail,
      href: `mailto:${CONTACT.supportEmail}`,
      note: 'Sign-in problems, quotation status, anything broken.',
    })
  }

  if (CONTACT.phone) {
    channels.push({
      icon: Phone,
      label: 'Phone',
      value: CONTACT.phone,
      href: `tel:${CONTACT.phoneHref}`,
      note: CONTACT.hours,
    })
  }

  return (
    <>
      <ContentHeader
        eyebrow="Contact"
        title="Talk to someone"
        lede="For a live requirement, the fastest route is the assistant — it reads the specification and returns matched products with pricing you can request in one step."
      />

      <ContentBody>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="max-w-[68ch]">
            {/* The fastest route first, because for most visitors it is. */}
            <div className="rounded-xl border border-accent-line bg-accent-soft p-6">
              <h2 className="font-display text-lg font-semibold tracking-tight text-text">
                Start with the assistant
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-text-2">
                Describe what you need in plain language. You will get matched
                products with the specification comparison already done, and can turn
                a shortlist into a quotation request without writing the requirement
                out a second time.
              </p>
              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                <ButtonLink href="/assistant" size="sm">
                  Describe a requirement
                </ButtonLink>
                <ButtonLink href="/products" size="sm" variant="outline">
                  Browse the catalogue
                </ButtonLink>
              </div>
            </div>

            {channels.length > 0 ? (
              <div className="mt-8">
                <h2 className="font-display text-lg font-semibold tracking-tight text-text">
                  Direct channels
                </h2>
                <ul className="mt-4 divide-y divide-border border-y border-border">
                  {channels.map((channel) => (
                    <li key={channel.label} className="flex gap-4 py-4">
                      <channel.icon
                        className="mt-0.5 size-4 shrink-0 text-faint"
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] text-muted">{channel.label}</p>
                        <a
                          href={channel.href}
                          className="text-[14.5px] font-medium text-text underline decoration-border underline-offset-[3px] transition-colors hover:decoration-accent"
                        >
                          {channel.value}
                        </a>
                        <p className="mt-0.5 text-[12.5px] text-faint">{channel.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-border bg-surface-1 p-6">
                <h2 className="text-[15px] font-semibold text-text">
                  This is a demonstration deployment
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  No contact address, phone number or registered office is published
                  for it, because publishing plausible-looking details that reach
                  nobody is worse than publishing none. Everything else on the site —
                  the catalogue, the matching engine, quotation requests — works
                  exactly as it would in production.
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
                  Configure <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code>{' '}
                  and the related variables to publish real details. They are listed
                  in <code className="font-mono">.env.example</code>.
                </p>
              </div>
            )}

            <div className="mt-8">
              <h2 className="font-display text-lg font-semibold tracking-tight text-text">
                Already have a quotation open?
              </h2>
              <p className="mt-2 max-w-[60ch] text-[14px] leading-relaxed text-muted">
                Reply on the quotation itself rather than by email. The thread keeps
                the specification, quantities and pricing together, and the supplier
                sees it in context — which is the reason this platform exists rather
                than a shared inbox.
              </p>
              <ButtonLink href="/account/rfq" size="sm" variant="outline" className="mt-4">
                Go to my quotations
              </ButtonLink>
            </div>
          </div>

          <aside className="lg:pt-1">
            {(address || CONTACT.gstin || CONTACT.cin) && (
              <div className="rounded-xl border border-border bg-surface-1 p-5">
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
                  Registered office
                </h2>
                <div className="mt-3.5 space-y-3 text-[13px] leading-relaxed text-muted">
                  {address && (
                    <p className="flex gap-2.5">
                      <Building2 className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                      <span>
                        <span className="block font-medium text-text-2">
                          {SITE.legalName}
                        </span>
                        {address}
                      </span>
                    </p>
                  )}
                  {CONTACT.hours && (
                    <p className="flex gap-2.5">
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                      <span>{CONTACT.hours}</span>
                    </p>
                  )}
                </div>

                {(CONTACT.gstin || CONTACT.cin) && (
                  <dl className="mt-4 space-y-1.5 border-t border-border pt-3.5 font-mono text-[11.5px] text-faint">
                    {CONTACT.gstin && (
                      <div className="flex justify-between gap-3">
                        <dt>GSTIN</dt>
                        <dd className="tnum">{CONTACT.gstin}</dd>
                      </div>
                    )}
                    {CONTACT.cin && (
                      <div className="flex justify-between gap-3">
                        <dt>CIN</dt>
                        <dd className="tnum">{CONTACT.cin}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            )}

            <div className={configured ? 'mt-4' : ''}>
              <div className="rounded-xl border border-border p-5">
                <p className="text-[13px] font-medium text-text">Common questions</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  How matching works, what the AI does, how quotations are priced.
                </p>
                <Link
                  href="/faq"
                  className="mt-3 inline-block text-[13px] text-accent-text underline decoration-border underline-offset-[3px] hover:decoration-accent"
                >
                  Read the FAQ
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </ContentBody>
    </>
  )
}
