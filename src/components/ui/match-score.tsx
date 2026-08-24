import { Check, Circle, Minus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MATCH_BAND_LABELS, matchBand } from '@/lib/format'
import type { CriterionOutcome, CriterionStatus, MatchExplanation } from '@/lib/domain/search'

/**
 * Match score presentation.
 *
 * The number rendered here is computed in `src/server/catalog/scoring.ts` — it
 * is never produced by a language model. That is the whole reason it is safe
 * to put a precise-looking figure in front of a buyer.
 *
 * Band colours: excellent = amber (the brand signal), strong = neutral text,
 * fair = muted. Only the best matches earn the accent colour; if every card
 * glows amber the signal is worthless.
 */

const BAND_RING: Record<ReturnType<typeof matchBand>, string> = {
  excellent: 'text-accent',
  strong: 'text-success',
  fair: 'text-muted',
}

const BAND_TEXT: Record<ReturnType<typeof matchBand>, string> = {
  excellent: 'text-accent-text',
  strong: 'text-success',
  fair: 'text-muted',
}

export function MatchRing({
  percent,
  size = 44,
  strokeWidth = 3,
  className,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const band = matchBand(percent)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (percent / 100) * circumference

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percent} percent match`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn('transition-[stroke-dasharray] duration-700 ease-out', BAND_RING[band])}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 grid place-items-center font-mono font-semibold tnum',
          BAND_TEXT[band]
        )}
        style={{ fontSize: size * 0.28 }}
      >
        {percent}
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/** Horizontal badge form, used on product cards inside search results. */
export function MatchBadge({
  percent,
  showLabel = true,
  className,
}: {
  percent: number
  showLabel?: boolean
  className?: string
}) {
  const band = matchBand(percent)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2 py-1',
        band === 'excellent'
          ? 'border-accent-line bg-accent-soft'
          : 'border-border bg-surface-2',
        className
      )}
    >
      <span
        className={cn('font-mono text-xs font-semibold tnum', BAND_TEXT[band])}
      >
        {percent}%
      </span>
      {showLabel && (
        <span className="text-[11px] font-medium text-muted">
          {MATCH_BAND_LABELS[band]}
        </span>
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

const CRITERION_ICON: Record<CriterionStatus, typeof Check> = {
  match: Check,
  partial: Minus,
  miss: X,
  unknown: Circle,
}

const CRITERION_STYLE: Record<CriterionStatus, string> = {
  match: 'text-success',
  partial: 'text-warning',
  miss: 'text-danger',
  unknown: 'text-faint',
}

const CRITERION_LABEL: Record<CriterionStatus, string> = {
  match: 'Matches',
  partial: 'Close',
  miss: 'Does not match',
  unknown: 'Not specified',
}

export function CriterionRow({ criterion }: { criterion: CriterionOutcome }) {
  const Icon = CRITERION_ICON[criterion.status]
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        className={cn('mt-0.5 shrink-0', CRITERION_STYLE[criterion.status])}
        title={CRITERION_LABEL[criterion.status]}
      >
        <Icon className="size-3.5" aria-hidden />
        <span className="sr-only">{CRITERION_LABEL[criterion.status]}</span>
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
        <span className="text-muted">{criterion.label}: </span>
        <span className={cn(criterion.status === 'miss' ? 'text-muted line-through' : 'text-text-2')}>
          {criterion.actual ?? 'not stated'}
        </span>
        {criterion.note && <span className="text-faint"> — {criterion.note}</span>}
      </span>
    </li>
  )
}

/**
 * The full "Why AI recommends this" panel. Shows misses as well as matches —
 * hiding a miss to inflate the score is exactly the behaviour that destroys
 * trust in a recommendation surface.
 */
export function MatchExplanationPanel({
  explanation,
  title = 'Why this matches',
  className,
}: {
  explanation: MatchExplanation
  title?: string
  className?: string
}) {
  const band = matchBand(explanation.matchPercent)

  return (
    <section
      className={cn(
        'rounded-lg border bg-surface',
        band === 'excellent' ? 'border-accent-line' : 'border-border',
        className
      )}
    >
      <header className="flex items-start gap-4 border-b border-border p-4">
        <MatchRing percent={explanation.matchPercent} size={52} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {explanation.headline}
          </p>
        </div>
      </header>

      <div className="p-4">
        <p className="text-[13px] leading-relaxed text-text-2">{explanation.summary}</p>

        {explanation.criteria.length > 0 && (
          <ul className="mt-3 divide-y divide-border/60 border-t border-border/60 pt-1">
            {explanation.criteria.map((criterion) => (
              <CriterionRow key={criterion.key} criterion={criterion} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Score component breakdown. Surfaced in the admin ranking inspector rather
 * than to buyers — buyers want the reason, operators want the arithmetic.
 */
export function ScoreBreakdown({ explanation }: { explanation: MatchExplanation }) {
  const max = Math.max(...explanation.components.map((c) => c.weight), 0.001)

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
          <th className="pb-2 font-semibold">Component</th>
          <th className="pb-2 text-right font-semibold">Raw</th>
          <th className="pb-2 text-right font-semibold">Weight</th>
          <th className="pb-2 text-right font-semibold">Contribution</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {explanation.components.map((component) => (
          <tr key={component.key}>
            <td className="py-2 text-text-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 rounded-full bg-accent/60"
                  style={{ width: `${Math.max(4, (component.weight / max) * 40)}px` }}
                  aria-hidden
                />
                {component.label}
              </div>
            </td>
            <td className="py-2 text-right font-mono text-muted tnum">
              {component.raw.toFixed(2)}
            </td>
            <td className="py-2 text-right font-mono text-muted tnum">
              {component.weight.toFixed(2)}
            </td>
            <td className="py-2 text-right font-mono font-medium text-text tnum">
              {component.weighted.toFixed(3)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
