import { Search, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { CONTACT } from '@/lib/site'

/**
 * Section 8 — Final call to action.
 *
 * One headline, two buttons, and a line that removes the last objection
 * (no account required). Nothing else — a closing section that reintroduces
 * navigation is a closing section that does not close.
 */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid opacity-50"
        style={{ maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-line to-transparent"
      />

      <div className="container-page relative py-20 text-center md:py-28 lg:py-32">
        <h2 className="mx-auto max-w-3xl font-display text-4xl leading-[1.06] font-bold tracking-[-0.03em] text-balance md:text-5xl lg:text-6xl">
          Stop searching. <span className="text-accent-text">Start finding.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
          Describe one requirement and see what comes back. It takes about
          twenty seconds, and you do not need an account to try it.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink
            href="/assistant"
            size="lg"
            leadingIcon={<Sparkles className="size-4" aria-hidden />}
          >
            Try the AI assistant
          </ButtonLink>
          <ButtonLink
            href="/products"
            size="lg"
            variant="outline"
            leadingIcon={<Search className="size-4" aria-hidden />}
          >
            Browse products
          </ButtonLink>
        </div>

        {/* Offered only when a real number is configured — a dead tel: link
            is worse than no invitation to call. */}
        {CONTACT.phone && (
          <p className="mt-8 text-[13px] text-faint">
            Prefer to talk to someone?{' '}
            <a
              href={`tel:${CONTACT.phoneHref}`}
              className="text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text hover:decoration-accent"
            >
              {CONTACT.phone}
            </a>{' '}
            · {CONTACT.hours}
          </p>
        )}
      </div>
    </section>
  )
}
