import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository } from '@/server/repositories'
import { formatDate, formatRelative, initials, pluralize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Customers' }

/**
 * Customer directory.
 *
 * Read-only by design in this phase. Editing another person's profile from an
 * admin console is a privileged write that needs an audit trail before it
 * needs a form, and there is no audit log yet — see the Phase 6 notes.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  await requireRole('staff', '/admin/customers')
  const { q, role } = await searchParams

  const admin = getAdminRepository()
  const [users, rfqs] = await Promise.all([admin.listUsers(500), admin.listAllRfqs(500)])

  const rfqCounts = new Map<string, number>()
  for (const rfq of rfqs) {
    if (!rfq.userId) continue
    rfqCounts.set(rfq.userId, (rfqCounts.get(rfq.userId) ?? 0) + 1)
  }

  const needle = q?.trim().toLowerCase() ?? ''
  const filtered = users
    .filter((user) => (role ? user.role === role : true))
    .filter((user) =>
      needle
        ? user.name.toLowerCase().includes(needle) ||
          user.email.toLowerCase().includes(needle) ||
          (user.company ?? '').toLowerCase().includes(needle)
        : true
    )

  const week = Date.now() - 7 * 86_400_000

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${pluralize(users.length, 'account')} registered`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Accounts" value={users.length} icon={Users} />
        <StatCard
          label="Active this week"
          value={users.filter((u) => new Date(u.lastActiveAt).getTime() >= week).length}
        />
        <StatCard
          label="New this week"
          value={users.filter((u) => new Date(u.createdAt).getTime() >= week).length}
        />
        <StatCard
          label="With quotations"
          value={rfqCounts.size}
          hint="Accounts that have raised at least one"
        />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search name, email or company"
            aria-label="Search customers"
            className="h-9 w-full rounded-md border border-border bg-surface-2 pr-3 pl-10 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hover"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin/customers"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-[13px] text-muted hover:text-text"
          >
            Clear
          </Link>
        )}
      </form>

      {filtered.length === 0 ? (
        <StateBlock
          title="No customers match"
          description="Nothing matches that search. Clear it to see every account."
          primaryAction={{ label: 'Clear search', href: '/admin/customers' }}
          compact
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface scrollbar-slim">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                <th scope="col" className="px-3 py-3 font-semibold">Company</th>
                <th scope="col" className="px-3 py-3 font-semibold">Role</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Quotations</th>
                <th scope="col" className="px-3 py-3 text-right font-semibold">Joined</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 font-mono text-[10px] font-semibold text-text-2">
                        {initials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-text">{user.name}</p>
                        <p className="truncate font-mono text-[11px] text-faint">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-muted">
                    {user.company ?? '—'}
                    {user.gstin && (
                      <p className="font-mono text-[11px] text-faint tnum">{user.gstin}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={user.role === 'customer' ? 'neutral' : 'accent'} size="sm">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] text-text-2 tnum">
                    {rfqCounts.get(user.id) ?? 0}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] text-faint tnum">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] text-muted">
                    {formatRelative(user.lastActiveAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        Password hashes never leave the repository layer — this view receives a
        projection without them.
      </p>
    </>
  )
}
