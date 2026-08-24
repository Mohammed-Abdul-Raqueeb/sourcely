import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shell for the site's written pages — about, pricing, contact, FAQ, legal.
 *
 * These pages have one job the catalogue does not: they are read linearly, so
 * the measure is capped at roughly 68 characters and the vertical rhythm is
 * set once here rather than per page. Ten pages each inventing their own
 * heading sizes is how a site starts looking assembled rather than designed.
 */

export function ContentHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string
  title: string
  lede?: string
}) {
  return (
    <header className="border-b border-border bg-surface-1">
      <div className="container-page py-14 md:py-20">
        {eyebrow && (
          <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-accent-text uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl font-display text-3xl leading-[1.12] font-semibold tracking-tight text-balance text-text md:text-[2.75rem]">
          {title}
        </h1>
        {lede && (
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">{lede}</p>
        )}
      </div>
    </header>
  )
}

/**
 * Long-form body copy.
 *
 * Tailwind's typography plugin is not installed, and pulling it in for six
 * pages would mean a second, parallel type scale to keep in step with the
 * design tokens. These rules are the subset those pages actually use.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[68ch] text-[15px] leading-[1.75] text-text-2',
        '[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text',
        '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-text',
        '[&_p]:mb-4',
        '[&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:pl-5',
        '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5',
        // Markers drawn with a pseudo-element rather than list-style, so they
        // take the accent colour and align to the first line's cap height.
        '[&_ul>li]:relative [&_ul>li]:list-none',
        "[&_ul>li]:before:absolute [&_ul>li]:before:top-[0.68em] [&_ul>li]:before:-left-4 [&_ul>li]:before:size-1 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-accent/70 [&_ul>li]:before:content-['']",
        '[&_a]:text-accent-text [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-[3px] [&_a:hover]:decoration-accent',
        '[&_strong]:font-semibold [&_strong]:text-text',
        '[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-text-2',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ContentBody({ children }: { children: ReactNode }) {
  return <div className="container-page section-y">{children}</div>
}

/**
 * A short note set apart from the body.
 *
 * Used where a page has to say something about itself — that a policy needs
 * legal review, that a contact detail is unset — rather than about its
 * subject. Visually distinct so it never reads as part of the argument.
 */
export function Aside({
  title,
  children,
  tone = 'neutral',
}: {
  title?: string
  children: ReactNode
  tone?: 'neutral' | 'accent'
}) {
  return (
    <aside
      className={cn(
        'my-8 max-w-[68ch] rounded-xl border p-5',
        tone === 'accent' ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface-1'
      )}
    >
      {title && <p className="mb-1.5 text-[13px] font-semibold text-text">{title}</p>}
      <div className="text-[13.5px] leading-relaxed text-muted">{children}</div>
    </aside>
  )
}
