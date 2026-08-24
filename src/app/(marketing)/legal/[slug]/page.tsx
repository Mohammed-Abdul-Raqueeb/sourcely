import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ContentBody, ContentHeader, Prose } from '@/components/content/page-shell'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  LEGAL_DOCUMENTS,
  LEGAL_NAV,
  LEGAL_SLUGS,
  isLegalSlug,
} from '@/server/content/legal'

interface PageProps {
  params: Promise<{ slug: string }>
}

/** Statically generated: four documents that change on a release, not a request. */
export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  if (!isLegalSlug(slug)) return {}

  const document = LEGAL_DOCUMENTS[slug]
  return { title: document.title, description: document.lede }
}

export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params
  if (!isLegalSlug(slug)) notFound()

  const document = LEGAL_DOCUMENTS[slug]

  return (
    <>
      <ContentHeader eyebrow="Legal" title={document.title} lede={document.lede} />

      <ContentBody>
        <div className="grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Sibling documents ------------------------------------------------ */}
          <nav aria-label="Legal documents" className="lg:order-first">
            <div className="lg:sticky lg:top-24">
              <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
                {LEGAL_NAV.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/legal/${entry.slug}`}
                      aria-current={entry.slug === slug ? 'page' : undefined}
                      className={cn(
                        'block rounded-lg px-3 py-2 text-[13.5px] transition-colors',
                        entry.slug === slug
                          ? 'bg-surface-2 font-medium text-text'
                          : 'text-muted hover:bg-surface-1 hover:text-text'
                      )}
                    >
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-5 hidden border-t border-border pt-4 text-[12px] text-faint lg:block">
                Last updated{' '}
                <time dateTime={document.updated}>{formatDate(document.updated)}</time>
              </p>
            </div>
          </nav>

          <div>
            <Prose>
              {document.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </Prose>

            {/*
              Stated plainly and at the end, where someone who has read the
              document will see it. These pages describe what the software
              genuinely does — every claim is checkable against the code — but
              a binding contract depends on the operating entity, its
              jurisdiction and its insurance, none of which a codebase knows.
              A convincing-looking legal page nobody reviewed is worse than an
              honest one.
            */}
            <aside className="mt-12 max-w-[68ch] rounded-xl border border-border bg-surface-1 p-5">
              <p className="text-[13px] font-semibold text-text">About this document</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                It describes how this platform actually operates, and each statement
                about the software can be verified against its source. It has not been
                reviewed by a lawyer for a specific operating entity or jurisdiction,
                and it is not a substitute for one. Before running this commercially,
                have these terms reviewed against your entity, your jurisdiction and
                your insurance.
              </p>
              <p className="mt-3 text-[12.5px] text-faint lg:hidden">
                Last updated{' '}
                <time dateTime={document.updated}>{formatDate(document.updated)}</time>
              </p>
            </aside>

            <p className="mt-6 text-[13px] text-faint">
              Questions about any of this?{' '}
              <Link
                href="/contact"
                className="text-accent-text underline decoration-border underline-offset-[3px] hover:decoration-accent"
              >
                Get in touch
              </Link>
              .
            </p>
          </div>
        </div>
      </ContentBody>
    </>
  )
}
