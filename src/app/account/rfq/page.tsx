import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, FileText } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { RFQ_STATUS_LABELS } from '@/lib/domain/account'
import { formatDate, formatPrice, formatRelative, pluralize, RFQ_TONE } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Quotations' }

/**
 * Quotation requests.
 *
 * Sorted newest first, with quoted requests visually promoted — they are the
 * only status where the buyer is the one holding things up.
 */
export default async function RfqListPage() {
  const user = await requireUser('/account/rfq')

  const rfqs = await getActivityRepository().listRfqs(user.id)
  const catalog = getCatalogRepository()

  const productNames = new Map<string, string>()
  for (const rfq of rfqs) {
    for (const item of rfq.items) {
      if (productNames.has(item.productId)) continue
      const product = await catalog.findById(item.productId)
      if (product) productNames.set(item.productId, product.name)
    }
  }

  const quoted = rfqs.filter((rfq) => rfq.status === 'quoted')
  const open = rfqs.filter((rfq) => !['accepted', 'declined', 'expired'].includes(rfq.status))
  const totalQuoted = quoted.reduce((sum, rfq) => sum + (rfq.quotedTotal ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Quotations"
        description="One request can cover products from several suppliers. Responses arrive here and in your notifications."
        action={
          <ButtonLink href="/account/saved" leadingIcon={<FileText className="size-4" aria-hidden />}>
            New request
          </ButtonLink>
        }
      />

      {rfqs.length === 0 ? (
        <StateBlock
          title="No quotation requests yet"
          description="Shortlist what you need, then send one request covering all of it. Suppliers see only the lines you include."
          primaryAction={{ label: 'Browse products', href: '/products' }}
          secondaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total requests" value={rfqs.length} />
            <StatCard label="Open" value={open.length} />
            <StatCard
              label="Awaiting you"
              value={quoted.length}
              tone={quoted.length > 0 ? 'accent' : 'neutral'}
            />
            <StatCard
              label="Quoted value"
              value={totalQuoted > 0 ? formatPrice(totalQuoted) : '—'}
              hint="Excludes GST"
            />
          </div>

          <ul className="space-y-3">
            {rfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  href={`/account/rfq/${rfq.id}`}
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
                      <p className="mt-1 text-[12px] text-faint">
                        Raised {formatDate(rfq.createdAt)} · updated {formatRelative(rfq.updatedAt)}
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
                        {item.quotedUnitPrice != null && (
                          <span className="shrink-0 font-mono text-[12px] text-muted tnum">
                            {formatPrice(item.quotedUnitPrice)}/unit
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {rfq.messages.length > 0 && (
                    <p className="mt-3 text-[12px] text-muted">
                      {pluralize(rfq.messages.length, 'message')} from the supplier
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
