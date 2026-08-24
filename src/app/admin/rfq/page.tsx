import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, FileText } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { RFQ_STATUS_LABELS } from '@/lib/domain/account'
import {
  formatCompactINR,
  formatDate,
  formatPrice,
  formatRelative,
  pluralize,
  RFQ_TONE,
} from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Quotations' }

/**
 * Quotation queue.
 *
 * Sorted so the work comes first: anything awaiting a supplier response leads,
 * because every hour there is a buyer waiting. Everything else follows by
 * recency.
 */
export default async function AdminRfqPage() {
  await requireRole('staff', '/admin/rfq')

  const admin = getAdminRepository()
  const catalog = getCatalogRepository()

  const rfqs = await admin.listAllRfqs(200)

  const productNames = new Map<string, string>()
  for (const rfq of rfqs) {
    for (const item of rfq.items) {
      if (productNames.has(item.productId)) continue
      const product = await catalog.findById(item.productId)
      if (product) productNames.set(item.productId, product.name)
    }
  }

  const awaiting = new Set(['submitted', 'under_review'])
  const ordered = [...rfqs].sort((a, b) => {
    const aWaiting = awaiting.has(a.status) ? 0 : 1
    const bWaiting = awaiting.has(b.status) ? 0 : 1
    return aWaiting - bWaiting || b.updatedAt.localeCompare(a.updatedAt)
  })

  const quotedValue = rfqs.reduce((sum, rfq) => sum + (rfq.quotedTotal ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Requests raised by buyers. Anything awaiting a response is listed first."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={rfqs.length} icon={FileText} />
        <StatCard
          label="Awaiting response"
          value={rfqs.filter((rfq) => awaiting.has(rfq.status)).length}
          tone={rfqs.some((rfq) => awaiting.has(rfq.status)) ? 'accent' : 'neutral'}
        />
        <StatCard label="Quoted" value={rfqs.filter((rfq) => rfq.status === 'quoted').length} />
        <StatCard
          label="Quoted value"
          value={quotedValue > 0 ? formatCompactINR(quotedValue) : '—'}
          hint="Excludes GST"
        />
      </div>

      {ordered.length === 0 ? (
        <StateBlock
          title="No quotation requests yet"
          description="When a buyer sends a request from their shortlist it appears here for pricing."
          primaryAction={{ label: 'View catalogue', href: '/admin/products' }}
        />
      ) : (
        <ul className="space-y-3">
          {ordered.map((rfq) => (
            <li key={rfq.id}>
              <Link
                href={`/admin/rfq/${rfq.id}`}
                className="group block rounded-xl border border-border bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-mono text-[13px] font-semibold text-text tnum">
                      {rfq.reference}
                      <ArrowUpRight
                        className="size-3.5 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </p>
                    <p className="mt-1 text-[13px] text-text-2">
                      {rfq.contact.company}
                      <span className="text-faint"> · {rfq.contact.name}</span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-faint">
                      Raised {formatDate(rfq.createdAt)} · updated {formatRelative(rfq.updatedAt)}
                      {rfq.requiredByDate && ` · needed by ${formatDate(rfq.requiredByDate)}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {rfq.quotedTotal != null && (
                      <span className="font-mono text-[15px] font-semibold text-text tnum">
                        {formatPrice(rfq.quotedTotal)}
                      </span>
                    )}
                    <Badge tone={RFQ_TONE[rfq.status]} size="md" dot>
                      {RFQ_STATUS_LABELS[rfq.status]}
                    </Badge>
                  </div>
                </div>

                <ul className="mt-3.5 space-y-1 border-t border-border pt-3.5">
                  {rfq.items.map((item) => (
                    <li key={item.productId} className="flex items-baseline gap-2 text-[13px]">
                      <span className="font-mono text-faint tnum">{item.quantity}×</span>
                      <span className="min-w-0 flex-1 truncate text-text-2">
                        {productNames.get(item.productId) ?? item.productId}
                      </span>
                      <span className="shrink-0 font-mono text-[12px] tnum">
                        {item.quotedUnitPrice != null ? (
                          <span className="text-accent-text">
                            {formatPrice(item.quotedUnitPrice)}
                          </span>
                        ) : (
                          <span className="text-faint">unpriced</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {rfq.messages.length > 0 && (
                  <p className="mt-3 text-[12px] text-muted">
                    {pluralize(rfq.messages.length, 'message')} in thread
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
