import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Form controls.
 *
 * React 19 passes `ref` as an ordinary prop, so none of these need
 * `forwardRef`. They stay hook-free and render in server components.
 */

const CONTROL_BASE =
  'w-full rounded-md border border-border bg-surface-2 text-text ' +
  'placeholder:text-faint ' +
  'transition-[border-color,box-shadow,background-color] duration-150 ' +
  'hover:border-border-strong ' +
  'focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const CONTROL_INVALID =
  'border-danger/50 focus:border-danger focus:ring-danger/20'

/* -------------------------------------------------------------------------- */

export interface FieldProps {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

/** Label + control + hint/error. Error replaces hint rather than stacking. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[13px] font-medium text-text-2"
        >
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  leadingIcon?: ReactNode
  trailingSlot?: ReactNode
  ref?: Ref<HTMLInputElement>
}

const INPUT_SIZES = {
  sm: 'h-9 text-sm',
  md: 'h-11 text-sm',
  lg: 'h-13 text-base',
} as const

export function Input({
  invalid,
  inputSize = 'md',
  leadingIcon,
  trailingSlot,
  className,
  ...props
}: InputProps) {
  const control = (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        INPUT_SIZES[inputSize],
        leadingIcon ? 'pl-10' : 'pl-3.5',
        trailingSlot ? 'pr-11' : 'pr-3.5',
        invalid && CONTROL_INVALID,
        className
      )}
      {...props}
    />
  )

  if (!leadingIcon && !trailingSlot) return control

  return (
    <div className="relative">
      {leadingIcon && (
        <span
          className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-faint"
          aria-hidden
        >
          {leadingIcon}
        </span>
      )}
      {control}
      {trailingSlot && (
        <span className="absolute inset-y-0 right-1.5 grid place-items-center">
          {trailingSlot}
        </span>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        'resize-y px-3.5 py-2.5 text-sm leading-relaxed',
        invalid && CONTROL_INVALID,
        className
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  selectSize?: 'sm' | 'md'
  ref?: Ref<HTMLSelectElement>
}

export function Select({
  invalid,
  selectSize = 'md',
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          'cursor-pointer appearance-none pr-9 pl-3.5',
          selectSize === 'sm' ? 'h-9 text-sm' : 'h-11 text-sm',
          invalid && CONTROL_INVALID,
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  /** Right-aligned muted count, used by facet lists. */
  count?: number
  ref?: Ref<HTMLInputElement>
}

export function Checkbox({ label, count, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded px-1 py-1.5 -mx-1',
        'transition-colors hover:bg-surface-2',
        props.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
        className
      )}
    >
      <input
        type="checkbox"
        className={cn(
          'size-4 shrink-0 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface-2',
          'transition-[background-color,border-color] duration-150',
          'checked:border-accent checked:bg-accent',
          "checked:bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2317110a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M3 8.5l3.2 3.2L13 5'/></svg>\")] checked:bg-center checked:bg-no-repeat",
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed'
        )}
        {...props}
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-2 group-hover:text-text">
        {label}
      </span>
      {count != null && (
        <span className="shrink-0 font-mono text-[11px] text-faint tnum">{count}</span>
      )}
    </label>
  )
}

/* -------------------------------------------------------------------------- */

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: string
  ref?: Ref<HTMLInputElement>
}

export function Radio({ label, description, className, ...props }: RadioProps) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-2.5 rounded px-1 py-1.5 -mx-1',
        'transition-colors hover:bg-surface-2',
        className
      )}
    >
      <input
        type="radio"
        className={cn(
          'mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-border-strong bg-surface-2',
          'transition-[background-color,border-color,box-shadow] duration-150',
          'checked:border-accent checked:bg-accent checked:shadow-[inset_0_0_0_3px_var(--surface-2)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
        {...props}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-text-2 group-hover:text-text">{label}</span>
        {description && <span className="block text-xs text-faint">{description}</span>}
      </span>
    </label>
  )
}
