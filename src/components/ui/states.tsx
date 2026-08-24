import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CloudOff,
  PackageSearch,
  RefreshCw,
  ServerCrash,
  SearchX,
  Timer,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, ButtonLink } from './button'

/**
 * Empty and error states.
 *
 * House rule: every state on this page ends with an action. An empty state
 * that only explains what went wrong is a dead end, and dead ends are where
 * B2B sessions terminate.
 */

export interface StateAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface StateProps {
  icon?: ReactNode
  title: string
  description: string
  primaryAction?: StateAction
  secondaryAction?: StateAction
  /** Rendered under the actions — suggestion chips, contact line, etc. */
  children?: ReactNode
  tone?: 'neutral' | 'danger'
  compact?: boolean
  className?: string
}

function ActionButton({
  action,
  variant,
}: {
  action: StateAction
  variant: 'primary' | 'secondary'
}) {
  if (action.href) {
    return (
      <ButtonLink href={action.href} variant={variant} size="sm">
        {action.label}
      </ButtonLink>
    )
  }
  return (
    <Button variant={variant} size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

export function StateBlock({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  tone = 'neutral',
  compact = false,
  className,
}: StateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-border bg-surface/50 text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className
      )}
    >
      <div
        className={cn(
          'mb-5 grid size-12 place-items-center rounded-full border',
          tone === 'danger'
            ? 'border-danger/25 bg-danger-soft text-danger'
            : 'border-border bg-surface-2 text-muted'
        )}
      >
        {icon ?? <PackageSearch className="size-5" aria-hidden />}
      </div>

      <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}

      {children && <div className="mt-6 w-full max-w-lg">{children}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Named states — one per real failure mode                                   */
/* -------------------------------------------------------------------------- */

export function NoResultsState({
  query,
  onClear,
  children,
}: {
  query?: string
  onClear?: () => void
  children?: ReactNode
}) {
  return (
    <StateBlock
      icon={<SearchX className="size-5" aria-hidden />}
      title="No products match those filters"
      description={
        query
          ? `Nothing in the catalogue matches “${query}” with your current filters. Try widening the price range or removing a specification.`
          : 'Nothing matches your current filters. Try removing one — specification filters narrow results fastest.'
      }
      primaryAction={onClear ? { label: 'Clear all filters', onClick: onClear } : undefined}
      secondaryAction={{ label: 'Ask the assistant instead', href: '/assistant' }}
    >
      {children}
    </StateBlock>
  )
}

export function UnparseableQueryState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateBlock
      icon={<PackageSearch className="size-5" aria-hidden />}
      title="I could not pin that down"
      description="I was not able to identify a product type from that description. Tell me what the item needs to do, and roughly where it will be installed — that is usually enough."
      primaryAction={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'Browse categories', href: '/categories' }}
      compact
    />
  )
}

/**
 * The one state here that is a notice rather than a dead end.
 *
 * It appears above working results — the offline engine ranked them — so it
 * deliberately has no fallback action when there is nothing to retry. Adding a
 * "browse products" link beneath a list of products would be noise.
 */
export function AiUnavailableState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateBlock
      icon={<CloudOff className="size-5" aria-hidden />}
      title="Assistant is running in offline mode"
      description="The language model is unreachable, so results are coming from the built-in matching engine. Ranking and specification matching still work — explanations will be briefer than usual."
      primaryAction={onRetry ? { label: 'Retry with AI', onClick: onRetry } : undefined}
      compact
    />
  )
}

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateBlock
      icon={<WifiOff className="size-5" aria-hidden />}
      title="Connection lost"
      description="We could not reach the server. Check your connection and try again — nothing you entered has been lost."
      primaryAction={onRetry ? { label: 'Retry', onClick: onRetry } : undefined}
      // Unconditional, unlike the retry above. Without it, a caller that
      // passes no handler renders a dead end — which is the one thing every
      // state in this file is supposed to avoid.
      secondaryAction={{ label: 'Browse products', href: '/products' }}
      tone="danger"
      compact
    />
  )
}

export function ServerErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateBlock
      icon={<ServerCrash className="size-5" aria-hidden />}
      title="Something broke on our side"
      description="This one is on us. The error has been logged. Try again in a moment, or contact support if it keeps happening."
      primaryAction={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      secondaryAction={{ label: 'Contact support', href: '/contact' }}
      tone="danger"
      compact
    />
  )
}

export function RateLimitedState({ retryAfterSeconds }: { retryAfterSeconds?: number }) {
  return (
    <StateBlock
      icon={<Timer className="size-5" aria-hidden />}
      title="Slow down a moment"
      description={
        retryAfterSeconds
          ? `You have made a lot of requests. Try again in ${retryAfterSeconds} seconds.`
          : 'You have made a lot of requests in a short window. Give it a moment and try again.'
      }
      secondaryAction={{ label: 'Browse products', href: '/products' }}
      compact
    />
  )
}

export function EmptySavedState() {
  return (
    <StateBlock
      icon={<PackageSearch className="size-5" aria-hidden />}
      title="Your shortlist is empty"
      description="Save products while you browse and they collect here, ready to compare side by side or send out as a single quotation request."
      primaryAction={{ label: 'Browse products', href: '/products' }}
      secondaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
    />
  )
}

export function EmptyComparisonState() {
  return (
    <StateBlock
      icon={<PackageSearch className="size-5" aria-hidden />}
      title="Nothing to compare yet"
      description="Pick two to four products and their specifications line up side by side, with a written summary of where they actually differ."
      primaryAction={{ label: 'Find products to compare', href: '/products' }}
    />
  )
}

/* -------------------------------------------------------------------------- */

/** Compact inline banner for non-blocking errors inside a populated view. */
export function InlineError({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-md border border-danger/25 bg-danger-soft px-4 py-3',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <p className="flex-1 text-sm text-text-2">{message}</p>
      {onRetry && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-3" aria-hidden />}
        >
          Retry
        </Button>
      )}
    </div>
  )
}
