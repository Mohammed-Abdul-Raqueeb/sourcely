import Link from 'next/link'
import { Info, Mail, MapPin, Phone } from 'lucide-react'
import {
  CONTACT,
  FOOTER_NAV,
  SITE,
  SOCIAL,
  formattedAddress,
  siteDetailsConfigured,
} from '@/lib/site'
import { Logo } from './logo'

/**
 * Site footer.
 *
 * Carries the trust signals a B2B buyer looks for before sending an enquiry:
 * a physical address, a GSTIN, a CIN and a phone number. A B2B footer without
 * those reads as a shell.
 */
export function SiteFooter() {
  const address = formattedAddress()
  const configured = siteDetailsConfigured()

  const year = 2026

  return (
    <footer className="mt-auto border-t border-border bg-bg-subtle">
      <div className="container-page py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          {/* Identity ------------------------------------------------------ */}
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Natural-language product discovery for industrial procurement.
              Describe the requirement; we match it against verified
              specifications and explain every recommendation.
            </p>

            {/*
              Each line renders only if it was configured. An unconfigured
              deployment says so instead of showing a plausible invented
              address — see siteDetailsConfigured() in src/lib/site.ts.
            */}
            <address className="mt-6 space-y-2.5 text-sm not-italic text-muted">
              {address && (
                <div className="flex gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                  <span>{address}</span>
                </div>
              )}
              {CONTACT.phone && (
                <div className="flex gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                  <a href={`tel:${CONTACT.phoneHref}`} className="hover:text-text">
                    {CONTACT.phone}
                  </a>
                </div>
              )}
              {CONTACT.email && (
                <div className="flex gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                  <a href={`mailto:${CONTACT.email}`} className="hover:text-text">
                    {CONTACT.email}
                  </a>
                </div>
              )}
              {!configured && (
                <div className="flex gap-2.5">
                  <Info className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                  <span className="text-faint">
                    Demonstration deployment — no registered office or contact
                    number is published for it.
                  </span>
                </div>
              )}
            </address>
          </div>

          {/* Navigation ---------------------------------------------------- */}
          {FOOTER_NAV.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted transition-colors hover:text-text"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Legal ----------------------------------------------------------- */}
        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-[13px] text-muted">
              © {year} {SITE.legalName.replace(/\.$/, '')}. All rights reserved.
            </p>
            {/* Statutory identifiers are shown only when they are real ones. */}
            {(CONTACT.gstin || CONTACT.cin) && (
              <p className="font-mono text-[11px] text-faint tnum">
                {[
                  CONTACT.gstin && `GSTIN ${CONTACT.gstin}`,
                  CONTACT.cin && `CIN ${CONTACT.cin}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[13px] text-faint">{CONTACT.hours}</span>
            <div className="flex gap-4">
              {SOCIAL.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-muted transition-colors hover:text-text"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
