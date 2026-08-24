import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Button system.
 *
 * `primary` is amber and is the only amber fill in the product. There should
 * be exactly one primary button visible in any viewport — if a screen needs
 * two, one of them is secondary.
 *
 * Hook-free by design so it renders in both server and client components.
 */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'link'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'select-none rounded-md transition-[background-color,border-color,color,box-shadow,transform] ' +
  'duration-150 ease-out active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-45 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-raise hover:bg-accent-hover ' +
    'border border-transparent',
  secondary:
    'bg-surface-2 text-text border border-border ' +
    'hover:bg-surface-3 hover:border-border-strong',
  outline:
    'bg-transparent text-text border border-border-strong ' +
    'hover:bg-surface-2 hover:border-accent-line',
  ghost:
    'bg-transparent text-text-2 border border-transparent ' +
    'hover:bg-surface-2 hover:text-text',
  danger:
    'bg-danger text-white border border-transparent hover:brightness-110 shadow-raise',
  link:
    'bg-transparent border-0 text-accent-text underline-offset-4 hover:underline px-0 h-auto',
}

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-sm',
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
}

export interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleProps = {}): string {
  return cn(BASE, VARIANTS[variant], variant !== 'link' && SIZES[size], fullWidth && 'w-full')
}

/* -------------------------------------------------------------------------- */

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleProps {
  /** Swaps the label for a spinner and blocks interaction. */
  loading?: boolean
  /** Rendered before the label; hidden while loading. */
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        leadingIcon
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    ButtonStyleProps {
  href: string
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  /** Bypasses the client router — use for downloads and external targets. */
  external?: boolean
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  children,
  external = false,
  ...props
}: ButtonLinkProps) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className)

  if (external) {
    return (
      <a
        href={href}
        className={classes}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {leadingIcon}
        {children}
        {trailingIcon}
      </a>
    )
  }

  return (
    <Link href={href} className={classes} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  )
}

/* -------------------------------------------------------------------------- */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — icon-only controls must still be announced. */
  label: string
  variant?: Exclude<ButtonVariant, 'link'>
  size?: Exclude<ButtonSize, 'lg'>
  children: ReactNode
}

const ICON_SIZES: Record<'xs' | 'sm' | 'md', string> = {
  xs: 'size-7 rounded-sm',
  sm: 'size-9',
  md: 'size-11',
}

export function IconButton({
  label,
  variant = 'ghost',
  size = 'sm',
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(BASE, VARIANTS[variant], ICON_SIZES[size], 'p-0', className)}
      {...props}
    >
      {children}
    </button>
  )
}
