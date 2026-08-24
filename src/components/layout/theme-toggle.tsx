'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Theme toggle.
 *
 * The initial theme is applied by the inline bootstrap script in the root
 * layout, before first paint. This component only reads what is already on
 * the document and writes changes back — it never decides the initial value,
 * because doing so in an effect guarantees a flash of the wrong theme.
 */

const STORAGE_KEY = 'sourcely-theme'

type Theme = 'dark' | 'light'

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    setTheme(current === 'light' ? 'light' : 'dark')
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Blocked storage: the theme still applies for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className={cn(
        'grid size-9 place-items-center rounded-md border border-transparent text-muted',
        'transition-colors hover:bg-surface-2 hover:text-text',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className
      )}
    >
      {/* Render the dark icon until mounted so server and client agree. */}
      {mounted && theme === 'light' ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  )
}
