import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAuditRepository } from '@/server/repositories'
import { AUDIT_ACTIONS, type AuditAction } from '@/server/repositories/types'
import { AUDIT_LABELS } from '@/server/audit/record'
import { formatRelative, formatDateTime, pluralize } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, SectionCard, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Audit trail' }

/**
 * The audit trail.
 *
 * Admin-only rather than staff, because the log records what staff did — a
 * role that can read its own audit entries can check whether anyone noticed.
 *
 * Append-only: there is no edit or delete anywhere in the application, and the
 * repository exposes none. Retention is a scheduled database job, so an
 * operator cannot quietly remove a row about themselves.
 */

const PAGE_SIZE = 150

/** Entries whose appearance in a list should draw the eye. */
const NOTABLE: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'login_failure',
  'user_role_change',
  'password_reset',
  'export',
  'product_status_change',
])

function toneFor(action: AuditAction): 'warning' | 'accent' | 'neutral' {
  if (action === 'login_failure' || action === 'user_role_change') return 'warning'
  if (NOTABLE.has(action)) return 'accent'
  return 'neutral'
}

interface PageProps {
  searchParams: Promise<{ action?: string; target?: string }>
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  await requireRole('admin', '/admin/audit')

  const params = await searchParams
  const action = AUDIT_ACTIONS.includes(params.action as AuditAction)
    ? (params.action as AuditAction)
    : undefined

  const audit = getAuditRepository()

  const [entries, total, failures, exports] = await Promise.all([
    audit.list({
      ...(action ? { action } : {}),
      ...(params.target ? { targetId: params.target } : {}),
      limit: PAGE_SIZE,
    }),
    audit.count(),
    audit.count({ action: 'login_failure' }),
    audit.count({ action: 'export' }),
  ])

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every privileged action, append-only. Filter by what happened."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Entries" value={total.toLocaleString('en-IN')} />
        <StatCard
          label="Failed sign-ins"
          value={failures.toLocaleString('en-IN')}
          tone={failures > 0 ? 'accent' : 'neutral'}
        />
        <StatCard label="Data exports" value={exports.toLocaleString('en-IN')} />
      </div>

      {/* Filter ------------------------------------------------------------ */}
      <div className="mt-6 flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          className={cn(
            'rounded-full border px-3 py-1 text-[12px] transition-colors',
            action
              ? 'border-border text-muted hover:border-accent hover:text-text'
              : 'border-accent bg-accent-soft text-accent-text'
          )}
        >
          All
        </Link>
        {AUDIT_ACTIONS.map((entry) => (
          <Link
            key={entry}
            href={`/admin/audit?action=${entry}`}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] transition-colors',
              action === entry
                ? 'border-accent bg-accent-soft text-accent-text'
                : 'border-border text-muted hover:border-accent hover:text-text'
            )}
          >
            {AUDIT_LABELS[entry]}
          </Link>
        ))}
      </div>

      <SectionCard
        title={action ? AUDIT_LABELS[action] : 'Recent activity'}
        description={`${pluralize(entries.length, 'entry', 'entries')}${
          entries.length === PAGE_SIZE ? ' (most recent)' : ''
        }`}
        className="mt-4"
        padded={false}
      >
        {entries.length === 0 ? (
          <StateBlock
            icon={<ShieldAlert className="size-5" aria-hidden />}
            title="Nothing recorded yet"
            description={
              action
                ? 'No entries of this kind. Try another filter.'
                : 'Privileged actions appear here as they happen — product edits, quotation pricing, sign-ins and exports.'
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneFor(entry.action)} size="sm">
                        {AUDIT_LABELS[entry.action]}
                      </Badge>
                      <span className="text-[13.5px] text-text">{entry.summary}</span>
                    </div>

                    <p className="mt-1 text-[12px] text-muted">
                      {entry.actorEmail}
                      <span className="text-faint"> · {entry.actorRole}</span>
                      {entry.ipHash && (
                        // Hashed, not stored raw — enough to tell "same origin
                        // as last time" without holding an address.
                        <span
                          className="font-mono text-faint"
                          title="Salted hash of the client address"
                        >
                          {' '}
                          · {entry.ipHash.slice(0, 8)}
                        </span>
                      )}
                    </p>

                    {entry.changes && (
                      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {Object.entries(entry.changes).map(([field, change]) => (
                          <div key={field} className="flex items-baseline gap-1.5">
                            <dt className="font-mono text-[11px] text-faint">{field}</dt>
                            <dd className="font-mono text-[11px] text-muted">
                              <span className="line-through decoration-border">
                                {String(change.from ?? '—')}
                              </span>
                              {' → '}
                              <span className="text-text-2">{String(change.to ?? '—')}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>

                  <time
                    dateTime={entry.createdAt}
                    title={formatDateTime(entry.createdAt)}
                    className="shrink-0 text-[12px] text-faint tnum"
                  >
                    {formatRelative(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <p className="mt-4 text-[12px] leading-relaxed text-faint">
        Entries are written on a best-effort basis and never block the action
        they describe — a failed audit write must not roll back a completed
        edit. Client addresses are stored as a salted hash, never in the clear.
      </p>
    </>
  )
}
