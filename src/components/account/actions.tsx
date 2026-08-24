'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import type { Notification } from '@/lib/domain/account'
import {
  clearSearchHistoryAction,
  deleteSavedSearchAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  toggleSearchAlertsAction,
} from '@/server/actions/account'
import { Button, IconButton } from '@/components/ui/button'

/**
 * Small client islands for the account area.
 *
 * Each one wraps a single server action in `useTransition` so the control
 * disables itself while the mutation is in flight — without it, a double click
 * on "delete" fires twice and the second call 404s against a row that is
 * already gone.
 */

/* -------------------------------------------------------------------------- */

export function ClearHistoryButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        leadingIcon={<Trash2 className="size-3.5" aria-hidden />}
      >
        Clear history
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted">Delete all search history?</span>
      <Button
        variant="danger"
        size="xs"
        loading={pending}
        onClick={() => startTransition(() => void clearSearchHistoryAction())}
      >
        Delete
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function SavedSearchControls({
  id,
  alertsEnabled,
}: {
  id: string
  alertsEnabled: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(alertsEnabled)

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={enabled ? 'Turn off alerts for this search' : 'Alert me when new products match'}
        size="sm"
        disabled={pending}
        onClick={() => {
          const next = !enabled
          setEnabled(next)
          startTransition(() => void toggleSearchAlertsAction(id, next))
        }}
        className={enabled ? 'text-accent-text' : undefined}
      >
        {enabled ? <Bell className="size-4" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
      </IconButton>

      <IconButton
        label="Delete this saved search"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => void deleteSavedSearchAction(id))}
        className="hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function MarkAllReadButton({ unread }: { unread: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={unread === 0}
      loading={pending}
      onClick={() => startTransition(() => void markAllNotificationsReadAction())}
      leadingIcon={<Check className="size-3.5" aria-hidden />}
    >
      Mark all read
    </Button>
  )
}

/* -------------------------------------------------------------------------- */

const KIND_LABELS: Record<Notification['kind'], string> = {
  rfq_status: 'Quotation',
  rfq_message: 'Message',
  price_drop: 'Price',
  back_in_stock: 'Stock',
  saved_search_hit: 'Saved search',
  account: 'Account',
  system: 'System',
}

/**
 * A notification row that marks itself read when opened.
 *
 * Marking on click rather than on render is deliberate: a notification the
 * buyer scrolled past is not one they have read, and silently clearing the
 * badge loses them the thing they came back for.
 */
export function NotificationRow({ notification }: { notification: Notification }) {
  const [pending, startTransition] = useTransition()
  const [read, setRead] = useState(notification.read)

  function open() {
    if (read) return
    setRead(true)
    startTransition(() => void markNotificationReadAction(notification.id))
  }

  const body = (
    <div className="flex gap-3">
      <span
        className={cn(
          'mt-1.5 size-1.5 shrink-0 rounded-full',
          read ? 'bg-transparent' : 'bg-accent'
        )}
        aria-label={read ? undefined : 'Unread'}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
            {KIND_LABELS[notification.kind]}
          </span>
          <span className="text-[11px] text-faint">
            {formatRelative(notification.createdAt)}
          </span>
        </div>

        <p
          className={cn(
            'mt-1.5 text-[14px] leading-snug',
            read ? 'font-medium text-text-2' : 'font-semibold text-text'
          )}
        >
          {notification.title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{notification.body}</p>
      </div>
    </div>
  )

  const className = cn(
    'block px-5 py-4 transition-colors',
    !read && 'bg-accent-soft/25',
    notification.href && 'hover:bg-surface-2',
    pending && 'opacity-70'
  )

  if (!notification.href) {
    return <div className={className}>{body}</div>
  }

  return (
    <Link href={notification.href} onClick={open} className={className}>
      {body}
    </Link>
  )
}
