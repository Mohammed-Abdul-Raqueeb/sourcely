import Link from 'next/link'
import { cn } from '@/lib/cn'
import { SITE } from '@/lib/site'

/**
 * Sourcely mark.
 *
 * A hexagon — the fastener profile every one of these categories has in
 * common — with a flow arrow passing through it. Industrial and directional,
 * which is what "sourcing" is. The arrow is the only amber element.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('size-8 shrink-0', className)}
    >
      <path
        d="M16 2.6 27.6 9.3v13.4L16 29.4 4.4 22.7V9.3L16 2.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        className="text-text"
      />
      <path
        d="M16 8.4 22.6 12.2v7.6L16 23.6 9.4 19.8v-7.6L16 8.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        className="text-border-strong"
      />
      <path
        d="M10.5 16h9m0 0-3.4-3.4M19.5 16l-3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
    </svg>
  )
}

export function Logo({
  className,
  href = '/',
  showWordmark = true,
}: {
  className?: string
  href?: string
  showWordmark?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-85',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
        className
      )}
      aria-label={`${SITE.name} home`}
    >
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-[19px] leading-none font-bold tracking-[-0.02em] text-text">
          {SITE.name}
        </span>
      )}
    </Link>
  )
}
