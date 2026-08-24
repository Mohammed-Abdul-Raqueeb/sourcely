import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 * Every primitive in `src/components/ui` accepts `className` and funnels it
 * through here, so a caller can always override a default without `!important`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
