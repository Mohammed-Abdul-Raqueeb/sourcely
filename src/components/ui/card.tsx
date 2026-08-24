import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Surface primitives.
 *
 * Depth in this design system comes from borders and a one-step surface
 * change, not from drop shadows. `interactive` adds the hover treatment used
 * by anything clickable — a subtle border warm-up rather than a lift.
 */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `flat` for dense data regions, `raised` for standalone panels. */
  elevation?: 'flat' | 'raised'
  interactive?: boolean
  /** Removes internal padding so the caller controls it (e.g. media at top). */
  bleed?: boolean
}

export function Card({
  elevation = 'flat',
  interactive = false,
  bleed = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface',
        elevation === 'raised' && 'shadow-raise',
        !bleed && 'p-5',
        interactive &&
          'transition-[border-color,background-color,transform] duration-200 ease-out ' +
            'hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-snug font-semibold text-text">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * A hairline divider. `label` renders it as a captioned rule, used to break
 * up long spec tables without adding a heading level.
 */
export function Divider({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  if (!label) {
    return <hr className={cn('border-0 border-t border-border', className)} />
  }
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-0 border-t border-border" />
      <span className="text-[11px] font-semibold tracking-wider text-faint uppercase">
        {label}
      </span>
      <hr className="flex-1 border-0 border-t border-border" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Section heading used across marketing and app pages. `eyebrow` is the small
 * amber label that gives each homepage section an identity without needing a
 * decorative graphic.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  action?: ReactNode
  className?: string
}) {
  const centered = align === 'center'
  return (
    <div
      className={cn(
        'flex gap-6',
        centered ? 'flex-col items-center text-center' : 'flex-col md:flex-row md:items-end md:justify-between',
        className
      )}
    >
      <div className={cn('max-w-2xl', centered && 'mx-auto')}>
        {eyebrow && (
          <div
            className={cn(
              'mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-accent-text uppercase',
              centered && 'justify-center'
            )}
          >
            <span className="h-px w-6 bg-accent-line" aria-hidden />
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-3xl leading-[1.12] font-semibold tracking-tight text-balance md:text-4xl lg:text-[2.75rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-4 text-base leading-relaxed text-muted md:text-[17px]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
