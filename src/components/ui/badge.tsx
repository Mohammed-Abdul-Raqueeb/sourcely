import type { HTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Badge  — static status label. Never interactive.
 * Chip   — a filter or intent token. Removable, therefore interactive.
 *
 * The distinction matters: a user learns quickly that a chip can be dismissed
 * and a badge cannot. Blurring the two makes the AI filter chips feel unsafe
 * to touch.
 */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  accent: 'bg-accent-soft text-accent-text border-accent-line',
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  info: 'bg-info-soft text-info border-info/25',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: 'sm' | 'md'
  /** Renders a filled 6px dot in the current tone before the label. */
  dot?: boolean
  icon?: ReactNode
}

export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'h-6 px-2.5 text-[11px]' : 'h-7 px-3 text-xs',
        TONES[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

export interface ChipProps {
  children: ReactNode
  /** Small qualifier rendered before the value, e.g. `Material`. */
  qualifier?: string
  tone?: Tone
  onRemove?: () => void
  /** Label for the remove control — required when `onRemove` is provided. */
  removeLabel?: string
  /**
   * Below 0.7 the chip renders with a dashed border, signalling the value was
   * inferred rather than stated. Users trust an AI more when it admits
   * which parts it guessed.
   */
  confidence?: number
  className?: string
}

export function Chip({
  children,
  qualifier,
  tone = 'accent',
  onRemove,
  removeLabel,
  confidence = 1,
  className,
}: ChipProps) {
  const inferred = confidence < 0.7

  return (
    <span
      className={cn(
        'group inline-flex h-8 items-center gap-1.5 rounded-md border pl-2.5 text-xs font-medium',
        onRemove ? 'pr-1' : 'pr-2.5',
        inferred ? 'border-dashed' : 'border-solid',
        TONES[tone],
        className
      )}
      title={inferred ? 'Inferred from your description — remove if wrong' : undefined}
    >
      {qualifier && (
        <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">
          {qualifier}
        </span>
      )}
      <span className="text-text">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove filter`}
          className={cn(
            'ml-0.5 grid size-5 place-items-center rounded text-muted',
            'transition-colors hover:bg-surface-3 hover:text-text',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'
          )}
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * A key–value pill for dense spec display on cards, e.g. `SS316 · DN50`.
 * Monospaced value so a column of cards stays visually aligned.
 */
export function SpecPill({
  label,
  value,
  className,
}: {
  label?: string
  value: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-1.5 py-0.5',
        'font-mono text-[11px] tracking-tight text-text-2 tnum',
        className
      )}
    >
      {label && <span className="text-faint">{label}</span>}
      {value}
    </span>
  )
}
