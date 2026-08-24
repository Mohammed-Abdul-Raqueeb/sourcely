import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Account-area building blocks.
 *
 * The charts here are hand-drawn SVG rather than a charting library. Three
 * reasons: the shapes needed are a bar column and a sparkline, a library costs
 * ~90 kB of client JavaScript for that, and these render on the server with no
 * hydration at all.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  href?: string
  tone?: 'neutral' | 'accent'
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</p>
        {Icon && (
          <Icon
            className={cn('size-4 shrink-0', tone === 'accent' ? 'text-accent' : 'text-faint')}
            aria-hidden
          />
        )}
      </div>

      <p
        className={cn(
          'mt-3 font-mono text-2xl font-semibold tnum',
          tone === 'accent' ? 'text-accent-text' : 'text-text'
        )}
      >
        {value}
      </p>

      {hint && <p className="mt-1 text-[12px] leading-snug text-faint">{hint}</p>}

      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-accent-text">
          View
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      )}
    </>
  )

  const className = cn(
    'group rounded-xl border bg-surface p-4 transition-[border-color,transform] duration-200',
    tone === 'accent' ? 'border-accent-line' : 'border-border',
    href && 'hover:-translate-y-0.5 hover:border-border-strong'
  )

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/* -------------------------------------------------------------------------- */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface', className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                     */
/* -------------------------------------------------------------------------- */

export interface BarDatum {
  label: string
  value: number
  /** Short label under the bar. Falls back to `label`. */
  short?: string
}

/**
 * Vertical bar column.
 *
 * Bars are drawn as divs rather than SVG so they inherit the type scale and
 * the theme tokens without any coordinate maths. The tallest bar is the
 * accent; the rest recede, which is the whole job of this chart — showing
 * which bucket is the outlier.
 */
export function BarChart({
  data,
  height = 120,
  valueSuffix = '',
}: {
  data: BarDatum[]
  height?: number
  valueSuffix?: string
}) {
  const max = Math.max(...data.map((entry) => entry.value), 1)
  const peak = data.reduce<BarDatum | undefined>(
    (best, entry) => (best == null || entry.value > best.value ? entry : best),
    undefined
  )

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Activity by day">
        {data.map((entry) => {
          const ratio = entry.value / max
          const isPeak = entry.label === peak?.label && entry.value > 0

          return (
            // `h-full` is load-bearing: the container is `items-end`, so
            // without it this column sizes to its content and the bar's
            // percentage height resolves against `auto` — rendering nothing.
            <div key={entry.label} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-t-sm transition-colors',
                  entry.value === 0
                    ? 'bg-border/60'
                    : isPeak
                      ? 'bg-accent'
                      : 'bg-surface-3 group-hover:bg-border-strong'
                )}
                style={{ height: `${Math.max(entry.value === 0 ? 3 : 8, ratio * 100)}%` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-text opacity-0 transition-opacity group-hover:opacity-100 tnum">
                {entry.value}
                {valueSuffix}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {data.map((entry) => (
          <span
            key={entry.label}
            className="flex-1 text-center font-mono text-[10px] text-faint tnum"
          >
            {entry.short ?? entry.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Horizontal breakdown bar. Used where the question is "what share", not
 * "how did it change" — search modes, RFQ statuses, category mix.
 */
export function ShareBar({
  segments,
}: {
  segments: { label: string; value: number; className: string }[]
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) {
    return <div className="h-2 rounded-full bg-border" aria-hidden />
  }

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-border">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${(segment.value / total) * 100}%` }}
            aria-hidden
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <li key={segment.label} className="flex items-center gap-2 text-[12px]">
              <span className={cn('size-2 shrink-0 rounded-full', segment.className)} aria-hidden />
              <span className="flex-1 text-muted">{segment.label}</span>
              <span className="font-mono text-text-2 tnum">{segment.value}</span>
              <span className="w-9 text-right font-mono text-faint tnum">
                {Math.round((segment.value / total) * 100)}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}
