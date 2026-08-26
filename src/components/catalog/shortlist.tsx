'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { toggleSavedAction } from '@/server/actions/account'
import { MAX_COMPARE } from '@/lib/compare'
import type { Role } from '@/lib/domain/account'

/**
 * Shortlist and comparison tray.
 *
 * One shortlist, two backing stores, reconciled here:
 *
 *   signed out  →  `localStorage`, so a visitor can collect products before
 *                  they have an account
 *   signed in   →  the server, so the shortlist follows them between devices
 *
 * On mount the provider paints from `localStorage` immediately (no flash of an
 * empty bookmark icon), then asks `/api/account/shortlist` who the caller is.
 * If a session exists, the server list becomes the source of truth and every
 * later toggle is written through to it.
 *
 * That fetch is the reason the marketing pages can stay statically generated —
 * reading the session in the layout would make every product page dynamic.
 *
 * Every storage access is wrapped: `localStorage` throws outright in some
 * privacy modes rather than returning null.
 */

const SAVED_KEY = 'sourcely.saved.v1'
const COMPARE_KEY = 'sourcely.compare.v1'

// Re-exported so existing client imports keep working. Server Components
// must import it from '@/lib/compare' directly — see the note in that file.
export { MAX_COMPARE }

/**
 * Display-only identity for the signed-in visitor, delivered by the same
 * post-mount reconcile that syncs the shortlist. Drives the header's account
 * state on statically-generated pages; it authorizes nothing — every
 * privileged surface re-checks the session server-side.
 */
export interface SessionIdentity {
  name: string
  role: Role
}

interface ShortlistValue {
  saved: string[]
  compare: string[]
  /** False until storage has been read — gates count badges to avoid hydration mismatch. */
  ready: boolean
  /** True once the server confirmed a session; toggles then write through. */
  synced: boolean
  /** The signed-in visitor, or null while unknown / signed out. */
  user: SessionIdentity | null
  isSaved: (id: string) => boolean
  isComparing: (id: string) => boolean
  toggleSaved: (id: string) => void
  toggleCompare: (id: string) => CompareResult
  removeCompare: (id: string) => void
  clearCompare: () => void
  clearSaved: () => void
}

export type CompareResult = 'added' | 'removed' | 'full'

const ShortlistContext = createContext<ShortlistValue | null>(null)

function read(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function write(key: string, value: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked. In-memory state still works for this session.
  }
}

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([])
  const [compare, setCompare] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [synced, setSynced] = useState(false)
  const [user, setUser] = useState<SessionIdentity | null>(null)

  // Read synchronously on first client render so the icons paint correct.
  useEffect(() => {
    setSaved(read(SAVED_KEY))
    setCompare(read(COMPARE_KEY))
    setReady(true)
  }, [])

  // Then reconcile against the server — on mount, on every route change, and
  // whenever the tab becomes visible again. The provider outlives client-side
  // navigations, so a one-shot fetch would freeze whatever identity it caught
  // first: sign out, and the header keeps greeting the previous user until a
  // hard reload. The endpoint is `no-store` and the payload is tiny, so the
  // refetch is cheap and never stale.
  const pathname = usePathname()
  useEffect(() => {
    const controller = new AbortController()

    function reconcile() {
      fetch('/api/account/shortlist', { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { saved: string[] | null; user?: SessionIdentity | null } | null) => {
          if (!payload) return
          // Identity is authoritative on every response: a signed-out payload
          // must CLEAR the header, not be ignored. The old early-return above
          // the assignment was the bug that made a logged-out session keep
          // its previous name.
          setUser(payload.user ?? null)
          if (payload.saved === null) {
            setSynced(false)
            return
          }
          setSynced(true)
          setSaved(payload.saved)
          write(SAVED_KEY, payload.saved)
        })
        .catch(() => {
          // Offline — the local shortlist stands.
        })
    }

    reconcile()

    function onVisible() {
      if (document.visibilityState === 'visible') reconcile()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      controller.abort()
    }
  }, [pathname])

  // Keep multiple tabs consistent — a shortlist that disagrees with itself
  // across two tabs is a bug the user will notice before we do.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === SAVED_KEY) setSaved(read(SAVED_KEY))
      if (event.key === COMPARE_KEY) setCompare(read(COMPARE_KEY))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const syncedRef = useRef(synced)
  syncedRef.current = synced

  const toggleSaved = useCallback((id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((v) => v !== id) : [id, ...current]
      write(SAVED_KEY, next)
      return next
    })

    if (syncedRef.current) {
      // Fire and forget: the optimistic update above is what the user sees,
      // and a failed write is corrected by the next reconcile on mount.
      void toggleSavedAction(id).catch(() => {})
    }
  }, [])

  const toggleCompare = useCallback((id: string): CompareResult => {
    let outcome: CompareResult = 'added'
    setCompare((current) => {
      if (current.includes(id)) {
        outcome = 'removed'
        const next = current.filter((v) => v !== id)
        write(COMPARE_KEY, next)
        return next
      }
      if (current.length >= MAX_COMPARE) {
        outcome = 'full'
        return current
      }
      const next = [...current, id]
      write(COMPARE_KEY, next)
      return next
    })
    return outcome
  }, [])

  const removeCompare = useCallback((id: string) => {
    setCompare((current) => {
      const next = current.filter((v) => v !== id)
      write(COMPARE_KEY, next)
      return next
    })
  }, [])

  const clearCompare = useCallback(() => {
    setCompare([])
    write(COMPARE_KEY, [])
  }, [])

  const clearSaved = useCallback(() => {
    setSaved((current) => {
      if (syncedRef.current) {
        for (const id of current) void toggleSavedAction(id).catch(() => {})
      }
      return []
    })
    write(SAVED_KEY, [])
  }, [])

  const value = useMemo<ShortlistValue>(
    () => ({
      saved,
      compare,
      ready,
      synced,
      user,
      isSaved: (id) => saved.includes(id),
      isComparing: (id) => compare.includes(id),
      toggleSaved,
      toggleCompare,
      removeCompare,
      clearCompare,
      clearSaved,
    }),
    [saved, compare, ready, synced, user, toggleSaved, toggleCompare, removeCompare, clearCompare, clearSaved]
  )

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>
}

export function useShortlist(): ShortlistValue {
  const context = useContext(ShortlistContext)
  if (!context) {
    throw new Error('useShortlist must be used inside <ShortlistProvider>')
  }
  return context
}
